/**
 * Ask-the-persona panel mounted on top of the lecture stage.
 *
 * Renders a `<textarea>` for the question, a Send button that calls
 * the LLM, and a Close button that tears the panel down. Status text
 * cycles through "thinking" and any error messages.
 */
import { askPersona, } from '../dialogue/ask.ts';
import { el, } from '../dom.ts';
import {
  getActiveSave,
  persistActiveSave,
} from '../state.ts';
import {
  canSpeak,
  speak,
} from '../tts.ts';
import type { LogEntry, } from '../types.ts';

/**
 * Localised labels and runtime hooks consumed by the ask panel.
 */
type AskPanelOptions = {
  /**
   * Translated labels used inside the panel.
   */
  labels: {
    /**
     * Placeholder copy for the textarea.
     */
    placeholder: string;
    /**
     * Header text shown above the question input.
     */
    prompt: string;
    /**
     * Send-button label.
     */
    send: string;
    /**
     * Close-button label (typically "Back").
     */
    back: string;
    /**
     * "Thinking..." status message shown during the LLM round-trip.
     */
    thinking: string;
    /**
     * Prefix prepended to the failure status message.
     */
    generationErrorPrefix: string;
  };
  /**
   * Stage container where the panel is appended.
   */
  stage: HTMLElement;
  /**
   * Stage's dialogue-text element updated with the reply when send succeeds.
   */
  dialogueText: HTMLElement;
  /**
   * Stage's speaker-name element restored to the persona name on send.
   */
  speakerName: HTMLElement;
  /**
   * Display name of the persona shown in the speaker label.
   */
  personaName: string;
  /**
   * Callback that appends an entry to the memory log.
   */
  onLog: (entry: LogEntry,) => void;
  /**
   * Cleanup callback fired when the panel is closed (success or cancel).
   */
  onClose: () => void;
};

/**
 * Mounts the ask panel onto the stage and returns it.
 *
 * @param labels - translated label bundle
 *
 * @param stage - parent container the panel is appended to
 *
 * @param dialogueText - element receiving the LLM reply once it lands
 *
 * @param speakerName - element whose text is restored to the persona name on send
 *
 * @param personaName - localised persona display name
 *
 * @param onLog - log appender for the question and reply entries
 *
 * @param onClose - hook fired by Close/successful Send to clear the panel ref
 *
 * @returns the mounted panel element
 *
 * @example
 * ```ts
 * const panel = mountAskPanel({
 *   labels: { placeholder: '...', prompt: '...', send: '...', back: '...', thinking: '...', generationErrorPrefix: '...' },
 *   stage,
 *   dialogueText,
 *   speakerName,
 *   personaName: 'Ruka',
 *   onLog: function append(entry) { appendLog(entry); },
 *   onClose: function clear() { runtime.askPanel = undefined; },
 * });
 * runtime.askPanel = panel;
 * ```
 */
export function mountAskPanel(
  {
    labels,
    stage,
    dialogueText,
    speakerName,
    personaName,
    onLog,
    onClose,
  }: AskPanelOptions,
): HTMLElement {
  /**
   * Question input where the user types their query.
   */
  const input = el({
    tag: 'textarea',
    attrs: { placeholder: labels.placeholder, },
  },);
  /**
   * Inline status paragraph for the thinking and error messages.
   */
  const status = el({
    tag: 'p',
    attrs: { class: 'muted', },
  },);
  /**
   * Send button wired to the local async `send`.
   */
  const sendBtn = el({
    tag: 'button',
    attrs: {
      'data-variant': 'primary',
      onclick: function onClick(): void {
        void send();
      },
    },
    children: [labels.send,],
  },);
  /**
   * Close button restoring the dialogue stage.
   */
  const closeBtn = el({
    tag: 'button',
    attrs: {
      'data-variant': 'ghost',
      onclick: function onClick(): void {
        close();
      },
    },
    children: [labels.back,],
  },);
  /**
   * Panel container holding input, status, send, and close.
   */
  const panel = el({
    tag: 'div',
    attrs: {
      class: 'stage-dialogue',
      style: 'inset-block-end: auto; inset-block-start: 1rem;',
    },
    children: [
      el({
        tag: 'header',
        attrs: {},
        children: [
          el({
            tag: 'span',
            attrs: { class: 'speaker-name', },
            children: [labels.prompt,],
          },),
          closeBtn,
        ],
      },),
      input,
      status,
      sendBtn,
    ],
  },);
  stage.append(panel,);

  /**
   * Sends the question to the persona LLM and renders the reply.
   */
  async function send(): Promise<void> {
    /**
     * Active save snapshot, source of the paper text passed to the LLM.
     */
    const live = getActiveSave();
    if (live === undefined)
      return;
    /**
     * Trimmed question text; empty value short-circuits the send.
     */
    const question = input.value
      .trim();
    if (question.length
      === 0)
      return;
    status.textContent = labels.thinking;
    sendBtn.setAttribute(
      'disabled',
      'disabled',
    );
    try {
      /**
       * LLM-generated persona reply rendered inline once received.
       */
      const reply = await askPersona({
        paperText: live.paperText,
        question,
        signal: undefined,
      },);
      onLog({
        speaker: 'user',
        text: question,
      },);
      onLog({
        speaker: 'persona',
        text: reply,
      },);
      persistActiveSave();
      dialogueText.textContent = reply;
      speakerName.textContent = personaName;
      if (canSpeak())
        void speak(reply,);
      close();
    }
    catch (err) {
      /**
       * Normalised error message shown in the panel status paragraph.
       */
      const message = err instanceof Error ? err.message : String(err,);
      status.textContent = `${labels.generationErrorPrefix}${message}`;
      status.className = 'error';
      sendBtn.removeAttribute('disabled',);
    }
  }

  /**
   * Tears down the ask panel and clears the runtime reference.
   */
  function close(): void {
    panel.remove();
    onClose();
  }

  return panel;
}
