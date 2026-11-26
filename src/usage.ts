import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface UseEvent {
  skill: string;
  outcome: 'success' | 'partial' | 'failed';
  agent?: string;
  session?: string;
  problem?: string;
}

export interface UsageRow {
  id: string;
  skill: string;
  outcome: string;
  agent: string;
  session: string;
  problem: string;
  created_at: string;
}

export interface StatsRow {
  skill: string;
  uses: number;
  success: number;
  partial: number;
  failed: number;
  success_rate: number;
  last_used_at: string;
}

function defaultDbPath(): string {
  const base = process.env.SKILLHUB_DATA_DIR ?? resolve(process.env.HOME ?? '.', '.local/state/skillhub');
  return resolve(base, 'usage.sqlite');
}

export class UsageStore {
  private readonly db: DatabaseSync;

  constructor(path: string = defaultDbPath()) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`CREATE TABLE IF NOT EXISTS usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('success','partial','failed')),
      agent TEXT NOT NULL DEFAULT '',
      session TEXT NOT NULL DEFAULT '',
      problem TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_usage_skill_created ON usage(skill, created_at DESC)');
  }

  record(event: UseEvent): void {
    if (!event.skill || !event.outcome) throw new Error('skill and outcome are required');
    if (!['success', 'partial', 'failed'].includes(event.outcome)) throw new Error(`bad outcome: ${event.outcome}`);
    if (event.outcome === 'success' && event.problem) throw new Error('success cannot carry a problem');
    this.db.prepare('INSERT INTO usage (skill, outcome, agent, session, problem, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(event.skill, event.outcome, event.agent ?? '', event.session ?? '', event.problem ?? '', new Date().toISOString());
  }

  stats(skill?: string): StatsRow[] {
    const where = skill ? 'WHERE skill = ?' : '';
    const params = skill ? [skill] : [];
    const rows = this.db.prepare(`SELECT skill,
      COUNT(*) AS uses,
      SUM(CASE WHEN outcome='success' THEN 1 ELSE 0 END) AS success,
      SUM(CASE WHEN outcome='partial' THEN 1 ELSE 0 END) AS partial,
      SUM(CASE WHEN outcome='failed' THEN 1 ELSE 0 END) AS failed,
      MAX(created_at) AS last_used_at
      FROM usage ${where} GROUP BY skill ORDER BY uses DESC, skill ASC`).all(...params) as Array<Record<string, unknown>>;
    return rows.map((r) => {
      const uses = Number(r.uses);
      const success = Number(r.success);
      return {
        skill: String(r.skill),
        uses,
        success,
        partial: Number(r.partial),
        failed: Number(r.failed),
        success_rate: uses ? success / uses : 0,
        last_used_at: String(r.last_used_at ?? ''),
      };
    });
  }

  problems(skill?: string): UsageRow[] {
    const where = skill ? "WHERE skill = ? AND outcome IN ('partial','failed') AND problem != ''" : "WHERE outcome IN ('partial','failed') AND problem != ''";
    const params = skill ? [skill] : [];
    const rows = this.db.prepare(`SELECT id, skill, outcome, agent, session, problem, created_at FROM usage ${where} ORDER BY created_at DESC`).all(...params) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id), skill: String(r.skill), outcome: String(r.outcome),
      agent: String(r.agent ?? ''), session: String(r.session ?? ''),
      problem: String(r.problem ?? ''), created_at: String(r.created_at),
    }));
  }

  close(): void {
    this.db.close();
  }
}
