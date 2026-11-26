import { spawnSync } from 'node:child_process';

export type HostState = 'ok' | 'fail' | 'unknown';
export type Light = '🟢' | '🔴' | '🟡' | '⚪';

export interface HostStatus {
  host: string;
  state: HostState;
  user: string;
  light: Light;
}

export interface CliStatus {
  cli: 'gh' | 'glab';
  installed: boolean;
  hosts: HostStatus[];
  light: Light;
  detail: string;
}

function probe(bin: string, args: string[]): { installed: boolean; text: string } {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    timeout: 6000,
    maxBuffer: 2 * 1024 * 1024,
    env: process.env,
  });
  if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
    return { installed: false, text: '' };
  }
  return { installed: true, text: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

function parse(text: string): HostStatus[] {
  const byHost = new Map<string, { state: HostState; user: string }>();
  let current = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // 顶格 host 行（gh/glab 都这样），状态行有前导空格
    if (!raw.startsWith(' ') && !/^[✓x✗!]/.test(line) && /^[a-z0-9.-]+\.[a-z]+$/i.test(line)) {
      current = line;
      if (!byHost.has(current)) byHost.set(current, { state: 'unknown', user: '' });
      continue;
    }
    // gh: "Logged in to github.com account <user>"
    // glab: "Logged in to <host> as <user>"
    const login = line.match(/Logged in to (\S+) (?:account|as) (\S+)/);
    if (login) {
      byHost.set(login[1], { state: 'ok', user: login[2].replace(/[()].*$/, '') });
      continue;
    }
    // gh "x host: ..." 或 glab "x host: API call failed/..." 都表示失败
    const failed = raw.match(/^\s*[x✗]\s+(\S+?):/);
    if (failed || /failed to initialize api client/i.test(line) || /api call failed/i.test(line) || /no token found/i.test(line)) {
      const host = failed?.[1] ?? current;
      if (host && byHost.get(host)?.state !== 'ok') byHost.set(host, { state: 'fail', user: '' });
    }
  }
  return [...byHost.entries()]
    .filter(([host]) => host)
    .map(([host, v]) => ({
      host,
      state: v.state,
      user: v.user,
      light: v.state === 'ok' ? '🟢' : v.state === 'fail' ? '🔴' : '🟡',
    }));
}

function overall(installed: boolean, hosts: HostStatus[]): Light {
  if (!installed || !hosts.length) return '⚪';
  const ok = hosts.filter(h => h.state === 'ok').length;
  const fail = hosts.filter(h => h.state === 'fail').length;
  if (ok && !fail) return '🟢';
  if (!ok && fail) return '🔴';
  if (ok && fail) return '🟡';
  return '🟡';
}

function build(cli: 'gh' | 'glab', args: string[], detail: string): CliStatus {
  const { installed, text } = probe(cli, args);
  const hosts = installed ? parse(text) : [];
  return { cli, installed, hosts, light: overall(installed, hosts), detail: installed ? detail : `${cli} 未安装` };
}

let cache: { at: number; value: CliStatus[] } | null = null;

export function checkCliStatus(force = false): CliStatus[] {
  const ttlMs = 60_000;
  if (!force && cache && Date.now() - cache.at < ttlMs) return cache.value;
  const value: CliStatus[] = [
    build('gh', ['auth', 'status'], 'GitHub CLI 登录状态'),
    build('glab', ['auth', 'status'], 'GitLab CLI 登录状态（多 host）'),
  ];
  cache = { at: Date.now(), value };
  return value;
}
