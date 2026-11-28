#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { collectCodexReads } from './codex-reads.js';
import { agentRead, sessionID } from './agent-read.js';
import { createServer } from 'node:http';
import { auditSkills } from './audit.js';
import { sendWebControl } from './cli-control.js';
import { doctor, scanSkills } from './scan.js';
import { checkCliStatus } from './cli-status.js';
import { buildRelations, currentGithubAccount, publicRepos } from './relations.js';
import { UsageStore, LIFECYCLE_STATUSES, VISIBILITY_STATUSES, type LifecycleStatus, type VisibilityStatus } from './usage.js';
import { buildProfiles } from './profile.js';
import { createHandler } from './web.js';
import { DEFAULT_ALLOWED_DUPLICATES, DEFAULT_EXCLUDES, DEFAULT_ROOTS } from './roots.js';
import type { ScanResult } from './types.js';

const HELP = `skillhub — local Skill hub CLI (independent of CS)

Usage:
  skillhub scan [--root <dir>] ... [--json]
  skillhub doctor [--root <dir>] ...
  skillhub audit [--root <dir>] ... [--json]            # 上架前安全与口径冲突门禁（存在阻断返回退出码 1）
  skillhub use <skill> --outcome success|partial|failed [--agent <id>] [--session <id>] [--problem <text>]
  skillhub reads [--skill <name>] [--session <id>] [--json]
  skillhub run <skill> -- <command> [args...]           # record the actual command outcome
  skillhub stats [--skill <name>] [--json]
  skillhub problems [--skill <name>] [--json]
  skillhub frequency [days] [--skill <name>] [--json]   # 近 N 天频次（默认 7）
  skillhub agents [--skill <name>] [--json]             # 按 agent 聚合使用次数
  skillhub profile [<skill>] [--json]                   # 每个 Skill 的版本+生命周期+使用档案
  skillhub lifecycle <skill> <status> [--note <text>]   # draft|active|deprecated|archived
  skillhub visibility <skill> open|closed [--note <text>] # 本地开源/闭源口径，不改远端仓库
  skillhub status [--json]          # gh/glab CLI 登录状态小灯
  skillhub relations [--json]       # Skill ↔ GitHub/GitLab 仓库关系（自有/第三方/未关联）
  skillhub serve [--root <dir>] ... [--port 4319]
  skillhub ui <tab|focus|search|theme|refresh> [value]  # 实时遥控已打开的本地网页
  skillhub help

Options:
  --root <dir>     skill root (repeatable; default: installed roots, see scan --json scannedRoots)
  --json           JSON output
  --port <n>       web server port (default 4319)
  --outcome <o>    use result: success | partial | failed (required for use)
  --problem <t>    issue description (only for partial/failed)
  --agent <id>     caller agent id
  --session <id>   caller session id
  --skill <name>   filter stats/problems to one skill
  --note <text>    lifecycle reason

Notes:
  skillhub is the source of truth for skill management. CS is a thin consumer.
  Telemetry lives in local SQLite (SKILLHUB_DATA_DIR to override), never in CS.
`;

interface Opts {
  command: string;
  positionals: string[];
  roots: string[];
  json: boolean;
  port: number;
  flags: Record<string, string>;
}

function parseArgs(argv: string[]): Opts {
  const [command = 'help', ...rest] = argv;
  const opts: Opts = { command, positionals: [], roots: [], json: false, port: 4319, flags: {} };
  const valueFlags = new Set(['--root', '--port', '--outcome', '--problem', '--agent', '--session', '--skill', '--note']);
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (valueFlags.has(arg)) {
      const value = rest[++i] ?? '';
      if (arg === '--root') opts.roots.push(value);
      else if (arg === '--port') opts.port = Number(value || 4319);
      else opts.flags[arg.slice(2)] = value;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (!arg.startsWith('-')) {
      opts.positionals.push(arg);
    }
  }
  return opts;
}

async function loadResult(roots: string[], explicitSkill?: string): Promise<ScanResult> {
  return scanSkills({
    roots: roots.length ? roots : DEFAULT_ROOTS,
    explicitSkill,
    excludePrefixes: DEFAULT_EXCLUDES,
    allowedDuplicates: DEFAULT_ALLOWED_DUPLICATES,
  });
}

function renderText(result: ScanResult): string {
  const byCategory = new Map<string, number>();
  const origins = new Map<string, number>();
  for (const s of result.skills) {
    byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + 1);
    origins.set(s.origin, (origins.get(s.origin) ?? 0) + 1);
  }
  return [
    `skills: ${result.count}`,
    `broken: ${result.broken.length}`,
    `duplicates: ${result.duplicates.length}`,
    `excluded: ${result.excluded.length}`,
    `categories: ${[...byCategory.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`,
    `origins: ${[...origins.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`,
  ].join('\n');
}

async function serve(opts: Opts): Promise<void> {
  const roots = opts.roots.length ? opts.roots : DEFAULT_ROOTS;
  const handler = await createHandler(roots);
  const server = createServer(handler);
  server.listen(opts.port, '127.0.0.1', () => {
    console.log(`skillhub web: http://127.0.0.1:${opts.port}`);
  });
}

async function main(): Promise<void> {
  const [command, name, separator, program, ...args] = process.argv.slice(2);
  if (command === 'run') {
    if (!name || separator !== '--' || !program) throw new Error('usage: skillhub run <skill> -- <command> [args...]');
    const child = spawnSync(program, args, { stdio: 'inherit' });
    if (child.error) throw child.error;
    const outcome = child.status === 0 ? 'success' : 'failed';
    const store = new UsageStore();
    try {
      store.record({ skill: name, outcome, agent: process.env.CS_AGENT ?? '', session: sessionID() });
    } finally {
      store.close();
    }
    process.exitCode = child.status ?? 1;
    await sendWebControl(4319, { action: 'refresh', message: `执行结果：${name} (${outcome})` });
    return;
  }
  if (command === '_hook') {
    const event = agentRead(JSON.parse(readFileSync(0, 'utf8')), name);
    if (!event) return;
    const store = new UsageStore();
    try { store.recordRead(event); } finally { store.close(); }
    return;
  }
  const opts = parseArgs(process.argv.slice(2));
  if (opts.command === 'help' || opts.command === '--help' || opts.command === '-h') {
    process.stdout.write(HELP);
    return;
  }
  if (opts.command === 'scan') {
    const result = await loadResult(opts.roots);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : `${renderText(result)}\n`);
    return;
  }
  if (opts.command === 'doctor') {
    const result = await loadResult(opts.roots);
    const report = doctor(result);
    const lines = [report.ok ? 'ok' : 'problems', ...report.problems.map(p => `- ${p}`)];
    // 有意同名不是问题，但必须看得见：单独一段，不混进 problems。
    if (report.notes.length) lines.push('', ...report.notes.map(n => `~ ${n}`));
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = report.ok ? 0 : 1;
    return;
  }
  if (opts.command === 'audit') {
    const result = await loadResult(opts.roots);
    const store = new UsageStore();
    try {
      const profiles = buildProfiles(result.skills, store);
      const profileMap = new Map(profiles.map(p => [p.name, p]));
      const account = await currentGithubAccount();
      const pub = account ? await publicRepos(account) : null;
      const relations = await buildRelations(result.skills, account ?? '', pub ?? undefined);
      const relationMap = new Map(relations.map(r => [r.skill, r]));
      const report = auditSkills(result.skills.map(s => ({
        name: s.name,
        description: s.description,
        version: s.version,
        origin: s.origin,
        path: s.path,
        publish: s.publish,
        visibility: profileMap.get(s.name)?.visibility ?? (s.origin.startsWith('opensource:') ? 'open' : 'closed'),
        relation: relationMap.get(s.name)?.relation ?? 'unlinked',
      })), result.duplicates);
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      } else {
        process.stdout.write(`${report.ok ? 'ok' : 'blocked'} (errors=${report.errorCount}, warnings=${report.warnCount})\n`);
        for (const f of report.findings) {
          process.stdout.write(`- [${f.severity}] ${f.skill} (${f.rule}): ${f.message}\n`);
        }
      }
      process.exitCode = report.ok ? 0 : 1;
    } finally {
      store.close();
    }
    return;
  }
  if (opts.command === 'ui') {
    const [sub, value = ''] = opts.positionals;
    if (!sub) throw new Error('usage: skillhub ui <tab|focus|search|theme|refresh> [value]');
    let payload: Record<string, unknown>;
    if (sub === 'tab') {
      if (!['skills', 'analytics', 'relations', 'doctor'].includes(value)) {
        throw new Error('expected tab: skills | analytics | relations | doctor');
      }
      payload = { action: 'tab', tab: value, message: `切换到 ${value}` };
    } else if (sub === 'focus') {
      if (!value) throw new Error('usage: skillhub ui focus <skill>');
      payload = { action: 'focus', skill: value, message: `聚焦 ${value}` };
    } else if (sub === 'search') {
      payload = { action: 'filter', query: value, message: value ? `搜索「${value}」` : '清空搜索' };
    } else if (sub === 'theme') {
      if (!['dark', 'light'].includes(value)) throw new Error('expected theme: dark | light');
      payload = { action: 'theme', theme: value, message: `切换主题：${value}` };
    } else if (sub === 'refresh') {
      payload = { action: 'refresh', message: 'CLI 触发全量刷新' };
    } else {
      throw new Error(`unknown ui action: ${sub}`);
    }
    const clients = await sendWebControl(opts.port, payload, true);
    process.stdout.write(`sent: ui ${sub}${value ? ` ${value}` : ''} (active tabs: ${clients})\n`);
    return;
  }
  if (opts.command === 'use') {
    const skill = opts.positionals[0];
    const outcome = opts.flags.outcome;
    if (!skill || !outcome) throw new Error('usage: skillhub use <skill> --outcome success|partial|failed');
    const store = new UsageStore();
    try {
      store.record({ skill, outcome: outcome as 'success' | 'partial' | 'failed', agent: opts.flags.agent, session: opts.flags.session, problem: opts.flags.problem });
      process.stdout.write(`recorded: ${skill} ${outcome}\n`);
    } finally {
      store.close();
    }
    await sendWebControl(opts.port, { action: 'refresh', message: `记录调用：${skill} (${outcome})` });
    return;
  }
  if (opts.command === 'reads' || opts.command === '_record-read') {
    const store = new UsageStore();
    try {
      if (opts.command === '_record-read') {
        store.recordRead({ skill: opts.positionals[0], agent: opts.flags.agent ?? '', session: opts.flags.session ?? '', source: 'cs-show' });
      } else {
        collectCodexReads(store);
        const rows = store.reads(opts.flags.skill, opts.flags.session);
        process.stdout.write(opts.json ? JSON.stringify(rows, null, 2) + '\n' :
          rows.map(r => [r.created_at, r.skill, r.source, r.agent, r.session].join('\t')).join('\n') + '\n');
      }
    } finally { store.close(); }
    return;
  }
  if (opts.command === 'stats') {
    const store = new UsageStore();
    try {
      const rows = store.stats(opts.flags.skill);
      process.stdout.write(opts.json ? `${JSON.stringify(rows, null, 2)}\n` : `${rows.map(r => `${r.skill}: ${r.uses} uses, ${(r.success_rate * 100).toFixed(1)}% success`).join('\n') || 'no usage recorded'}\n`);
    } finally {
      store.close();
    }
    return;
  }
  if (opts.command === 'problems') {
    const store = new UsageStore();
    try {
      const rows = store.problems(opts.flags.skill);
      process.stdout.write(opts.json ? `${JSON.stringify(rows, null, 2)}\n` : `${rows.map(r => `${r.skill}: ${r.problem}`).join('\n') || 'no problems recorded'}\n`);
    } finally {
      store.close();
    }
    return;
  }
  if (opts.command === 'frequency') {
    const days = Number(opts.positionals[0] || 7);
    const store = new UsageStore();
    try {
      const rows = store.frequency(days, opts.flags.skill);
      process.stdout.write(opts.json ? `${JSON.stringify(rows, null, 2)}\n` : `${rows.map(r => `${r.skill}: ${r.uses} uses / ${days}d (${r.agents} agents)`).join('\n') || `no usage in last ${days}d`}\n`);
    } finally { store.close(); }
    return;
  }
  if (opts.command === 'agents') {
    const store = new UsageStore();
    try {
      const rows = store.agents(opts.flags.skill);
      process.stdout.write(opts.json ? `${JSON.stringify(rows, null, 2)}\n` : `${rows.map(r => `${r.skill} ← ${r.agent}: ${r.uses}`).join('\n') || 'no agent usage recorded'}\n`);
    } finally { store.close(); }
    return;
  }
  if (opts.command === 'lifecycle') {
    const [skill, status] = opts.positionals;
    if (!skill || !status) throw new Error('usage: skillhub lifecycle <skill> <status> [--note <text>]');
    if (!LIFECYCLE_STATUSES.includes(status as LifecycleStatus)) throw new Error(`bad status: ${status} (expected ${LIFECYCLE_STATUSES.join('|')})`);
    const store = new UsageStore();
    try {
      const row = store.setLifecycle(skill, status as LifecycleStatus, opts.flags.note ?? '');
      process.stdout.write(`${row.skill}: ${row.status}${row.note ? ` (${row.note})` : ''}\n`);
    } finally { store.close(); }
    return;
  }
  if (opts.command === 'visibility') {
    const [skill, status] = opts.positionals;
    if (!skill || !status) throw new Error('usage: skillhub visibility <skill> open|closed [--note <text>]');
    if (!VISIBILITY_STATUSES.includes(status as VisibilityStatus)) throw new Error(`bad status: ${status} (expected ${VISIBILITY_STATUSES.join('|')})`);
    const store = new UsageStore();
    try {
      const row = store.setVisibility(skill, status as VisibilityStatus, opts.flags.note ?? '');
      process.stdout.write(`${row.skill}: ${row.status}${row.note ? ` (${row.note})` : ''}\n`);
    } finally { store.close(); }
    return;
  }
  if (opts.command === 'profile') {
    const result = await loadResult(opts.roots, opts.positionals[0] ?? opts.flags.skill);
    const store = new UsageStore();
    try {
      let profiles = buildProfiles(result.skills, store);
      if (opts.flags.skill) profiles = profiles.filter(p => p.name === opts.flags.skill || p.name.includes(opts.flags.skill));
      if (opts.positionals[0]) profiles = profiles.filter(p => p.name === opts.positionals[0] || p.name.includes(opts.positionals[0]));
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(profiles, null, 2)}\n`);
      } else {
        process.stdout.write(`${profiles.map(p => `${p.name}@${p.version ?? '?'} [${p.lifecycle}/${p.visibility}] uses=${p.total_uses} 7d=${p.uses_7d} 30d=${p.uses_30d} agents=${p.unique_agents}`).join('\n')}\n`);
      }
    } finally { store.close(); }
    return;
  }
  if (opts.command === 'relations') {
    const result = await loadResult(opts.roots);
    const account = await currentGithubAccount();
    const pub = account ? await publicRepos(account) : null;
    const relations = await buildRelations(result.skills, account ?? '', pub ?? undefined);
    if (opts.json) {
      process.stdout.write(`${JSON.stringify({ account, relations }, null, 2)}\n`);
    } else {
      const groups = { 'own-public': [], 'own-private': [], 'third-party': [], unlinked: [] } as Record<string, typeof relations>;
      for (const r of relations) groups[r.relation].push(r);
      process.stdout.write(`GitHub 账户: ${account ?? 'unknown'} · 公开仓 ${pub?.size ?? 'unknown'}\n自有开源 ${groups['own-public'].length} · 自有私有 ${groups['own-private'].length} · 第三方 ${groups['third-party'].length} · 未关联 ${groups.unlinked.length}\n`);
      for (const [label, rows] of Object.entries(groups)) {
        if (!rows.length) continue;
        process.stdout.write(`\n[${label}]\n${rows.slice(0, 20).map(r => `  ${r.skill} → ${r.repo?.url ?? '—'} (${r.via ?? 'none'})`).join('\n')}\n`);
      }
    }
    return;
  }
  if (opts.command === 'status') {
    const status = checkCliStatus();
    if (opts.json) {
      process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    } else {
      process.stdout.write(`${status.map(c => `${c.light} ${c.cli}: ${c.hosts.map(h => `${h.light} ${h.host}${h.user ? ` (${h.user})` : ''}`).join(', ') || c.detail}`).join('\n')}\n`);
    }
    return;
  }
  if (opts.command === 'serve') {
    await serve(opts);
    return;
  }
  process.stderr.write(`unknown command: ${opts.command}\n${HELP}`);
  process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).stack ?? error}\n`);
  process.exitCode = 1;
});
