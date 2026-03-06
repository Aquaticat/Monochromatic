/**
 * Checks whether the desktop session is locked via the freedesktop
 * ScreenSaver D-Bus interface (works on KDE, GNOME, and other compliant DEs).
 * @returns `true` when the session is locked
 * @example
 * ```ts
 * if (await isScreenLocked()) {
 *   log.debug("Screen locked, skipping cycle");
 * }
 * ```
 */
export async function isScreenLocked(): Promise<boolean> {
  const proc = Bun.spawn(
    [
      "gdbus", "call", "--session",
      "--dest", "org.freedesktop.ScreenSaver",
      "--object-path", "/org/freedesktop/ScreenSaver",
      "--method", "org.freedesktop.ScreenSaver.GetActive",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  // gdbus returns "(true,)\n" or "(false,)\n"
  return out.includes("true");
}
