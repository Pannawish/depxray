/** Raw import information extracted from a source file before path resolution. */
export interface RawImportInfo {
  source: string;
  specifiers: string[];
  referencedExports?: string[];
  isTypeOnly: boolean;
  isDynamic: boolean;
  line: number;
  originKind?: 'import' | 'reexport_named' | 'reexport_all' | 'dynamic' | 'require';
}

/** Raw export information extracted from a source file. */
export interface RawExportInfo {
  name: string;
  kind: 'named' | 'default' | 'reexport' | 'export_all';
  isTypeOnly: boolean;
  line: number;
  source?: string;
  sourceExportName?: string;
}

/** A raw import paired with its resolved local file, when available. */
export interface ResolvedImport {
  raw: RawImportInfo;
  resolvedPath: string | null;
  error?: string;
}

/** A path alias loaded from tsconfig.json, jsconfig.json, or a workspace. */
export interface AliasMapping {
  prefix: string;
  paths: string[];
}

export const DEFAULT_IGNORE_PATTERNS: string[] = [
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  '.git',
  '.cache',
  '.turbo',
  '.depxray',
  '__mocks__',
];

export const DEFAULT_EXTENSIONS: string[] = ['.js', '.jsx', '.ts', '.tsx'];

export const DEFAULT_ENTRY_POINT_PATTERNS: string[] = [
  '**/index.*',
  '**/main.*',
  '**/app.*',
  '**/App.*',
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.config.*',
  '**/vite.config.*',
  '**/next.config.*',
];
