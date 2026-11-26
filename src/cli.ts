#!/usr/bin/env node
import { createServer } from 'node:http';
import { doctor, scanSkills } from './scan.js';
import { checkCliStatus } from './cli-status.js';
import { UsageStore } from './usage.js';
import { createHandler } from './web.js';
import type { ScanResult } from './types.js';

const HELP = `skillhub — local Skill hub CLI (independent of CS)

Usage:
  skillhub scan [--root <dir>] ... [--json]
  skillhub doctor [--root <dir>] ...
  skillhub use <skill> --outcome success|partial|failed [--agent <id>] [--session <id>] [--problem <text>]
  skillhub stats [--skill <name>] [--json]
  skillhub problems [--skill <name>] [--json]
  skillhub status [--json]          # gh/glab CLI 登录状态小灯
  skillhub serve [--root <dir>] ... [--port 4319]
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
  const valueFlags = new Set(['--root', '--port', '--outcome', '--problem', '--agent', '--session', '--skill']);
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

const DEFAULT_ROOTS = [
  '~/dev/agent-infra',               // 本仓薄插件优先，盖掉 CS 仓里的旧厚入口
  '~/dev/cs/CortexOS/skills',
  '~/dev/agent-skills/writing-standard-skills/skills',
  '~/dev/agent-skills',
  '~/dev/visual/ui-craft/skills',
  '~/.agents/skills',
  '~/.claude/skills',
  '~/.codex/skills',
  '~/.gemini/config/skills',
  '~/.dsh/skills',
  '~/.cursor/skills',
  '~/.config/opencode/skills',
];

async function loadResult(roots: string[]): Promise<ScanResult> {
  return scanSkills({ roots: roots.length ? roots : DEFAULT_ROOTS });
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
    process.stdout.write(`${report.ok ? 'ok' : 'problems'}\n${report.problems.map(p => `- ${p}`).join('\n')}\n`);
    process.exitCode = report.ok ? 0 : 1;
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
