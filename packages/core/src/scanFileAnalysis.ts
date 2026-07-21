import * as fs from 'fs/promises';
import * as path from 'path';
import { computeFileMetrics } from './computeMetrics.js';
import { parseExports } from './parseExports.js';
import { parseImports } from './parseImports.js';
import { resolveImports } from './resolveImports.js';
import type {
  AliasMapping,
  FileMetrics,
  RawExportInfo,
  RawImportInfo,
  ResolvedImport,
  ScanAnalysisCache,
  ScanError,
  UnresolvedImport,
} from './types.js';

const KNOWN_ASSET_EXTENSIONS = new Set([
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp4',
  '.mp3',
  '.webm',
  '.json',
]);

const ANALYSIS_BATCH_SIZE = 50;

export interface FileAnalysisOptions {
  rootDir: string;
  filePaths: string[];
  aliases: AliasMapping[];
  extensions: string[];
  includeTypeImports: boolean;
  includeDynamicImports: boolean;
  analysisCache?: ScanAnalysisCache;
}

export interface FileAnalysisResult {
  fileImportsMap: Map<string, ResolvedImport[]>;
  fileExportsMap: Map<string, RawExportInfo[]>;
  fileMetricsMap: Map<string, Omit<FileMetrics, 'instability'>>;
  unresolvedImports: UnresolvedImport[];
  unresolvedImportsByFile: Map<string, UnresolvedImport[]>;
  errors: ScanError[];
}

function isKnownAssetImport(specifier: string): boolean {
  const cleaned = specifier.split('?')[0]?.split('#')[0] ?? specifier;
  return KNOWN_ASSET_EXTENSIONS.has(path.extname(cleaned).toLowerCase());
}

export async function analyzeProjectFiles(
  options: FileAnalysisOptions,
): Promise<FileAnalysisResult> {
  const {
    rootDir,
    filePaths,
    aliases,
    extensions,
    includeTypeImports,
    includeDynamicImports,
    analysisCache,
  } = options;
  const fileImportsMap = new Map<string, ResolvedImport[]>();
  const fileExportsMap = new Map<string, RawExportInfo[]>();
  const fileMetricsMap = new Map<string, Omit<FileMetrics, 'instability'>>();
  const unresolvedImports: UnresolvedImport[] = [];
  const unresolvedImportsByFile = new Map<string, UnresolvedImport[]>();
  const errors: ScanError[] = [];

  analysisCache?.retain(new Set(filePaths));

  for (let index = 0; index < filePaths.length; index += ANALYSIS_BATCH_SIZE) {
    const batch = filePaths.slice(index, index + ANALYSIS_BATCH_SIZE);
    await Promise.all(
      batch.map(async (filePath) => {
        try {
          const fileStat = await fs.stat(filePath);
          const signature = `${fileStat.mtimeMs}:${fileStat.ctimeMs}:${fileStat.size}`;
          const cachedAnalysis = analysisCache?.get(filePath, signature);
          let rawImports: RawImportInfo[];

          if (cachedAnalysis) {
            rawImports = cachedAnalysis.rawImports;
            fileMetricsMap.set(filePath, cachedAnalysis.metrics);
            fileExportsMap.set(filePath, cachedAnalysis.rawExports);
          } else {
            const sourceCode = await fs.readFile(filePath, 'utf-8');
            const metrics = computeFileMetrics(sourceCode, filePath);
            const rawExports = parseExports(sourceCode, filePath);
            rawImports = parseImports(sourceCode, filePath);
            fileMetricsMap.set(filePath, metrics);
            fileExportsMap.set(filePath, rawExports);
            analysisCache?.set(filePath, { signature, rawImports, rawExports, metrics });
          }

          if (!includeTypeImports) rawImports = rawImports.filter((item) => !item.isTypeOnly);
          if (!includeDynamicImports) rawImports = rawImports.filter((item) => !item.isDynamic);

          const resolvedImports = resolveImports(rawImports, filePath, aliases, extensions);
          fileImportsMap.set(filePath, resolvedImports);

          const fileUnresolvedImports = resolvedImports
            .filter(
              (item) =>
                !item.resolvedPath &&
                item.error !== 'external_package' &&
                !isKnownAssetImport(item.raw.source),
            )
            .map<UnresolvedImport>((item) => ({
              file: path.relative(rootDir, filePath),
              absoluteFilePath: filePath,
              importSpecifier: item.raw.source,
              line: item.raw.line,
              isTypeOnly: item.raw.isTypeOnly,
              isDynamic: item.raw.isDynamic,
              ...(item.error ? { error: item.error } : {}),
            }));
          unresolvedImports.push(...fileUnresolvedImports);
          unresolvedImportsByFile.set(filePath, fileUnresolvedImports);
        } catch (error) {
          analysisCache?.delete(filePath);
          errors.push({ filePath, error: (error as Error).message });
          fileImportsMap.set(filePath, []);
          fileExportsMap.set(filePath, []);
          unresolvedImportsByFile.set(filePath, []);
        }
      }),
    );
  }

  return {
    fileImportsMap,
    fileExportsMap,
    fileMetricsMap,
    unresolvedImports,
    unresolvedImportsByFile,
    errors,
  };
}
