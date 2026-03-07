/**
 * Vendor brand SVG icons from `@lobehub/icons-static-svg`.
 *
 * Uses import attributes to inline SVG content as strings at build time.
 * {@link iconDot} is synchronous and requires no preloading.
 */
import claudeSvg from '@lobehub/icons-static-svg/icons/claude-color.svg' with { type: 'text' };
import geminiSvg from '@lobehub/icons-static-svg/icons/gemini-color.svg' with { type: 'text' };
import kimiSvg from '@lobehub/icons-static-svg/icons/kimi-color.svg' with { type: 'text' };
import minimaxSvg from '@lobehub/icons-static-svg/icons/minimax-color.svg' with { type: 'text' };
import openaiSvg from '@lobehub/icons-static-svg/icons/openai.svg' with { type: 'text' };
import qwenSvg from '@lobehub/icons-static-svg/icons/qwen-color.svg' with { type: 'text' };
import zhipuSvg from '@lobehub/icons-static-svg/icons/zhipu-color.svg' with { type: 'text' };

/**
 * Maps OpenRouter vendor prefix to inlined SVG content.
 *
 * - anthropic models use the Claude icon (product icon, not corporate)
 * - moonshotai uses the kimi icon (Kimi is the product name)
 * - z-ai (Zhipu) uses the zhipu icon
 */
/** Kimi SVG has white (#fff) fills that are invisible on light backgrounds — add a dark square behind it */
const kimiFixed = kimiSvg.replace('<path', '<rect width="24" height="24" rx="3" fill="#888"/><path');

const VENDOR_ICONS: Record<string, string> = {
  'anthropic': claudeSvg,
  'google': geminiSvg,
  'openai': openaiSvg,
  'moonshotai': kimiFixed,
  'minimax': minimaxSvg,
  'z-ai': zhipuSvg,
  'qwen': qwenSvg,
};

/**
 * Returns a `color-swatch` span containing the vendor's SVG icon.
 * Falls back to a plain colored dot when no icon is available.
 * @param modelId - full OpenRouter model ID
 * @param color - CSS color for the dot background/fallback
 * @returns HTML string for the icon dot
 *
 * @example
 * ```ts
 * const dot = iconDot('anthropic/claude-opus-4.6', '#D97757');
 * // '<span class="color-swatch" data-shape="icon"><svg ...>...</svg></span>'
 * ```
 */
export function iconDot(modelId: string, color: string): string {
  const vendor = modelId.split('/')[0] ?? '';
  const svg = VENDOR_ICONS[vendor];
  if (svg === undefined || svg === '') {
    return `<span class="color-swatch" style="--point-color: ${color}"></span>`;
  }
  return `<span class="color-swatch" data-shape="icon" data-vendor="${vendor}">${svg}</span>`;
}

/**
 * Returns raw SVG content for a vendor icon, or `undefined` when unavailable.
 * Used to embed icons directly inside chart data points.
 * @param modelId - full OpenRouter model ID
 * @returns raw SVG string or `undefined`
 *
 * @example
 * ```ts
 * const svg = vendorIcon('anthropic/claude-opus-4.6');
 * // '<svg ...>...</svg>'
 * ```
 */
export function vendorIcon(modelId: string): string | undefined {
  const vendor = modelId.split('/')[0] ?? '';
  const svg = VENDOR_ICONS[vendor];
  return svg === undefined || svg === '' ? undefined : svg;
}
