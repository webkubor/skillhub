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

export interface ScanResult {
  count: number;
  skills: SkillRecord[];
  broken: Array<{ path: string; reason: string }>;
  scannedRoots: string[];
}
