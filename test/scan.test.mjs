import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter, scanSkills, doctor } from '../dist/scan.js';

test('parseFrontmatter handles simple quoted and unquoted values', () => {
  const result = parseFrontmatter('---\nname: demo\nversion: "1.2.3"\nscope: company\n---\nbody');
  assert.equal(result.data?.name, 'demo');
  assert.equal(result.data?.version, '1.2.3');
  assert.equal(result.error, undefined);
});

test('parseFrontmatter rejects missing name', () => {
  const result = parseFrontmatter('---\ndescription: no name\n---\nbody');
  assert.equal(result.data, null);
  assert.match(result.error ?? '', /missing name/);
});

test('scanSkills scans nested skills, records category and broken files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'skillhub-test-'));
  await mkdir(join(root, 'devops', 'alpha'), { recursive: true });
  await mkdir(join(root, 'beta'), { recursive: true });
  await writeFile(join(root, 'devops', 'alpha', 'SKILL.md'), '---\nname: alpha\nversion: 1.0.0\npublish: never\n---\nbody');
  await writeFile(join(root, 'beta', 'SKILL.md'), '---\ndescription: broken\n---\nbody');
  const result = await scanSkills({ roots: [root] });
  assert.equal(result.count, 1);
  assert.equal(result.skills[0].name, 'alpha');
  assert.equal(result.skills[0].category, 'devops');
  assert.equal(result.skills[0].publish, 'never');
  assert.equal(result.broken.length, 1);
  const report = doctor(result);
  assert.equal(report.ok, false);
  assert.ok(report.problems.some(p => p.includes('broken:')));
});
