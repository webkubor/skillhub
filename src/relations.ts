import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { SkillRecord } from './types.js';

export type RepoRelation = 'own-public' | 'own-private' | 'third-party' | 'unlinked';

export interface RepoLink {
  host: 'github.com' | 'gitlab.com' | 'other';
  owner: string;
  repo: string;
  url: string;
}

export interface SkillRelation {
  skill: string;
  path: string;
  relation: RepoRelation;
  repo: RepoLink | null;
  via: 'git-remote' | 'frontmatter' | null;
}

const GH_RE = /(?:github\.com[:/])([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;
const GL_RE = /(?:gitlab\.com[:/])([\w.-]+(?:\/[\w.-]+)*?)\/([\w.-]+?)(?:\.git)?\/?$/;

function parseRepo(raw: string): RepoLink | null {
  if (!raw) return null;
  let m = raw.match(GH_RE);
  if (m) return { host: 'github.com', owner: m[1], repo: m[2], url: `https://github.com/${m[1]}/${m[2]}` };
  m = raw.match(GL_RE);
  if (m) return { host: 'gitlab.com', owner: m[1], repo: m[2], url: `https://gitlab.com/${m[1]}/${m[2]}` };
  if (/^https?:\/\//.test(raw)) {
    try {
      const u = new URL(raw);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) return { host: u.hostname as 'other', owner: parts[0], repo: parts[1], url: `${u.origin}/${parts[0]}/${parts[1]}` };
    } catch { /* ignore */ }
  }
  return null;
}

async function repoFromFrontmatter(path: string): Promise<string | null> {
  try {
    const text = readFileSync(path, 'utf8');
    const end = text.indexOf('\n---', 3);
    if (!text.startsWith('---') || end < 0) return null;
    for (const line of text.slice(3, end).split('\n')) {
      const m = line.match(/^(url|repository|homepage|source):\s*(.*)$/);
      if (m) {
        const value = m[2].trim().replace(/^["']|["']$/g, '');
        if (value) return value;
      }
    }
  } catch { /* ignore */ }
  return null;
}

function repoFromGit(path: string): string | null {
  let dir: string = resolve(path);
  try {
    // SKILL.md 可能在仓库子目录里，向上找最多 6 层
    for (let i = 0; i < 6; i += 1) {
      if (statSync(dir).isDirectory()) {
        try {
          const url = execFileSync('git', ['-C', dir, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }).trim();
          if (url) return url;
        } catch { /* try parent */ }
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch { /* ignore */ }
  return null;
}

export async function buildRelations(skills: SkillRecord[], account: string, publicRepos?: Set<string>): Promise<SkillRelation[]> {
  const out: SkillRelation[] = [];
  const lowerAccount = account.toLowerCase();
  for (const s of skills) {
    const gitRaw = repoFromGit(s.path);
    const fmRaw = await repoFromFrontmatter(s.path);
    const raw = gitRaw ?? fmRaw;
    const repo = parseRepo(raw ?? '');
    const via = gitRaw ? 'git-remote' : fmRaw ? 'frontmatter' : null;
    const isAccountOwner = !!repo && repo.owner.toLowerCase() === lowerAccount && ['github.com', 'gitlab.com'].includes(repo.host);
    // 只有确认在公开仓列表里才算「自有开源」；同名但未命中公开列表（私有/公司仓）单列，不混进第三方。
    const isPublic = !!repo && publicRepos?.has(`${repo.host}/${repo.owner}/${repo.repo}`.toLowerCase()) === true;
    const relation: RepoRelation = !repo
      ? 'unlinked'
      : isAccountOwner
        ? (isPublic ? 'own-public' : 'own-private')
        : 'third-party';
    out.push({
      skill: s.name,
      path: s.path,
      relation,
      repo,
      via,
    });
  }
  return out;
}

export async function currentGithubAccount(): Promise<string | null> {
  try {
    const login = execFileSync('gh', ['api', 'user', '--jq', '.login'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 6000 }).trim();
    return login || null;
  } catch { return null; }
}

/** 拉当前 gh 账户的公开仓库集合；失败返回 null（此时无法区分自有公开/私有，按私有保守处理）。 */
export async function publicRepos(account: string): Promise<Set<string> | null> {
  try {
    const raw = execFileSync('gh', ['repo', 'list', account, '--limit', '200', '--visibility', 'public', '--json', 'nameWithOwner'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 });
    const rows = JSON.parse(raw) as Array<{ nameWithOwner: string }>;
    return new Set(rows.map(r => `github.com/${r.nameWithOwner}`.toLowerCase()));
  } catch { return null; }
}
