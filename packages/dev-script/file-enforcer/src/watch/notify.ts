import {
  l,
  tagged,
} from '../log.ts';
import { exec, } from '../pipeline/exec.ts';
import { evaluatePredicate, } from '../platform/evaluate-predicate.ts';

//region Notification tool detection

/**
 * Desktop notification backends, checked in order of preference.
 * - `notify-send`: Linux with libnotify
 * - `osascript`: macOS
 * - `pwsh` / `powershell`: Windows
 */
type NotificationTool = 'notify-send' | 'osascript' | 'pwsh' | 'powershell';

/**
 * Cached detection result.
 * `undefined` = detection not yet run, `null` = no tool found.
 */
let cachedTool: NotificationTool | null | undefined = undefined;

/**
 * Detects the first available desktop notification tool.
 * Result is cached for the lifetime of the process:
 * available tools don't change between events.
 *
 * @returns Detected tool name, or `null` if none found
 */
async function detectNotificationTool(): Promise<NotificationTool | null> {
  if (cachedTool !== undefined)
    return cachedTool;

  if (await evaluatePredicate([
    'notify-send',
    '--version',
  ],)) {
    cachedTool = 'notify-send';
    return cachedTool;
  }
  if (await evaluatePredicate([
    'osascript',
    '-e',
    'return',
  ],)) {
    cachedTool = 'osascript';
    return cachedTool;
  }
  if (await evaluatePredicate([
    'pwsh',
    '--version',
  ],)) {
    cachedTool = 'pwsh';
    return cachedTool;
  }
  if (await evaluatePredicate([
    'powershell',
    '-Command',
    'exit',
  ],)) {
    cachedTool = 'powershell';
    return cachedTool;
  }

  cachedTool = null;
  return null;
}

//endregion Notification tool detection

/**
 * Sends a write-protection warning to both terminal and desktop notification.
 * Called when an external process modifies a file that file-enforcer manages.
 *
 * @param filePath - Absolute path of the externally modified managed file
 *
 * @example
 * ```ts
 * await notifyWriteProtection('/abs/path/to/managed-file.json');
 * ```
 */
export async function notifyWriteProtection(filePath: string,): Promise<void> {
  l.warn(
    `PROTECTED: "${filePath}" was modified externally -- reverting to enforced content`,
  );

  await sendDesktopNotification(filePath,);
}

/**
 * Sends a desktop notification using the detected notification tool.
 * Fails silently when no tool is available; the terminal warning
 * is always printed regardless.
 *
 * @param filePath - Absolute path shown in the notification body
 */
async function sendDesktopNotification(filePath: string,): Promise<void> {
  /** Function-scoped logger tagged with the call site for traceable notification logs. */
  const rl = tagged({
    tag: sendDesktopNotification.name,
    l,
  },);
  /** Detected notification backend, or `null` when no compatible tool is installed. */
  const tool = await detectNotificationTool();
  if (tool === null)
    return;

  /** Desktop notification body kept short for readability in notification popups */
  const body = `"${filePath}" was modified externally and has been reverted.`;
  /** Notification title consistent across platforms */
  const title = 'file-enforcer: write protected';

  try {
    if (tool === 'notify-send') {
      await exec(
        'notify-send',
        [
          '--urgency=critical',
          title,
          body,
        ],
      );
      return;
    }
    if (tool === 'osascript') {
      await exec(
        'osascript',
        [
          '-e',
          `display notification "${body}" with title "${title}"`,
        ],
      );
      return;
    }
    // pwsh or powershell
    /** Escape single quotes in body/title for PowerShell string literals */
    const safeBody = body.replaceAll(
      "'",
      "''",
    );
    /** Title with single quotes doubled, matching the PowerShell literal escape used above for `safeBody`. */
    const safeTitle = title.replaceAll(
      "'",
      "''",
    );
    /** PowerShell toast notification via WinRT. No external modules needed. */
    const script = [
      '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null',
      `$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)`,
      '$texts = $xml.GetElementsByTagName("text")',
      `$texts[0].AppendChild($xml.CreateTextNode('${safeTitle}')) > $null`,
      `$texts[1].AppendChild($xml.CreateTextNode('${safeBody}')) > $null`,
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('file-enforcer').Show([Windows.UI.Notifications.ToastNotification]::new($xml))`,
    ]
      .join('; ',);
    await exec(
      tool,
      [
        '-Command',
        script,
      ],
    );
  }
  catch (notifyError: unknown) {
    rl.warn(`could not send desktop notification: ${String(notifyError,)}`,);
  }
}
