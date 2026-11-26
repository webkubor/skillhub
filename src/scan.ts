import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import type { Frontmatter, ScanOptions, ScanResult, SkillRecord } from './types.js';

const DEFAULT_IGNORE = new Set(['node_modules', '.git', 'dist', 'archive', '.Trash', 'node_modules']);

function isIgnoredDir(name: string, extra: string[]): boolean {
  if (name.startsWith('.')) return true;
  return DEFAULT_IGNORE.has(name) || extra.includes(name);
}

export function parseFrontmatter(text: string): { data: Frontmatter | null; error?: string } {
  if (!text.startsWith('---')) return { data: null, error: 'missing frontmatter' };
  const end = text.indexOf('\n---', 3);
  if (end < 0) return { data: null, error: 'unterminated frontmatter' };
  const block = text.slice(3, end).trim();
  const data: Frontmatter = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[m[1]] = value;
  }
  if (!data.name) return { data: null, error: 'frontmatter missing name' };
  return { data };
}

function categoryFromPath(path: string, root: string): string {
  const rel = relative(root, path);
  const parts = rel.split(/[\\/]/);
  if (parts.length >= 3) return parts[0];
  return 'uncategorized';
}

async function walk(root: string, extraIgnore: string[], out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!isIgnoredDir(entry.name, extraIgnore)) await walk(join(root, entry.name), extraIgnore, out);
      continue;
    }
    if (entry.isFile() && entry.name === 'SKILL.md') out.push(join(root, entry.name));
  }
}

export async function scanSkills(options: ScanOptions): Promise<ScanResult> {
  const skills: SkillRecord[] = [];
  const broken: Array<{ path: string; reason: string }> = [];
  const seen = new Set<string>();
  const extraIgnore = options.ignoreDirs ?? [];

  for (const rawRoot of options.roots) {
    const root = resolve(rawRoot.replace(/^~/, process.env.HOME ?? ''));
    const files: string[] = [];
    await walk(root, extraIgnore, files);
    for (const file of files) {
      let text: string;
      try {
        text = await readFile(file, 'utf8');
      } catch (error) {
        broken.push({ path: file, reason: `read failed: ${(error as Error).message}` });
        continue;
      }
      const parsed = parseFrontmatter(text);
      if (!parsed.data) {
        broken.push({ path: file, reason: parsed.error ?? 'invalid frontmatter' });
        continue;
      }
      const fm = parsed.data;
      const name = String(fm.name);
      if (seen.has(name)) continue;
      seen.add(name);
      skills.push({
        name,
        description: String(fm.description ?? ''),
        version: fm.version ? String(fm.version).replace(/^["']|["']$/g, '') : null,
        scope: String(fm.scope ?? ''),
        origin: String(fm.origin ?? 'private'),
        category: String(fm.category ?? categoryFromPath(file, root)),
        path: file,
      });
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return { count: skills.length, skills, broken, scannedRoots: options.roots };
}

export function doctor(result: ScanResult): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  for (const b of result.broken) problems.push(`broken: ${basename(b.path)} -> ${b.reason}`);
  for (const s of result.skills) {
    if (s.scope === 'company') continue;
    if (s.origin.startsWith('opensource:')) continue;
    if (!s.version) problems.push(`no-version: ${s.name}`);
  }
  return { ok: problems.length === 0, problems };
}
