/**
 * Static site build script for the inference canary viewer.
 *
 * Reads enriched artifacts from the sibling inference-canary package,
 * generates a single-page HTML dashboard, and writes it to `dist/final/`.
 */
import { mkdir, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { build as buildCss, } from '@monochromatic-dev/build-tool-css/ts';
import { models, } from '@monochromatic-dev/dev-script-inference-canary/src/models.ts';

import { readArtifacts, } from './data/read-artifacts.ts';
import { hasMultipleProbes, } from './data/viewer-types.ts';
import { computeThreshold, } from './data/threshold.ts';
import { renderPage, } from './html/page.ts';
import { renderDashboard, } from './html/dashboard.ts';
import { renderOverview, } from './html/view-overview.ts';
import type { ModelSummary, } from './html/view-overview.ts';
import { renderByModel, } from './html/view-model.ts';
import { renderByProbe, } from './html/view-probe.ts';
import { renderAllOverlays, } from './html/detail-overlay.ts';

export {};

/** Absolute path to this package's root directory */
const PACKAGE_DIR: string = new URL('..', import.meta.url).pathname;
/** Output directory for the generated site */
const DIST_DIR = join(PACKAGE_DIR, 'dist', 'final');
/** Directory containing CSS source files */
const CSS_DIR = join(PACKAGE_DIR, 'src', 'css');

console.error('[viewer] reading artifacts...');
const { entries, probeDetails, } = await readArtifacts();

console.error(`[viewer] ${String(entries.length)} runs, ${String(probeDetails.size)} probe details`);

//region Build model labels and thresholds from the canonical model registry

/** Map from model label to short display label (identity for current models, fallback for old artifacts) */
const modelLabels = new Map<string, string>(
  models.map((model) => [model.label, model.label]),
);

// Add labels for any models in artifacts not in the current registry
for (const entry of entries) {
  if (!modelLabels.has(entry.label)) {
    modelLabels.set(entry.label, entry.label);
  }
}

/** Map from model label to computed degradation threshold */
const thresholds = new Map<string, number>();
for (const label of new Set(entries.map((entry) => entry.label))) {
  const result = computeThreshold(label, entries);
  thresholds.set(label, result.threshold);
}

//endregion Build model labels and thresholds

//region Build model summaries for the overview

/** Summaries for the overview table, one per model */
const summaries: ModelSummary[] = [];
for (const label of new Set(entries.map((entry) => entry.label))) {
  const modelEntries = entries.filter((entry) => entry.label === label);
  /** Latest multi-probe run for meaningful overall score; fall back to latest run */
  const latestMultiProbe = modelEntries.filter(hasMultipleProbes).at(-1);
  const latest = latestMultiProbe ?? modelEntries.at(-1);
  if (latest === undefined) continue;

  const threshold = thresholds.get(label) ?? 0;
  summaries.push({
    model: latest.model,
    label,
    latestScore: latest.overallScore,
    latestTimestamp: latest.timestamp,
    runCount: modelEntries.length,
    failed: latest.failed,
    threshold,
    degraded: !latest.failed && latest.overallScore < threshold,
  });
}

//endregion Build model summaries

//region Render all HTML sections

console.error('[viewer] rendering HTML...');

const overviewHtml = renderOverview(summaries, entries);
const byModelHtml = renderByModel(entries, modelLabels, thresholds);
const byProbeHtml = renderByProbe(entries, modelLabels);
const overlaysHtml = await renderAllOverlays(entries, probeDetails, modelLabels);

const dashboardHtml = renderDashboard(overviewHtml, byModelHtml, byProbeHtml, overlaysHtml);
const pageHtml = renderPage(dashboardHtml, 'Inference canary dashboard');

//endregion Render all HTML sections

//region Build CSS and write output

await mkdir(DIST_DIR, { recursive: true, });

const [, cssResult] = await Promise.all([
  writeFile(join(DIST_DIR, 'index.html'), pageHtml, 'utf8'),
  buildCss({ input: join(CSS_DIR, 'index.css'), output: join(DIST_DIR, 'style.css'), }),
]);

console.error(`[viewer] wrote ${join(DIST_DIR, 'index.html')}`);
console.error(`[viewer] wrote ${join(DIST_DIR, 'style.css')} (${String(cssResult.length)} bytes)`);

//endregion Build CSS and write output
