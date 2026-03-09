/**
 * Vendor brand SVG icons from `@lobehub/icons-static-svg`.
 *
 * Icons are defined once as `<symbol>` elements in an SVG sprite sheet
 * ({@link renderSvgSprite}), then referenced via `<use href>` throughout
 * the page. This avoids duplicating full SVG markup at every data point.
 */
import claudeSvg from '@lobehub/icons-static-svg/icons/claude-color.svg' with { type: 'text' };
import geminiSvg from '@lobehub/icons-static-svg/icons/gemini-color.svg' with { type: 'text' };
import kimiSvg from '@lobehub/icons-static-svg/icons/kimi-color.svg' with { type: 'text' };
import minimaxSvg from '@lobehub/icons-static-svg/icons/minimax-color.svg' with { type: 'text' };
import openaiSvg from '@lobehub/icons-static-svg/icons/openai.svg' with { type: 'text' };
import qwenSvg from '@lobehub/icons-static-svg/icons/qwen-color.svg' with { type: 'text' };
import zhipuSvg from '@lobehub/icons-static-svg/icons/zhipu-color.svg' with { type: 'text' };

import { $ as h, } from '@monochromatic-dev/module-es/h-html';

/**
 * Kimi SVG has white (#fff) fills that are invisible on light backgrounds,
 * so a dark square is prepended behind its paths.
 */
const kimiFixed = kimiSvg.replace('<path', '<rect width="24" height="24" rx="3" fill="#888"/><path');

/** Raw SVG sources keyed by OpenRouter vendor prefix */
const RAW_SVGS: Record<string, string> = {
  'anthropic': claudeSvg,
  'google': geminiSvg,
  'openai': openaiSvg,
  'moonshotai': kimiFixed,
  'minimax': minimaxSvg,
  'z-ai': zhipuSvg,
  'qwen': qwenSvg,
};

/**
 * Extracts the inner content and viewBox from a raw SVG string.
 * @param raw - full `<svg>...</svg>` string
 * @returns viewBox attribute value and inner markup
 *
 * @example
 * ```ts
 * const { viewBox, inner } = parseSvg('<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>');
 * // viewBox === '0 0 24 24', inner === '<path d="M0 0"/>'
 * ```
 */
function parseSvg(raw: string): { viewBox: string; inner: string } {
  const viewBoxMatch = raw.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch?.[1] ?? '0 0 24 24';
  const inner = raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return { viewBox, inner, };
}

/**
 * Separates `<defs>` blocks from SVG inner content so gradients
 * can be hoisted to the sprite root for reliable cross-reference
 * from `<use>` shadow trees.
 * @param inner - SVG inner markup
 * @returns extracted defs content and remaining markup
 *
 * @example
 * ```ts
 * const { defs, content } = extractDefs('<defs><linearGradient id="g"/></defs><path/>');
 * // defs === '<linearGradient id="g"/>', content === '<path/>'
 * ```
 */
function extractDefs(inner: string): { defs: string; content: string } {
  let defs = '';
  const content = inner.replaceAll(/<defs>([\s\S]*?)<\/defs>/g, (_match, defsContent: string) => {
    defs += defsContent;
    return '';
  });
  return { defs, content, };
}

/** Parsed symbol data for a single vendor icon */
type VendorSymbol = {
  /** Symbol element ID (e.g. `icon-anthropic`) */
  readonly id: string;
  /** SVG viewBox attribute value */
  readonly viewBox: string;
  /** Inner markup (paths, shapes) without `<defs>` */
  readonly inner: string;
  /** Extracted `<defs>` content (gradients, filters) to hoist */
  readonly defs: string;
};

/** Map of vendor prefix to parsed symbol data */
const VENDOR_SYMBOLS: ReadonlyMap<string, VendorSymbol> = new Map(
  Object.entries(RAW_SVGS).map(function parseEntry([vendor, raw]) {
    const { viewBox, inner, } = parseSvg(raw);
    const { defs, content, } = extractDefs(inner);
    return [vendor, { id: `icon-${vendor}`, viewBox, inner: content, defs, }];
  }),
);

/**
 * Renders the SVG sprite sheet containing all vendor icon symbols.
 *
 * Gradient `<defs>` are hoisted to the sprite root so `url(#id)` references
 * resolve correctly when symbols are instantiated via `<use>`.
 * Must be included once in the document before any `<use>` references.
 * @returns hidden `<svg>` element with `<defs>` and `<symbol>` definitions
 *
 * @example
 * ```ts
 * const sprite = renderSvgSprite();
 * // '<svg ...><defs>...</defs><symbol id="icon-anthropic" ...>...</symbol>...</svg>'
 * ```
 */
export function renderSvgSprite(): string {
  let allDefs = '';
  const symbols = [...VENDOR_SYMBOLS.values()].map(function buildSymbol({ id, viewBox, inner, defs, }) {
    allDefs += defs;
    return `<symbol id="${id}" viewBox="${viewBox}">${inner}</symbol>`;
  });
  const defsBlock = allDefs !== '' ? `<defs>${allDefs}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;inline-size:0;block-size:0;overflow:hidden">${defsBlock}${symbols.join('')}</svg>`;
}

/**
 * Builds an `<svg><use href>` reference to a vendor symbol in the sprite.
 * @param symbolId - symbol ID to reference (e.g. `icon-anthropic`)
 * @returns SVG element string with `<use>` reference
 *
 * @example
 * ```ts
 * useRef('icon-anthropic');
 * // '<svg height="1em" width="1em"><use href="#icon-anthropic"/></svg>'
 * ```
 */
function useRef(symbolId: string): string {
  return `<svg height="1em" width="1em"><use href="#${symbolId}"/></svg>`;
}

/**
 * Returns a `color-swatch` span containing a vendor icon `<use>` reference.
 * Falls back to a plain colored dot when no icon is available.
 * @param modelId - full OpenRouter model ID
 * @param color - CSS color for the dot background/fallback
 * @returns HTML string for the icon dot
 *
 * @example
 * ```ts
 * const dot = iconDot('anthropic/claude-opus-4.6', '#D97757');
 * // '<span class="color-swatch" data-shape="icon" data-vendor="anthropic"><svg ...><use href="#icon-anthropic"/></svg></span>'
 * ```
 */
export function iconDot(modelId: string, color: string): string {
  const vendor = modelId.split('/')[0] ?? '';
  const symbol = VENDOR_SYMBOLS.get(vendor);
  if (symbol === undefined) {
    return h({ tag: 'span', class: 'color-swatch', style: { '--point-color': color, }, });
  }
  return h({ tag: 'span', class: 'color-swatch', attrs: { 'data-shape': 'icon', 'data-vendor': vendor, }, html: useRef(symbol.id), });
}

/**
 * Returns an `<svg><use>` reference for a vendor icon, or `undefined` when unavailable.
 * Used to embed icons inside chart data points.
 * @param modelId - full OpenRouter model ID
 * @returns SVG use-reference string or `undefined`
 *
 * @example
 * ```ts
 * const svg = vendorIcon('anthropic/claude-opus-4.6');
 * // '<svg height="1em" width="1em"><use href="#icon-anthropic"/></svg>'
 * ```
 */
export function vendorIcon(modelId: string): string | undefined {
  const vendor = modelId.split('/')[0] ?? '';
  const symbol = VENDOR_SYMBOLS.get(vendor);
  return symbol === undefined ? undefined : useRef(symbol.id);
}
