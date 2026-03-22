/**
 * `<binary-viewer>` web component.
 *
 * Displays non-text file content: images via `<img>`, audio via `<audio>`,
 * video via `<video>`, and generic binaries as a hex dump in `<pre>`.
 * Hidden by default; shown when a binary file is opened in the editor.
 */

import { $ as h, } from '@monochromatic-dev/module-es/h-dom';

import { STYLES, } from './binary-viewer.styles.ts';

/**
 * Repeat/loop icon as inline SVG.
 * Single circular arrow indicating track repeat.
 */
const REPEAT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;

/**
 * `<binary-viewer>` — media and hex dump viewer component.
 *
 * Provides dedicated show methods for each supported file kind.
 * Only one content type is displayed at a time; calling any show method
 * replaces the previous content.
 */
export class BinaryViewer extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Creates the shadow DOM and injects component styles. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
    this.#shadow.append(h({ tag: 'style', text: STYLES, },),);
  }

  /**
   * Displays an image at the given URL.
   *
   * @param url - source URL for the image
   *
   * @param mediaInfo - optional ffprobe metadata to display below the image
   */
  showImage({ url, mediaInfo, }: { url: string; mediaInfo?: string }): void {
    this.#clear();
    this.#shadow.append(
      h({ tag: 'img', attrs: { src: url, alt: 'Image preview', }, },),
    );
    this.#appendMediaInfo(mediaInfo,);
    this.style.display = 'flex';
  }

  /**
   * Displays an audio player for the given URL with a repeat toggle button.
   *
   * @param url - source URL for the audio file
   *
   * @param mediaInfo - optional ffprobe metadata to display below the player
   */
  showAudio({ url, mediaInfo, }: { url: string; mediaInfo?: string }): void {
    this.#clear();

    const audio = h({ tag: 'audio', attrs: { src: url, controls: '', }, },);

    const repeatBtn = h({
      tag: 'button',
      class: 'repeat-btn',
      html: REPEAT_ICON_SVG,
      attrs: { type: 'button', title: 'Repeat track', },
      on: {
        click: function handleRepeatToggle(): void {
          audio.loop = !audio.loop;
          repeatBtn.toggleAttribute('data-active', audio.loop,);
        },
      },
    },);

    this.#shadow.append(
      h({ tag: 'div', class: 'audio-controls', children: [audio, repeatBtn,], },),
    );
    this.#appendMediaInfo(mediaInfo,);
    this.style.display = 'flex';
  }

  /**
   * Displays a video player for the given URL.
   *
   * @param url - source URL for the video file
   *
   * @param mediaInfo - optional ffprobe metadata to display below the player
   */
  showVideo({ url, mediaInfo, }: { url: string; mediaInfo?: string }): void {
    this.#clear();
    this.#shadow.append(
      h({ tag: 'video', attrs: { src: url, controls: '', }, },),
    );
    this.#appendMediaInfo(mediaInfo,);
    this.style.display = 'flex';
  }

  /**
   * Displays preformatted hex dump content.
   *
   * @param content - hex dump text to display
   */
  showHexDump({ content, }: { content: string }): void {
    this.#clear();
    this.#shadow.append(h({ tag: 'pre', text: content, },),);
    this.style.display = 'flex';
  }

  /**
   * Appends a `<pre>` block with ffprobe metadata below the current content.
   * Does nothing when `mediaInfo` is undefined.
   *
   * @param mediaInfo - trimmed ffprobe output, or undefined to skip
   */
  #appendMediaInfo(mediaInfo: string | undefined,): void {
    if (mediaInfo === undefined) return;
    this.#shadow.append(h({ tag: 'pre', class: 'media-info', text: mediaInfo, },),);
  }

  /** Hides the viewer and removes displayed content. */
  hide(): void {
    this.#clear();
    this.style.display = 'none';
  }

  /** Removes all content nodes from the shadow root, keeping the style element. */
  #clear(): void {
    const style = this.#shadow.querySelector<HTMLStyleElement>('style',);
    this.#shadow.replaceChildren();
    if (style !== null) this.#shadow.append(style,);
  }
}

customElements.define('binary-viewer', BinaryViewer,);
