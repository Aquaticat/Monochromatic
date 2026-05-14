import { wait, } from '@monochromatic-dev/module-async-time';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';
import { spawn as nodeSpawn, } from 'node:child_process';
import {
  l as defaultLogger,
  type Logger,
  tagged,
} from './log.ts';

/**
 * Default grace period (ms) between SIGTERM and SIGKILL during {@link Child.stop}.
 *
 * 5 seconds is the watchexec default and the editord legacy value; tuned for
 * bun servers that flush sockets and close timers synchronously on SIGTERM.
 * Higher would make Ctrl+C feel sluggish; lower would surprise long-running
 * graceful-shutdown handlers.
 */
export const DEFAULT_STOP_TIMEOUT_MS = 5_000;

/**
 * State of the {@link Child}'s underlying process.
 *
 * - `idle`: no child running.
 * - `running`: child alive; `current` is defined.
 * - `stopping`: SIGTERM dispatched, awaiting exit (with possible SIGKILL escalation).
 *
 * State transitions are driven by the public methods plus the `exit` listener
 * registered in `#spawnAndTrack`: a natural (uncommanded) exit also flips
 * `running` to `idle` so the orchestrator's next event finds a clean slate.
 *
 * @example
 * ```ts
 * if (child.state === 'idle') await child.start();
 * ```
 */
export type ChildState = 'idle' | 'running' | 'stopping';

/**
 * Listener shape compatible with `ChildProcess.once('exit', ...)`.
 *
 * Hoisted so tests can build matching stubs without importing node's types directly,
 * and so the {@link SpawnedChildHandle} signature stays readable.
 *
 * @param code - exit code if the child exited normally, `null` if it was killed
 *
 * @param signal - signal name if the child was killed by a signal, `null` otherwise
 */
export type ExitListener = (
  code: number | null,
  signal: NodeJS.Signals | null,
) => void;

/**
 * Minimum surface {@link Child} requires from a spawned process.
 *
 * `node:child_process.ChildProcess` satisfies this via structural compatibility;
 * tests supply an in-memory fake implementing the same shape so the state-machine
 * tests stay deterministic instead of depending on a real OS process.
 *
 * Return types on `once`/`off` are `void`: callers do not chain, and a `void`
 * declaration here accepts `ChildProcess`'s `this`-returning methods without
 * forcing the test fake to also pretend to be chainable.
 *
 * @example
 * ```ts
 * const handle: SpawnedChildHandle = nodeSpawn('bun', ['src/server.ts'], { stdio: 'inherit', },);
 * ```
 */
export type SpawnedChildHandle = {
  /** OS process id; `undefined` only if the spawn failed before assignment. */
  readonly pid: number | undefined;
  /** Exit code once the process has exited; `null` while still running. */
  readonly exitCode: number | null;
  /** Whether `kill()` has been called against this handle. */
  readonly killed: boolean;
  /** Sends a signal to the child; mirrors `ChildProcess.kill`. */
  kill(signal?: NodeJS.Signals | number,): boolean;
  /** Registers a one-shot exit listener; mirrors `ChildProcess.once('exit', ...)`. */
  once(event: 'exit', listener: ExitListener,): void;
  /** Removes a previously-registered exit listener; mirrors `ChildProcess.off`. */
  off(event: 'exit', listener: ExitListener,): void;
};

/**
 * Factory that spawns a child process.
 *
 * The default factory wraps `child_process.spawn(command, args, { stdio: 'inherit' })`;
 * tests inject a stub so the state-machine assertions do not depend on a real
 * OS process. Splitting this interface out keeps the {@link Child} class free of
 * test-only branches and keeps the spawn-options decision (stdio inheritance,
 * env propagation, ...) at one site.
 *
 * @param args - command and argument list
 *
 * @returns spawned child handle
 *
 * @example
 * ```ts
 * const fake: SpawnFn = function fake() { return makeFakeHandle(); };
 * const child = new Child({ command: 'bun', spawn: fake, },);
 * ```
 */
export type SpawnFn = (args: {
  readonly command: string;
  readonly args: readonly string[];
},) => SpawnedChildHandle;

/**
 * Sends a signal to a process (or process group) by pid.
 *
 * Default implementation wraps `process.kill`; tests inject a recording
 * function so assertions can verify which pid (positive for a single
 * process, negative for a process group) received which signal without
 * touching the real OS.
 *
 * @param args - pid (negative targets the matching process group on POSIX) and signal
 *
 * @example
 * ```ts
 * defaultProcessSignal({ pid: -1234, signal: 'SIGTERM', },);
 * ```
 */
export type ProcessSignalFn = (
  args: {
    readonly pid: number;
    readonly signal: NodeJS.Signals | number;
  },
) => void;

/**
 * Writes the terminal-clear escape sequence (or whatever side-effect the
 * caller wants) before each child spawn.
 *
 * Default implementation writes `\x1b[2J\x1b[H` to `process.stdout`;
 * tests inject a counting/recording function to assert call timing
 * without polluting real stdout.
 *
 * @example
 * ```ts
 * const writes = { count: 0, };
 * function recordingWriteClear(): void { writes.count += 1; }
 * ```
 */
export type WriteClearFn = () => void;

/**
 * Construction options for {@link Child}.
 */
export type ChildOptions = {
  /** Command to spawn (e.g. `'bun'`). */
  readonly command: string;
  /** Argument list passed verbatim to the spawn factory. Defaults to empty. */
  readonly args?: readonly string[];
  /** SIGTERM-to-SIGKILL grace period (ms); defaults to {@link DEFAULT_STOP_TIMEOUT_MS}. */
  readonly stopTimeout?: number;
  /**
   * Signal sent first when stopping or restarting the child; SIGKILL is
   * still the escalation after `stopTimeout` regardless of this value.
   * Defaults to `'SIGTERM'`. `'SIGHUP'` is the canonical "soft-reload"
   * choice for servers that re-read config without exiting.
   */
  readonly killSignal?: NodeJS.Signals;
  /**
   * When `true`, spawn with `detached: true` (POSIX `setsid`) so the
   * child leads its own process group, and signal `-pid` (the negative
   * pid) so the whole subtree receives the signal. When `false`, signal
   * the direct child pid only. Defaults to `true`: the dev-server case
   * commonly spawns its own workers (e.g. bun `--watch`, vite) that we
   * want to kill together with the parent.
   */
  readonly processGroup?: boolean;
  /**
   * When `true`, run {@link writeClear} before every spawn (initial and
   * restart). Defaults to `false` so the terminal scrollback is
   * preserved unless the user opts in.
   */
  readonly clear?: boolean;
  /**
   * Process-signal sink; injected by tests to record `(pid, signal)`
   * pairs without firing real `process.kill`. Defaults to a thin wrapper
   * around `process.kill`.
   */
  readonly processSignal?: ProcessSignalFn;
  /**
   * Terminal-clear sink; injected by tests to count calls without
   * polluting stdout. Defaults to writing `\x1b[2J\x1b[H` to `process.stdout`.
   */
  readonly writeClear?: WriteClearFn;
  /** Spawn factory; defaults to wrapping `node:child_process.spawn` with `stdio: 'inherit'`. */
  readonly spawn?: SpawnFn;
  /** Parent logger; the child composes a `Child` tag on top. */
  readonly logger?: Logger;
};

/**
 * Builds the default {@link SpawnFn}: wraps `node:child_process.spawn` with
 * `stdio: 'inherit'` and `detached: <processGroup>`.
 *
 * Stdio inheritance lets the bun child's logs flow through to the user's
 * terminal unchanged; the watcher process does not buffer or recolor, which
 * was a known failure mode under watchexec's nested-tree stdio handling.
 *
 * `detached` is captured at Child construction time rather than passed
 * through {@link SpawnFn}'s args so the public type stays narrow (tests
 * inject a recording fake that does not know or care about detachment).
 *
 * @param detached - forwarded to `node:child_process.spawn`'s options; when `true` the child becomes a process-group leader on POSIX
 *
 * @returns spawn factory
 *
 * @example
 * ```ts
 * const spawn = makeDefaultSpawn({ detached: true, },);
 * const handle = spawn({ command: 'bun', args: ['src/server.ts',], },);
 * ```
 */
function makeDefaultSpawn(
  {
    detached,
  }: {
    readonly detached: boolean;
  },
): SpawnFn {
  return function defaultSpawn(
    args: {
      readonly command: string;
      readonly args: readonly string[];
    },
  ): SpawnedChildHandle {
    /**
     * `ChildProcess` has overload-rich `on`/`once`/`off` and a `this`-returning
     * `kill`; the `SpawnedChildHandle` shape narrows to just the `exit` event.
     * The narrower type is structurally satisfied at runtime but TS cannot prove
     * the overload subset matches, so an explicit assertion lands here at the
     * single integration boundary instead of polluting consumers.
     */
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- narrowing ChildProcess to the minimal SpawnedChildHandle shape; behavior is structurally compatible at runtime
    return nodeSpawn(
      args.command,
      [...args.args,],
      {
        stdio: 'inherit',
        detached,
      },
    ) as unknown as SpawnedChildHandle;
  };
}

/**
 * Default {@link ProcessSignalFn}: forwards to `process.kill`.
 *
 * Wrapped in a named function so the call site reads naturally and so
 * dependency-injection points stay symmetric with {@link SpawnFn} and
 * {@link WriteClearFn}.
 *
 * @param pid - target pid; negative values address the matching process group on POSIX
 *
 * @param signal - signal name (`'SIGTERM'`, `'SIGHUP'`, ...) or numeric signal id
 *
 * @example
 * ```ts
 * defaultProcessSignal({ pid: -1234, signal: 'SIGTERM', },);
 * ```
 */
function defaultProcessSignal(
  {
    pid,
    signal,
  }: {
    readonly pid: number;
    readonly signal: NodeJS.Signals | number;
  },
): void {
  process.kill(
    pid,
    signal,
  );
}

/**
 * Code point of the ESC (escape) control character. Named so the
 * `magic-numbers` lint does not fire on the inline literal and so the
 * intent (the standard 0x1B C0 control) is grep-able in one spot.
 */
const ESC_CODE_POINT: number = 0x1B;

/**
 * ESC character built from {@link ESC_CODE_POINT}. Hoisted as a named
 * constant so the `defaultWriteClear` body stays free of raw escape-sequence
 * literals.
 */
const ESC: string = String.fromCodePoint(ESC_CODE_POINT,);

/**
 * Default {@link WriteClearFn}: writes the terminal-clear escape to stdout.
 *
 * `${ESC}[2J` clears the screen and `${ESC}[H` moves the cursor home;
 * matches `watchexec --clear=clear` and `clear(1)`.
 *
 * @example
 * ```ts
 * defaultWriteClear();
 * ```
 */
function defaultWriteClear(): void {
  process.stdout.write(`${ESC}[2J${ESC}[H`,);
}

/**
 * Wraps a child handle's `'exit'` event in a promise that resolves with the
 * `[code, signal]` pair the OS reported. Listener is `once` so it auto-removes
 * after firing; the handle's EventEmitter is then eligible for GC even if the
 * caller drops the returned promise.
 *
 * @param handle - spawned child handle
 *
 * @returns promise resolving with exit code and signal
 *
 * @example
 * ```ts
 * const exited = waitForExit(handle,);
 * handle.kill('SIGTERM',);
 * const { code, signal, } = await exited;
 * ```
 */
function waitForExit(handle: SpawnedChildHandle,): Promise<{
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
}> {
  // oxlint-disable-next-line promise/avoid-new -- EventEmitter -> Promise bridge needs the constructor form
  return new Promise(function captureExit(resolve,) {
    handle.once(
      'exit',
      function onExitForPromise(
        code,
        signal,
      ) {
        resolve({
          code,
          signal,
        },);
      },
    );
  },);
}

/**
 * Awaits a promise and tags its resolution with `'exited'` so {@link Child.#stopRunning}
 * can distinguish "child exited" from "stopTimeout elapsed" in a `Promise.race`.
 *
 * @param promise - exit-watcher promise
 *
 * @returns string tag `'exited'`
 */
async function tagExited(
  promise: Promise<{
    readonly code: number | null;
    readonly signal: NodeJS.Signals | null;
  }>,
): Promise<'exited'> {
  await promise;
  return 'exited';
}

/**
 * Sleeps for the given duration then resolves to `'timeout'`. Paired with
 * {@link tagExited} inside a `Promise.race` to detect SIGTERM-grace expiry.
 *
 * @param ms - milliseconds to wait
 *
 * @returns string tag `'timeout'`
 */
async function tagTimeout(ms: number,): Promise<'timeout'> {
  await wait(ms,);
  return 'timeout';
}

/**
 * Long-running child process with restart/stop semantics.
 *
 * Owns at most one underlying process at a time. {@link start} spawns it;
 * {@link restart} tears down the running one before spawning the next;
 * {@link stop} is the `restart`-without-spawn variant. SIGTERM is sent first;
 * if the child has not exited within `stopTimeout`, SIGKILL escalates.
 *
 * The class is the unit of state because the orchestrator may issue many
 * `restart()` calls over a long-running watch session and needs a stable
 * handle to address; a function-returning-handle style would multiply
 * closure state across modules without buying anything.
 *
 * @example
 * ```ts
 * const child = new Child({ command: 'bun', args: ['src/server.ts',], },);
 * await child.start();
 * // ... file change
 * await child.restart();
 * // ... user hits Ctrl+C
 * await child.stop();
 * ```
 */
export class Child {
  /** Captured command string; immutable for the lifetime of the manager. */
  readonly #command: string;
  /** Captured argument list; immutable for the lifetime of the manager. */
  readonly #args: readonly string[];
  /** SIGTERM-to-SIGKILL grace period (ms); frozen at construction. */
  readonly #stopTimeout: number;
  /** First signal sent on stop/restart; SIGKILL still escalates regardless. */
  readonly #killSignal: NodeJS.Signals;
  /**
   * When `true`, spawn detached and signal `-pid`; see
   * {@link ChildOptions.processGroup}.
   */
  readonly #processGroup: boolean;
  /**
   * When `true`, run the configured `writeClear` sink before every spawn.
   */
  readonly #clear: boolean;
  /** Process-signal sink; default forwards to `process.kill`. */
  readonly #processSignal: ProcessSignalFn;
  /** Terminal-clear sink; default writes ANSI escape to `process.stdout`. */
  readonly #writeClear: WriteClearFn;
  /**
   * Spawn factory; defaults to the detached-aware wrapper produced by
   * a local `makeDefaultSpawn` factory.
   */
  readonly #spawn: SpawnFn;
  /** Tagged logger; composed with `Child.name` on top of the parent. */
  readonly #logger: Logger;
  /**
   * Mutable state field backing the {@link state} getter; transitions documented at {@link ChildState}.
   */
  #state: ChildState = 'idle';
  /**
   * Currently active child handle, or `undefined` between spawns; backs {@link current}.
   */
  #current: SpawnedChildHandle | undefined = undefined;

  /**
   * Constructs the manager. Does NOT start the child; call {@link start} to spawn.
   *
   * @param options - construction options
   *
   * @example
   * ```ts
   * const child = new Child({ command: 'bun', args: ['src/server.ts',], },);
   * ```
   */
  constructor(options: ChildOptions,) {
    this.#command = options.command;
    this.#args = options.args ?? [];
    this.#stopTimeout = options.stopTimeout ?? DEFAULT_STOP_TIMEOUT_MS;
    this.#killSignal = options.killSignal ?? 'SIGTERM';
    this.#processGroup = options.processGroup ?? true;
    this.#clear = options.clear ?? false;
    this.#processSignal = options.processSignal ?? defaultProcessSignal;
    this.#writeClear = options.writeClear ?? defaultWriteClear;
    this.#spawn = options.spawn
      ?? makeDefaultSpawn({ detached: this.#processGroup, },);
    this.#logger = tagged({
      tag: Child.name,
      l: options.logger ?? defaultLogger,
    },);
  }

  /**
   * Current state. Reads are O(1) and side-effect free.
   *
   * @returns one of `idle`, `running`, `stopping`
   *
   * @example
   * ```ts
   * if (child.state === 'idle') await child.start();
   * ```
   */
  get state(): ChildState {
    return this.#state;
  }

  /**
   * Active child handle, or `undefined` when no child is alive.
   *
   * Exposed so tests can inspect the underlying handle's `pid`, `killed`,
   * and event-emission state; production callers should treat the
   * {@link Child} as a black box and use the lifecycle methods instead.
   *
   * @returns active child handle, or `undefined`
   */
  get current(): SpawnedChildHandle | undefined {
    return this.#current;
  }

  /**
   * Spawns the child if state is `idle`. Logs a warning and returns when
   * state is `running` or `stopping`; reentry would leak handles.
   *
   * Returns `Promise<void>` even though no await is needed today, so the
   * lifecycle trio ({@link start}, {@link restart}, {@link stop}) stays
   * uniformly awaitable; a future readiness-check (e.g. wait for the
   * process to print a banner) lands here without breaking callers.
   *
   * @example
   * ```ts
   * await child.start();
   * ```
   */
  start(): Promise<void> {
    if (this.#state !== 'idle') {
      this.#logger.warn(`start() in state ${this.#state}; ignoring`,);
      return Promise.resolve();
    }
    this.#spawnAndTrack();
    return Promise.resolve();
  }

  /**
   * Stops the running child (if any) and spawns a fresh one.
   *
   * In state `idle`, behaves like {@link start}. In state `running`,
   * sends SIGTERM, waits up to `stopTimeout`, escalates to SIGKILL,
   * then spawns. In state `stopping`, logs a warning and returns;
   * a parallel stop is already in flight and the orchestrator should
   * not interleave restarts.
   *
   * @example
   * ```ts
   * await child.restart();
   * ```
   */
  async restart(): Promise<void> {
    if (this.#state === 'stopping') {
      this.#logger.warn('restart() during stopping; ignoring',);
      return;
    }
    if (this.#state === 'running')
      await this.#stopRunning();
    this.#spawnAndTrack();
  }

  /**
   * Sends SIGTERM to the running child; escalates to SIGKILL after
   * {@link ChildOptions.stopTimeout}. No-op when state is `idle`;
   * logs a warning and returns when state is `stopping`.
   *
   * @example
   * ```ts
   * await child.stop();
   * ```
   */
  async stop(): Promise<void> {
    if (this.#state === 'idle')
      return;
    if (this.#state === 'stopping') {
      this.#logger.warn('stop() during stopping; ignoring',);
      return;
    }
    await this.#stopRunning();
  }

  /**
   * Invokes the spawn factory and tracks the resulting handle. Wires
   * an `exit` listener so a natural child exit (e.g. crash, normal
   * completion) resets state to `idle` without orchestrator action.
   *
   * Honors `clear`: when enabled, runs the configured `writeClear`
   * sink before the spawn so the child's first output lands on a clean
   * terminal rather than scrolling under the prior child's logs.
   */
  #spawnAndTrack(): void {
    if (this.#clear) {
      this.#writeClear();
    }
    /** Freshly spawned process handle; stored on `#current` so subsequent stops can address it. */
    const handle = this.#spawn({
      command: this.#command,
      args: this.#args,
    },);
    this.#current = handle;
    this.#state = 'running';
    this.#logger.info(
      `spawned pid=${String(handle.pid ?? '?',)} command=${this.#command}`,
    );

    /** Captured for the sync exit listener that needs class state. */
    const self = this;

    handle.once(
      'exit',
      // chokidar-style sync listener inline at the `.once` call site:
      // chokidar's ExitListener signature is positional (code, signal), and
      // oxlint's `require-destructured-params` is hard-banned-from-disabling
      // on declarations but accepts positional pairs in callback expressions.
      function onSpawnExit(
        code,
        signal,
      ) {
        if (self.#current === handle) {
          self.#current = undefined;
          if (self.#state !== 'stopping') {
            // Stop path explicitly manages this transition after Promise.race resolves;
            // a natural (uncommanded) exit also lands here and resets the state.
            self.#state = 'idle';
          }
        }
        self.#logger.info(
          `exited pid=${String(handle.pid ?? '?',)} code=${
            code === null ? '?' : String(code,)
          } signal=${signal ?? '?'}`,
        );
      },
    );
  }

  /**
   * Routes a signal to either the direct child or its process group.
   *
   * When {@link ChildOptions.processGroup} is `true` (default) and the
   * handle reports a `pid`, the call goes through `process.kill(-pid)`
   * via the configured `processSignal` sink so the whole subtree
   * receives the signal. When `false` or `pid` is undefined, the
   * signal is sent to the direct child handle (`handle.kill(signal)`),
   * matching node's single-process semantics.
   *
   * @param handle - active child handle
   *
   * @param signal - signal name to deliver
   */
  #sendSignal(
    handle: SpawnedChildHandle,
    signal: NodeJS.Signals,
  ): void {
    if (this.#processGroup && handle.pid !== undefined) {
      this.#processSignal({
        pid: -handle.pid,
        signal,
      },);
      return;
    }
    handle.kill(signal,);
  }

  /**
   * Stops the running child: sends {@link ChildOptions.killSignal} first
   * and races the exit against `stopTimeout`. On expiry, escalates to
   * `SIGKILL` (always the escalation regardless of `killSignal` so a
   * misbehaving child cannot block teardown indefinitely).
   *
   * Caller is responsible for ensuring state is `running` at entry; the
   * private method narrows the precondition via {@link nonNullishOrThrow}
   * on `#current` so a stray call from a future code path fails loudly
   * instead of silently no-op'ing.
   */
  async #stopRunning(): Promise<void> {
    /** Active child handle narrowed from `#current`; the throw guards against the private method being called outside `running`. */
    const handle = nonNullishOrThrow(this.#current,);
    this.#state = 'stopping';
    this.#logger.info(
      `stopping pid=${String(handle.pid ?? '?',)} (${this.#killSignal})`,
    );

    /** Listener registered BEFORE kill so a synchronous-exit fake cannot lose the event. */
    const exited = waitForExit(handle,);
    this.#sendSignal(
      handle,
      this.#killSignal,
    );

    /** Race winner tag: `'exited'` means the child stopped within grace, `'timeout'` triggers SIGKILL escalation. */
    const result = await Promise.race([
      tagExited(exited,),
      tagTimeout(this.#stopTimeout,),
    ],);
    if (result === 'timeout') {
      this.#logger.warn(
        `${this.#killSignal} timed out after ${
          String(this.#stopTimeout,)
        }ms; escalating to SIGKILL`,
      );
      this.#sendSignal(
        handle,
        'SIGKILL',
      );
      await exited;
    }

    this.#current = undefined;
    this.#state = 'idle';
  }
}
