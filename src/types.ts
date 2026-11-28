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
  explicitSkill?: string;
  ignoreDirs?: string[];
  /**
   * 真实路径前缀黑名单（按 realpath 判定）。用于排除「有 SKILL.md 但不是真源」的目录：
   * 工具生成的路由缓存、编进二进制的内嵌副本等。被排除的路径既不计数也不报冲突。
   */
  excludePrefixes?: string[];
  /**
   * 有意保留的同名对（必须写理由）。仅当被遮蔽路径与声明的 paths 全部对上才放行，
   * 放行后进 allowedDuplicates（doctor 仍打印，但不计为问题）。
   */
  allowedDuplicates?: AllowedDuplicate[];
}

/** 上游有意让同一 name 存在两份正文（如 Claude 的指针 shim）。必须写清理由。 */
export interface AllowedDuplicate {
  name: string;
  /** 允许被遮蔽的绝对路径（~ 开头支持）。不写则只允许该 name 的任意一份，慎用。 */
  paths?: string[];
  reason: string;
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
  /** 命中 excludePrefixes 的 SKILL.md（生成物/内嵌副本），不计入 skills 也不报冲突。 */
  excluded: string[];
  /** 声明为「有意同名」的冲突，doctor 打印但不计为问题。 */
  allowedDuplicates: Array<DuplicateSkill & { reason: string }>;
  scannedRoots: string[];
}
