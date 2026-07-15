/**
 * Beat-navigation utilities for the lecture screen.
 *
 * Stateless lookups on the active save so the screen file does not
 * need to repeat the chapter/beat index dance.
 */
import { el, } from '../dom.ts';
import {
  getActiveSave,
  patchActiveSave,
  persistActiveSave,
} from '../state.ts';
import type {
  Chapter,
  DialogueBeat,
} from '../types.ts';

/**
 * Returns the chapter at the saved index, throwing on a vanished save.
 *
 * @returns the chapter referenced by the active save's `chapterIndex`
 *
 * @throws when the save has been cleared or `chapterIndex` is out of range
 *
 * @example
 * ```ts
 * const chapter = currentChapter();
 * console.error('current title:', chapter.title);
 * ```
 */
export function currentChapter(): Chapter {
  /**
   * Active save snapshot used to read the chapter index.
   */
  const live = getActiveSave();
  if (live === undefined)
    throw new Error('lecture: active save vanished',);
  /**
   * Chapter looked up by index; throws on out-of-range.
   */
  const chapter = live.chapters[live.chapterIndex];
  if (chapter === undefined)
    throw new Error('lecture: chapter index out of range',);
  return chapter;
}

/**
 * Returns the beat at the saved indices, or `undefined` when missing.
 *
 * @returns the beat for the current `(chapterIndex, beatIndex)` pair, or `undefined`
 *
 * @example
 * ```ts
 * const beat = currentBeat();
 * if (beat !== undefined) renderBeat(beat);
 * ```
 */
export function currentBeat(): DialogueBeat | undefined {
  /**
   * Active save snapshot used to read chapter and beat indices.
   */
  const live = getActiveSave();
  if (live === undefined)
    return undefined;
  return live.chapters[live.chapterIndex]
    ?.dialogue[live.beatIndex];
}

/**
 * Renders the chapter card overlay for `chapter`.
 *
 * @param chapterCard - card element whose children and `hidden` are updated
 *
 * @param chapter - chapter whose title and summary are painted onto the card
 *
 * @example
 * ```ts
 * showChapterCard({ chapterCard, chapter: currentChapter() });
 * ```
 */
export function showChapterCard(
  {
    chapterCard,
    chapter,
  }: {
    chapterCard: HTMLElement;
    chapter: Chapter;
  },
): void {
  chapterCard.replaceChildren(
    el({
      tag: 'div',
      attrs: {},
      children: [
        el({
          tag: 'h2',
          attrs: {},
          children: [chapter.title,],
        },),
        el({
          tag: 'p',
          attrs: {},
          children: [chapter.summary,],
        },),
      ],
    },),
  );
  chapterCard.hidden = false;
}

/**
 * Hides the chapter card overlay so the dialogue stage is visible.
 *
 * @param chapterCard - card element to hide
 *
 * @example
 * ```ts
 * hideChapterCard(chapterCard);
 * ```
 */
export function hideChapterCard(chapterCard: HTMLElement,): void {
  chapterCard.hidden = true;
}

/**
 * Moves the active save to the next beat, the first beat of the next
 * chapter, or parks at the end of the paper.
 *
 * @param onAdvanced - callback fired after a successful advance so the
 *   caller can repaint the new beat
 *
 * @example
 * ```ts
 * advanceBeat({ onAdvanced: function repaint() { void showCurrentBeat(); } });
 * ```
 */
export function advanceBeat(
  {
    onAdvanced,
  }: {
    onAdvanced: () => void;
  },
): void {
  /**
   * Active save snapshot, read so the next index can be patched correctly.
   */
  const live = getActiveSave();
  if (live === undefined)
    return;
  /**
   * Current chapter resolved through the throwing helper.
   */
  const chapter = currentChapter();
  if ((live.beatIndex
    + 1)
    < chapter
    .dialogue
    .length) {
    patchActiveSave({ beatIndex: live.beatIndex
      + 1, },);
    onAdvanced();
    return;
  }
  if ((live.chapterIndex
    + 1)
    < live
    .chapters
    .length) {
    patchActiveSave({
      chapterIndex: live.chapterIndex
        + 1,
      beatIndex: 0,
    },);
    onAdvanced();
    return;
  }
  // End of paper. Park on the last beat.
  persistActiveSave();
}

/**
 * Moves the active save to the previous beat (or end of the previous chapter).
 *
 * @param onRegressed - callback fired after a successful regress so the
 *   caller can repaint the new beat
 *
 * @example
 * ```ts
 * regressBeat({ onRegressed: function repaint() { void showCurrentBeat(); } });
 * ```
 */
export function regressBeat(
  {
    onRegressed,
  }: {
    onRegressed: () => void;
  },
): void {
  /**
   * Active save snapshot, read so the previous index can be patched.
   */
  const live = getActiveSave();
  if (live === undefined)
    return;
  if (live.beatIndex
    > 0) {
    patchActiveSave({ beatIndex: live.beatIndex
      - 1, },);
    onRegressed();
    return;
  }
  if (live.chapterIndex
    > 0) {
    /**
     * Previous chapter entry whose final beat becomes the new index.
     */
    const prev = live.chapters[live.chapterIndex
      - 1];
    if (prev === undefined)
      return;
    patchActiveSave({
      chapterIndex: live.chapterIndex
        - 1,
      beatIndex: prev.dialogue
        .length
        - 1,
    },);
    onRegressed();
  }
}
