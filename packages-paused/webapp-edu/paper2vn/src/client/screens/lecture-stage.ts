/**
 * Lecture-stage element factory.
 *
 * Builds the static stage subtree (background, character, dialogue box,
 * chapter card, toolbar slot) used by the lecture screen. Returns
 * references the screen needs to drive per-beat updates.
 */
import { el, } from '../dom.ts';
import {
  getBackground,
  getCharacterName,
  getCharacterPose,
} from '../sprite-pack.ts';

/**
 * Assembled stage subtree plus the per-element references the screen drives.
 */
export type LectureStage = {
  /**
   * Outer stage element receiving click events and holding the layered children.
   */
  stage: HTMLElement;
  /**
   * Character `<img>` whose `src` is swapped per beat pose.
   */
  characterImg: HTMLImageElement;
  /**
   * Dialogue box (header + text), hidden when the user toggles Hide.
   */
  dialogueBox: HTMLElement;
  /**
   * Inner element receiving the typewriter-revealed dialogue text.
   */
  dialogueText: HTMLElement;
  /**
   * Speaker-name span shown in the dialogue header.
   */
  speakerName: HTMLElement;
  /**
   * Chapter-card overlay; `hidden` is toggled when a chapter begins.
   */
  chapterCard: HTMLElement;
  /**
   * Toolbar row hosting the navigation/auto/log/hide/ask buttons.
   */
  toolbar: HTMLElement;
};

/**
 * Builds the lecture stage and returns its parts.
 *
 * @returns assembled stage plus the per-element references the screen drives
 *
 * @example
 * ```ts
 * const stage = buildLectureStage();
 * root.append(stage.stage);
 * stage.toolbar.append(backBtn, autoBtn);
 * ```
 */
export function buildLectureStage(): LectureStage {
  /**
   * Top-level stage container holding background, character, dialogue, toolbar.
   */
  const stage = el({
    tag: 'div',
    attrs: { class: 'stage', },
  },);
  /**
   * Background layer painted with the classroom asset.
   */
  const bg = el({
    tag: 'div',
    attrs: {
      class: 'stage-bg',
      style: `background-image: url("${getBackground('classroom',)}")`,
    },
  },);
  /**
   * Character portrait image whose `src` is swapped per beat pose.
   */
  const characterImg = el({
    tag: 'img',
    attrs: {
      src: getCharacterPose({
        characterId: 'ruka',
        pose: 'neutral',
      },),
      alt: '',
    },
  },);
  /**
   * Wrapper sized to position the character relative to the stage.
   */
  const characterWrap = el({
    tag: 'div',
    attrs: { class: 'stage-character', },
    children: [characterImg,],
  },);
  /**
   * Inner element receiving the typewriter-revealed dialogue text.
   */
  const dialogueText = el({
    tag: 'div',
    attrs: { class: 'dialogue-text', },
  },);
  /**
   * Speaker-name span shown in the dialogue header.
   */
  const speakerName = el({
    tag: 'span',
    attrs: { class: 'speaker-name', },
    children: [getCharacterName('ruka',),],
  },);
  /**
   * Bottom dialogue box assembled from header + text.
   */
  const dialogueBox = el({
    tag: 'div',
    attrs: { class: 'stage-dialogue', },
    children: [
      el({
        tag: 'header',
        attrs: {},
        children: [speakerName,],
      },),
      dialogueText,
    ],
  },);
  /**
   * Chapter-card overlay shown before the first beat of each chapter.
   */
  const chapterCard = el({
    tag: 'div',
    attrs: { class: 'chapter-card', },
  },);
  chapterCard.hidden = true;
  /**
   * Toolbar row hosting the navigation/auto/log/hide/ask buttons.
   */
  const toolbar = el({
    tag: 'div',
    attrs: { class: 'stage-controls', },
  },);
  stage.append(
    bg,
    characterWrap,
    dialogueBox,
    chapterCard,
    toolbar,
  );
  return {
    stage,
    characterImg,
    dialogueBox,
    dialogueText,
    speakerName,
    chapterCard,
    toolbar,
  };
}
