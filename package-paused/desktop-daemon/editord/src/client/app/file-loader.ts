/**
 * File loading and display logic for the editord client.
 *
 * Handles opening text, media, and binary files via the WebSocket
 * connection, routing each file kind to the appropriate viewer.
 */

import type { FileKind, } from '../../../protocol.ts';
import { FILE_SIZE_WARNING_THRESHOLD, } from '../../constants.ts';

import { getParserForPath, } from '../highlight/languages.ts';
import {
  l as rootLogger,
  tagged,
} from '../log.ts';
import { showFixedToast, } from '../toast/toast.ts';
import type {
  BinaryViewerHandle,
  EditorPaneHandle,
  EditorWsClientHandle,
} from './types.ts';

/**
 * Tagged logger for the file loader subsystem.
 */
const appLog = tagged({
  tag: 'app-file-loader',
  l: rootLogger,
},);

/**
 * Loads a file from the server and displays it in the appropriate viewer.
 * Text files go to the editor pane; media files to native browser elements;
 * generic binaries to a hex dump display.
 *
 * @param ws - WebSocket client for server communication
 *
 * @param editorPane - editor pane component for text files
 *
 * @param binaryViewer - binary viewer component for non-text files
 *
 * @param token - auth token for raw media URLs
 *
 * @param path - absolute file path to open
 *
 * @param line - optional 1-based line number to scroll to
 *
 * @param character - optional 0-based character offset within the line
 *
 * @returns the file kind, or null on failure
 *
 * @example
 * ```ts
 * const result = await loadFile({ ws: ws, editorPane: editorPane, binaryViewer: binaryViewer, token: 'abc123', path: '/home/user/project/src/main.ts', line: 10, character: 5, });
 * ```
 */
export async function loadFile(
  {
    ws,
    editorPane,
    binaryViewer,
    token,
    path,
    line,
    character,
  }: {
    readonly ws: EditorWsClientHandle;
    readonly editorPane: EditorPaneHandle;
    readonly binaryViewer: BinaryViewerHandle;
    readonly token: string;
    readonly path: string;
    readonly line?: number | undefined;
    readonly character?: number | undefined;
  },
): Promise<FileKind | null> {
  try {
    /**
     * Full server response; kept around because the media branch also reads `mediaInfo`.
     */
    const r = await ws.request({
      type: 'open',
      path,
    },);
    /**
     * File kind and content lifted out for the branching below.
     */
    const {
      kind,
      content,
    } = r;
    document.title = `editord - ${path}`;

    if ((kind === 'image') || (kind === 'audio')
      || (kind === 'video')) {
      editorPane.style
        .display = 'none';
      /**
       * Token-scoped URL the browser fetches the asset bytes from for native media playback.
       */
      const mediaUrl = `/_raw?path=${encodeURIComponent(path,)}&token=${token}`;
      /**
       * Options bag for the binary viewer, including probed media metadata when the server returned it.
       */
      const mediaOpts = r.mediaInfo
        !== undefined
        ? {
          url: mediaUrl,
          mediaInfo: r.mediaInfo,
        }
        : { url: mediaUrl, };
      if (kind === 'image')
        binaryViewer.showImage(mediaOpts,);
      else if (kind === 'audio')
        binaryViewer.showAudio(mediaOpts,);
      else
        binaryViewer.showVideo(mediaOpts,);
      return kind;
    }

    if (kind === 'binary') {
      editorPane.style
        .display = 'none';
      binaryViewer.showHexDump({ content, },);
      return kind;
    }

    binaryViewer.hide();
    editorPane.style
      .display = '';
    if (content.length
      > FILE_SIZE_WARNING_THRESHOLD)
      showFixedToast({ message: 'File too large (>100KB)', },);
    editorPane.setParser(getParserForPath({ path, },),);
    editorPane.setText(content,);
    if (line !== undefined) {
      editorPane.scrollToLine({ line, },);
      editorPane.restoreCursor({
        line: line - 1,
        character: character ?? 0,
      },);
    }
    return kind;
  }
  catch (error) {
    appLog.error(`failed to load: ${String(error,)}`,);
    return null;
  }
}
