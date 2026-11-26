import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UsageStore } from '../dist/usage.js';

test('UsageStore records events and computes stats', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-usage-'));
  const store = new UsageStore(join(dir, 'usage.sqlite'));
  store.record({ skill: 'alpha', outcome: 'success', agent: 'a1' });
  store.record({ skill: 'alpha', outcome: 'partial', agent: 'a1', problem: 'x' });
  store.record({ skill: 'beta', outcome: 'failed', problem: 'y' });
  const stats = store.stats();
  assert.equal(stats.length, 2);
  const alpha = stats.find(s => s.skill === 'alpha');
  assert.equal(alpha?.uses, 2);
  assert.equal(alpha?.success, 1);
  assert.equal(alpha?.partial, 1);
  assert.equal(alpha?.success_rate, 0.5);
  const problems = store.problems('alpha');
  assert.equal(problems.length, 1);
  assert.equal(problems[0].problem, 'x');
  store.close();
});

test('UsageStore rejects invalid events', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-usage-'));
  const store = new UsageStore(join(dir, 'usage.sqlite'));
  assert.throws(() => store.record({ skill: '', outcome: 'success' }), /required/);
  assert.throws(() => store.record({ skill: 'a', outcome: 'success', problem: 'x' }), /success cannot/);
  store.close();
});
