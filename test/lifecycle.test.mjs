import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UsageStore } from '../dist/usage.js';
import { buildProfiles } from '../dist/profile.js';

test('lifecycle, frequency and agent aggregation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-life-'));
  const store = new UsageStore(join(dir, 'u.sqlite'));
  store.record({ skill: 'alpha', outcome: 'success', agent: 'codex' });
  store.record({ skill: 'alpha', outcome: 'success', agent: 'codex' });
  store.record({ skill: 'alpha', outcome: 'failed', agent: 'claude', problem: 'x' });
  store.setLifecycle('alpha', 'deprecated', 'superseded by beta');

  assert.equal(store.lifecycle('alpha')[0].status, 'deprecated');
  assert.equal(store.lifecycle('alpha')[0].note, 'superseded by beta');
  const freq = store.frequency(7);
  assert.equal(freq.find(r => r.skill === 'alpha')?.uses, 3);
  assert.equal(freq.find(r => r.skill === 'alpha')?.agents, 2);
  const agents = store.agents('alpha');
  assert.equal(agents.length, 2);
  assert.equal(agents[0].agent, 'codex');
  assert.equal(agents[0].uses, 2);

  const profiles = buildProfiles([
    { name: 'alpha', description: '', version: '1.2.0', scope: '', origin: 'private', category: 'x', path: '/x' },
    { name: 'unused', description: '', version: null, scope: '', origin: 'private', category: 'x', path: '/y' },
  ], store);
  const a = profiles.find(p => p.name === 'alpha');
  const u = profiles.find(p => p.name === 'unused');
  assert.equal(a?.version, '1.2.0');
  assert.equal(a?.lifecycle, 'deprecated');
  assert.equal(a?.total_uses, 3);
  assert.equal(a?.uses_7d, 3);
  assert.equal(a?.unique_agents, 2);
  assert.equal(u?.lifecycle, 'active'); // 未登记默认 active
  assert.equal(u?.total_uses, 0);
  store.close();
});

test('lifecycle rejects invalid status', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-life-'));
  const store = new UsageStore(join(dir, 'u.sqlite'));
  assert.throws(() => store.setLifecycle('x', 'alive'), /bad status/);
  store.close();
});
