import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditSkills } from '../dist/audit.js';

const baseSkill = (name, path, publish) => ({
  name,
  description: 'Valid description for testing',
  version: '1.0.0',
  origin: 'personal:demo',
  path,
  visibility: 'closed',
  relation: 'own-private',
  publish,
});

test('auditSkills detects visibility conflict, secret leak, missing version and description', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-audit-test-'));
  try {
    const cleanFile = join(dir, 'clean.md');
    writeFileSync(cleanFile, '# Clean Skill\nNo secrets here.\n', 'utf8');

    // 拼接构造，避免仓库里出现可直接命中的明文凭据字面量（提交期凭据扫描会拦）
    const fakePat = ['ghp', '1234567890abcdef1234567890'].join('_');
    const leakyFile = join(dir, 'leaky.md');
    writeFileSync(leakyFile, `# Leaky\nplaceholder ${fakePat}\n`, 'utf8');

    const report = auditSkills([
      {
        name: 'closed-but-public',
        description: 'Valid description for testing',
        version: '1.0.0',
        origin: 'personal:demo',
        path: cleanFile,
        visibility: 'closed',
        relation: 'own-public',
        publish: null,
      },
      {
        name: 'leaky-skill',
        description: '',
        version: null,
        origin: 'personal:leaky',
        path: leakyFile,
        visibility: 'open',
        relation: 'own-private',
        publish: null,
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
        publish: null,
      },
    ]);
    assert.equal(report.ok, true);
    assert.equal(report.errorCount, 0);
    assert.equal(report.warnCount, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('auditSkills blocks publish: never and allows explicit allow', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-audit-publish-'));
  try {
    const file = join(dir, 'SKILL.md');
    writeFileSync(file, '# Publish gate\nNo secrets here.\n', 'utf8');
    const blocked = auditSkills([baseSkill('private-skill', file, 'never')]);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.errorCount, 1);
    assert.ok(blocked.findings.some((f) => f.rule === 'publish-never' && f.skill === 'private-skill'));

    const allowed = auditSkills([baseSkill('shareable-skill', file, 'allow')]);
    assert.equal(allowed.ok, true);
    assert.equal(allowed.errorCount, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('auditSkills blocks duplicate skill names (non-unique source of truth)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-audit-dup-'));
  try {
    const file = join(dir, 'SKILL.md');
    writeFileSync(file, '# Dup\nNo secrets here.\n', 'utf8');
    const report = auditSkills(
      [baseSkill('same-skill', file, null)],
      [{ name: 'same-skill', kept: file, shadowed: [join(dir, 'other', 'SKILL.md')] }],
    );
    assert.equal(report.ok, false);
    assert.equal(report.errorCount, 1);
    const finding = report.findings.find((f) => f.rule === 'duplicate-name');
    assert.ok(finding);
    assert.equal(finding.skill, 'same-skill');
    assert.match(finding.suggestion, /other/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
