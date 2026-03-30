import { evaluatePredicate, } from '../platform/evaluate-predicate.ts';
import { exec, } from '../pipeline/exec.ts';

/**
 * Sends a write-protection warning to both terminal and desktop notification.
 * Called when an external process modifies a file that file-enforcer manages.
 *
 * Desktop notification dispatch:
 * - `notify-send` when available (Linux with libnotify)
 * - `osascript` when available (macOS)
 * - PowerShell toast notification (Windows)
 * - Terminal-only warning when none of the above are available (headless servers)
 *
 * @param filePath - Absolute path of the externally modified managed file
 */
export async function notifyWriteProtection(filePath: string,): Promise<void> {
  /** Human-readable warning for the terminal */
  const terminalMessage =
    `[file-enforcer] PROTECTED: "${filePath}" was modified externally -- reverting to enforced content`;
  console.warn(terminalMessage,);

  await sendDesktopNotification(filePath,);
}

/**
 * Attempts to send a desktop notification via the first available notification tool.
 * Fails silently when no notification tool is available — the terminal warning is always printed regardless.
 *
 * @param filePath - Absolute path shown in the notification body
 */
async function sendDesktopNotification(filePath: string,): Promise<void> {
  /** Desktop notification body kept short for readability in notification popups */
  const body = `"${filePath}" was modified externally and has been reverted.`;
  /** Notification title consistent across platforms */
  const title = 'file-enforcer: write protected';

  const hasNotifySend = await evaluatePredicate(['notify-send', '--version',],);
  if (hasNotifySend) {
    try {
      await exec('notify-send', ['--urgency=critical', title, body,],);
    }
    catch (notifyError: unknown) {
      console.warn(
        '[file-enforcer] could not send desktop notification:',
        notifyError,
      );
    }
    return;
  }

  const hasOsascript = await evaluatePredicate(['osascript', '-e', 'return',],);
  if (hasOsascript) {
    try {
      await exec('osascript', [
        '-e',
        `display notification "${body}" with title "${title}"`,
      ],);
    }
    catch (notifyError: unknown) {
      console.warn(
        '[file-enforcer] could not send desktop notification:',
        notifyError,
      );
    }
    return;
  }

  const hasPwsh = await evaluatePredicate(['pwsh', '--version',],);
  const hasPowershell = !hasPwsh && await evaluatePredicate(['powershell', '-Command', 'exit',],);
  if (hasPwsh || hasPowershell) {
    /** PowerShell toast notification via WinRT. No external modules needed. */
    const shell = hasPwsh ? 'pwsh' : 'powershell';
    /** Escape single quotes in body/title for PowerShell string literals */
    const safeBody = body.replaceAll("'", "''",);
    const safeTitle = title.replaceAll("'", "''",);
    const script = [
      '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null',
      `$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)`,
      '$texts = $xml.GetElementsByTagName("text")',
      `$texts[0].AppendChild($xml.CreateTextNode('${safeTitle}')) > $null`,
      `$texts[1].AppendChild($xml.CreateTextNode('${safeBody}')) > $null`,
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('file-enforcer').Show([Windows.UI.Notifications.ToastNotification]::new($xml))`,
    ].join('; ',);
    try {
      await exec(shell, ['-Command', script,],);
    }
    catch (notifyError: unknown) {
      console.warn(
        '[file-enforcer] could not send desktop notification:',
        notifyError,
      );
    }
    return;
  }

  // No desktop notification tool available — terminal warning was already printed
}
