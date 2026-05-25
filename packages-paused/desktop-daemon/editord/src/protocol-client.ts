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
    readonly type: 'open';
    readonly id: string;
    readonly path: string;
  }
  | {
    readonly type: 'save';
    readonly id: string;
    readonly path: string;
    readonly content: string;
  }
  | {
    readonly type: 'listDir';
    readonly id: string;
    readonly path: string;
  }
  | {
    readonly type: 'search';
    readonly id: string;
    readonly query: string;
    readonly scope: string;
  }
  | ({
    readonly type: 'hover';
    readonly id: string;
  } & FilePosition)
  | ({
    readonly type: 'completion';
    readonly id: string;
  } & FilePosition)
  | {
    readonly type: 'format';
    readonly id: string;
    readonly path: string;
  }
  | ({
    readonly type: 'gotoDefinition';
    readonly id: string;
  } & FilePosition)
  | ({
    readonly type: 'findReferences';
    readonly id: string;
  } & FilePosition)
  | {
    readonly type: 'inlayHint';
    readonly id: string;
    readonly path: string;
    readonly range: Range;
  }
  | {
    readonly type: 'selectionRange';
    readonly id: string;
    readonly path: string;
    readonly positions: readonly Position[];
  }
  | {
    readonly type: 'deleteEntry';
    readonly id: string;
    readonly path: string;
  }
  | {
    readonly type: 'copyEntry';
    readonly id: string;
    readonly path: string;
    readonly destPath: string;
  }
  | {
    readonly type: 'moveEntry';
    readonly id: string;
    readonly path: string;
    readonly destPath: string;
  }
  | {
    readonly type: 'newEntry';
    readonly id: string;
    readonly parentPath: string;
    readonly name: string;
    readonly isDirectory: boolean;
  }
  | {
    readonly type: 'openInTerminal';
    readonly id: string;
    readonly path: string;
  }
  | {
    readonly type: 'openInDefaultApp';
    readonly id: string;
    readonly path: string;
  }
  | ({
    readonly type: 'prepareRename';
    readonly id: string;
  } & FilePosition)
  | ({
    readonly type: 'rename';
    readonly id: string;
    readonly newName: string;
  } & FilePosition)
  | {
    readonly type: 'didChange';
    readonly path: string;
    readonly content: string;
  }
  | {
    readonly type: 'didClose';
    readonly path: string;
  }
  | {
    readonly type: 'watchDir';
    readonly path: string;
  };

/**
 * Client request payload without the auto-generated `id` field.
 * Distributive over the union so variant-specific fields like `content` are preserved.
 * Filters to only variants that have an `id` (excludes notifications).
 */
export type ClientRequest = ClientMessage extends infer TVariant
  ? TVariant extends { readonly id: string; } ? Omit<TVariant, 'id'>
  : never
  : never;

/**
 * Client notification payload (messages without an `id` that expect no response).
 */
export type ClientNotification = Extract<ClientMessage,
  { readonly type: 'didChange'; } | { readonly type: 'didClose'; } | { readonly type: 'watchDir'; }>;

//endregion Client messages
