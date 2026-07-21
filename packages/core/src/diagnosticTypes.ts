export interface ArchitectureRule {
  from?: string;
  to?: string;
  entryPoints?: string[];
  deny?: { files?: string[]; modules?: string[] };
  severity?: 'error' | 'warning';
  message?: string;
}

export interface RuleViolation {
  source: string;
  target: string;
  importSpecifier: string;
  from: string;
  to: string;
  entryPoint?: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface RuleValidationResult {
  violations: RuleViolation[];
  errorCount: number;
  warningCount: number;
}

export interface DevDependencyInProd {
  file: string;
  module: string;
  importSpecifier: string;
  line: number;
  entryPoint: string;
  isTypeOnly: boolean;
}

export interface ImportConventionConfig {
  prefer?: 'relative' | 'absolute';
  aliasPrefix?: string;
  root?: string;
}

export interface ImportConventionViolation {
  file: string;
  target: string;
  importSpecifier: string;
  suggestedSpecifier: string;
  expected: 'relative' | 'absolute';
  line: number;
}

export interface UnusedExport {
  name: string;
  kind: 'named' | 'default' | 'reexport';
  isTypeOnly: boolean;
  line: number;
}

export interface UnresolvedImport {
  file: string;
  absoluteFilePath: string;
  importSpecifier: string;
  line: number;
  isTypeOnly: boolean;
  isDynamic: boolean;
  error?: string;
}
