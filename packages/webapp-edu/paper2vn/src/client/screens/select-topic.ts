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
  const ll = LL();
  const fileInput = el(
    'input',
    {
      type: 'file',
      accept: ll.uploadAccept(),
    },
  );
  const textarea = el(
    'textarea',
    { placeholder: ll.pasteTextPlaceholder(), },
  );
  const status = el(
    'p',
    { class: 'muted', },
    [ll.selectTopicHint(),],
  );

  async function start(): Promise<void> {
    if (!isProviderReady()) {
      status.textContent = ll.apiKeyMissing();
      status.className = 'error';
      return;
    }
    let paperText = '';
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
      const generation = await generateChapters({
        paperText,
        signal: undefined,
      },);
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
      const message = err instanceof Error ? err.message : String(err,);
      console.error(
        '[select-topic] start failed',
        err,
      );
      status.textContent = `${ll.generationError()}${message}`;
      status.className = 'error';
    }
  }

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
