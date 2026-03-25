/**
 * Client-to-server message types for the editord WebSocket protocol.
 *
 * Split from protocol.ts to stay under max-lines.
 */

import type {
  FilePosition,
  Position,
  Range,
} from './protocol.ts';

//region Client messages

/**
 * Messages sent from the client to the server.
 * Requests have a `type` discriminant and a client-generated `id` for response correlation.
 * Notifications (e.g. `didChange`) have no `id` and expect no response.
 */
export type ClientMessage =
  | {
    type: 'open';
    id: string;
    path: string
  }
  | {
    type: 'save';
    id: string;
    path: string;
    content: string
  }
  | {
    type: 'listDir';
    id: string;
    path: string
  }
  | {
    type: 'search';
    id: string;
    query: string;
    scope: string
  }
  | ({
    type: 'hover';
    id: string;
  } & FilePosition)
  | ({
    type: 'completion';
    id: string;
  } & FilePosition)
  | {
    type: 'format';
    id: string;
    path: string
  }
  | ({
    type: 'gotoDefinition';
    id: string;
  } & FilePosition)
  | ({
    type: 'findReferences';
    id: string;
  } & FilePosition)
  | {
    type: 'inlayHint';
    id: string;
    path: string;
    range: Range
  }
  | {
    type: 'selectionRange';
    id: string;
    path: string;
    positions: Position[]
  }
  | {
    type: 'deleteEntry';
    id: string;
    path: string
  }
  | {
    type: 'copyEntry';
    id: string;
    path: string;
    destPath: string
  }
  | {
    type: 'moveEntry';
    id: string;
    path: string;
    destPath: string
  }
  | {
    type: 'newEntry';
    id: string;
    parentPath: string;
    name: string;
    isDirectory: boolean
  }
  | {
    type: 'openInTerminal';
    id: string;
    path: string
  }
  | {
    type: 'openInDefaultApp';
    id: string;
    path: string
  }
  | {
    type: 'didChange';
    path: string;
    content: string
  }
  | {
    type: 'didClose';
    path: string
  }
  | {
    type: 'watchDir';
    path: string
  };

/**
 * Client request payload without the auto-generated `id` field.
 * Distributive over the union so variant-specific fields like `content` are preserved.
 * Filters to only variants that have an `id` (excludes notifications).
 */
export type ClientRequest = ClientMessage extends infer TVariant
  ? TVariant extends { id: string; } ? Omit<TVariant, 'id'>
  : never
  : never;

/**
 * Client notification payload (messages without an `id` that expect no response).
 */
export type ClientNotification = Extract<ClientMessage,
  { type: 'didChange'; } | { type: 'didClose'; } | { type: 'watchDir'; }>;

//endregion Client messages
