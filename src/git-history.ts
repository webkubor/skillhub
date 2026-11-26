import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  date: string;
  author: string;
  subject: string;
}

const HASH_RE = /^[0-9a-f]{4,40}$/i;

export function isValidCommitRef(ref: string): boolean {
  return ref === 'HEAD' || HASH_RE.test(ref);
}

export function getSkillGitHistory(filePath: string, limit = 12): GitCommitInfo[] {
  try {
    const absPath = resolve(filePath);
    const dir = dirname(absPath);
    const out = execFileSync(
      'git',
      ['-C', dir, 'log', '-n', String(limit), '--format=%H%x1f%h%x1f%ai%x1f%an%x1f%s', '--', absPath],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 },
    ).trim();
    if (!out) return [];
    return out.split('\n').map((line) => {
      const [hash = '', shortHash = '', date = '', author = '', subject = ''] = line.split('\x1f');
      return { hash, shortHash, date, author, subject };
    });
  } catch {
    return [];
  }
}

export function getSkillGitDiff(filePath: string, from: string, to?: string): string {
  if (!isValidCommitRef(from)) throw new Error(`Invalid commit ref: ${from}`);
  if (to && !isValidCommitRef(to)) throw new Error(`Invalid commit ref: ${to}`);

  const absPath = resolve(filePath);
  const dir = dirname(absPath);
  try {
    const args = to
      ? ['-C', dir, 'diff', '--unified=3', from, to, '--', absPath]
      : ['-C', dir, 'show', '--format=', '--unified=3', from, '--', absPath];
    const diff = execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return diff.length > 131072 ? `${diff.slice(0, 131072)}\n\n... (diff truncated)` : diff;
  } catch {
    return '';
  }
}
