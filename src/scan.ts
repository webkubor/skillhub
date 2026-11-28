import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import type { DuplicateSkill, Frontmatter, ScanOptions, ScanResult, SkillRecord } from './types.js';

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

/**
 * 排除前缀必须也走 realpath：被比较的是文件的 realpath，而 macOS 上 /var 是
 * /private/var 的软链、临时目录、以及 ~/.config 之类的真实路径都可能不同形。
 * 只 resolve 不 realpath 会永远匹配不上，排除静默失效。
 */
async function resolveExcludes(prefixes: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const raw of prefixes) {
    const expanded = resolve(raw.replace(/^~/, process.env.HOME ?? ''));
    try {
      out.push(await realpath(expanded));
    } catch {
      out.push(expanded); // 不存在的前缀保留原形，不至于崩
    }
  }
  return out;
}

async function walk(root: string, extraIgnore: string[], out: string[]): Promise<void> {  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      if (!isIgnoredDir(entry.name, extraIgnore)) await walk(full, extraIgnore, out);
      continue;
    }
    if (entry.isSymbolicLink()) {
      // 软链目录要跟随，但防止环：只对指向真实目录的链接递归一层
      try {
        const target = await realpath(full);
        const st = await stat(target);
        if (st.isDirectory() && !isIgnoredDir(entry.name, extraIgnore)) await walk(full, extraIgnore, out);
        else if (st.isFile() && entry.name === 'SKILL.md') out.push(full);
      } catch { /* 断链忽略 */ }
      continue;
    }
    if (entry.isFile() && entry.name === 'SKILL.md') out.push(full);
  }
}

export async function scanSkills(options: ScanOptions): Promise<ScanResult> {
  const skills: SkillRecord[] = [];
  const broken: Array<{ path: string; reason: string }> = [];
  const seen = new Set<string>();
  // 同名多份不能静默遮蔽：先扫到的生效，其余记进 duplicates 并让 doctor/audit 报错。
  // 之前这里直接 `continue`，导致假的高版本能无声盖掉真源（2026-11-27 实测复现）。
  const shadowed = new Map<string, { kept: string; paths: string[]; reals: string[] }>();
  const excluded: string[] = [];
  const extraIgnore = options.ignoreDirs ?? [];
  const excludePrefixes = await resolveExcludes(options.excludePrefixes ?? []);

  for (const rawRoot of options.roots) {
    const root = resolve(rawRoot.replace(/^~/, process.env.HOME ?? ''));
    const files: string[] = [];
    await walk(root, extraIgnore, files);
    for (const file of files) {
      // Check canonical paths so an installed symlink cannot expose a fixture or archive.
      let real = file;
      try {
        real = await realpath(file);
      } catch { /* Report unreadable files below. */ }
      if (real.split(sep).includes('archive') || real.includes(sep + 'tests' + sep + 'fixtures' + sep) ||
          excludePrefixes.some(p => real === p || real.startsWith(p + sep))) {
        excluded.push(file);
        continue;
      }
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
      if (fm.discovery === 'explicit' && name !== options.explicitSkill) continue;
      if (seen.has(name)) {
        const entry = shadowed.get(name);
        if (entry) {
          if (!entry.reals.includes(real)) {
            entry.paths.push(file);
            entry.reals.push(real);
          }
        } else {
          // 首次撞名：先确认是不是同一个文件。嵌套根（如 ~/dev/agent-skills 与
          // 其子目录 writing-standard-skills/skills）会让同一文件被走两遍，
          // realpath 相同就不是冲突，不该记录。
          const kept = skills.find((s) => s.name === name);
          let keptReal = kept?.path ?? '';
          try {
            keptReal = kept ? await realpath(kept.path) : '';
          } catch { /* 断链按原路径比较 */ }
          if (real !== keptReal) {
            shadowed.set(name, { kept: kept?.path ?? file, paths: [file], reals: [keptReal, real] });
          }
        }
        continue;
      }
      seen.add(name);
      skills.push({
        name,
        description: String(fm.description ?? ''),
        version: fm.version ? String(fm.version).replace(/^["']|["']$/g, '') : null,
        scope: String(fm.scope ?? ''),
        origin: String(fm.origin ?? 'private'),
        category: String(fm.category ?? categoryFromPath(file, root)),
        publish: fm.publish ? String(fm.publish).replace(/^["']|["']$/g, '') : null,
        path: file,
      });
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  const allDuplicates: DuplicateSkill[] = [...shadowed.entries()]
    .map(([name, v]) => {
      const keptRecord = skills.find((s) => s.name === name);
      return { name, kept: keptRecord?.path ?? v.kept, shadowed: v.paths };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // 上游有意保留的同名对：声明里把被遮蔽路径全部列全才放行，避免变成万能豁免。
  const allowed = new Map((options.allowedDuplicates ?? []).map(a => [a.name, a]));
  const duplicates: DuplicateSkill[] = [];
  const allowedDuplicates: Array<DuplicateSkill & { reason: string }> = [];
  for (const d of allDuplicates) {
    const rule = allowed.get(d.name);
    if (!rule) {
      duplicates.push(d);
      continue;
    }
    const declared = (rule.paths ?? []).map(p => resolve(p.replace(/^~/, process.env.HOME ?? '')));
    const uncovered = d.shadowed.filter(p => !declared.includes(p));
    if (declared.length === 0 || uncovered.length > 0) {
      // 声明没覆盖到的副本仍然是真问题，不能靠写个 name 就全放过。
      duplicates.push({ ...d, shadowed: uncovered.length ? uncovered : d.shadowed });
      continue;
    }
    allowedDuplicates.push({ ...d, reason: rule.reason });
  }
  return { count: skills.length, skills, broken, duplicates, excluded, allowedDuplicates, scannedRoots: options.roots };
}

export function doctor(result: ScanResult): { ok: boolean; problems: string[]; notes: string[] } {
  const problems: string[] = [];
  const notes: string[] = [];
  for (const b of result.broken) problems.push(`broken: ${basename(b.path)} -> ${b.reason}`);
  for (const d of result.duplicates) {
    problems.push(`duplicate-name: ${d.name} -> 采用 ${d.kept}，被遮蔽 ${d.shadowed.join(', ')}`);
  }
  // 有意同名：仍打印出来让人看得见，但不算问题（否则要么永久红、要么逼人删掉上游契约）。
  for (const d of result.allowedDuplicates ?? []) {
    notes.push(`duplicate-name-allowed: ${d.name} -> 采用 ${d.kept}（有意保留：${d.reason}）`);
  }
  for (const s of result.skills) {
    if (s.scope === 'company') continue;
    if (s.origin.startsWith('opensource:')) continue;
    if (!s.version) problems.push(`no-version: ${s.name}`);
  }
  return { ok: problems.length === 0, problems, notes };
}
