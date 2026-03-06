/**
 * Detects whether a JPEG frame is essentially all-black (e.g. webcam privacy
 * cover is down) using ffmpeg's blackdetect filter.
 * Thresholds: 98% of pixels must be below 10% luminance to count as black.
 * @param jpegBuf - raw JPEG image bytes to analyze
 * @returns `true` when the frame is considered black
 * @example
 * ```ts
 * if (await isBlackFrame(webcamBuffer)) {
 *   log.debug("Webcam cover detected, skipping");
 * }
 * ```
 */
export async function isBlackFrame(jpegBuf: Buffer): Promise<boolean> {
  const proc = Bun.spawn(
    [
      "/usr/bin/ffmpeg",
      "-f", "image2pipe", "-i", "pipe:0",
      "-vf", "blackdetect=d=0:pix_th=0.10:pic_th=0.98",
      "-f", "null", "-",
    ],
    { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  );
  proc.stdin.write(jpegBuf);
  proc.stdin.end();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  // blackdetect emits "black_start:..." lines on stderr when a black frame is found
  return stderr.includes("black_start");
}
