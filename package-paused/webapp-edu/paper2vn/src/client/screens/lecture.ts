/**
 * Lecture screen; the visual-novel runtime.
 *
 * Shows a chapter card before the first beat of each chapter, then
 * walks through each beat with a typewriter reveal. Toolbar buttons
 * cover Back, Auto, Log, Hide, and Ask. Click anywhere on the stage
 * (outside controls) or hit Space / Enter / Right Arrow to advance.
 *
 * The screen renders against the active save in the state store and
 * persists progress on each advance.
 */
import { el, } from '../dom.ts';
import { LL, } from '../i18n/runtime.ts';
import {
  navigate,
  registerScreen,
} from '../router.ts';
import {
  getCharacterName,
  getCharacterPose,
} from '../sprite-pack.ts';
import {
  getActiveSave,
  getSettings,
  patchActiveSave,
  persistActiveSave,
} from '../state.ts';
import {
  canSpeak,
  speak,
  stopSpeaking,
} from '../tts.ts';
import type { LogEntry, } from '../types.ts';
import { mountAskPanel, } from './lecture-ask.ts';
import {
  lectureKeyHandler,
  lectureStageClickHandler,
} from './lecture-events.ts';
import {
  advanceBeat,
  currentBeat,
  currentChapter,
  hideChapterCard,
  regressBeat,
  showChapterCard,
} from './lecture-runtime.ts';
import { buildLectureStage, } from './lecture-stage.ts';
import { toolbarButton, } from './lecture-toolbar.ts';
import {
  type Cancel,
  typewrite,
} from './lecture-typewriter.ts';

/**
 * `setTimeout` return type.
 *
 * The DOM lib types `setTimeout` as returning `number`, but `@types/bun`
 * leaks the Node `Timeout` opaque type into globals. Use the actual
 * return type so `clearTimeout` and our state record stay aligned.
 */
type TimerId = ReturnType<typeof setTimeout>;

/**
 * Beat-runtime state (kept on the screen instance).
 */
type Runtime = {
  /**
   * Whether auto-advance is on.
   */
  auto: boolean;

  /**
   * Current typewriter cancel handle, if a reveal is in progress.
   */
  typewriterCancel: Cancel | undefined;

  /**
   * Pending auto-advance timer id.
   */
  autoTimer: TimerId | undefined;

  /**
   * Whether the dialogue is currently hidden (Hide toolbar button).
   */
  hidden: boolean;

  /**
   * Current ask form root node, when the panel is open.
   */
  askPanel: HTMLElement | undefined;
};

/**
 * Single-slot container holding the most recent mount's teardown closure.
 */
const lectureState: {
  currentTeardown: (() => void) | undefined;
} = {
  currentTeardown: undefined,
};

/**
 * Toolbar handler for the Log button: routes to the memory-log screen.
 */
function goToLog(): void {
  navigate('log',);
}

/**
 * Toolbar handler for the Menu button: routes back to the main menu.
 */
function goBackToMenu(): void {
  navigate('menu',);
}

/**
 * Persists and appends a log entry to the active save.
 *
 * @param entry - log entry to append to the active save's log
 */
function appendLog(entry: Readonly<LogEntry>,): void {
  /**
   * Active save snapshot used to append `entry` to its log.
   */
  const save = getActiveSave();
  if (save === undefined)
    return;
  patchActiveSave({
    log: [
      ...save.log,
      entry,
    ],
  },);
}

/**
 * Mounts the lecture screen against the active save.
 *
 * @param root - host element the screen mounts into
 */
function mount(root: HTMLElement,): void {
  /**
   * Current locale's translation accessors.
   */
  // oxlint-disable-next-line new-cap -- typesafe-i18n exports the accessor as LL by convention.
  const ll = LL();
  /**
   * Active save snapshot; missing means the user landed here without a save.
   */
  const save = getActiveSave();
  if (save === undefined) {
    navigate('menu',);
    return;
  }
  /**
   * Per-mount mutable runtime state (auto, timers, hidden, ask panel).
   */
  const runtime: Runtime = {
    auto: false,
    typewriterCancel: undefined,
    autoTimer: undefined,
    hidden: false,
    askPanel: undefined,
  };

  /**
   * Assembled stage subtree (background, character, dialogue, chapter card, toolbar).
   */
  const {
    stage,
    characterImg,
    dialogueBox,
    dialogueText,
    speakerName,
    chapterCard,
    toolbar,
  } = buildLectureStage();

  /**
   * Outer screen container wrapping the assembled stage.
   */
  const screen = el({
    tag: 'section',
    attrs: {
      class: 'screen',
      'data-screen': 'lecture',
    },
    children: [stage,],
  },);
  root.append(screen,);

  /**
   * Cancels any in-flight typewriter, auto timer, or speech.
   */
  function clearTimers(): void {
    if (runtime.typewriterCancel
      !== undefined) {
      runtime.typewriterCancel();
      runtime.typewriterCancel = undefined;
    }
    if (runtime.autoTimer
      !== undefined) {
      globalThis.clearTimeout(runtime.autoTimer,);
      runtime.autoTimer = undefined;
    }
    stopSpeaking();
  }

  /**
   * Renders the current beat: pose, typewriter reveal, optional speech, auto-advance.
   */
  async function showCurrentBeat(): Promise<void> {
    clearTimers();
    /**
     * Beat to render at the saved indices, or `undefined` when none remains.
     */
    const beat = currentBeat();
    if (beat === undefined)
      return;
    /**
     * Active save snapshot read alongside the beat lookup.
     */
    const live = getActiveSave();
    if (live === undefined)
      return;
    if (live.beatIndex
      === 0) {
      showChapterCard({
        chapterCard,
        chapter: currentChapter(),
      },);
    }
    else {
      hideChapterCard(chapterCard,);
    }
    characterImg.src = getCharacterPose({
      characterId: 'ruka',
      pose: beat.pose
        ?? 'neutral',
    },);
    /**
     * Settings snapshot used to pick the typewriter speed.
     */
    const settings = getSettings();
    /**
     * Typewriter controller exposing cancel and a completion promise.
     */
    const tw = typewrite({
      target: dialogueText,
      text: beat.text,
      charsPerSecond: settings.textSpeed,
    },);
    runtime.typewriterCancel = tw.cancel;
    /**
     * Pending speech promise when voice playback is enabled.
     */
    const speakPromise: Promise<void> | undefined = canSpeak()
      ? speak(beat.text,)
      : undefined;
    await tw.done;
    runtime.typewriterCancel = undefined;
    appendLog({
      speaker: 'persona',
      text: beat.text,
    },);
    persistActiveSave();
    if (!runtime.auto)
      return;
    /**
     * Fresh settings read after speech/log so the latest values drive auto-advance.
     */
    const settingsAfter = getSettings();
    if (settingsAfter.autoAdvanceByVoice
      && (speakPromise !== undefined)) {
      await (async function waitForSpeech(): Promise<void> {
        try {
          await speakPromise;
        }
        catch {
          // tts errors logged inside speak()
        }
      })();
    }
    runtime.autoTimer = globalThis.setTimeout(
      advance,
      settingsAfter.autoAdvanceDelayMs,
    );
  }

  /**
   * Repaint trigger consumed by `advanceBeat`/`regressBeat` from the runtime helper.
   */
  function repaint(): void {
    void showCurrentBeat();
  }

  /**
   * Moves to the next beat (or next chapter, or parks at the end).
   */
  function advance(): void {
    advanceBeat({ onAdvanced: repaint, },);
  }

  /**
   * Moves to the previous beat (or end of the previous chapter).
   */
  function regress(): void {
    regressBeat({ onRegressed: repaint, },);
  }

  /**
   * Toggles auto-advance and immediately advances once when turning on.
   */
  function toggleAuto(): void {
    runtime.auto = !runtime.auto;
    autoBtn.dataset
      .variant = runtime.auto ? 'primary' : 'ghost';
    if (runtime.auto) {
      // Kick the auto loop forward immediately when toggled on.
      advance();
    }
  }

  /**
   * Toggles visibility of dialogue and toolbar to reveal the background.
   */
  function toggleHide(): void {
    runtime.hidden = !runtime.hidden;
    dialogueBox.hidden = runtime.hidden;
    toolbar.hidden = runtime.hidden;
  }

  /**
   * Opens the ask-the-persona panel; no-op when one is already open.
   */
  function openAsk(): void {
    if (runtime.askPanel
      !== undefined)
      return;
    runtime.askPanel = mountAskPanel({
      labels: {
        placeholder: ll.askPlaceholder(),
        prompt: ll.askPrompt(),
        send: ll.askSend(),
        back: ll.back(),
        thinking: ll.askThinking(),
        generationErrorPrefix: ll.generationError(),
      },
      stage,
      dialogueText,
      speakerName,
      personaName: getCharacterName('ruka',),
      onLog: appendLog,
      onClose: function clearRef(): void {
        runtime.askPanel = undefined;
      },
    },);
  }

  /**
   * Back toolbar button stepping the dialogue cursor backward.
   */
  const backBtn = toolbarButton({
    label: ll.back(),
    variant: 'ghost',
    onActivate: regress,
  },);
  /**
   * Auto toolbar button toggling auto-advance state.
   */
  const autoBtn = toolbarButton({
    label: ll.auto(),
    variant: 'ghost',
    onActivate: toggleAuto,
  },);
  /**
   * Log toolbar button navigating to the memory-log screen.
   */
  const logBtn = toolbarButton({
    label: ll.log(),
    variant: 'ghost',
    onActivate: goToLog,
  },);
  /**
   * Hide toolbar button toggling dialogue/toolbar visibility.
   */
  const hideBtn = toolbarButton({
    label: ll.hide(),
    variant: 'ghost',
    onActivate: toggleHide,
  },);
  /**
   * Ask toolbar button opening the persona-question panel.
   */
  const askBtn = toolbarButton({
    label: ll.ask(),
    variant: 'primary',
    onActivate: openAsk,
  },);
  /**
   * Menu toolbar button returning to the main menu.
   */
  const menuBtn = toolbarButton({
    label: 'Menu',
    variant: 'ghost',
    onActivate: goBackToMenu,
  },);
  toolbar.append(
    menuBtn,
    backBtn,
    autoBtn,
    logBtn,
    hideBtn,
    askBtn,
  );

  /**
   * Global keyboard handler driving advance/regress shortcuts.
   */
  const onKey = lectureKeyHandler({
    runtime,
    advance,
    regress,
  },);
  document.addEventListener(
    'keydown',
    onKey,
  );

  /**
   * Stage click handler advancing the dialogue while ignoring control clicks.
   */
  const onStageClick = lectureStageClickHandler({
    runtime,
    advance,
  },);
  stage.addEventListener(
    'click',
    onStageClick,
  );

  void showCurrentBeat();

  lectureState.currentTeardown = function teardown(): void {
    clearTimers();
    document.removeEventListener(
      'keydown',
      onKey,
    );
  };
}

/**
 * Registers the lecture screen with the router.
 *
 * @example
 * ```ts
 * registerLecture();
 * navigate('lecture');
 * ```
 */
export function registerLecture(): void {
  registerScreen({
    id: 'lecture',
    module: {
      mount,
      unmount: function unmount(): void {
        if (lectureState.currentTeardown
          !== undefined) {
          lectureState.currentTeardown();
          lectureState.currentTeardown = undefined;
        }
      },
    },
  },);
}
