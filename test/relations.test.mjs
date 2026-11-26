import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRelations } from '../dist/relations.js';

test('buildRelations classifies own, third-party and unlinked skills', async () => {
  const root = await mkdtemp(join(tmpdir(), 'skillhub-rel-'));
  for (const [dir, body] of [
    ['own', '---\nname: own-skill\nversion: 1.0.0\nurl: https://github.com/webkubor/demo-repo\n---\nbody'],
    ['third', '---\nname: third-skill\nversion: 1.0.0\nrepository: https://github.com/other/demo-skill\n---\nbody'],
    ['none', '---\nname: none-skill\nversion: 1.0.0\n---\nbody'],
  ]) {
    await mkdir(join(root, dir), { recursive: true });
    await writeFile(join(root, dir, 'SKILL.md'), body);
  }
  const skills = ['own-skill', 'third-skill', 'none-skill'].map(name => ({
    name, description: '', version: '1.0.0', scope: '', origin: 'private', category: 'test',
    path: join(root, name === 'own-skill' ? 'own' : name === 'third-skill' ? 'third' : 'none', 'SKILL.md'),
  }));
  const rel = await buildRelations(skills, 'webkubor', new Set(['github.com/webkubor/demo-repo']));
  const own = rel.find(r => r.skill === 'own-skill');
  const third = rel.find(r => r.skill === 'third-skill');
  const none = rel.find(r => r.skill === 'none-skill');
  assert.equal(own?.relation, 'own-public');
  assert.equal(own?.repo?.url, 'https://github.com/webkubor/demo-repo');
  assert.equal(third?.relation, 'third-party');
  assert.equal(none?.relation, 'unlinked');
});
