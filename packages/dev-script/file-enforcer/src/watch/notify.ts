/**
 * Sends a write-protection warning to both terminal and desktop notification.
 * Called when an external process modifies a file that file-enforcer manages.
 * @param filePath - Absolute path of the externally modified managed file
 */
export async function notifyWriteProtection(filePath: string): Promise<void> {
  /** Human-readable warning for the terminal */
  const terminalMessage = `[file-enforcer] PROTECTED: "${filePath}" was modified externally -- reverting to enforced content`;
  console.warn(terminalMessage);

  /** Desktop notification body kept short for readability in notification popups */
  const notifyBody = `"${filePath}" was modified externally and has been reverted.`;
  try {
    /** Spawn notify-send as fire-and-forget; failure is non-fatal */
    const proc = Bun.spawn(
      ['notify-send', '--urgency=critical', 'file-enforcer: write protected', notifyBody],
      { stdout: 'ignore', stderr: 'pipe', },
    );
    await proc.exited;
  } catch (notifyError: unknown) {
    // notify-send may not be installed -- log and move on
    console.warn('[file-enforcer] could not send desktop notification:', notifyError);
  }
}
