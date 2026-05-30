// ============================================================================
// JSON Formatter — Outputs the dependency graph as structured JSON
// ============================================================================
// This is the default output format. It produces machine-readable JSON
// suitable for AI agents (Claude, Codex, Antigravity), CI pipelines,
// and downstream tooling.
// ============================================================================

import { exportGraphJSON } from '@depxray/core';
import type { ScanResult } from '@depxray/core';

/**
 * Format a ScanResult as JSON.
 *
 * @param result - The scan result to format
 * @param pretty - Whether to indent the JSON (default: true)
 * @returns JSON string
 */
export function formatAsJSON(result: ScanResult, pretty: boolean = true): string {
  return exportGraphJSON(result.graph, pretty);
}
