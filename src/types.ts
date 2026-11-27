export interface Frontmatter {
  name?: string;
  description?: string;
  version?: string;
  scope?: string;
  origin?: string;
  category?: string;
  [key: string]: unknown;
}

export interface SkillRecord {
  name: string;
  description: string;
  version: string | null;
  scope: string;
  origin: string;
  category: string;
  publish: string | null;
  path: string;
}

export interface ScanOptions {
  roots: string[];
  ignoreDirs?: string[];
}

export interface DuplicateSkill {
  name: string;
  /** 实际采用的那一份 */
  kept: string;
  /** 被静默遮蔽的其余路径（按扫描顺序） */
  shadowed: string[];
}

export interface ScanResult {
  count: number;
  skills: SkillRecord[];
  broken: Array<{ path: string; reason: string }>;
  /** 同名多份：先扫到的生效，其余被遮蔽。非空即说明真源不唯一。 */
  duplicates: DuplicateSkill[];
  scannedRoots: string[];
}
