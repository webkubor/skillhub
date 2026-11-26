export type LifecycleStatus = 'draft' | 'active' | 'deprecated' | 'archived';
export type VisibilityStatus = 'open' | 'closed';
export type RepoRelation = 'own-public' | 'own-private' | 'third-party' | 'unlinked';

export interface RepoLink {
  host: 'github.com' | 'gitlab.com' | 'other';
  owner: string;
  repo: string;
  url: string;
}

export interface HostStatus {
  host: string;
  state: 'ok' | 'fail' | 'unknown';
  user: string;
  light: string;
}

export interface CliStatus {
  cli: 'gh' | 'glab';
  installed: boolean;
  hosts: HostStatus[];
  light: string;
  detail: string;
}

export interface SkillItem {
  name: string;
  description: string;
  version: string | null;
  scope: string;
  origin: string;
  category: string;
  path: string;
  lifecycle: LifecycleStatus;
  lifecycle_note: string;
  visibility: VisibilityStatus;
  visibility_note: string;
  visibility_source: 'explicit' | 'inferred';
  total_uses: number;
  success_rate: number;
  uses_7d: number;
  uses_30d: number;
  agents: Array<{ agent: string; uses: number }>;
  unique_agents: number;
  last_used_at: string;
  relation: RepoRelation;
  repo: RepoLink | null;
  via: 'git-remote' | 'frontmatter' | null;
}

export interface StatsRow {
  skill: string;
  uses: number;
  success: number;
  partial: number;
  failed: number;
  success_rate: number;
  last_used_at: string;
}

export interface AgentStatRow {
  skill: string;
  agent: string;
  uses: number;
  success: number;
  partial: number;
  failed: number;
  last_used_at: string;
}

export interface ProblemRow {
  id: string;
  skill: string;
  outcome: string;
  agent: string;
  session: string;
  problem: string;
  created_at: string;
}

export interface AuditFinding {
  skill: string;
  severity: 'error' | 'warn';
  rule: 'visibility-conflict' | 'secret-leak' | 'missing-version' | 'missing-description';
  message: string;
  suggestion: string;
}

export interface AuditReport {
  ok: boolean;
  errorCount: number;
  warnCount: number;
  findings: AuditFinding[];
}

export interface OverviewSummary {
  totalSkills: number;
  activeSkills: number;
  archivedSkills: number;
  brokenCount: number;
  doctorOk: boolean;
  doctorProblemsCount: number;
  auditOk: boolean;
  auditErrorCount: number;
  auditWarnCount: number;
  openCount: number;
  closedCount: number;
  totalUses: number;
  uses7d: number;
  uses30d: number;
  overallSuccessRate: number;
  ownPublicCount: number;
  ownPrivateCount: number;
  thirdPartyCount: number;
  unlinkedCount: number;
}

export interface OverviewResponse {
  summary: OverviewSummary;
  account: string | null;
  cliStatus: CliStatus[];
  doctor: { ok: boolean; problems: string[] };
  audit: AuditReport;
  skills: SkillItem[];
  stats: StatsRow[];
  agents: AgentStatRow[];
  problems: ProblemRow[];
  broken: Array<{ path: string; reason: string }>;
  scannedRoots: string[];
  refreshedAt: string;
}

export interface SkillSourceResponse {
  name: string;
  path: string;
  content: string;
  updatedAt?: string;
  sizeBytes?: number;
}

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  date: string;
  author: string;
  subject: string;
}

export interface SkillHistoryResponse {
  name: string;
  path: string;
  commits: GitCommitInfo[];
}

export interface SkillDiffResponse {
  name: string;
  from: string;
  to: string | null;
  diff: string;
}
