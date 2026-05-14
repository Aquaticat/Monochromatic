/**
 * Select-paper screen.
 *
 * Three input paths:
 *   - Upload a `.pdf` / `.txt` / `.md` file
 *   - Paste raw text into the textarea
 * Plus a primary action that runs the chapter generator and navigates
 * to the lecture screen on success.
 */
import { generateChapters, } from '../dialogue/generator.ts';
import { el, } from '../dom.ts';
import { LL, } from '../i18n/runtime.ts';
import { isProviderReady, } from '../llm/index.ts';
import { extractPaperText, } from '../parse/index.ts';
import {
  navigate,
  registerScreen,
} from '../router.ts';
import {
  persistActiveSave,
  setActiveSave,
} from '../state.ts';
import type { SaveData, } from '../types.ts';

/**
 * Generates a stable id for new save slots.
 *
 * Uses `crypto.randomUUID` which is supported across all baseline
 * browsers; fallback to a timestamp-derived id if missing.
 */
function newSaveId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return globalThis.crypto.randomUUID();
  return `save-${Date.now()}-${Math.floor(Math.random() * 1e6,)}`;
}

/** Mounts the select-topic screen. */
function mount(root: HTMLElement,): void {
  /** Current locale's translation accessors. */
  const ll = LL();
  /** File picker accepting the locale-tuned accept string. */
  const fileInput = el(
    'input',
    {
      type: 'file',
      accept: ll.uploadAccept(),
    },
  );
  /** Plain-text alternative input when the user pastes instead of uploading. */
  const textarea = el(
    'textarea',
    { placeholder: ll.pasteTextPlaceholder(), },
  );
  /** Inline status paragraph used for hints and error messages. */
  const status = el(
    'p',
    { class: 'muted', },
    [ll.selectTopicHint(),],
  );

  /** Click handler for the primary action: parse input, generate, navigate. */
  async function start(): Promise<void> {
    if (!isProviderReady()) {
      status.textContent = ll.apiKeyMissing();
      status.className = 'error';
      return;
    }
    /** Paper body either extracted from the upload or read from the textarea. */
    let paperText = '';
    /** First selected file from the picker, when the upload path is chosen. */
    const file = fileInput.files?.[0];
    try {
      if (file !== undefined) {
        status.textContent = `${ll.generating()} (${file.name})`;
        status.className = 'muted';
        paperText = await extractPaperText(file,);
      }
      else {
        paperText = textarea.value;
      }
      if (paperText.trim().length === 0) {
        status.textContent = ll.selectTopicHint();
        status.className = 'error';
        return;
      }
      status.textContent = ll.generating();
      status.className = 'muted';
      /** LLM-generated title and chapters for the parsed paper text. */
      const generation = await generateChapters({
        paperText,
        signal: undefined,
      },);
      /** Fresh save record stored before navigating to the lecture screen. */
      const save: SaveData = {
        id: newSaveId(),
        label: generation.title,
        paperTitle: generation.title,
        paperText,
        chapters: generation.chapters,
        chapterIndex: 0,
        beatIndex: 0,
        log: [],
        updatedAt: new Date().toISOString(),
      };
      setActiveSave(save,);
      persistActiveSave();
      navigate('lecture',);
    }
    catch (err) {
      /** Normalised error message shown to the user in the status paragraph. */
      const message = err instanceof Error ? err.message : String(err,);
      console.error(
        '[select-topic] start failed',
        err,
      );
      status.textContent = `${ll.generationError()}${message}`;
      status.className = 'error';
    }
  }

  /** Primary "Start lecture" button wiring the click to the local async {@link start}. */
  const startBtn = el(
    'button',
    {
      'data-variant': 'primary',
      onclick: function onClick(): void {
        void start();
      },
    },
    [ll.startLecture(),],
  );

  /** Outer screen container with header, upload, paste, status, and start button. */
  const screen = el(
    'section',
    {
      class: 'screen',
      'data-screen': 'select-topic',
    },
    [
      el(
        'header',
        { class: 'row', },
        [
          el(
            'button',
            {
              'data-variant': 'ghost',
              onclick: function go(): void {
                navigate('menu',);
              },
            },
            [ll.back(),],
          ),
          el(
            'h2',
            {},
            [ll.selectTopic(),],
          ),
        ],
      ),
      el(
        'div',
        { class: 'field', },
        [
          el(
            'label',
            {},
            [ll.upload(),],
          ),
          fileInput,
        ],
      ),
      el(
        'div',
        { class: 'field', },
        [
          el(
            'label',
            {},
            [ll.pasteText(),],
          ),
          textarea,
        ],
      ),
      status,
      startBtn,
    ],
  );
  root.append(screen,);
}

/** Registers the screen with the router. */
export function registerSelectTopic(): void {
  registerScreen(
    'select-topic',
    { mount, },
  );
}
