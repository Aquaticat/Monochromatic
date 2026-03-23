/**
 * `<binary-viewer>` web component.
 *
 * Displays non-text file content: images via `<img>`, audio via `<audio>`,
 * video via `<video>`, and generic binaries as a hex dump in `<pre>`.
 * Hidden by default; shown when a binary file is opened in the editor.
 */

import { $ as h, } from '@monochromatic-dev/module-es/h-dom';

import { createHexDumpContent, } from './content.ts';
import { showAudio, showImage, showVideo, } from './media.ts';
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
    showImage({ shadow: this.#shadow, host: this, clear: this.#clear.bind(this,), url, mediaInfo, },);
  }

  /**
   * Displays an audio player for the given URL with a repeat toggle button.
   *
   * @param url - source URL for the audio file
   *
   * @param mediaInfo - optional ffprobe metadata to display below the player
   */
  showAudio({ url, mediaInfo, }: { url: string; mediaInfo?: string }): void {
    showAudio({ shadow: this.#shadow, host: this, clear: this.#clear.bind(this,), url, mediaInfo, },);
  }

  /**
   * Displays a video player for the given URL.
   *
   * @param url - source URL for the video file
   *
   * @param mediaInfo - optional ffprobe metadata to display below the player
   */
  showVideo({ url, mediaInfo, }: { url: string; mediaInfo?: string }): void {
    showVideo({ shadow: this.#shadow, host: this, clear: this.#clear.bind(this,), url, mediaInfo, },);
  }

  /**
   * Displays preformatted hex dump content.
   *
   * @param content - hex dump text to display
   */
  showHexDump({ content, }: { content: string }): void {
    this.#clear();
    this.#shadow.append(createHexDumpContent({ content, },),);
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
