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
import { askPersona, } from '../dialogue/ask.ts';
import { el, } from '../dom.ts';
import { LL, } from '../i18n/runtime.ts';
import {
  navigate,
  registerScreen,
} from '../router.ts';
import {
  getBackground,
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
import type {
  Chapter,
  DialogueBeat,
  LogEntry,
} from '../types.ts';

/** Cancels a pending typewriter timer. */
type Cancel = () => void;

/**
 * `setTimeout` return type.
 *
 * The DOM lib types `setTimeout` as returning `number`, but `@types/bun`
 * leaks the Node `Timeout` opaque type into globals. Use the actual
 * return type so `clearTimeout` and our state record stay aligned.
 */
type TimerId = ReturnType<typeof setTimeout>;

/** Beat-runtime state (kept on the screen instance). */
type Runtime = {
  /** Whether auto-advance is on. */
  auto: boolean;

  /** Current typewriter cancel handle, if a reveal is in progress. */
  typewriterCancel: Cancel | undefined;

  /** Pending auto-advance timer id. */
  autoTimer: TimerId | undefined;

  /** Whether the dialogue is currently hidden (Hide toolbar button). */
  hidden: boolean;

  /** Current ask form root node, when the panel is open. */
  askPanel: HTMLElement | undefined;
};

/**
 * Reveals `text` into `target` one character at a time.
 *
 * @returns cancel function and a promise resolved on completion
 */
function typewrite(
  {
    target,
    text,
    charsPerSecond,
  }: {
    target: HTMLElement;
    text: string;
    charsPerSecond: number;
  },
): {
  cancel: Cancel;
  done: Promise<void>;
} {
  target.textContent = '';
  /** Cooperative cancel flag flipped by the returned cancel callback. */
  let cancelled = false;
  /** Per-character delay derived from `charsPerSecond`, floored at 8 ms. */
  const interval = Math.max(
    8,
    Math.floor(1_000 / charsPerSecond,),
  );
  /** Reveal cursor advanced one character per tick. */
  let index = 0;
  /** Promise resolved when the reveal completes or is cancelled. */
  const done = new Promise<void>(function run(resolve,): void {
    /** Repeating timer driving the per-character reveal. */
    const timer = globalThis.setInterval(
      function step(): void {
        if (cancelled) {
          globalThis.clearInterval(timer,);
          resolve();
          return;
        }
        index += 1;
        target.textContent = text.slice(
          0,
          index,
        );
        if (index >= text.length) {
          globalThis.clearInterval(timer,);
          resolve();
        }
      },
      interval,
    );
  },);
  return {
    cancel: function cancel(): void {
      if (cancelled)
        return;
      cancelled = true;
      target.textContent = text;
    },
    done,
  };
}

/** Last mount's teardown closure, captured so the router can call it. */
let currentTeardown: (() => void) | undefined;

/** Persists and appends a log entry to the active save. */
function appendLog(entry: LogEntry,): void {
  /** Active save snapshot used to append `entry` to its log. */
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

/** Mounts the lecture screen against the active save. */
function mount(root: HTMLElement,): void {
  /** Current locale's translation accessors. */
  const ll = LL();
  /** Active save snapshot; missing means the user landed here without a save. */
  const save = getActiveSave();
  if (save === undefined) {
    navigate('menu',);
    return;
  }
  /** Per-mount mutable runtime state (auto, timers, hidden, ask panel). */
  const runtime: Runtime = {
    auto: false,
    typewriterCancel: undefined,
    autoTimer: undefined,
    hidden: false,
    askPanel: undefined,
  };

  /** Top-level stage container holding background, character, dialogue, toolbar. */
  const stage = el(
    'div',
    { class: 'stage', },
  );
  /** Background layer painted with the classroom asset. */
  const bg = el(
    'div',
    {
      class: 'stage-bg',
      style: `background-image: url("${getBackground('classroom',)}")`,
    },
  );
  /** Character portrait image whose `src` is swapped per beat pose. */
  const characterImg = el(
    'img',
    {
      src: getCharacterPose(
        'ruka',
        'neutral',
      ),
      alt: '',
    },
  );
  /** Wrapper sized to position the character relative to the stage. */
  const characterWrap = el(
    'div',
    { class: 'stage-character', },
    [characterImg,],
  );
  /** Inner element receiving the typewriter-revealed dialogue text. */
  const dialogueText = el(
    'div',
    { class: 'dialogue-text', },
  );
  /** Speaker-name span shown in the dialogue header. */
  const speakerName = el(
    'span',
    { class: 'speaker-name', },
    [getCharacterName('ruka',),],
  );
  /** Bottom dialogue box assembled from header + text. */
  const dialogueBox = el(
    'div',
    { class: 'stage-dialogue', },
    [
      el(
        'header',
        {},
        [speakerName,],
      ),
      dialogueText,
    ],
  );
  /** Chapter-card overlay shown before the first beat of each chapter. */
  const chapterCard = el(
    'div',
    { class: 'chapter-card', },
  );
  chapterCard.hidden = true;
  /** Toolbar row hosting the navigation/auto/log/hide/ask buttons. */
  const toolbar = el(
    'div',
    { class: 'stage-controls', },
  );
  stage.append(
    bg,
    characterWrap,
    dialogueBox,
    chapterCard,
    toolbar,
  );

  /** Outer screen container wrapping the assembled stage. */
  const screen = el(
    'section',
    {
      class: 'screen',
      'data-screen': 'lecture',
    },
    [stage,],
  );
  root.append(screen,);

  /** Cancels any in-flight typewriter, auto timer, or speech. */
  function clearTimers(): void {
    if (runtime.typewriterCancel !== undefined) {
      runtime.typewriterCancel();
      runtime.typewriterCancel = undefined;
    }
    if (runtime.autoTimer !== undefined) {
      globalThis.clearTimeout(runtime.autoTimer,);
      runtime.autoTimer = undefined;
    }
    stopSpeaking();
  }

  /** Returns the chapter at the saved index, throwing on a vanished save. */
  function currentChapter(): Chapter {
    /** Active save snapshot used to read the chapter index. */
    const live = getActiveSave();
    if (live === undefined)
      throw new Error('lecture: active save vanished',);
    /** Chapter looked up by index; throws on out-of-range. */
    const chapter = live.chapters[live.chapterIndex];
    if (chapter === undefined)
      throw new Error('lecture: chapter index out of range',);
    return chapter;
  }

  /** Returns the beat at the saved indices, or `undefined` when missing. */
  function currentBeat(): DialogueBeat | undefined {
    /** Active save snapshot used to read chapter and beat indices. */
    const live = getActiveSave();
    if (live === undefined)
      return undefined;
    return live.chapters[live.chapterIndex]?.dialogue[live.beatIndex];
  }

  /** Renders the chapter card overlay for `chapter`. */
  function showChapterCard(chapter: Chapter,): void {
    chapterCard.replaceChildren(
      el(
        'div',
        {},
        [
          el(
            'h2',
            {},
            [chapter.title,],
          ),
          el(
            'p',
            {},
            [chapter.summary,],
          ),
        ],
      ),
    );
    chapterCard.hidden = false;
  }

  /** Hides the chapter card overlay so the dialogue stage is visible. */
  function hideChapterCard(): void {
    chapterCard.hidden = true;
  }

  /** Renders the current beat: pose, typewriter reveal, optional speech, auto-advance. */
  async function showCurrentBeat(): Promise<void> {
    clearTimers();
    /** Beat to render at the saved indices, or `undefined` when none remains. */
    const beat = currentBeat();
    if (beat === undefined)
      return;
    /** Active save snapshot read alongside the beat lookup. */
    const live = getActiveSave();
    if (live === undefined)
      return;
    if (live.beatIndex === 0)
      showChapterCard(currentChapter(),);
    else
      hideChapterCard();
    characterImg.src = getCharacterPose(
      'ruka',
      beat.pose ?? 'neutral',
    );
    /** Settings snapshot used to pick the typewriter speed. */
    const settings = getSettings();
    /** Typewriter controller exposing cancel and a completion promise. */
    const tw = typewrite({
      target: dialogueText,
      text: beat.text,
      charsPerSecond: settings.textSpeed,
    },);
    runtime.typewriterCancel = tw.cancel;
    /** Pending speech promise when voice playback is enabled. */
    let speakPromise: Promise<void> | undefined;
    if (canSpeak())
      speakPromise = speak(beat.text,);
    await tw.done;
    runtime.typewriterCancel = undefined;
    appendLog({
      speaker: 'persona',
      text: beat.text,
    },);
    persistActiveSave();
    if (runtime.auto) {
      /** Fresh settings read after speech/log so the latest values drive auto-advance. */
      const settingsAfter = getSettings();
      if (
        settingsAfter.autoAdvanceByVoice
        && speakPromise !== undefined
      ) {
        await speakPromise.catch(function ignore(): void {
          // tts errors logged inside speak()
        },);
        runtime.autoTimer = globalThis.setTimeout(
          advance,
          settingsAfter.autoAdvanceDelayMs,
        );
        return;
      }
      runtime.autoTimer = globalThis.setTimeout(
        advance,
        settingsAfter.autoAdvanceDelayMs,
      );
    }
  }

  /** Moves to the next beat (or next chapter, or parks at the end). */
  function advance(): void {
    /** Active save snapshot, read so the next index can be patched correctly. */
    const live = getActiveSave();
    if (live === undefined)
      return;
    /** Current chapter resolved through the throwing helper. */
    const chapter = currentChapter();
    if (live.beatIndex + 1 < chapter.dialogue.length) {
      patchActiveSave({ beatIndex: live.beatIndex + 1, },);
      void showCurrentBeat();
      return;
    }
    if (live.chapterIndex + 1 < live.chapters.length) {
      patchActiveSave({
        chapterIndex: live.chapterIndex + 1,
        beatIndex: 0,
      },);
      void showCurrentBeat();
      return;
    }
    // End of paper. Park on the last beat.
    persistActiveSave();
  }

  /** Moves to the previous beat (or end of the previous chapter). */
  function regress(): void {
    /** Active save snapshot, read so the previous index can be patched. */
    const live = getActiveSave();
    if (live === undefined)
      return;
    if (live.beatIndex > 0) {
      patchActiveSave({ beatIndex: live.beatIndex - 1, },);
      void showCurrentBeat();
      return;
    }
    if (live.chapterIndex > 0) {
      /** Previous chapter entry whose final beat becomes the new index. */
      const prev = live.chapters[live.chapterIndex - 1];
      if (prev === undefined)
        return;
      patchActiveSave({
        chapterIndex: live.chapterIndex - 1,
        beatIndex: prev.dialogue.length - 1,
      },);
      void showCurrentBeat();
    }
  }

  /** Toggles auto-advance and immediately advances once when turning on. */
  function toggleAuto(): void {
    runtime.auto = !runtime.auto;
    autoBtn.dataset.variant = runtime.auto ? 'primary' : 'ghost';
    if (runtime.auto) {
      // Kick the auto loop forward immediately when toggled on.
      advance();
    }
  }

  /** Toggles visibility of dialogue and toolbar to reveal the background. */
  function toggleHide(): void {
    runtime.hidden = !runtime.hidden;
    dialogueBox.hidden = runtime.hidden;
    toolbar.hidden = runtime.hidden;
  }

  /** Opens the ask-the-persona panel; no-op when one is already open. */
  function openAsk(): void {
    if (runtime.askPanel !== undefined)
      return;
    /** Question input where the user types their query. */
    const input = el(
      'textarea',
      { placeholder: ll.askPlaceholder(), },
    );
    /** Inline status paragraph for the thinking and error messages. */
    const status = el(
      'p',
      { class: 'muted', },
    );
    /** Send button wired to the local async `send`. */
    const sendBtn = el(
      'button',
      {
        'data-variant': 'primary',
        onclick: function onClick(): void {
          void send();
        },
      },
      [ll.askSend(),],
    );
    /** Close button restoring the dialogue stage. */
    const closeBtn = el(
      'button',
      {
        'data-variant': 'ghost',
        onclick: function onClick(): void {
          close();
        },
      },
      [ll.back(),],
    );
    /** Panel container holding input, status, send, and close. */
    const panel = el(
      'div',
      {
        class: 'stage-dialogue',
        style: 'inset-block-end: auto; inset-block-start: 1rem;',
      },
      [
        el(
          'header',
          {},
          [
            el(
              'span',
              { class: 'speaker-name', },
              [ll.askPrompt(),],
            ),
            closeBtn,
          ],
        ),
        input,
        status,
        sendBtn,
      ],
    );
    stage.append(panel,);
    runtime.askPanel = panel;

    /** Sends the question to the persona LLM and renders the reply. */
    async function send(): Promise<void> {
      /** Active save snapshot, source of the paper text passed to the LLM. */
      const live = getActiveSave();
      if (live === undefined)
        return;
      /** Trimmed question text; empty value short-circuits the send. */
      const question = input.value.trim();
      if (question.length === 0)
        return;
      status.textContent = ll.askThinking();
      sendBtn.setAttribute(
        'disabled',
        'disabled',
      );
      try {
        /** LLM-generated persona reply rendered inline once received. */
        const reply = await askPersona({
          paperText: live.paperText,
          question,
          signal: undefined,
        },);
        appendLog({
          speaker: 'user',
          text: question,
        },);
        appendLog({
          speaker: 'persona',
          text: reply,
        },);
        persistActiveSave();
        dialogueText.textContent = reply;
        speakerName.textContent = getCharacterName('ruka',);
        if (canSpeak())
          void speak(reply,);
        close();
      }
      catch (err) {
        /** Normalised error message shown in the panel status paragraph. */
        const message = err instanceof Error ? err.message : String(err,);
        status.textContent = `${ll.generationError()}${message}`;
        status.className = 'error';
        sendBtn.removeAttribute('disabled',);
      }
    }

    /** Tears down the ask panel and clears the runtime reference. */
    function close(): void {
      panel.remove();
      runtime.askPanel = undefined;
    }
  }

  /** Back toolbar button stepping the dialogue cursor backward. */
  const backBtn = el(
    'button',
    {
      'data-variant': 'ghost',
      onclick: function onClick(): void {
        regress();
      },
    },
    [ll.back(),],
  );
  /** Auto toolbar button toggling auto-advance state. */
  const autoBtn = el(
    'button',
    {
      'data-variant': 'ghost',
      onclick: function onClick(): void {
        toggleAuto();
      },
    },
    [ll.auto(),],
  );
  /** Log toolbar button navigating to the memory-log screen. */
  const logBtn = el(
    'button',
    {
      'data-variant': 'ghost',
      onclick: function onClick(): void {
        navigate('log',);
      },
    },
    [ll.log(),],
  );
  /** Hide toolbar button toggling dialogue/toolbar visibility. */
  const hideBtn = el(
    'button',
    {
      'data-variant': 'ghost',
      onclick: function onClick(): void {
        toggleHide();
      },
    },
    [ll.hide(),],
  );
  /** Ask toolbar button opening the persona-question panel. */
  const askBtn = el(
    'button',
    {
      'data-variant': 'primary',
      onclick: function onClick(): void {
        openAsk();
      },
    },
    [ll.ask(),],
  );
  /** Menu toolbar button returning to the main menu. */
  const menuBtn = el(
    'button',
    {
      'data-variant': 'ghost',
      onclick: function onClick(): void {
        navigate('menu',);
      },
    },
    ['Menu',],
  );
  toolbar.append(
    menuBtn,
    backBtn,
    autoBtn,
    logBtn,
    hideBtn,
    askBtn,
  );

  /** Global keyboard handler driving advance/regress shortcuts. */
  function onKey(ev: KeyboardEvent,): void {
    if (
      ev.key === ' '
      || ev.key === 'Enter'
      || ev.key === 'ArrowRight'
    ) {
      ev.preventDefault();
      if (runtime.typewriterCancel !== undefined) {
        runtime.typewriterCancel();
        runtime.typewriterCancel = undefined;
        return;
      }
      advance();
    }
    else if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      regress();
    }
  }
  document.addEventListener(
    'keydown',
    onKey,
  );

  /** Stage click handler advancing the dialogue while ignoring control clicks. */
  function onStageClick(ev: MouseEvent,): void {
    if (
      ev.target instanceof Element
      && ev.target.closest('.stage-controls, .stage-dialogue button',)
        !== null
    ) {
      return;
    }
    if (runtime.typewriterCancel !== undefined) {
      runtime.typewriterCancel();
      runtime.typewriterCancel = undefined;
      return;
    }
    advance();
  }
  stage.addEventListener(
    'click',
    onStageClick,
  );

  void showCurrentBeat();

  currentTeardown = function teardown(): void {
    clearTimers();
    document.removeEventListener(
      'keydown',
      onKey,
    );
  };
}

/** Registers the lecture screen. */
export function registerLecture(): void {
  registerScreen(
    'lecture',
    {
      mount,
      unmount: function unmount(): void {
        if (currentTeardown !== undefined) {
          currentTeardown();
          currentTeardown = undefined;
        }
      },
    },
  );
}
