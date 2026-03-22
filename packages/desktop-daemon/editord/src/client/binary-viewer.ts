/**
 * `<binary-viewer>` web component.
 *
 * Displays non-text file content: images via `<img>`, audio via `<audio>`,
 * video via `<video>`, and generic binaries as a hex dump in `<pre>`.
 * Hidden by default; shown when a binary file is opened in the editor.
 */

import { STYLES, } from './binary-viewer.styles.ts';

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
    const style = document.createElement('style',);
    style.textContent = STYLES;
    this.#shadow.append(style,);
  }

  /**
   * Displays an image at the given URL.
   *
   * @param url - source URL for the image
   */
  showImage({ url, }: { url: string }): void {
    this.#clear();
    const img = document.createElement('img',);
    img.src = url;
    img.alt = 'Image preview';
    this.#shadow.append(img,);
    this.style.display = 'flex';
  }

  /**
   * Displays an audio player for the given URL.
   *
   * @param url - source URL for the audio file
   */
  showAudio({ url, }: { url: string }): void {
    this.#clear();
    const audio = document.createElement('audio',);
    audio.src = url;
    audio.controls = true;
    this.#shadow.append(audio,);
    this.style.display = 'flex';
  }

  /**
   * Displays a video player for the given URL.
   *
   * @param url - source URL for the video file
   */
  showVideo({ url, }: { url: string }): void {
    this.#clear();
    const video = document.createElement('video',);
    video.src = url;
    video.controls = true;
    this.#shadow.append(video,);
    this.style.display = 'flex';
  }

  /**
   * Displays preformatted hex dump content.
   *
   * @param content - hex dump text to display
   */
  showHexDump({ content, }: { content: string }): void {
    this.#clear();
    const pre = document.createElement('pre',);
    pre.textContent = content;
    this.#shadow.append(pre,);
    this.style.display = 'flex';
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
