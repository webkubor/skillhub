import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCliStatus } from '../dist/cli-status.js';

test('checkCliStatus detects gh and glab with per-host lights', () => {
  const status = checkCliStatus();
  const gh = status.find(s => s.cli === 'gh');
  const glab = status.find(s => s.cli === 'glab');
  assert.ok(gh);
  assert.ok(glab);
  assert.equal(typeof gh.installed, 'boolean');
  assert.ok(['🟢', '🔴', '🟡', '⚪'].includes(gh.light));
  for (const host of glab.hosts) {
    assert.ok(host.host);
    assert.ok(['ok', 'fail', 'unknown'].includes(host.state));
  }
});
