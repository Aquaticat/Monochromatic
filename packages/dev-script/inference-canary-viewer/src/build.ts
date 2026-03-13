/**
 * Static site build script for the inference canary viewer.
 *
 * Reads enriched artifacts from the sibling inference-canary package,
 * generates a single-page HTML dashboard, and writes it to `dist/final/`.
 *
 * Exceeds 100 lines: top-level build orchestration script with sequential
 * pipeline steps that must remain in a single execution scope.
 */
import { mkdir, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { build as buildCss, } from '@monochromatic-dev/build-tool-css/ts';

import { readArtifacts, } from './data/read-artifacts.ts';
import { hasMultipleProbes, } from './data/viewer-types.ts';
import { computeThreshold, } from './data/threshold.ts';
import { renderSvgSprite, } from './data/model-icons.ts';
import { renderPage, } from './html/page.ts';
import { renderDashboard, } from './html/dashboard.ts';
import { renderOverview, type ModelSummary, } from './html/view-overview.ts';
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

/** Unique model labels across all entries */
const uniqueLabels = [...new Set(entries.map((entry) => entry.label))];

/** Map from model label to computed degradation threshold */
const thresholds = new Map<string, number>(
  uniqueLabels.map(function buildThreshold(label) {
    return [label, computeThreshold(label, entries).threshold];
  }),
);

//endregion Build model labels and thresholds

//region Build model summaries for the overview

/** Summaries for the overview table, one per model */
const summaries: ModelSummary[] = uniqueLabels.flatMap(function buildSummary(label) {
  const modelEntries = entries.filter((entry) => entry.label === label);
  /** Latest multi-probe run for meaningful overall score; fall back to latest run */
  const latestMultiProbe = modelEntries.filter(hasMultipleProbes).at(-1);
  const latest = latestMultiProbe ?? modelEntries.at(-1);
  if (latest === undefined) return [];

  const threshold = thresholds.get(label) ?? 0;
  return [{
    model: latest.model,
    label,
    latestScore: latest.overallScore,
    latestTimestamp: latest.timestamp,
    runCount: modelEntries.length,
    failed: latest.failed,
    threshold,
    degraded: !latest.failed && latest.overallScore < threshold,
  }];
});

//endregion Build model summaries

//region Render all HTML sections

console.error('[viewer] rendering HTML...');

const overviewHtml = renderOverview({ summaries, entries, });
const byModelHtml = renderByModel({ entries, thresholds, });
const byProbeHtml = renderByProbe({ entries, });
const overlaysHtml = await renderAllOverlays({ entries, probeDetails, });

const dashboardHtml = renderDashboard({ overviewHtml, byModelHtml, byProbeHtml, overlaysHtml, });
const spriteHtml = renderSvgSprite();
const pageHtml = renderPage({ body: spriteHtml + dashboardHtml, title: 'Inference canary dashboard', });

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
