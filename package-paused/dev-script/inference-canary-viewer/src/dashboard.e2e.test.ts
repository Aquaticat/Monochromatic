/**
 * E2e tests for the inference canary dashboard.
 *
 * Verifies the full interaction chain: view switching, scatter point popovers,
 * probe card navigation, and collapsible detail sections. Tests run against
 * the pre-built `dist/final/index.html`; build the dashboard first.
 */

import { join, } from 'node:path';
import { pathToFileURL, } from 'node:url';

import {
  expect,
  type Page,
  test,
} from '@playwright/test';

/** Absolute file URL to the built dashboard */
const DASHBOARD_URL = pathToFileURL(
  join(import.meta.dirname, '..', 'dist', 'final', 'index.html',),
)
  .href;

/**
 * Locates a popover element by its ID using the browser's `getElementById`.
 *
 * IDs contain characters (spaces, colons, dots) that break CSS selectors.
 * Using `page.evaluate` with `getElementById` avoids the need for escaping.
 * @param page - Playwright page
 * @param id - popover element ID
 * @returns locator for the popover element
 *
 * @example
 * ```ts
 * const overlay = popoverById({ page, id: 'Sonnet 4.6-2026-03-06T12:00:00.000Z', });
 * await expect(overlay,).toBeVisible();
 * ```
 */
function popoverById(
  { page, id, }: { page: Page; id: string; },
): ReturnType<Page['locator']> {
  return page.locator(`id=${id}`,);
}

//region View switching

test.describe('view switching', () => {
  test('overview is open by default, other views are closed', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    const overview = page.locator('.view-section:has(> summary:text("Overview"))',);
    const byModel = page.locator('.view-section:has(> summary:text("By model"))',);
    const byProbe = page.locator('.view-section:has(> summary:text("By probe"))',);

    await expect(overview,).toHaveAttribute('open', '',);
    await expect(byModel,).not.toHaveAttribute('open', '',);
    await expect(byProbe,).not.toHaveAttribute('open', '',);
  });

  test('clicking "By model" opens its view', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    await page.locator('.view-section > summary:text("By model")',).click();
    const byModel = page.locator('.view-section:has(> summary:text("By model"))',);
    await expect(byModel,).toHaveAttribute('open', '',);
  });

  test('clicking "By probe" opens its view', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    await page.locator('.view-section > summary:text("By probe")',).click();
    const byProbe = page.locator('.view-section:has(> summary:text("By probe"))',);
    await expect(byProbe,).toHaveAttribute('open', '',);
  });
});

//endregion View switching

//region Overview

test.describe('overview', () => {
  test('scatter chart has at least one data point', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    const points = page.locator(
      '.view-section:has(> summary:text("Overview")) .chart-point',
    );
    await expect(points.first(),).toBeAttached();
  });

  test('summary table has model rows', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    const rows = page.locator('.overview-table tbody tr',);
    await expect(rows.first(),).toBeAttached();
  });

  test('scatter point opens run overlay popover', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    const point = page
      .locator('.view-section:has(> summary:text("Overview")) .chart-point',)
      .first();
    const targetId = await point.getAttribute('popovertarget',);
    const overlay = popoverById({ page, id: targetId ?? '', },);

    await expect(overlay,).not.toBeVisible();
    await point.click();
    await expect(overlay,).toBeVisible();
  });
});

//endregion Overview

//region Run overlay to probe overlay

test.describe('run overlay to probe overlay', () => {
  test('run overlay shows probe cards that open probe overlays', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    // Click a scatter point to open the run overlay
    const point = page
      .locator('.view-section:has(> summary:text("Overview")) .chart-point',)
      .first();
    const targetId = await point.getAttribute('popovertarget',);
    const runOverlay = popoverById({ page, id: targetId ?? '', },);

    await point.click();
    await expect(runOverlay,).toBeVisible();

    // Run overlay should contain at least one probe card button
    const probeCard = runOverlay.locator('.probe-card',).first();
    await expect(probeCard,).toBeVisible();

    // Click probe card to open probe overlay
    const probeTargetId = await probeCard.getAttribute('popovertarget',);
    const probeOverlay = popoverById({ page, id: probeTargetId ?? '', },);

    await probeCard.click();
    await expect(probeOverlay,).toBeVisible();
  });

  test('probe overlay has a title with score', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    const point = page
      .locator('.view-section:has(> summary:text("Overview")) .chart-point',)
      .first();
    await point.click();

    const targetId = await point.getAttribute('popovertarget',);
    const runOverlay = popoverById({ page, id: targetId ?? '', },);
    const probeCard = runOverlay.locator('.probe-card',).first();
    await probeCard.click();

    const probeTargetId = await probeCard.getAttribute('popovertarget',);
    const probeOverlay = popoverById({ page, id: probeTargetId ?? '', },);
    const title = probeOverlay.locator('.detail-popover-title',);

    await expect(title,).toBeVisible();
    await expect(title,).not.toBeEmpty();
  });
});

//endregion Run overlay to probe overlay

//region Probe overlay collapsible sections

test.describe('probe overlay collapsible sections', () => {
  test('collapsible sections expand on click', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    // Navigate to a probe overlay: scatter point -> run overlay -> probe card
    const point = page
      .locator('.view-section:has(> summary:text("Overview")) .chart-point',)
      .first();
    await point.click();

    const targetId = await point.getAttribute('popovertarget',);
    const runOverlay = popoverById({ page, id: targetId ?? '', },);
    const probeCard = runOverlay.locator('.probe-card',).first();
    await probeCard.click();

    const probeTargetId = await probeCard.getAttribute('popovertarget',);
    const probeOverlay = popoverById({ page, id: probeTargetId ?? '', },);

    // Find any collapsible section inside the probe overlay
    const collapsible = probeOverlay.locator('.collapsible-section',).first();
    const hasCollapsible = await collapsible.count() > 0;

    if (hasCollapsible) {
      await expect(collapsible,).not.toHaveAttribute('open', '',);
      await collapsible.locator('summary',).click();
      await expect(collapsible,).toHaveAttribute('open', '',);
    }
  });
});

//endregion Probe overlay collapsible sections

//region By model deep navigation

test.describe('by model deep navigation', () => {
  test('model section -> probe section -> scatter point -> overlay chain', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    // 1. Open "By model" view
    await page.locator('.view-section > summary:text("By model")',).click();
    const byModel = page.locator('.view-section:has(> summary:text("By model"))',);

    // 2. Open first model section
    const modelSection = byModel.locator('.model-section',).first();
    await modelSection.locator('> summary',).click();
    await expect(modelSection,).toHaveAttribute('open', '',);

    // 3. Open first probe section within the model
    const probeSection = modelSection.locator('.probe-section',).first();
    await probeSection.locator('> summary',).click();
    await expect(probeSection,).toHaveAttribute('open', '',);

    // 4. Click a scatter point in the probe chart
    const point = probeSection.locator('.chart-point',).first();
    const targetId = await point.getAttribute('popovertarget',);
    await point.click();

    const overlay = popoverById({ page, id: targetId ?? '', },);
    await expect(overlay,).toBeVisible();
  });
});

//endregion By model deep navigation

//region By probe deep navigation

test.describe('by probe deep navigation', () => {
  test('probe section -> model section -> scatter point -> overlay chain', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    // 1. Open "By probe" view
    await page.locator('.view-section > summary:text("By probe")',).click();
    const byProbe = page.locator('.view-section:has(> summary:text("By probe"))',);

    // 2. Open first probe section
    const probeSection = byProbe.locator('.probe-section',).first();
    await probeSection.locator('> summary',).click();
    await expect(probeSection,).toHaveAttribute('open', '',);

    // 3. Open first model section within the probe
    const modelSection = probeSection.locator('.model-section',).first();
    await modelSection.locator('> summary',).click();
    await expect(modelSection,).toHaveAttribute('open', '',);

    // 4. Click a scatter point
    const point = modelSection.locator('.chart-point',).first();
    const targetId = await point.getAttribute('popovertarget',);
    await point.click();

    const overlay = popoverById({ page, id: targetId ?? '', },);
    await expect(overlay,).toBeVisible();
  });
});

//endregion By probe deep navigation

//region Popover ID wiring integrity

test.describe('popover ID wiring', () => {
  test('every popovertarget references an existing element', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    const brokenTargets = await page.evaluate(() => {
      const buttons = document.querySelectorAll<HTMLButtonElement>('[popovertarget]',);
      const broken: string[] = [];
      for (const button of buttons) {
        const targetId = button.getAttribute('popovertarget',);
        if ((targetId !== null)
          && (document.querySelector<HTMLElement>(`#${targetId}`,) === null))
        {
          broken.push(targetId,);
        }
      }
      return [...new Set(broken,),];
    },);

    expect(brokenTargets,).toEqual([],);
  });

  test('every popover element is a valid popover', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    const invalidPopovers = await page.evaluate(() => {
      const popovers = document.querySelectorAll<HTMLElement>('[popover]',);
      const invalid: string[] = [];
      for (const popover of popovers) {
        if (popover.id === '')
          invalid.push('(no id)',);
        if (popover.getAttribute('popover',) !== 'auto')
          invalid.push(`${popover.id}: popover="${popover.getAttribute('popover',)}"`,);
      }
      return invalid;
    },);

    expect(invalidPopovers,).toEqual([],);
  });
});

//endregion Popover ID wiring integrity

//region Data visibility

test.describe('data visibility', () => {
  test('all models in summary table have scores', async ({ page, },) => {
    await page.goto(DASHBOARD_URL,);

    const rows = page.locator('.overview-table tbody tr',);
    const count = await rows.count();
    expect(count,).toBeGreaterThan(0,);

    for (let loopIndex = 0; loopIndex < count; loopIndex++) {
      const scoreCell = rows.nth(loopIndex,).locator('td',).nth(1,);
      // oxlint-disable-next-line no-await-in-loop -- Playwright locator calls must be sequential within a loop
      const text = await scoreCell.textContent();
      expect(text?.trim(),).not.toBe('',);
    }
  });
});

//endregion Data visibility
