/**
 Bash-poke constants shared by configuration, execution, rendering, and cancellation.

 @module
 */

import { join, } from 'node:path';

//region Identity

/**
 Custom message type Pi routes to this package's registered renderer.
 */
const POKE_CUSTOM_TYPE = 'bash-poke';

/**
 Root logger tag so every emitted record is attributable to this extension.
 */
const LOGGER_TAG = 'pi-bash-poke';

//endregion Identity

//region Settings location

/**
 Directory below home where global Pi extension settings live.
 */
const PI_EXTENSION_CONFIG_DIR: string = join(
  '.pi',
  'agent',
  'extensions',
);

/**
 Settings file name, matching the sibling `pi-guardrail.json` convention.
 */
const CONFIG_FILE_NAME = 'pi-bash-poke.json';

/**
 Node error code meaning the settings file was never created.
 */
const FILE_NOT_FOUND_CODE = 'ENOENT';

//endregion Settings location

//region Settings defaults

/**
 Instruction appended to a poke so the model resumes the interrupted task.
 */
const DEFAULT_POKE_INSTRUCTION = 'continue';

/**
 Characters kept from the start of command output, where a run's setup usually is.
 */
const DEFAULT_POKE_HEAD_CHARS = 2_000;

/**
 Characters kept from the end of command output, where failures and results usually are.
 */
const DEFAULT_POKE_TAIL_CHARS = 6_000;

/**
 Whether a running job is visible above the editor.
 */
const DEFAULT_PROGRESS_WIDGET = true;

/**
 Output lines shown per running job, enough to follow a build without owning the screen.
 */
const DEFAULT_PROGRESS_TAIL_LINES = 3;

/**
 Milliseconds between widget redraws, so a chatty command cannot thrash the renderer.
 */
const DEFAULT_PROGRESS_REFRESH_MS = 250;

/**
 Milliseconds between elapsed-time redraws while a job runs, so a silent command
 such as a long sleep still shows its clock advancing.
 */
const DEFAULT_PROGRESS_TICK_MS = 1_000;

/**
 Milliseconds a cancelled job gets to exit on SIGTERM before SIGKILL reaches its group.
 */
const DEFAULT_KILL_GRACE_MS = 2_000;

//endregion Settings defaults

//region Poke content

/**
 Placeholder recorded in Pi's context while a job is still running.
 */
const PENDING_NOTE = '(running in background; output will be sent when it finishes)';

/**
 Heading prefix naming the finished command in poke content.
 */
const POKE_HEADER_PREFIX = '[bash finished] $ ';

/**
 Body used when a command produced no output at all.
 */
const EMPTY_OUTPUT_NOTE = '(no output)';

/**
 Prefix introducing a spawn failure, which has no exit code and no output.
 */
const SPAWN_FAILURE_PREFIX = 'failed to run: ';

/**
 Status text for a command whose exit code is unavailable.
 */
const UNKNOWN_EXIT_STATUS = 'exit unknown';

/**
 Status prefix for a command that reported an exit code.
 */
const EXIT_STATUS_PREFIX = 'exit ';

/**
 Status text for a command the user cancelled.
 */
const CANCELLED_STATUS = 'cancelled';

/**
 Horizontal ellipsis surrounding the middle-out elision marker.
 */
const ELISION_ELLIPSIS = '\u2026';

/**
 Backtick, the character a Markdown fence is built from.
 */
const BACKTICK_CHARACTER = '`';

/**
 Shortest fence Markdown accepts, and the floor used when output contains no
 backtick run of its own.
 */
const MIN_FENCE_LENGTH = 3;

//endregion Poke content

//region Spool

/**
 Directory name below the OS temp directory holding complete captured output.
 */
const SPOOL_DIR_NAME = 'pi-bash-poke';

/**
 Spool file extension marking a captured output document.
 */
const SPOOL_FILE_EXTENSION = '.log';

/**
 Owner-only directory mode, because captured output can contain secrets.
 */
const SPOOL_DIR_MODE = 0o700;

/**
 Owner-only file mode, because one job's output can hold credentials it printed.
 */
const SPOOL_FILE_MODE = 0o600;

//endregion Spool

//region Process control

/**
 Signal asking a job's process group to stop, which shells forward to children.
 */
const CANCEL_SIGNAL = 'SIGTERM';

/**
 Signal used once the grace period expires, which cannot be caught or ignored.
 */
const FORCE_SIGNAL = 'SIGKILL';

//endregion Process control

//region Shell resolution

/**
 Absolute shell used first, matching Pi's own documented resolution order.
 */
const ABSOLUTE_BASH_PATH = '/bin/bash';

/**
 Shell name searched on `PATH` when the absolute bash is absent.
 */
const BASH_COMMAND_NAME = 'bash';

/**
 Last-resort shell name, matching Pi's own documented final fallback.
 */
const SH_COMMAND_NAME = 'sh';

/**
 Shell flag carrying the command text rather than a script file.
 */
const SHELL_COMMAND_FLAG = '-c';

//endregion Shell resolution

//region Escape interception

/**
 Byte a terminal delivers for a lone Escape press.
 */
const BARE_ESCAPE = '\u001B';

/**
 Kitty keyboard protocol encoding of Escape with no modifiers, which Pi requests.
 */
const KITTY_ESCAPE = '\u001B[27u';

/**
 Editor prefix proving Pi is in bash mode, where Escape belongs to Pi.
 */
const BASH_MODE_PREFIX = '!';

//endregion Escape interception

//region Progress display

/**
 Widget key owning the space above the editor, so redraws replace rather than stack.
 */
const PROGRESS_WIDGET_KEY = 'bash-poke-progress';

/**
 Prefix tying a progress line back to the keystroke that started the job.
 */
const JOB_LINE_PREFIX = '! ';

/**
 Indent separating a job's output lines from its heading line.
 */
const TAIL_LINE_INDENT = '  ';

//endregion Progress display

//region Sanitization

/**
 Character code of the horizontal tab, kept because it carries layout meaning.
 */
const TAB_CODE = 0x09;

/**
 Character code of the line feed, kept because output structure depends on it.
 */
const LINE_FEED_CODE = 0x0A;

/**
 Character code of the carriage return, kept so progress lines survive.
 */
const CARRIAGE_RETURN_CODE = 0x0D;

/**
 First C0 control code, the start of the dropped range below the kept whitespace.
 */
const C0_START_CODE = 0x00;

/**
 Last C0 control code, dropped except for the three kept whitespace codes.
 */
const C0_END_CODE = 0x1F;

/**
 Delete code, dropped because it renders as nothing or as garbage.
 */
const DELETE_CODE = 0x7F;

/**
 First C1 control code, dropped because terminals interpret them as commands.
 */
const C1_START_CODE = 0x80;

/**
 Last C1 control code, dropped for the same reason as the rest of C1.
 */
const C1_END_CODE = 0x9F;

/**
 First surrogate code point, dropped when unpaired because it renders as nothing.
 */
const SURROGATE_START_CODE = 0xD8_00;

/**
 Last surrogate code point, which bounds the unpaired-surrogate check.
 */
const SURROGATE_END_CODE = 0xDF_FF;

//endregion Sanitization

export {
  ABSOLUTE_BASH_PATH,
  BACKTICK_CHARACTER,
  BARE_ESCAPE,
  BASH_COMMAND_NAME,
  BASH_MODE_PREFIX,
  C0_END_CODE,
  C0_START_CODE,
  C1_END_CODE,
  C1_START_CODE,
  CANCELLED_STATUS,
  CANCEL_SIGNAL,
  CARRIAGE_RETURN_CODE,
  CONFIG_FILE_NAME,
  DEFAULT_KILL_GRACE_MS,
  DEFAULT_POKE_HEAD_CHARS,
  DEFAULT_POKE_INSTRUCTION,
  DEFAULT_POKE_TAIL_CHARS,
  DEFAULT_PROGRESS_REFRESH_MS,
  DEFAULT_PROGRESS_TICK_MS,
  DEFAULT_PROGRESS_TAIL_LINES,
  DEFAULT_PROGRESS_WIDGET,
  DELETE_CODE,
  ELISION_ELLIPSIS,
  EMPTY_OUTPUT_NOTE,
  EXIT_STATUS_PREFIX,
  FILE_NOT_FOUND_CODE,
  FORCE_SIGNAL,
  JOB_LINE_PREFIX,
  KITTY_ESCAPE,
  LINE_FEED_CODE,
  LOGGER_TAG,
  MIN_FENCE_LENGTH,
  PENDING_NOTE,
  PI_EXTENSION_CONFIG_DIR,
  POKE_CUSTOM_TYPE,
  POKE_HEADER_PREFIX,
  PROGRESS_WIDGET_KEY,
  SH_COMMAND_NAME,
  SHELL_COMMAND_FLAG,
  SPOOL_DIR_MODE,
  SPOOL_DIR_NAME,
  SPOOL_FILE_EXTENSION,
  SPOOL_FILE_MODE,
  SPAWN_FAILURE_PREFIX,
  SURROGATE_END_CODE,
  SURROGATE_START_CODE,
  TAB_CODE,
  TAIL_LINE_INDENT,
  UNKNOWN_EXIT_STATUS,
};
