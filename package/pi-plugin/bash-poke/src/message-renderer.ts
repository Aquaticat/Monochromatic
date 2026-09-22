/**
 Transcript rendering for poke messages.

 @module
 */

import type {
  ExtensionAPI,
  MessageRenderOptions,
  Theme,
} from '@earendil-works/pi-coding-agent';
import { Text, } from '@earendil-works/pi-tui';

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { POKE_CUSTOM_TYPE, } from './constants.ts';
import {
  jobStatusText,
  type PokeDetails,
} from './poke-text.ts';

//region Types

/**
 Structural view of one message content part.
 
 Narrowed here so rendering does not depend on Pi's content-part unions, which
 Pi may extend without this package needing to change.
 */
type ContentPart = {
  /**
   Part kind, of which only text parts carry renderable characters.
   */
  readonly type: string;

  /**
   Text carried by a text part, absent for other kinds.
   */
  readonly text?: string;
};

/**
 Structural view of the poke message Pi hands a registered renderer.
 
 Pi's package root does not export its custom-message type, so the shape this
 package actually reads is declared here. Declaring only what is read keeps the
 renderer working when Pi widens its own message type.
 */
type PokeMessage = {
  /**
   Renderer key this message was sent with.
   */
  readonly customType: string;

  /**
   Model-facing content, which is also what the transcript shows.
   */
  readonly content: string | readonly ContentPart[];

  /**
   Whether Pi displays the message at all.
   */
  readonly display: boolean;

  /**
   Renderer-only outcome data, absent for messages sent without it.
   */
  readonly details?: PokeDetails;

  /**
   Send timestamp Pi stamps on every message.
   */
  readonly timestamp: number;
};

//endregion Types

//region Content flattening

/**
 Flattens message content into the text the transcript shows.
 
 @param content - string content, or mixed parts of which only text renders
 
 @returns renderable text
 
 @example
 ```ts
 contentText({ content: 'done', },);
 ```
 */
function contentText(
  { content, }: { readonly content: string | readonly ContentPart[]; },
): string {
  if ((typeof content) === 'string')
    return content;
  return content
    .map(function partText(part: ContentPart, ): string {
      if (part.type !== 'text')
        return '';
      return part.text ?? '';
    }, )
    .filter(function isPresent(text: string, ): boolean {
      return text.length > 0;
    }, )
    .join('\n', );
}

//endregion Content flattening

//region Card text

/**
 Builds the card label naming this package and how the job ended.
 
 @param details - outcome data, absent for messages sent without it
 
 @returns label text
 
 @example
 ```ts
 cardLabel({ details: undefined, },);
 ```
 */
function cardLabel(
  { details, }: { readonly details?: PokeDetails; },
): string {
  if (details === undefined)
    return POKE_CUSTOM_TYPE;

  /**
   Exit or cancellation phrase, the state a reader scans for first.
   */
  const status = jobStatusText({
    ...(details.exitCode === undefined ? {} : { exitCode: details.exitCode, }),
    cancelled: details.cancelled,
  }, );
  return `${POKE_CUSTOM_TYPE} ${status}`;
}

/**
 Builds the full transcript text for one poke message.
 
 The label gives a second visible channel beyond color, so a poke stays
 identifiable in a monochrome transcript or a dim room.
 
 @param message - custom message carrying poke content and details
 
 @param theme - active theme supplying card colors
 
 @returns text the renderer wraps in a component
 
 @example
 ```ts
 pokeCardText({ message, theme, },);
 ```
 */
function pokeCardText(
  {
    message,
    theme,
  }: {
    readonly message: ForeignBorrowed<PokeMessage>;
    readonly theme: ForeignBorrowed<Theme>;
  },
): string {
  /**
   Label line, colored and named so a poke is never mistaken for typed text.
   */
  const label = theme.fg(
    'customMessageLabel',
    cardLabel((message.details === undefined ? {} : { details: message.details, }), ),
  );

  /**
   Body text, which is exactly what the model received.
   */
  const body = theme.fg(
    'customMessageText',
    contentText({ content: message.content, }, ),
  );
  return `${label}\n${body}`;
}

//endregion Card text

//region Registration

/**
 Registers the transcript renderer for poke messages.
 
 The renderer is passed as a named callback because Pi calls registered
 renderers positionally, which is the one signature shape this package does
 not get to choose.
 
 @param pi - Pi extension API storing the renderer
 
 @mutates pi - `registerMessageRenderer` stores the renderer in the Pi host
 
 @example
 ```ts
 registerPokeRenderer(pi);
 ```
 */
function registerPokeRenderer(pi: ForeignBorrowed<ExtensionAPI>, ): void {
  pi.registerMessageRenderer<PokeDetails>(
    POKE_CUSTOM_TYPE,
    function renderPokeMessage(
      message: ForeignBorrowed<PokeMessage>,
      options: ForeignBorrowed<MessageRenderOptions>,
      theme: ForeignBorrowed<Theme>,
    ) {
      return new Text(
        pokeCardText({
          message,
          theme,
        }, ),
        options.outputPad,
        0,
      );
    },
  );
}

//endregion Registration

export {
  cardLabel,
  contentText,
  pokeCardText,
  registerPokeRenderer,
};

export type {
  ContentPart,
  PokeMessage,
};
