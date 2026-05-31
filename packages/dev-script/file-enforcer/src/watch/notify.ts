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
 * Sentinel for "detection ran but found no notification tool".
 * A unique `Symbol` keeps the absent case out of a banned `T | null` union
 * while staying distinguishable from every real {@link NotificationTool} value.
 */
const NO_TOOL = Symbol('no-notification-tool',);

/**
 * Single-key holder for the lazily-detected notification backend.
 * {@link NO_TOOL} value means detection ran but no tool was found; missing key
 * means detection has not run yet.
 */
const toolCache = new Map<'tool', NotificationTool | typeof NO_TOOL>();

/**
 * Detects the first available desktop notification tool.
 * Result is cached for the lifetime of the process:
 * available tools don't change between events.
 *
 * @returns Detected tool name, or {@link NO_TOOL} if none found
 */
async function detectNotificationTool(): Promise<NotificationTool | typeof NO_TOOL> {
  if (toolCache.has('tool',))
    return toolCache.get('tool',)
      ?? NO_TOOL;

  if (await evaluatePredicate([
    'notify-send',
    '--version',
  ],)) {
    toolCache.set(
      'tool',
      'notify-send',
    );
    return 'notify-send';
  }
  if (await evaluatePredicate([
    'osascript',
    '-e',
    'return',
  ],)) {
    toolCache.set(
      'tool',
      'osascript',
    );
    return 'osascript';
  }
  if (await evaluatePredicate([
    'pwsh',
    '--version',
  ],)) {
    toolCache.set(
      'tool',
      'pwsh',
    );
    return 'pwsh';
  }
  if (await evaluatePredicate([
    'powershell',
    '-Command',
    'exit',
  ],)) {
    toolCache.set(
      'tool',
      'powershell',
    );
    return 'powershell';
  }

  toolCache.set(
    'tool',
    NO_TOOL,
  );
  return NO_TOOL;
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
  /**
   * Function-scoped logger tagged with the call site for traceable notification logs.
   */
  const rl = tagged({
    tag: sendDesktopNotification.name,
    l,
  },);
  /**
   * Detected notification backend, or NO_TOOL when no compatible tool is installed.
   */
  const tool = await detectNotificationTool();
  if (tool === NO_TOOL)
    return;

  /**
   * Desktop notification body kept short for readability in notification popups
   */
  const body = `"${filePath}" was modified externally and has been reverted.`;
  /**
   * Notification title consistent across platforms
   */
  const title = 'file-enforcer: write protected';

  try {
    if (tool === 'notify-send') {
      await exec({
        cmd: 'notify-send',
        args: [
          '--urgency=critical',
          title,
          body,
        ],
      },);
      return;
    }
    if (tool === 'osascript') {
      await exec({
        cmd: 'osascript',
        args: [
          '-e',
          `display notification "${body}" with title "${title}"`,
        ],
      },);
      return;
    }
    // pwsh or powershell
    /**
     * Escape single quotes in body/title for PowerShell string literals
     */
    const safeBody = body.replaceAll(
      "'",
      "''",
    );
    /**
     * Title with single quotes doubled, matching the PowerShell literal escape used above for `safeBody`.
     */
    const safeTitle = title.replaceAll(
      "'",
      "''",
    );
    /**
     * PowerShell toast notification via WinRT. No external modules needed.
     */
    const script = [
      '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null',
      `$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)`,
      '$texts = $xml.GetElementsByTagName("text")',
      `$texts[0].AppendChild($xml.CreateTextNode('${safeTitle}')) > $null`,
      `$texts[1].AppendChild($xml.CreateTextNode('${safeBody}')) > $null`,
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('file-enforcer').Show([Windows.UI.Notifications.ToastNotification]::new($xml))`,
    ]
      .join('; ',);
    await exec({
      cmd: tool,
      args: [
        '-Command',
        script,
      ],
    },);
  }
  catch (notifyError: unknown) {
    rl.warn(`could not send desktop notification: ${String(notifyError,)}`,);
  }
}
