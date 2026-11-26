import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditSkills } from '../dist/audit.js';

test('auditSkills detects visibility conflict, secret leak, missing version and description', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-audit-test-'));
  try {
    const cleanFile = join(dir, 'clean.md');
    writeFileSync(cleanFile, '# Clean Skill\nNo secrets here.\n', 'utf8');

    const leakyFile = join(dir, 'leaky.md');
    writeFileSync(leakyFile, '# Leaky\napi_key = ghp_1234567890abcdef1234567890\n', 'utf8');

    const report = auditSkills([
      {
        name: 'closed-but-public',
        description: 'Valid description for testing',
        version: '1.0.0',
        origin: 'personal:demo',
        path: cleanFile,
        visibility: 'closed',
        relation: 'own-public',
      },
      {
        name: 'leaky-skill',
        description: '',
        version: null,
        origin: 'personal:leaky',
        path: leakyFile,
        visibility: 'open',
        relation: 'own-private',
      },
    ]);

    assert.equal(report.ok, false);
    assert.equal(report.errorCount, 2);
    assert.equal(report.warnCount, 2);
    assert.ok(report.findings.some((f) => f.skill === 'closed-but-public' && f.rule === 'visibility-conflict'));
    assert.ok(report.findings.some((f) => f.skill === 'leaky-skill' && f.rule === 'secret-leak'));
    assert.ok(report.findings.some((f) => f.skill === 'leaky-skill' && f.rule === 'missing-version'));
    assert.ok(report.findings.some((f) => f.skill === 'leaky-skill' && f.rule === 'missing-description'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('auditSkills passes cleanly when skills meet all launch gates', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-audit-pass-'));
  try {
    const file = join(dir, 'SKILL.md');
    writeFileSync(file, '# Good Skill\nAll clean.\n', 'utf8');
    const report = auditSkills([
      {
        name: 'good-skill',
        description: 'Well-documented production skill',
        version: '1.0.0',
        origin: 'opensource:webkubor',
        path: file,
        visibility: 'open',
        relation: 'own-public',
      },
    ]);
    assert.equal(report.ok, true);
    assert.equal(report.errorCount, 0);
    assert.equal(report.warnCount, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
