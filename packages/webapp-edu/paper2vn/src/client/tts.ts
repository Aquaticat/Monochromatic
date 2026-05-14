/**
 * Web Speech API wrapper.
 *
 * Speaks dialogue beats in the active locale's voice. Volume is
 * pulled from the settings store. Returns a promise that resolves
 * when speech ends so the lecture screen can chain auto-advance.
 *
 * Voice availability varies by browser/OS; missing voices for the
 * target language fall back to the default voice with a console
 * warning, never crash.
 */
import { bcp47, } from './i18n/runtime.ts';
import { getSettings, } from './state.ts';

/** Cancels any in-flight utterance. */
export function stopSpeaking(): void {
  try {
    globalThis.speechSynthesis.cancel();
  }
  catch (err) {
    console.error(
      '[tts] cancel failed',
      err,
    );
  }
}

/** Returns whether voice playback is available + enabled. */
export function canSpeak(): boolean {
  return getSettings().voiceEnabled
    && globalThis.speechSynthesis !== undefined;
}

/**
 * Selects the best available voice for the active locale.
 *
 * @returns a `SpeechSynthesisVoice` matching the locale, or
 *   `undefined` to let the engine pick a default
 */
function pickVoice(): SpeechSynthesisVoice | undefined {
  /** Active locale's BCP-47 tag, matched against voice metadata. */
  const lang = bcp47();
  /** Snapshot of installed synthesis voices for the running engine. */
  const voices = globalThis.speechSynthesis.getVoices();
  /** Voice whose lang matches the active locale exactly. */
  const exact = voices.find(function isExact(v,): boolean {
    return v.lang === lang;
  },);
  if (exact !== undefined)
    return exact;
  /** Language portion of the BCP-47 tag, used for prefix-match fallback. */
  const prefix = lang
    .split(
      '-',
      1,
    )[0] ?? '';
  /** First voice whose lang starts with the prefix, when no exact match exists. */
  const partial = voices.find(function isPartial(v,): boolean {
    return v.lang.startsWith(prefix,);
  },);
  return partial;
}

/**
 * Speaks the given text and resolves when playback ends.
 *
 * @param text - dialogue text
 *
 * @returns promise that resolves on `onend` or rejects on `onerror`
 */
export async function speak(text: string,): Promise<void> {
  if (!canSpeak())
    return;
  stopSpeaking();
  /** Snapshot of settings used to configure volume on the utterance. */
  const settings = getSettings();
  return await new Promise<void>(
    function run(
      resolve,
      reject,
    ): void {
      /** Outgoing speech utterance configured with locale, volume, and voice. */
      const utterance = new SpeechSynthesisUtterance(text,);
      utterance.lang = bcp47();
      utterance.volume = settings.voiceVolume;
      /** Picked voice for the locale, or `undefined` to let the engine choose. */
      const voice = pickVoice();
      if (voice !== undefined)
        utterance.voice = voice;
      utterance.onend = function onEnd(): void {
        resolve();
      };
      utterance.onerror = function onError(
        event: SpeechSynthesisErrorEvent,
      ): void {
        console.error(
          '[tts] error',
          event.error,
        );
        reject(new Error(`tts: ${event.error}`,),);
      };
      globalThis.speechSynthesis.speak(utterance,);
    },
  );
}
