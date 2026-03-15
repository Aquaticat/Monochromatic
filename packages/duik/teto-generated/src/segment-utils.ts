/**
 * Low-level ImageMagick utility functions.
 *
 * Shell execution, color formatting, and image metadata.
 *
 * @module
 */

/**
 * Run a shell command and throw on non-zero exit.
 *
 * @param cmd - Command tokens to execute
 *
 * @throws Error when the subprocess exits with non-zero status
 */
export async function run(cmd: readonly string[],): Promise<void> {
  const proc = Bun.spawn([...cmd,], { stdout: 'inherit', stderr: 'inherit', },);
  const code = await proc.exited;
  if (code !== 0)
    throw new Error(`Command failed (exit ${code}): ${cmd.join(' ',)}`,);
}

/**
 * Convert a color tolerance (Euclidean RGB distance) to an ImageMagick fuzz percentage.
 * IM fuzz is a percentage of the maximum possible distance (sqrt(3) * 255 ≈ 441.67).
 *
 * @param tolerance - Euclidean distance threshold in RGB space
 *
 * @returns Fuzz percentage string like "12%"
 */
export function toleranceToFuzz(tolerance: number,): string {
  const maxDist = Math.sqrt(3,) * 255;
  const pct = Math.round((tolerance / maxDist) * 100,);
  return `${pct}%`;
}

/**
 * Format an RGB triplet as an ImageMagick color string.
 *
 * @param rgb - RGB values 0-255
 *
 * @returns Color string like "rgb(204,34,68)"
 */
export function rgbString(rgb: readonly [number, number, number,],): string {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

/**
 * Get image dimensions using magick identify.
 *
 * @param path - Image file path
 *
 * @returns Width and height in pixels
 */
export async function getImageSize(
  path: string,
): Promise<{ width: number; height: number; }> {
  const proc = Bun.spawn(['magick', 'identify', '-format', '%w %h', path,], {
    stdout: 'pipe',
    stderr: 'inherit',
  },);
  const text = await new Response(proc.stdout,).text();
  const code = await proc.exited;
  if (code !== 0)
    throw new Error(`magick identify failed for ${path}`,);
  const parts = text.trim().split(' ',);
  return { width: Number(parts[0],), height: Number(parts[1],), };
}
