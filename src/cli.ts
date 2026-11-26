#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { doctor, scanSkills } from './scan.js';
import { createHandler } from './web.js';
import type { ScanResult } from './types.js';

const HELP = `skillhub — local Skill hub CLI

Usage:
  skillhub scan [--root <dir>] ... [--json]
  skillhub doctor [--root <dir>] ...
  skillhub serve [--root <dir>] ... [--port 4319]
  skillhub help

Options:
  --root <dir>   skill root (repeatable; default: ~/dev/cs/CortexOS/skills)
  --json         JSON output for scan
  --port <n>     web server port (default 4319)

Notes:
  scan/doctor are read-only. Write operations stay in the CS skill CLI.
`;

function parseArgs(argv: string[]): { command: string; roots: string[]; json: boolean; port: number } {
  const [command = 'help', ...rest] = argv;
  const roots: string[] = [];
  let json = false;
  let port = 4319;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--root') {
      roots.push(rest[++i] ?? '');
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--port') {
      port = Number(rest[++i] ?? 4319);
    }
  }
  return { command, roots: roots.filter(Boolean), json, port };
}

async function loadResult(roots: string[]): Promise<ScanResult> {
  const useRoots = roots.length ? roots : ['~/dev/cs/CortexOS/skills'];
  return scanSkills({ roots: useRoots });
}

function renderText(result: ScanResult): string {
  const byCategory = new Map<string, number>();
  const origins = new Map<string, number>();
  for (const s of result.skills) {
    byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + 1);
    origins.set(s.origin, (origins.get(s.origin) ?? 0) + 1);
  }
  const lines = [
    `skills: ${result.count}`,
    `broken: ${result.broken.length}`,
    `categories: ${[...byCategory.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`,
    `origins: ${[...origins.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`,
  ];
  return lines.join('\n');
}

async function serve(opts: ReturnType<typeof parseArgs>): Promise<void> {
  const roots = opts.roots.length ? opts.roots : ['~/dev/cs/CortexOS/skills'];
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
