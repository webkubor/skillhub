import { readFileSync } from 'node:fs';
import type { RepoRelation } from './relations.js';
import type { VisibilityStatus } from './usage.js';

export type AuditSeverity = 'error' | 'warn';
export type AuditRule = 'visibility-conflict' | 'secret-leak' | 'missing-version' | 'missing-description';

export interface AuditFinding {
  skill: string;
  severity: AuditSeverity;
  rule: AuditRule;
  message: string;
  suggestion: string;
}

export interface AuditReport {
  ok: boolean;
  errorCount: number;
  warnCount: number;
  findings: AuditFinding[];
}

export interface AuditableSkill {
  name: string;
  description: string;
  version: string | null;
  origin: string;
  path: string;
  visibility: VisibilityStatus;
  relation: RepoRelation;
}

const SECRET_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'OpenAI/Anthropic Key', regex: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b/ },
  { label: 'GitHub PAT', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/ },
  { label: 'AWS Access Key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

export function auditSkills(skills: AuditableSkill[]): AuditReport {
  const findings: AuditFinding[] = [];

  for (const s of skills) {
    // 1. 闭源口径却关联公开仓库
    if (s.visibility === 'closed' && s.relation === 'own-public') {
      findings.push({
        skill: s.name,
        severity: 'error',
        rule: 'visibility-conflict',
        message: '本地口径标注为闭源，但关联仓库为 GitHub 自有公开仓',
        suggestion: '确认是否应切换为开源口径，或将闭源版本迁至私有仓/独立发行分支。',
      });
    }

    // 2. 敏感信息扫描
    try {
      const content = readFileSync(s.path, 'utf8');
      for (const pat of SECRET_PATTERNS) {
        if (pat.regex.test(content)) {
          findings.push({
            skill: s.name,
            severity: 'error',
            rule: 'secret-leak',
            message: `SKILL.md 疑似包含明文敏感凭据（${pat.label}）`,
            suggestion: '立即移除明文密钥，改用环境变量或 Kyvault 别名引用。',
          });
          break;
        }
      }
    } catch {
      // ignore unreadable file (doctor handles broken files)
    }

    // 3. 缺失版本号（自有非第三方）
    if (!s.version && !s.origin.startsWith('opensource:')) {
      findings.push({
        skill: s.name,
        severity: 'warn',
        rule: 'missing-version',
        message: '自有 Skill 缺少 frontmatter version 字段',
        suggestion: '在 SKILL.md 头部补充 version: 0.1.0，便于版本追溯与打包。',
      });
    }

    // 4. 缺失描述
    if (!s.description || s.description.trim().length < 4) {
      findings.push({
        skill: s.name,
        severity: 'warn',
        rule: 'missing-description',
        message: '缺少清晰的一句话 description，影响 Agent 自动触发召回率',
        suggestion: '在 SKILL.md frontmatter 补充明确触发条件与用途描述。',
      });
    }
  }

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warnCount = findings.filter((f) => f.severity === 'warn').length;

  return {
    ok: errorCount === 0,
    errorCount,
    warnCount,
    findings,
  };
}
