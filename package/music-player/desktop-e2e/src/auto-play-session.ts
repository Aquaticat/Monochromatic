/**
 The auto-play session: the Auto-play on select setting (D129) in two launches of the app over the same scratch
 configuration. The first launch checks that a click only selects while the setting is off (D124), turns the setting on in
 Settings with the keyboard, and checks that a click then selects and plays at once; the second launch checks that the
 setting survived Ctrl+Q and a restart and still plays on a click.

 @example
 ```ts
 import { runAutoPlaySession, } from './auto-play-session.ts';

 await runAutoPlaySession(context,);
 ```

 @packageDocumentation
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import {
  chordKeys,
  clickAt,
  isPaused,
  modeIs,
  tapKey,
} from './actions.ts';
import {
  type RunContext,
  startContextSession,
} from './context.ts';
import { expect, } from './errors.ts';
import { pathExists, } from './files.ts';
import {
  WIDE_POINTS,
  WIDE_WINDOW,
} from './layout.ts';
import { pollUntil, } from './poll.ts';
import { press, } from './press.ts';
import type { Session, } from './session.ts';
import { SESSION_READY_MS, } from './timing.ts';
import {
  NO_INDEX,
  type UiState,
} from './ui-state.ts';

/**
 Label of both launches, which names the scratch configuration the second launch finds again.
 */
const LABEL = 'auto-play';

/**
 How long a selected row is watched to see that it stays paused, in milliseconds.
 */
const STAYS_PAUSED_MS = 1_500;

/**
 Distance from the first track row's click point to a point on the second row, in pixels.
 */
const SECOND_ROW_OFFSET_PX = 90;

/**
 How many times the app process is looked for after Ctrl+Q.
 */
const EXIT_LOOKS = 40;

/**
 Pause between two looks for the app process.
 */
const EXIT_LOOK_PAUSE_MS = 200;

/**
 Row A: the first track row of the folder on screen.
 */
const ROW_A = WIDE_POINTS.trackRow;

/**
 Row B: the second track row of the folder on screen.
 */
const ROW_B = {
  x: WIDE_POINTS.trackRow.x,
  y: WIDE_POINTS.trackRow.y + SECOND_ROW_OFFSET_PX,
} as const;

/**
 Condition: a folder is shown, so the player page is up.

 @param state - a state of the app

 @returns whether a folder shows

 @example
 ```ts
 hasFolder(state,);
 ```
 */
function hasFolder(state: UiState,): boolean {
  return state.folder !== '';
}

/**
 Condition: the Settings page shows.

 @param state - a state of the app

 @returns whether the page is Settings

 @example
 ```ts
 isSettingsPage(state,);
 ```
 */
function isSettingsPage(state: UiState,): boolean {
  return state.route === 'Settings';
}

/**
 Condition: the player page shows.

 @param state - a state of the app

 @returns whether the page is the player

 @example
 ```ts
 isPlayerRoute(state,);
 ```
 */
function isPlayerRoute(state: UiState,): boolean {
  return state.route === 'Player';
}

/**
 Starts a launch of the app in the wide window and waits for the player page.

 @param context - the run's context

 @returns the running session; disposing it stops the unit

 @throws CheckFailureError when the session cannot start or never shows the player page

 @example
 ```ts
 await using session = await launch(context,);
 ```
 */
async function launch(context: RunContext,): Promise<Session> {
  /**
   The running launch.
   */
  const session = await startContextSession({
    context,
    options: {
      ...WIDE_WINDOW,
      scheme: 'dark',
      accent: '3B82F6',
      library: context.library,
      label: LABEL,
    },
  },);
  await session.waitState({
    predicate: hasFolder,
    what: 'the player page',
    timeoutMs: SESSION_READY_MS,
  },);
  await session.findAppPid();
  return session;
}

/**
 Selects Repeat so that a short track under the clicks never moves on by itself.

 @param session - the running launch

 @example
 ```ts
 await keepTrackFromMovingOn(session,);
 ```
 */
async function keepTrackFromMovingOn(session: Session,): Promise<void> {
  await press({
    session,
    act: chordKeys({
      mods: ['ctrl', 'shift',],
      key: '1',
    },),
    until: modeIs(0,),
    what: 'Repeat',
  },);
}

/**
 Quits the app with Ctrl+Q and waits until its process is gone, so that the shutdown has saved what it saves.

 @param session - the running launch

 @throws CheckFailureError when the process is not found or is still running after Ctrl+Q

 @example
 ```ts
 await quitApp(session,);
 ```
 */
async function quitApp(session: Session,): Promise<void> {
  /**
   Process id of the app, found by its own unit.
   */
  const pid = await session.findAppPid();
  expect({
    condition: pid !== '',
    message: 'the app process was not found',
  },);
  await session.chord({
    mods: ['ctrl',],
    key: 'q',
  },);

  /**
   Whether the process is gone.
   */
  const gone = await pollUntil({
    attempts: EXIT_LOOKS,
    intervalMs: EXIT_LOOK_PAUSE_MS,
    order: 'wait-then-check',
    check: async function processIsGone(): Promise<boolean> {
      return !(await pathExists(`/proc/${pid}`,));
    },
  },);
  expect({
    condition: gone,
    message: `the app process ${pid} is still running after Ctrl+Q`,
  },);
}

/**
 Records the checks of the first launch: the setting is off at first, a click only selects, the switch in Settings turns it
 on, and a click then selects and plays; the app quits at the end.

 @param context - the run's context

 @throws CheckFailureError when a launch cannot start or the app does not quit

 @example
 ```ts
 await runFirstLaunch(context,);
 ```
 */
async function runFirstLaunch(context: RunContext,): Promise<void> {
  /**
   The recorder of the run.
   */
  const { recorder, } = context;

  /**
   The first launch; leaving the function stops it.
   */
  await using session = await launch(context,);
  await keepTrackFromMovingOn(session,);
  recorder.setGroup('auto-play',);

  /**
   Library indexes of rows A and B, set by the first check.
   */
  const rows = { a: NO_INDEX, b: NO_INDEX, };
  await recorder.check({
    id: 'auto-play/off-by-default-click-selects-paused',
    title: 'with no saved setting Auto-play on select is off, and a click on another row selects it paused (D124, D129)',
    body: async function offByDefault(): Promise<string> {
      expect({
        condition: !(await session.last()).auto_play_on_select,
        message: 'the setting is on in a fresh configuration',
      },);
      await press({
        session,
        act: clickAt(ROW_A,),
        until: function rowASelected(state: UiState,): boolean {
          return state.current_index !== NO_INDEX;
        },
        what: 'a click on row A selecting it',
      },);
      if ((await session.last()).playing)
        await press({
          session,
          act: clickAt(ROW_A,),
          until: isPaused,
          what: 'row A paused by a second click',
        },);
      rows.a = (await session.last()).current_index;
      await press({
        session,
        act: clickAt(ROW_A,),
        until: function rowAPlays(state: UiState,): boolean {
          return (state.current_index === rows.a) && state.playing;
        },
        what: 'a click on the selected row A playing it',
      },);

      // Row B is another row while row A plays: with the setting off the click selects it and stops row A.
      /**
       The state after the click on row B.
       */
      const selectedB = await press({
        session,
        act: clickAt(ROW_B,),
        until: function rowBSelectedPaused(state: UiState,): boolean {
          return (state.current_index !== rows.a) && (state.current_index !== NO_INDEX) && !state.playing;
        },
        what: 'a click on row B selecting it paused and stopping row A',
      },);
      rows.b = selectedB.current_index;
      await session.shot('auto-play-off-row-b-selected',);
      await wait(STAYS_PAUSED_MS,);
      expect({
        condition: !(await session.last()).playing && ((await session.last()).current_index === rows.b),
        message: 'row B started playing by itself with the setting off',
      },);
      return `row A ${rows.a} played; the click on row B ${rows.b} left it paused with the setting off`;
    },
  },);

  await recorder.check({
    id: 'auto-play/switch-turns-it-on',
    title: 'End, Up and Space on the Auto-play on select row of Settings turn the setting on and leave Settings open (D129)',
    body: async function switchTurnsItOn(): Promise<string> {
      await press({
        session,
        act: chordKeys({
          mods: ['ctrl', 'alt',],
          key: 's',
        },),
        until: isSettingsPage,
        what: 'Settings',
      },);
      await press({
        session,
        act: tapKey('end',),
        until: function noChange(state: UiState,): boolean {
          return isSettingsPage(state,) && !state.auto_play_on_select;
        },
        what: 'the keyboard position on the last row, the Licenses row, with nothing toggled',
      },);
      // The Licenses row is the last stop; the switch row is the one above it.
      await press({
        session,
        act: tapKey('up',),
        until: function noChangeAfterUp(state: UiState,): boolean {
          return isSettingsPage(state,) && !state.auto_play_on_select;
        },
        what: 'the keyboard position on the switch row with nothing toggled',
      },);
      /**
       The state after Space on the switch row.
       */
      const turnedOn = await press({
        session,
        act: tapKey('space',),
        until: function settingOn(state: UiState,): boolean {
          return state.auto_play_on_select;
        },
        what: 'Space turning Auto-play on select on',
      },);
      expect({
        condition: isSettingsPage(turnedOn,),
        message: `toggling the setting left Settings (route ${turnedOn.route})`,
      },);
      await session.shot('auto-play-switch-on',);
      await press({
        session,
        act: tapKey('escape',),
        until: isPlayerRoute,
        what: 'the player page after Escape',
      },);
      return 'the switch row turned the setting on in place';
    },
  },);

  await recorder.check({
    id: 'auto-play/on-click-selects-and-plays',
    title: 'with the setting on, a click on another row selects it and starts it at once; the selected row still toggles (D129)',
    body: async function onClickPlays(): Promise<string> {
      /**
       The state after the click on row A with the setting on.
       */
      const playingA = await press({
        session,
        act: clickAt(ROW_A,),
        until: function rowAPlaysAtOnce(state: UiState,): boolean {
          return (state.current_index === rows.a) && state.playing;
        },
        what: 'a click on row A selecting it and playing it at once',
      },);
      await session.shot('auto-play-on-row-a-playing',);
      /**
       The state after the click on row B with the setting on.
       */
      const playingB = await press({
        session,
        act: clickAt(ROW_B,),
        until: function rowBPlaysAtOnce(state: UiState,): boolean {
          return (state.current_index === rows.b) && state.playing;
        },
        what: 'a click on row B selecting it and playing it at once',
      },);
      /**
       The state after the click on the playing row B.
       */
      const pausedB = await press({
        session,
        act: clickAt(ROW_B,),
        until: function rowBPaused(state: UiState,): boolean {
          return (state.current_index === rows.b) && !state.playing;
        },
        what: 'a click on the playing row B pausing it',
      },);
      return `row A ${rows.a} played at once (${playingA.playing}), row B ${rows.b} played at once (${playingB.playing}) `
        + `and the next click paused it (${!pausedB.playing})`;
    },
  },);
  await quitApp(session,);
}

/**
 Records the check of the second launch: the setting saved in the first launch is still on, and a click plays.

 @param context - the run's context

 @throws CheckFailureError when the launch cannot start

 @example
 ```ts
 await runSecondLaunch(context,);
 ```
 */
async function runSecondLaunch(context: RunContext,): Promise<void> {
  /**
   The recorder of the run.
   */
  const { recorder, } = context;

  /**
   The second launch over the same scratch configuration; leaving the function stops it.
   */
  await using session = await launch(context,);
  await recorder.check({
    id: 'auto-play/setting-survives-restart',
    title: 'the setting is still on after Ctrl+Q and a restart, and a click on a row plays it at once (D129)',
    body: async function settingSurvives(): Promise<string> {
      expect({
        condition: (await session.last()).auto_play_on_select,
        message: 'the setting was off again after the restart',
      },);
      await keepTrackFromMovingOn(session,);
      /**
       The state after the click on row B in the second launch.
       */
      const state = await press({
        session,
        act: clickAt(ROW_B,),
        until: function rowPlaysAtOnce(candidate: UiState,): boolean {
          return (candidate.current_index !== NO_INDEX) && candidate.playing;
        },
        what: 'a click on row B selecting it and playing it at once after the restart',
      },);
      await session.shot('auto-play-after-restart-playing',);
      await press({
        session,
        act: clickAt(ROW_B,),
        until: isPaused,
        what: 'a click on the playing row pausing it',
      },);
      return `the setting stayed on; the click on row ${state.current_index} played at once`;
    },
  },);
}

/**
 Runs the auto-play session: the first launch with its checks and its quit, then the second launch.

 @param context - the run's context

 @throws CheckFailureError when a launch cannot start or the app does not quit

 @throws SafetyStopError when the app plays anywhere but the private sink

 @example
 ```ts
 await runAutoPlaySession(context,);
 ```
 */
export async function runAutoPlaySession(context: RunContext,): Promise<void> {
  await runFirstLaunch(context,);
  await runSecondLaunch(context,);
}
