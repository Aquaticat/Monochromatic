/**
 * File loading and display logic for the editord client.
 *
 * Handles opening text, media, and binary files via the WebSocket
 * connection, routing each file kind to the appropriate viewer.
 */

import type { FileKind, } from '../../../protocol.ts';
import type { BinaryViewer, } from '../binary-viewer/binary-viewer.ts';
import type { EditorPane, } from '../editor/editor-pane.ts';
import { getParserForPath, } from '../highlight/languages.ts';
import { BYTES_PER_KB, } from '../highlight/utils.ts';
import {
  l as rootLogger,
  tagged,
} from '../log.ts';
import { showFixedToast, } from '../toast/toast.ts';
import type { EditorWsClient, } from '../ws/client.ts';

/** Tagged logger for the file loader subsystem. */
const appLog = tagged({
  tag: 'app-file-loader',
  l: rootLogger,
},);

/** Content length threshold for showing a "file too large" warning toast. */
const FILE_SIZE_WARNING_THRESHOLD = 100 * BYTES_PER_KB;

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
    ws: EditorWsClient;
    editorPane: EditorPane;
    binaryViewer: BinaryViewer;
    token: string;
    path: string;
    line?: number | undefined;
    character?: number | undefined;
  },
): Promise<FileKind | null> {
  try {
    const r = await ws.request({
      type: 'open',
      path,
    },);
    if (!('kind' in r))
      return null;
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrowed by 'kind' in r; cast needed because ServerMessage union is wide
    const kind = r.kind as FileKind;
    document.title = `editord - ${path}`;

    if (kind === 'image' || kind === 'audio' || kind === 'video') {
      editorPane.style.display = 'none';
      const mediaUrl = `/_raw?path=${encodeURIComponent(path,)}&token=${token}`;
      const mediaOpts = 'mediaInfo' in r && typeof r.mediaInfo === 'string'
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

    if (kind === 'binary' && 'content' in r) {
      editorPane.style.display = 'none';
      binaryViewer.showHexDump({ content: String(r.content,), },);
      return kind;
    }

    binaryViewer.hide();
    editorPane.style.display = '';
    if ('content' in r) {
      const content = String(r.content,);
      if (content.length > FILE_SIZE_WARNING_THRESHOLD)
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
    }
    return kind;
  }
  catch (error) {
    appLog.error(`failed to load: ${String(error,)}`,);
    return null;
  }
}
