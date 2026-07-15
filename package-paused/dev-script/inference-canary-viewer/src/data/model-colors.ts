/**
 * Vendor brand colors derived from lobehub/lobe-icons style.ts files.
 *
 * Colors are chosen for visibility on both light and dark backgrounds.
 * When a vendor's primary color is too dark (near-black), an accent color
 * from their icon SVG is used instead.
 */

/**
 * Maps OpenRouter vendor prefix to a brand color hex string.
 * Falls back to a neutral gray for unknown vendors.
 *
 * @param modelId - full OpenRouter model ID (e.g. "anthropic/claude-sonnet-4.6")
 *
 * @returns CSS hex color string
 *
 * @example
 * ```ts
 * vendorColor('anthropic/claude-sonnet-4.6'); // "#D97757"
 * vendorColor('unknown/model'); // "#6B7280"
 * ```
 */
export function vendorColor(modelId: string,): string {
  /**
   * OpenRouter prefix segment used as the lookup key into the color table.
   */
  const vendor = modelId.includes('/',)
    ? modelId.slice(
      0,
      modelId.indexOf('/',),
    )
    : modelId;
  return VENDOR_COLORS[vendor]
    ?? FALLBACK_COLOR;
}

/**
 * Fallback gray for unrecognized vendors
 */
const FALLBACK_COLOR = '#6B7280';

/**
 * Brand colors by vendor prefix.
 *
 * - anthropic: Claude terracotta (#D97757): Anthropic corporate (#F1F0E8) is invisible on white
 * - google: Gemini blue (#3186FF): primary fill color from the icon SVG
 * - openai: GPT 5 pink (#F86AA4): OpenAI corporate (#000) is unusable
 * - moonshotai: Kimi blue (#027AFF): Moonshot corporate (#16191E) is near-black
 * - minimax: Minimax coral (#F23F5D)
 * - z-ai: Zhipu indigo (#3859FF): GLM is a Zhipu product
 * - qwen: Qwen purple (#615CED)
 */
const VENDOR_COLORS: Record<string, string> = {
  anthropic: '#D97757',
  google: '#3186FF',
  openai: '#F86AA4',
  moonshotai: '#027AFF',
  minimax: '#F23F5D',
  'z-ai': '#3859FF',
  qwen: '#615CED',
};
