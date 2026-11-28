import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanSkills, doctor } from '../dist/scan.js';

async function makeSkill(root, dir, name, version) {
  await mkdir(join(root, dir), { recursive: true });
  await writeFile(join(root, dir, 'SKILL.md'), `---\nname: ${name}\nversion: ${version}\n---\nbody`);
}

test('excludePrefixes drops generated copies without reporting them as duplicates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'skillhub-excl-'));
  const generated = join(root, 'router');
  await makeSkill(root, 'real/thing', 'thing', '1.0.0');
  // 生成物：同 name 的另一份正文，位于排除前缀下
  await makeSkill(generated, 'v1/thing', 'thing', '9.9.9');

  const result = await scanSkills({ roots: [root], excludePrefixes: [generated] });
  assert.equal(result.count, 1);
  assert.equal(result.duplicates.length, 0, '排除目录不该制造同名冲突');
  assert.equal(result.excluded.length, 1);
  assert.match(result.excluded[0], /router/);
  // 被排除的路径仍要可见，不能静默丢弃
  assert.match(result.skills[0].path, /real\/thing/);
});

test('excludePrefixes matches by prefix boundary, not by substring', async () => {
  const root = await mkdtemp(join(tmpdir(), 'skillhub-excl2-'));
  const excludedDir = join(root, 'cache');
  await makeSkill(root, 'cache-real/thing', 'thing', '1.0.0');
  await makeSkill(excludedDir, 'x/other', 'other', '1.0.0');

  const result = await scanSkills({ roots: [root], excludePrefixes: [excludedDir] });
  // cache-real 不是 cache 的子路径，必须留下；cache/x/other 必须被排除
  assert.deepEqual(result.skills.map(s => s.name), ['thing']);
  assert.equal(result.excluded.length, 1);
  assert.match(result.excluded[0], /cache\/x\/other/);
});

test('allowedDuplicates only clears the exact declared shadowed paths', async () => {
  const rootA = await mkdtemp(join(tmpdir(), 'skillhub-allow-a-'));
  const rootB = await mkdtemp(join(tmpdir(), 'skillhub-allow-b-'));
  await makeSkill(rootA, 'skill', 'pair', '1.0.0');
  await makeSkill(rootB, 'skill', 'pair', '1.0.0');
  const shadowedPath = join(rootB, 'skill', 'SKILL.md');

  const allowed = await scanSkills({
    roots: [rootA, rootB],
    allowedDuplicates: [{ name: 'pair', paths: [shadowedPath], reason: '上游有意双份' }],
  });
  assert.equal(allowed.duplicates.length, 0);
  assert.equal(allowed.allowedDuplicates.length, 1);
  assert.equal(allowed.allowedDuplicates[0].reason, '上游有意双份');
  // doctor 不算问题，但要在 notes 里看得见
  const report = doctor(allowed);
  assert.ok(!report.problems.some(p => p.startsWith('duplicate-name:')));
  assert.ok(report.notes.some(n => n.startsWith('duplicate-name-allowed: pair')));
});

test('allowedDuplicates does not clear undeclared copies of the same name', async () => {
  const rootA = await mkdtemp(join(tmpdir(), 'skillhub-allow-c-'));
  const rootB = await mkdtemp(join(tmpdir(), 'skillhub-allow-d-'));
  const rootC = await mkdtemp(join(tmpdir(), 'skillhub-allow-e-'));
  await makeSkill(rootA, 'skill', 'trio', '1.0.0');
  await makeSkill(rootB, 'skill', 'trio', '1.0.0');
  await makeSkill(rootC, 'skill', 'trio', '1.0.0');

  const result = await scanSkills({
    roots: [rootA, rootB, rootC],
    allowedDuplicates: [{ name: 'trio', paths: [join(rootB, 'skill', 'SKILL.md')], reason: '只放过一份' }],
  });
  // 声明没覆盖到第三份 → 仍然是真问题，且只报没覆盖的那份
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.duplicates[0].shadowed.length, 1);
  assert.match(result.duplicates[0].shadowed[0], /skillhub-allow-e/);
});

test('allowedDuplicates without paths never clears anything', async () => {
  const rootA = await mkdtemp(join(tmpdir(), 'skillhub-allow-f-'));
  const rootB = await mkdtemp(join(tmpdir(), 'skillhub-allow-g-'));
  await makeSkill(rootA, 'skill', 'vague', '1.0.0');
  await makeSkill(rootB, 'skill', 'vague', '1.0.0');

  const result = await scanSkills({
    roots: [rootA, rootB],
    allowedDuplicates: [{ name: 'vague', reason: '没写路径' }],
  });
  assert.equal(result.duplicates.length, 1, '不写被遮蔽路径就不能当万能豁免');
});
