/**
 * Static site build script for the inference canary viewer.
 *
 * Reads enriched artifacts from the sibling inference-canary package,
 * generates a single-page HTML dashboard, and writes it to `dist/final/`.
 */
import { mkdir, readFile, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { models, } from '@monochromatic-dev/dev-script-inference-canary/src/models.ts';

import { readArtifacts, } from './data/read-artifacts.ts';
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

/** Map from OpenRouter model ID to short display label */
const modelLabels = new Map<string, string>(
  models.map((model) => [model.id, model.label]),
);

// Add labels for any models in artifacts not in the current registry
for (const entry of entries) {
  if (!modelLabels.has(entry.model)) {
    /** Extract short name from model ID: "vendor/model-name" -> "model-name" */
    const shortName = entry.model.split('/').pop() ?? entry.model;
    modelLabels.set(entry.model, shortName);
  }
}

/** Map from model ID to computed degradation threshold */
const thresholds = new Map<string, number>();
for (const modelId of new Set(entries.map((entry) => entry.model))) {
  const result = computeThreshold(modelId, entries);
  thresholds.set(modelId, result.threshold);
}

//endregion Build model labels and thresholds

//region Build model summaries for the overview

/** Summaries for the overview table, one per model */
const summaries: ModelSummary[] = [];
for (const modelId of new Set(entries.map((entry) => entry.model))) {
  const modelEntries = entries.filter((entry) => entry.model === modelId);
  const latest = modelEntries.at(-1);
  if (latest === undefined) continue;

  const threshold = thresholds.get(modelId) ?? 0;
  summaries.push({
    model: modelId,
    label: modelLabels.get(modelId) ?? modelId,
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

//region Concatenate CSS files and write output

/** CSS source files in the order they should be concatenated */
const CSS_FILES = ['base.css', 'chart.css', 'views.css', 'overlay.css', 'diff.css', 'glow.css'];

const cssContents = await Promise.all(
  CSS_FILES.map(async (file) => readFile(join(CSS_DIR, file), 'utf8')),
);
const combinedCss = cssContents.join('\n');

await mkdir(DIST_DIR, { recursive: true, });
await Promise.all([
  writeFile(join(DIST_DIR, 'index.html'), pageHtml, 'utf8'),
  writeFile(join(DIST_DIR, 'style.css'), combinedCss, 'utf8'),
]);

console.error(`[viewer] wrote ${join(DIST_DIR, 'index.html')}`);
console.error(`[viewer] wrote ${join(DIST_DIR, 'style.css')}`);

//endregion Concatenate CSS and write output
