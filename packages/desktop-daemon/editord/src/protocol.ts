/**
 * Wire protocol types shared between editord server and client.
 *
 * Defines all message shapes for the WebSocket protocol and
 * common data types used by both sides of the connection.
 */

//region Directory types

/** Single entry in a directory listing. */
export type DirEntry = {
  /** File or directory name (no path separator). */
  name: string;
  /** Whether entry is a directory. */
  isDirectory: boolean;
};

//endregion Directory types

//region Search types

/**
 * Single result from a search operation.
 * File-path matches have no `line` or `text`; content matches include both.
 */
export type SearchResult =
  | { kind: 'file'; path: string }
  | { kind: 'content'; path: string; line: number; text: string };


//region Client messages

/**
 * Messages sent from the client to the server.
 * Each message has a `type` discriminant and a client-generated `id`
 * for response correlation.
 */
export type ClientMessage =
  | { type: 'open'; id: string; path: string }
  | { type: 'save'; id: string; path: string; content: string }
  | { type: 'listDir'; id: string; path: string }
  | { type: 'search'; id: string; query: string; scope: string };

/**
 * Client request payload without the auto-generated `id` field.
 * Distributive over the union so variant-specific fields like `content` are preserved.
 */
export type ClientRequest = ClientMessage extends infer TVariant
  ? TVariant extends { id: string }
    ? Omit<TVariant, 'id'>
    : never
  : never;

//endregion Client messages

//region Server messages

/**
 * Messages sent from the server to the client.
 * Responses carry the `id` from the originating client message.
 * Push notifications (e.g. `fileChanged`) have no `id`.
 */
export type ServerMessage =
  | { type: 'connected'; rootDir: string }
  | { type: 'fileContent'; id: string; path: string; content: string }
  | { type: 'saved'; id: string; path: string }
  | { type: 'dirListing'; id: string; path: string; entries: DirEntry[] }
  | { type: 'searchResults'; id: string; results: SearchResult[] }
  | { type: 'fileChanged'; path: string }
  | { type: 'error'; id?: string; message: string };

//endregion Server messages
