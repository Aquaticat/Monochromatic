import { $ } from "bun";
import { unlink } from "node:fs/promises";

/** Path to the ffmpeg binary. */
const FFMPEG = "/usr/bin/ffmpeg";

/** Maximum long-edge resolution for downscaled screenshots. */
const SCREENSHOT_LONG_EDGE = 1_440;

/** Maximum long-edge resolution for downscaled webcam frames. */
const WEBCAM_LONG_EDGE = 720;

/**
 * Builds an ffmpeg scale filter that constrains the longer edge to
 * {@link longEdge} pixels while preserving aspect ratio.
 * @param longEdge - target pixel count for the longer dimension
 * @returns ffmpeg `-vf` filter string
 * @example
 * ```ts
 * scaleFilter(1440); // "scale='if(gt(iw,ih),1440,-2)':'if(gt(iw,ih),-2,1440)'"
 * ```
 */
function scaleFilter(longEdge: number): string {
  return `scale='if(gt(iw,ih),${longEdge},-2)':'if(gt(iw,ih),-2,${longEdge})'`;
}

/**
 * Captures a full-screen screenshot via Spectacle, downscales it with ffmpeg,
 * and returns the result as a JPEG buffer.
 * @returns JPEG-encoded screenshot buffer
 * @throws when Spectacle or ffmpeg produces empty output
 * @example
 * ```ts
 * const screenshot = await captureScreenshot();
 * log.debug(`Screenshot: ${(screenshot.length / 1024).toFixed(0)}KB`);
 * ```
 */
export async function captureScreenshot(): Promise<Buffer> {
  const tmp = `/tmp/hall-monitor-screen-${Date.now()}.png`;
  try {
    await $`spectacle -f -b -n -o ${tmp}`.quiet();
    const proc = Bun.spawn(
      [FFMPEG, "-y", "-i", tmp, "-vf", scaleFilter(SCREENSHOT_LONG_EDGE), "-q:v", "2", "-f", "image2", "-vcodec", "mjpeg", "pipe:1"],
      { stdout: "pipe", stderr: "inherit" },
    );
    const buf = Buffer.from(await new Response(proc.stdout).arrayBuffer());
    await proc.exited;
    if (buf.length === 0) throw new Error("Screenshot resize produced empty output");
    return buf;
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

/**
 * Captures a single webcam frame from `/dev/video0` via ffmpeg v4l2,
 * downscales it, and returns the result as a JPEG buffer.
 * @returns JPEG-encoded webcam frame buffer
 * @throws when ffmpeg produces empty output
 * @example
 * ```ts
 * const webcam = await captureWebcam();
 * log.debug(`Webcam: ${(webcam.length / 1024).toFixed(0)}KB`);
 * ```
 */
export async function captureWebcam(): Promise<Buffer> {
  const proc = Bun.spawn(
    [FFMPEG, "-f", "v4l2", "-i", "/dev/video0", "-frames:v", "1",
     "-vf", scaleFilter(WEBCAM_LONG_EDGE), "-q:v", "2",
     "-f", "image2", "-vcodec", "mjpeg", "pipe:1"],
    { stdout: "pipe", stderr: "inherit" },
  );
  const buf = Buffer.from(await new Response(proc.stdout).arrayBuffer());
  await proc.exited;
  if (buf.length === 0) throw new Error("Webcam capture produced empty output");
  return buf;
}
