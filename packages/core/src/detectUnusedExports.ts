import type { RawExportInfo, ResolvedImport, UnusedExport } from './types.js';

interface DetectUnusedExportsOptions {
  entryPointFiles?: Set<string>;
}

function pushMapValue<TKey, TValue>(
  map: Map<TKey, Set<TValue>>,
  key: TKey,
  value: TValue,
): boolean {
  const current = map.get(key);
  if (current) {
    const sizeBefore = current.size;
    current.add(value);
    return current.size !== sizeBefore;
  }

  map.set(key, new Set([value]));
  return true;
}

function markAllUsed(filePath: string, allUsedFiles: Set<string>): boolean {
  if (allUsedFiles.has(filePath)) {
    return false;
  }

  allUsedFiles.add(filePath);
  return true;
}

export function detectUnusedExports(
  fileImportsMap: Map<string, ResolvedImport[]>,
  fileExportsMap: Map<string, RawExportInfo[]>,
  options: DetectUnusedExportsOptions = {},
): Map<string, UnusedExport[]> {
  const entryPointFiles = options.entryPointFiles ?? new Set<string>();
  const directUsedNamesByFile = new Map<string, Set<string>>();
  const allUsedFiles = new Set<string>();
  const directExportNamesByFile = new Map<string, Set<string>>();

  for (const [filePath, exports] of fileExportsMap.entries()) {
    directExportNamesByFile.set(
      filePath,
      new Set(
        exports
          .filter((exportInfo) => exportInfo.kind !== 'export_all')
          .map((exportInfo) => exportInfo.name),
      ),
    );
  }

  for (const [sourceFile, resolvedImports] of fileImportsMap.entries()) {
    void sourceFile;
    for (const resolvedImport of resolvedImports) {
      const targetFile = resolvedImport.resolvedPath;
      const originKind = resolvedImport.raw.originKind ?? 'import';
      const referencedExports = resolvedImport.raw.referencedExports ?? [];
      if (!targetFile || originKind === 'reexport_named' || originKind === 'reexport_all') {
        continue;
      }

      if (
        resolvedImport.raw.isDynamic ||
        originKind === 'require' ||
        referencedExports.includes('*')
      ) {
        markAllUsed(targetFile, allUsedFiles);
        continue;
      }

      for (const exportName of referencedExports) {
        pushMapValue(directUsedNamesByFile, targetFile, exportName);
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const [filePath, exports] of fileExportsMap.entries()) {
      const directNames = directExportNamesByFile.get(filePath) ?? new Set<string>();
      const usedNames = directUsedNamesByFile.get(filePath) ?? new Set<string>();

      if (allUsedFiles.has(filePath)) {
        for (const exportInfo of exports) {
          if (!exportInfo.source) {
            continue;
          }

          const targetFile = fileImportsMap
            .get(filePath)
            ?.find(
              (resolvedImport) =>
                resolvedImport.raw.line === exportInfo.line &&
                resolvedImport.raw.source === exportInfo.source &&
                resolvedImport.resolvedPath,
            )?.resolvedPath;
          if (!targetFile) {
            continue;
          }

          if (exportInfo.kind === 'export_all') {
            changed = markAllUsed(targetFile, allUsedFiles) || changed;
            continue;
          }

          changed =
            pushMapValue(
              directUsedNamesByFile,
              targetFile,
              exportInfo.sourceExportName ?? exportInfo.name,
            ) || changed;
        }
      }

      for (const exportInfo of exports) {
        if (!exportInfo.source) {
          continue;
        }

        const targetFile = fileImportsMap
          .get(filePath)
          ?.find(
            (resolvedImport) =>
              resolvedImport.raw.line === exportInfo.line &&
              resolvedImport.raw.source === exportInfo.source &&
              resolvedImport.resolvedPath,
          )?.resolvedPath;
        if (!targetFile) {
          continue;
        }

        if (exportInfo.kind === 'export_all') {
          for (const usedName of usedNames) {
            if (directNames.has(usedName)) {
              continue;
            }
            changed = pushMapValue(directUsedNamesByFile, targetFile, usedName) || changed;
          }
          continue;
        }

        if (usedNames.has(exportInfo.name)) {
          changed =
            pushMapValue(
              directUsedNamesByFile,
              targetFile,
              exportInfo.sourceExportName ?? exportInfo.name,
            ) || changed;
        }
      }
    }
  }

  const unusedExportsByFile = new Map<string, UnusedExport[]>();
  for (const [filePath, exports] of fileExportsMap.entries()) {
    if (entryPointFiles.has(filePath)) {
      unusedExportsByFile.set(filePath, []);
      continue;
    }

    const usedNames = directUsedNamesByFile.get(filePath) ?? new Set<string>();
    const markAll = allUsedFiles.has(filePath);
    const unusedExports = exports
      .filter((exportInfo) => exportInfo.kind !== 'export_all')
      .filter((exportInfo) => !markAll && !usedNames.has(exportInfo.name))
      .map<UnusedExport>((exportInfo) => ({
        name: exportInfo.name,
        kind:
          exportInfo.kind === 'default'
            ? 'default'
            : exportInfo.kind === 'reexport'
              ? 'reexport'
              : 'named',
        isTypeOnly: exportInfo.isTypeOnly,
        line: exportInfo.line,
      }))
      .sort((a, b) => a.line - b.line || a.name.localeCompare(b.name));

    unusedExportsByFile.set(filePath, unusedExports);
  }

  return unusedExportsByFile;
}
