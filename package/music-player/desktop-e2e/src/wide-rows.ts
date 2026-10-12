/**
 Checks of the wide session about the row chords that copy, show in the file manager, and show details.
 
 @example
 ```ts
 import { checkRowChords, } from './wide-rows.ts';
 
 await checkRowChords({ context, session, fileManagerRecord, },);
 ```
 
 @packageDocumentation
 */

import { readFile, } from 'node:fs/promises';

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import {
  tapKey,
} from './actions.ts';
import { readClipboard, } from './clipboard.ts';
import { ringIsOnTrashFile, } from './conditions.ts';
import type { RunContext, } from './context.ts';
import { expect, } from './errors.ts';
import {
  diffBox,
  loadImage,
} from './image.ts';
import { pollUntil, } from './poll.ts';
import { press, } from './press.ts';
import type { Session, } from './session.ts';
import { EFFECT_SETTLE_MS, } from './timing.ts';

/**
 Fewest differing pixels that prove a notice appeared.
 */
const MIN_NOTICE_PIXELS = 200;

/**
 How many times the file manager stub's record is read.
 */
const RECORD_LOOKS = 20;

/**
 Pause between two reads of the record.
 */
const RECORD_PAUSE_MS = 200;

/**
 Records the copy, file-manager and details checks of the wide session, with the ring in the last folder.
 
 @param context - the run's context
 
 @param session - the wide session, with the track list focused in the last folder
 
 @param fileManagerRecord - file in which the stub that stands in for the file manager appends its arguments
 
 @example
 ```ts
 await checkRowChords({ context, session, fileManagerRecord, },);
 ```
 */
export async function checkRowChords(
  {
    context,
    session,
    fileManagerRecord,
  }: {
    readonly context: RunContext;
    readonly fileManagerRecord: string;
    readonly session: Session;
  },
): Promise<void> {
  /**
   The recorder of the run.
   */
  const { recorder, } = context;
  recorder.setGroup('row',);
  await press({
    session,
    act: tapKey('down',),
    until: ringIsOnTrashFile,
    what: 'the ring on the file to trash',
  },);
  await recorder.check({
    id: 'row/ctrl-shift-c',
    title: 'Ctrl+Shift+C copies the file name of the row under the ring to the clipboard',
    body: async function ctrlShiftCCopiesFileName(): Promise<string> {
      await session.chord({
        mods: [
          'ctrl',
          'shift',
        ],
        key: 'c',
      },);
      await wait(EFFECT_SETTLE_MS,);

      /**
       Name of the nested Wayland display, whose clipboard is read.
       */
      const display = await session.waylandDisplay();
      expect({
        condition: display !== '',
        message: 'the nested Wayland display name is unknown',
      },);

      /**
       Text on that display's clipboard.
       */
      const text = await readClipboard(display,);
      expect({
        condition: text.includes('99 Trash me',),
        message: `the clipboard holds ${JSON.stringify(text,)}`,
      },);
      return `clipboard of ${display}: ${JSON.stringify(text,)}`;
    },
  },);
  await recorder.check({
    id: 'row/ctrl-shift-e',
    title: 'Ctrl+Shift+E opens the file manager on the folder of the row',
    body: async function ctrlShiftEOpensFileManager(): Promise<string> {
      await session.chord({
        mods: [
          'ctrl',
          'shift',
        ],
        key: 'e',
      },);

      /**
       What the stub recorded, once it recorded anything.
       */
      const seen = { recorded: '', };
      await pollUntil({
        attempts: RECORD_LOOKS,
        intervalMs: RECORD_PAUSE_MS,
        order: 'wait-then-check',
        check: async function stubRecorded(): Promise<boolean> {
          seen.recorded = await readFile(
            fileManagerRecord,
            'utf8',
          );
          return seen.recorded !== '';
        },
      },);
      expect({
        condition: seen.recorded
          .includes('Zzz Tones',),
        message: `the file manager stub was asked for ${JSON.stringify(seen.recorded,)}`,
      },);
      return `xdg-open ${seen.recorded
        .trim()}`;
    },
  },);
  await recorder.check({
    id: 'row/alt-enter',
    title: 'Alt+Enter shows the details notice of the row',
    body: async function altEnterShowsDetails(): Promise<string> {
      /**
       Screenshot before the chord.
       */
      const before = await session.shot('before-details',);

      /**
       Details uses before the chord.
       */
      const used = await session.used('row-details',);
      await session.chord({
        mods: ['alt',],
        key: 'enter',
      },);
      await wait(EFFECT_SETTLE_MS,);
      expect({
        condition: await session.used('row-details',) === (used
          + 1),
        message: 'Alt+Enter was not used as the details action',
      },);

      /**
       Screenshot after the chord.
       */
      const after = await session.shot('details-notice',);

      /**
       How the screenshots differ.
       */
      const delta = diffBox({
        a: await loadImage(before,),
        b: await loadImage(after,),
      },);
      expect({
        condition: delta.count > MIN_NOTICE_PIXELS,
        message: `no notice appeared (${delta.count} pixels differ)`,
      },);
      return `${delta.count} pixels changed, in ${JSON.stringify(delta.box,)}`;
    },
  },);
}
