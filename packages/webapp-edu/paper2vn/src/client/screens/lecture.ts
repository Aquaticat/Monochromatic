/**
 * Lecture screen -- the visual-novel runtime.
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

/** Beat-runtime state -- kept on the screen instance. */
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
  let cancelled = false;
  const interval = Math.max(
    8,
    Math.floor(1_000 / charsPerSecond,),
  );
  let index = 0;
  const done = new Promise<void>(function run(resolve,): void {
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
  const ll = LL();
  const save = getActiveSave();
  if (save === undefined) {
    navigate('menu',);
    return;
  }
  const runtime: Runtime = {
    auto: false,
    typewriterCancel: undefined,
    autoTimer: undefined,
    hidden: false,
    askPanel: undefined,
  };

  const stage = el(
    'div',
    { class: 'stage', },
  );
  const bg = el(
    'div',
    {
      class: 'stage-bg',
      style: `background-image: url("${getBackground('classroom',)}")`,
    },
  );
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
  const characterWrap = el(
    'div',
    { class: 'stage-character', },
    [characterImg,],
  );
  const dialogueText = el(
    'div',
    { class: 'dialogue-text', },
  );
  const speakerName = el(
    'span',
    { class: 'speaker-name', },
    [getCharacterName('ruka',),],
  );
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
  const chapterCard = el(
    'div',
    { class: 'chapter-card', },
  );
  chapterCard.hidden = true;
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

  const screen = el(
    'section',
    {
      class: 'screen',
      'data-screen': 'lecture',
    },
    [stage,],
  );
  root.append(screen,);

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

  function currentChapter(): Chapter {
    const live = getActiveSave();
    if (live === undefined)
      throw new Error('lecture: active save vanished',);
    const chapter = live.chapters[live.chapterIndex];
    if (chapter === undefined)
      throw new Error('lecture: chapter index out of range',);
    return chapter;
  }

  function currentBeat(): DialogueBeat | undefined {
    const live = getActiveSave();
    if (live === undefined)
      return undefined;
    return live.chapters[live.chapterIndex]?.dialogue[live.beatIndex];
  }

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

  function hideChapterCard(): void {
    chapterCard.hidden = true;
  }

  async function showCurrentBeat(): Promise<void> {
    clearTimers();
    const beat = currentBeat();
    if (beat === undefined)
      return;
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
    const settings = getSettings();
    const tw = typewrite({
      target: dialogueText,
      text: beat.text,
      charsPerSecond: settings.textSpeed,
    },);
    runtime.typewriterCancel = tw.cancel;
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

  function advance(): void {
    const live = getActiveSave();
    if (live === undefined)
      return;
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
    // End of paper -- park on the last beat.
    persistActiveSave();
  }

  function regress(): void {
    const live = getActiveSave();
    if (live === undefined)
      return;
    if (live.beatIndex > 0) {
      patchActiveSave({ beatIndex: live.beatIndex - 1, },);
      void showCurrentBeat();
      return;
    }
    if (live.chapterIndex > 0) {
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

  function toggleAuto(): void {
    runtime.auto = !runtime.auto;
    autoBtn.dataset.variant = runtime.auto ? 'primary' : 'ghost';
    if (runtime.auto) {
      // Kick the auto loop forward immediately when toggled on.
      advance();
    }
  }

  function toggleHide(): void {
    runtime.hidden = !runtime.hidden;
    dialogueBox.hidden = runtime.hidden;
    toolbar.hidden = runtime.hidden;
  }

  function openAsk(): void {
    if (runtime.askPanel !== undefined)
      return;
    const input = el(
      'textarea',
      { placeholder: ll.askPlaceholder(), },
    );
    const status = el(
      'p',
      { class: 'muted', },
    );
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

    async function send(): Promise<void> {
      const live = getActiveSave();
      if (live === undefined)
        return;
      const question = input.value.trim();
      if (question.length === 0)
        return;
      status.textContent = ll.askThinking();
      sendBtn.setAttribute(
        'disabled',
        'disabled',
      );
      try {
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
        const message = err instanceof Error ? err.message : String(err,);
        status.textContent = `${ll.generationError()}${message}`;
        status.className = 'error';
        sendBtn.removeAttribute('disabled',);
      }
    }

    function close(): void {
      panel.remove();
      runtime.askPanel = undefined;
    }
  }

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
