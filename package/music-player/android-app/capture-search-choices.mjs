import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Debug-only Fold Search comparison: actual input-method window, not a keyboard-closed inference.
const sdk = process.env.ANDROID_HOME;
if (!sdk) throw new Error('ANDROID_HOME is unset; invoke this capture through its mise task.');
const adb = join(sdk, 'platform-tools', 'adb');
const serial = process.env.ANDROID_SERIAL ?? 'emulator-5554';
const app = 'dev.monochromatic.musicplayer';
const component = `${app}/.DesignCandidateActivity`;
const ime = `${app}/.FoldProbeInputMethod`;
const buildCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const render = resolve('../design/questions/render');
const evidence = resolve('../design/questions/evidence');
const shell = (args) => execFileSync(adb, ['-s', serial, 'shell', ...args], { encoding: 'utf8' }).trim();
const adbText = (args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' }).trim();
const pause = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
const initial = {
  state: shell(['cmd', 'device_state', 'print-state']),
  font: shell(['settings', 'get', 'system', 'font_scale']),
  night: shell(['cmd', 'uimode', 'night']),
  ime: shell(['settings', 'get', 'secure', 'default_input_method']),
  stayOn: shell(['settings', 'get', 'global', 'stay_on_while_plugged_in']),
};
const restore = {
  [Symbol.dispose]() {
    shell(['ime', 'set', initial.ime]);
    if (initial.ime !== ime) shell(['ime', 'disable', ime]);
    shell(['settings', 'put', 'system', 'font_scale', initial.font]);
    shell(['cmd', 'uimode', 'night', initial.night.includes('yes') ? 'yes' : 'no']);
    shell(['cmd', 'device_state', 'base-state', initial.state]);
    if (initial.stayOn === 'null') shell(['settings', 'delete', 'global', 'stay_on_while_plugged_in']);
    else shell(['settings', 'put', 'global', 'stay_on_while_plugged_in', initial.stayOn]);
  },
};
const hierarchy = (required) => {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    shell(['uiautomator', 'dump', '/sdcard/fold-search-choices.xml']);
    const xml = adbText(['exec-out', 'cat', '/sdcard/fold-search-choices.xml']);
    if (required.every((text) => xml.includes(text))) return xml;
    pause(350);
  }
  throw new Error(`Compose view did not settle: ${required.join(', ')}`);
};
const nodeBounds = ({ xml, description }) => {
  const attribute = `content-desc="${description}"`;
  const match = xml.indexOf(attribute);
  if (match < 0) throw new Error(`Missing accessibility label: ${description}`);
  const start = xml.lastIndexOf('<node ', match);
  const end = xml.indexOf('/>', match);
  const node = xml.slice(start, end);
  const marker = 'bounds="';
  const boundsStart = node.indexOf(marker);
  const boundsEnd = node.indexOf('"', boundsStart + marker.length);
  if (boundsStart < 0 || boundsEnd < 0) throw new Error(`Missing bounds: ${description}`);
  return JSON.parse(node.slice(boundsStart + marker.length, boundsEnd).replace('][', ','));
};
const keyboardTop = () => {
  const dump = shell(['dumpsys', 'window', 'windows']);
  const marker = ' u0 InputMethod}:';
  const entry = dump.indexOf(marker);
  if (entry < 0) throw new Error('Android did not create the input-method window.');
  const end = dump.indexOf('  Window #', entry);
  const window = dump.slice(entry, end < 0 ? undefined : end);
  if (!window.includes(`package=${app}`) || !window.includes('isOnScreen=true') ||
      !window.includes('isVisible=true') || !window.includes('mHasSurface=true')) {
    throw new Error('Debug keyboard is not a visible system window.');
  }
  const frames = window.indexOf('    Frames:');
  const frame = window.indexOf('frame=[', frames);
  if (frames < 0 || frame < 0) throw new Error('Input-method window has no reported frame.');
  const firstPoint = window.slice(frame + 'frame=['.length, window.indexOf(']', frame));
  const top = Number(firstPoint.split(',')[1]);
  if (!Number.isFinite(top) || top < 1100 || top > 1600) {
    throw new Error(`Input-method window top is outside measured Fold probe range: ${top}`);
  }
  return top;
};
const validate = ({ xml, candidate, top }) => {
  const leftDeck = candidate !== 'mirrored';
  for (const description of ['Previous track', 'Pause', 'Next track', 'Repeat track',
    'Play in order', 'Shuffle Camellia', 'Shuffle all folders']) {
    const [left, upper, right, lower] = nodeBounds({ xml, description });
    if (upper < 136 || lower >= top - 8 || (leftDeck ? right >= 983 : left <= 1093)) {
      throw new Error(`${candidate}: ${description} [${left},${upper}][${right},${lower}] is clipped or enters the crease.`);
    }
  }
};
const capture = ({ candidate, mode, scale, stage, xml, top, displayId }) => {
  if (shell(['settings', 'get', 'secure', 'default_input_method']) !== ime) {
    throw new Error('The selected IME changed before capture.');
  }
  if (stage === 'typing') validate({ xml, candidate, top });
  const png = execFileSync(adb, ['-s', serial, 'exec-out', 'screencap', '-p', '-d', displayId],
    { maxBuffer: 20 * 1024 * 1024 });
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      png.readUInt32BE(16) !== 2076 || png.readUInt32BE(20) !== 2152) {
    throw new Error('The capture did not come from the unfolded physical panel.');
  }
  const base = `search-choice-inner-${candidate}-${stage}-${mode}-s${scale === '2.0' ? '200' : '100'}`;
  const file = join(render, `${base}.png`);
  writeFileSync(file, png);
  execFileSync('mogrify', ['-strip', file]);
  writeFileSync(join(evidence, `${base}.xml`), `${xml}\n`);
  writeFileSync(join(evidence, `${base}.meta.json`), `${JSON.stringify({
    buildCommit, physicalPixels: [2076, 2152],
    densityDpi: 390, dentPxApprox: [983, 1093],
    state: shell(['cmd', 'device_state', 'print-state']),
    fontScale: Number(shell(['settings', 'get', 'system', 'font_scale'])),
    night: shell(['cmd', 'uimode', 'night']), selectedIme: ime,
    imeTopPx: top, candidate, stage, probeOnly: true,
  }, null, 2)}\n`);
  console.log(`${base}.png ${png.length} bytes IME top ${top ?? 'closed'}`);
};

mkdirSync(render, { recursive: true });
mkdirSync(evidence, { recursive: true });
{
  using settings = restore;
  shell(['settings', 'put', 'global', 'stay_on_while_plugged_in', '7']);
  shell(['cmd', 'device_state', 'base-state', '2']);
  pause(1000);
  if (shell(['cmd', 'device_state', 'print-state']) !== '2' ||
      !shell(['wm', 'size']).includes('2076x2152') ||
      shell(['wm', 'density']) !== 'Physical density: 390') {
    throw new Error('The unfolded physical Fold panel or measured density is unavailable.');
  }
  const displayLine = shell(['dumpsys', 'SurfaceFlinger', '--display-id'])
    .split('\n').find((line) => line.includes('(HWC display 0)'));
  if (!displayLine) throw new Error('Inner HWC display 0 is unavailable.');
  const displayId = displayLine.split(' ')[1];
  shell(['ime', 'enable', ime]);
  for (const mode of ['light', 'dark']) {
    shell(['cmd', 'uimode', 'night', mode === 'dark' ? 'yes' : 'no']);
    pause(1100);
    for (const scale of ['1.0', '2.0']) {
      shell(['settings', 'put', 'system', 'font_scale', scale]);
      for (const candidate of ['right', 'mirrored', 'right-lift']) {
        shell(['input', 'keyevent', '224']);
        shell(['cmd', 'window', 'dismiss-keyguard']);
        shell(['am', 'force-stop', app]);
        const name = `search-deck-${candidate}-empty${mode === 'light' ? '-light' : ''}`;
        shell(['am', 'start', '-W', '-n', component, '--es', 'candidate', name]);
        shell(['ime', 'set', ime]);
        const empty = hierarchy(['content-desc="Back to player"', 'text="Search your music"',
          'content-desc="Pause"', 'content-desc="Shuffle all folders"']);
        capture({ candidate, mode, scale, stage: 'empty', xml: empty, top: null, displayId });
        shell(['input', 'tap', candidate === 'mirrored' ? '300' : '1330', '220']);
        hierarchy(['content-desc="Pause"', 'text="Search your music"']);
        pause(500);
        const firstTop = keyboardTop();
        if (Math.abs(firstTop - 1421) > 24) throw new Error(`Probe window did not settle at 300dp: ${firstTop}`);
        shell(['input', 'tap', '1038', scale === '2.0' ? '1640' : '1600']);
        const results = hierarchy(['text="cam"', 'text="Results for “cam”"',
          'content-desc="Pause"', 'content-desc="Shuffle all folders"']);
        const top = keyboardTop();
        capture({ candidate, mode, scale, stage: 'typing', xml: results, top, displayId });
      }
    }
  }
}
