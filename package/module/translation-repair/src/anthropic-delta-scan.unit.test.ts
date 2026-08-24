/**
 * Tests for the Anthropic delta scanner.
 *
 * WHAT THIS FILE IS REALLY CHECKING is that a second wire format produces the
 * SAME `ChannelDelta` stream the OpenAI-shaped one does, because that identity
 * is the whole reason the stream guards were not written twice. If this scanner
 * files the answer under `reasoning`, every volume bound and degeneration
 * verdict downstream reads a call that thought forever and answered nothing.
 *
 * The case that matters most is `input_json_delta`. Under forced tool use the
 * model's entire reply arrives as the tool call's arguments, so a scanner that
 * treated those fragments as anything but the answer channel would make every
 * schema'd call on this transport look silent.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  scanAnthropicDeltas,
  watchForDegeneration,
} from '../dist/final/node/index.mjs';

/**
 * Builds one Anthropic event frame, newline-terminated as the wire sends it.
 *
 * @param body - frame payload, which carries its own `type`
 *
 * @returns Frame ready to feed a scanner
 *
 * @example
 * ```ts
 * const raw = frameOf({ body: { type: 'ping', }, },);
 * ```
 */
function frameOf(
  { body, }: { readonly body: Readonly<Record<string, unknown>>; },
): string {
  return `event: ${String(body['type'],)}\ndata: ${JSON.stringify(body,)}\n\n`;
}

/**
 * Frame opening a content block of one type at one index.
 *
 * @param index - position the block occupies
 *
 * @param type - block type the server declares
 *
 * @returns Frame ready to feed a scanner
 *
 * @example
 * ```ts
 * const raw = blockStart({ index: 0, type: 'thinking', },);
 * ```
 */
function blockStart(
  {
    index,
    type,
  }: {
    readonly index: number;
    readonly type: string;
  },
): string {
  return frameOf({
    body: {
      type: 'content_block_start',
      index,
      content_block: { type, },
    },
  },);
}

/**
 * Frame carrying one delta of one kind at one index.
 *
 * @param index - position the delta belongs to
 *
 * @param deltaType - kind of delta, which names its text field
 *
 * @param field - field the text rides in
 *
 * @param text - text the frame carries
 *
 * @returns Frame ready to feed a scanner
 *
 * @example
 * ```ts
 * const raw = blockDelta({ index: 0, deltaType: 'text_delta', field: 'text', text: 'Biscuit', },);
 * ```
 */
function blockDelta(
  {
    index,
    deltaType,
    field,
    text,
  }: {
    readonly index: number;
    readonly deltaType: string;
    readonly field: string;
    readonly text: string;
  },
): string {
  return frameOf({
    body: {
      type: 'content_block_delta',
      index,
      delta: {
        type: deltaType,
        [field]: text,
      },
    },
  },);
}

/**
 * Feeds a whole body to a fresh scanner in one chunk.
 *
 * @param raw - whole stream body
 *
 * @returns Every delta it yielded, in order
 *
 * @example
 * ```ts
 * const deltas = scanAll({ raw, },);
 * ```
 */
function scanAll(
  { raw, }: { readonly raw: string; },
): readonly { readonly channel: string; readonly text: string; }[] {
  return scanAnthropicDeltas().feed({ chunk: raw, },);
}

await describe({
  name: scanAnthropicDeltas.name,
  children: [
    it({
      name: 'FORWARDS a text delta as the answer channel, which is the ordinary case every '
        + 'unforced call takes',
      fn: async () => {
        const deltas = scanAll({
          raw: blockStart({
            index: 0,
            type: 'text',
          },) + blockDelta({
            index: 0,
            deltaType: 'text_delta',
            field: 'text',
            text: 'Biscuit is smug.',
          },),
        },);

        expect(deltas.length,).toBe(1,);
        expect(deltas[0]?.channel,).toBe('content',);
        expect(deltas[0]?.text,).toBe('Biscuit is smug.',);
      },
    },),

    it({
      name: 'FORWARDS a thinking delta as the reasoning channel, which this transport DECLARES '
        + 'rather than spelling two ways: the blindness `#158` measured at 47 percent of calls '
        + 'cannot recur through a typed block',
      fn: async () => {
        const deltas = scanAll({
          raw: blockStart({
            index: 0,
            type: 'thinking',
          },) + blockDelta({
            index: 0,
            deltaType: 'thinking_delta',
            field: 'thinking',
            text: 'Weighing the mug.',
          },),
        },);

        expect(deltas.length,).toBe(1,);
        expect(deltas[0]?.channel,).toBe('reasoning',);
        expect(deltas[0]?.text,).toBe('Weighing the mug.',);
      },
    },),

    it({
      name: 'FORWARDS tool-call arguments as the ANSWER channel, which decides whether forced '
        + 'tool use works at all: under it the whole reply is the tool arguments, so filing them '
        + 'anywhere else leaves every schema\'d call on this transport looking silent',
      fn: async () => {
        const deltas = scanAll({
          raw: blockStart({
            index: 0,
            type: 'tool_use',
          },) + blockDelta({
            index: 0,
            deltaType: 'input_json_delta',
            field: 'partial_json',
            text: '{"mood":"smug"}',
          },),
        },);

        expect(deltas.length,).toBe(1,);
        expect(deltas[0]?.channel,).toBe('content',);
        expect(deltas[0]?.text,).toBe('{"mood":"smug"}',);
      },
    },),

    it({
      name: 'FORWARDS plain text inside a THINKING BLOCK as reasoning, because the block that '
        + 'encloses a delta outranks the delta\'s own type: reading only the type would file a '
        + 'model\'s private deliberation as its answer',
      fn: async () => {
        const deltas = scanAll({
          raw: blockStart({
            index: 0,
            type: 'thinking',
          },) + blockDelta({
            index: 0,
            deltaType: 'text_delta',
            field: 'text',
            text: 'Still weighing.',
          },),
        },);

        expect(deltas.length,).toBe(1,);
        expect(deltas[0]?.channel,).toBe('reasoning',);
      },
    },),

    it({
      name: 'SEPARATES two open blocks by the type each declared, since a message interleaves '
        + 'thinking and answer blocks and both carry deltas under their own index',
      fn: async () => {
        const deltas = scanAll({
          raw: blockStart({
            index: 0,
            type: 'thinking',
          },) + blockStart({
            index: 1,
            type: 'text',
          },) + blockDelta({
            index: 0,
            deltaType: 'thinking_delta',
            field: 'thinking',
            text: 'Hmm.',
          },) + blockDelta({
            index: 1,
            deltaType: 'text_delta',
            field: 'text',
            text: 'Ravenous.',
          },),
        },);

        expect(deltas.length,).toBe(2,);
        expect(deltas[0]?.channel,).toBe('reasoning',);
        expect(deltas[1]?.channel,).toBe('content',);
        expect(deltas[1]?.text,).toBe('Ravenous.',);
      },
    },),

    it({
      name: 'REFUSES to emit anything for lifecycle frames, which outnumber delta frames on a '
        + 'short reply and would each read as an empty answer',
      fn: async () => {
        expect(scanAll({
          raw: frameOf({ body: { type: 'message_start', }, },)
            + frameOf({ body: { type: 'ping', }, },)
            + frameOf({
              body: {
                type: 'content_block_stop',
                index: 0,
              },
            },)
            + frameOf({ body: { type: 'message_delta', }, },)
            + frameOf({ body: { type: 'message_stop', }, },),
        },).length,).toBe(0,);
      },
    },),

    it({
      name: 'REFUSES to emit anything for a delta type it does not read, so a provider adding a '
        + 'new delta kind cannot inject text into either channel unannounced',
      fn: async () => {
        expect(scanAll({
          raw: blockStart({
            index: 0,
            type: 'text',
          },) + blockDelta({
            index: 0,
            deltaType: 'citations_delta',
            field: 'citation',
            text: 'a mug',
          },),
        },).length,).toBe(0,);
      },
    },),

    it({
      name: 'REASSEMBLES a frame split across two chunks, since a chunk boundary lands wherever '
        + 'the network puts it and routinely falls inside a frame',
      fn: async () => {
        /**
         * Scanner fed in halves, as a slow connection delivers a body.
         */
        const scanner = scanAnthropicDeltas();

        /**
         * Whole body, to be cut at a point inside its delta frame.
         */
        const raw = blockStart({
          index: 0,
          type: 'text',
        },) + blockDelta({
          index: 0,
          deltaType: 'text_delta',
          field: 'text',
          text: 'Knocked it off.',
        },);

        /**
         * Cut point chosen inside the JSON payload rather than on a boundary.
         */
        const cut = raw.length - 12;

        /**
         * Everything both halves yielded, in order.
         */
        const deltas = [
          ...scanner.feed({ chunk: raw.slice(
            0,
            cut,
          ), },),
          ...scanner.feed({ chunk: raw.slice(cut,), },),
        ];

        expect(deltas.length,).toBe(1,);
        expect(deltas[0]?.text,).toBe('Knocked it off.',);
      },
    },),

    it({
      name: 'READS frames whose lines end with a carriage return, which is what the SSE grammar '
        + 'permits and what a proxy may rewrite a body into',
      fn: async () => {
        const deltas = scanAll({
          raw: (blockStart({
            index: 0,
            type: 'text',
          },) + blockDelta({
            index: 0,
            deltaType: 'text_delta',
            field: 'text',
            text: 'Pleased.',
          },)).split('\n',).join('\r\n',),
        },);

        expect(deltas.length,).toBe(1,);
        expect(deltas[0]?.text,).toBe('Pleased.',);
      },
    },),

    it({
      name: 'COUNTS a payload it cannot read and KEEPS READING, because this runs on every chunk '
        + 'of every call and one malformed frame must not cost the rest of the stream',
      fn: async () => {
        /**
         * Scanner fed one broken frame between two sound ones.
         */
        const scanner = scanAnthropicDeltas();

        /**
         * Deltas surviving a payload no parser could read.
         */
        const deltas = scanner.feed({
          chunk: `${blockStart({
            index: 0,
            type: 'text',
          },)}data: {not json at all\n\n${blockDelta({
            index: 0,
            deltaType: 'text_delta',
            field: 'text',
            text: 'Twelve whiskers.',
          },)}`,
        },);

        expect(deltas.length,).toBe(1,);
        expect(deltas[0]?.text,).toBe('Twelve whiskers.',);
        expect(scanner.unreadableFrames(),).toBe(1,);
      },
    },),

    it({
      name: 'REFUSES to count an empty keep-alive payload as unreadable, since inflating that '
        + 'tally would hide the changed wire format it exists to make visible',
      fn: async () => {
        /**
         * Scanner fed the bare `data:` lines servers send to hold a connection.
         */
        const scanner = scanAnthropicDeltas();
        scanner.feed({ chunk: 'data:\n\ndata: \n\n', },);
        expect(scanner.unreadableFrames(),).toBe(0,);
      },
    },),

    it({
      name: 'FORWARDS a thinking runaway into the EXISTING degeneration guard while leaving the '
        + 'answer channel unjudged, which is the claim the whole normalization rests on: a guard '
        + 'built for the other wire format reaches its verdict on this one unchanged',
      fn: async () => {
        /**
         * A model that thinks the same thing forever and never answers.
         */
        const frames = Array.from(
          { length: 9_000, },
          function think(): string {
            return blockDelta({
              index: 0,
              deltaType: 'thinking_delta',
              field: 'thinking',
              text: 'I will output. ',
            },);
          },
        ).join('',);

        /**
         * Scanner and one detector per channel, wired as the drain will wire them.
         */
        const scanner = scanAnthropicDeltas();
        const thinking = watchForDegeneration();
        const answering = watchForDegeneration();

        scanner.feed({
          chunk: blockStart({
            index: 0,
            type: 'thinking',
          },) + frames,
        },).forEach(function route(delta,): void {
          if (delta.channel === 'reasoning')
            thinking.notifyText({ text: delta.text, },);
          else
            answering.notifyText({ text: delta.text, },);
        },);

        expect(thinking.verdict().kind,).toBe('degenerate',);
        expect(answering.verdict().kind,).toBe('undecided',);
      },
    },),
  ],
},);
