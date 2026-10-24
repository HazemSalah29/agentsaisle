import type { AuditFinding, AuditSeverity } from "@agentsaisle/registry-schema";

export type FileKind = "skill-md" | "instruction" | "script" | "binary" | "other";

export interface SkillFile {
  /** POSIX path relative to the skill folder. */
  path: string;
  kind: FileKind;
  bytes: number;
  /** Executable by magic bytes or extension (S04). Only set for binaries. */
  executable?: boolean;
  /** Absent for binaries. */
  lines: string[];
  /** True for lines inside a fenced code block (markdown files only). */
  fenced: boolean[];
  /** Info string of the enclosing fence ("bash", ""), per line. */
  fenceInfo: string[];
  /** Raw text, absent for binaries. */
  text?: string;
}

export interface SymlinkInfo {
  path: string;
  target: string;
  escapes: boolean;
}

/** A non-executable media file over the per-file limit; it is listed but not read. */
export interface SkippedFile {
  path: string;
  bytes: number;
}

export interface LoadedSkill {
  root: string;
  files: SkillFile[];
  skipped: SkippedFile[];
  symlinks: SymlinkInfo[];
  hidden: string[];
  /** Raw text of .aisleaudit.yaml, if present. */
  suppressionFile?: string;
  totalBytes: number;
}

export interface Frontmatter {
  present: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface Ctx {
  skill: LoadedSkill;
  frontmatter: Frontmatter;
  /** Folder name the skill is expected to match (S02). */
  folderName: string;
  hasLockfile: boolean;
}

export type Rule = (ctx: Ctx) => AuditFinding[];

export interface LineInfo {
  file: SkillFile;
  /** 1-based. */
  n: number;
  text: string;
  fenced: boolean;
}

export type Scope =
  /** Scripts only. */
  | "script"
  /** SKILL.md and other instruction files, every line. */
  | "instruction"
  /** Scripts (every line) plus fenced code in instruction files. */
  | "code"
  /** Every text file. */
  | "text";

export interface LinePattern {
  rule: string;
  severity: AuditSeverity;
  title: string;
  why: string;
  fix: string;
  re: RegExp;
  scope: Scope;
  /** Scan comment lines in scripts too (default: skip them). */
  comments?: boolean;
  /** Lower to medium when the line sits in a "bad example" or quoted context in an instruction file. */
  quotable?: boolean;
  /** Return true to ignore this match. */
  skip?: (line: LineInfo, m: RegExpExecArray) => boolean;
}
