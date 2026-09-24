import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// D51/D52: capture only selected Search A on both physical Fold panels, with no repeated query heading.
const sdk = process.env.ANDROID_HOME;
if (!sdk) throw new Error('ANDROID_HOME is unset; invoke through its mise task.');
const adb = join(sdk, 'platform-tools', 'adb');
const serial = process.env.ANDROID_SERIAL ?? 'emulator-5554';
const app = 'dev.monochromatic.musicplayer';
const activity = `${app}/.DesignCandidateActivity`;
const ime = `${app}/.FoldProbeInputMethod`;
const buildCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const render = resolve('../design/questions/render');
const evidence = resolve('../design/questions/evidence');
const shell = (args) => execFileSync(adb, ['-s', serial, 'shell', ...args], { encoding: 'utf8' }).trim();
const adbText = (args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' }).trim();
const pause = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
const before = {
  state: shell(['cmd', 'device_state', 'print-state']),
  font: shell(['settings', 'get', 'system', 'font_scale']),
  night: shell(['cmd', 'uimode', 'night']),
  ime: shell(['settings', 'get', 'secure', 'default_input_method']),
  stayOn: shell(['settings', 'get', 'global', 'stay_on_while_plugged_in']),
};
const restore = {
  [Symbol.dispose]() {
    shell(['ime', 'set', before.ime]);
    if (before.ime !== ime) shell(['ime', 'disable', ime]);
    shell(['settings', 'put', 'system', 'font_scale', before.font]);
    shell(['cmd', 'uimode', 'night', before.night.includes('yes') ? 'yes' : 'no']);
    shell(['cmd', 'device_state', 'base-state', before.state]);
    if (before.stayOn === 'null') shell(['settings', 'delete', 'global', 'stay_on_while_plugged_in']);
    else shell(['settings', 'put', 'global', 'stay_on_while_plugged_in', before.stayOn]);
  },
};
const panels = [
  { name: 'inner', state: '2', pixels: [2076, 2152], hwc: '(HWC display 0)', keyboardTop: 1421 },
  { name: 'cover', state: '0', pixels: [1080, 2424], hwc: '(HWC display 1)', keyboardTop: 1693 },
];
const hierarchy = (required) => {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    shell(['uiautomator', 'dump', '/sdcard/fold-search-selected.xml']);
    const xml = adbText(['exec-out', 'cat', '/sdcard/fold-search-selected.xml']);
    if (required.every((text) => xml.includes(text))) return xml;
    pause(350);
  }
  throw new Error(`Selected Search did not settle: ${required.join(', ')}`);
};
const nodeBounds = ({ xml, description }) => {
  const at = xml.indexOf(`content-desc="${description}"`);
  if (at < 0) throw new Error(`Missing deck accessibility label: ${description}`);
  const node = xml.slice(xml.lastIndexOf('<node ', at), xml.indexOf('/>', at));
  const marker = 'bounds="';
  const start = node.indexOf(marker);
  const end = node.indexOf('"', start + marker.length);
  if (start < 0 || end < 0) throw new Error(`Missing bounds: ${description}`);
  return JSON.parse(node.slice(start + marker.length, end).replace('][', ','));
};
const visibleKeyboardTop = (panel) => {
  const dump = shell(['dumpsys', 'window', 'windows']);
  const at = dump.indexOf(' u0 InputMethod}:');
  if (at < 0) throw new Error(`${panel.name}: no system input window.`);
  const next = dump.indexOf('  Window #', at);
  const window = dump.slice(at, next < 0 ? undefined : next);
  if (!window.includes(`package=${app}`) || !window.includes('isOnScreen=true') ||
      !window.includes('isVisible=true') || !window.includes('mHasSurface=true')) {
    throw new Error(`${panel.name}: debug keyboard was not visibly drawn.`);
  }
  const frames = window.indexOf('    Frames:');
  const frame = window.indexOf('frame=[', frames);
  if (frames < 0 || frame < 0) throw new Error('Input-method window has no frame.');
  const top = Number(window.slice(frame + 'frame=['.length, window.indexOf(']', frame)).split(',')[1]);
  if (!Number.isFinite(top) || Math.abs(top - panel.keyboardTop) > 24) {
    throw new Error(`${panel.name}: 300dp probe did not settle: y=${top}.`);
  }
  return top;
};
const verifyResults = ({ panel, xml, keyboardTop }) => {
  if (!xml.includes('text="cam"')) throw new Error(`${panel.name}: query is not in the header.`);
  if (xml.includes('Results for “cam”')) throw new Error(`${panel.name}: repeated query heading returned.`);
  const minimumX = panel.name === 'inner' ? 1093 : 0;
  const nodes = xml.split('<node ').slice(1);
  for (const text of ['Camellia', 'Folder · opens this folder',
    'Another Xronixle', 'Track · Camellia · reveals track']) {
    const node = nodes.find((entry) => {
      if (!entry.includes(`text="${text}"`)) return false;
      const bounds = entry.split('bounds="')[1]?.split('"')[0];
      return bounds !== undefined && JSON.parse(bounds.replace('][', ','))[0] >= minimumX;
    });
    if (!node) throw new Error(`${panel.name}: right-side result ${text} is absent.`);
    const bounds = JSON.parse(node.split('bounds="')[1].split('"')[0].replace('][', ','));
    if (keyboardTop !== null && bounds[3] >= keyboardTop - 8) {
      throw new Error(`${panel.name}: result ${text} extends beneath keyboard.`);
    }
  }
  if (panel.name !== 'inner') return;
  for (const description of ['Track position', 'Previous track', 'Pause', 'Next track',
    'Repeat track', 'Play in order', 'Shuffle Camellia', 'Shuffle all folders']) {
    const [left, upper, right, lower] = nodeBounds({ xml, description });
    if (upper < 136 || right >= 983 || (keyboardTop !== null && lower >= keyboardTop - 8)) {
      throw new Error(`${panel.name}: ${description} [${left},${upper}][${right},${lower}] enters crease or keyboard.`);
    }
  }
};
const capture = ({ panel, displayId, mode, scale, stage, xml, keyboardTop }) => {
  if (shell(['settings', 'get', 'secure', 'default_input_method']) !== ime) {
    throw new Error('The selected input method changed during capture.');
  }
  if (stage !== 'empty') verifyResults({ panel, xml, keyboardTop });
  const png = execFileSync(adb, ['-s', serial, 'exec-out', 'screencap', '-p', '-d', displayId],
    { maxBuffer: 20 * 1024 * 1024 });
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      png.readUInt32BE(16) !== panel.pixels[0] || png.readUInt32BE(20) !== panel.pixels[1]) {
    throw new Error(`${panel.name}: incorrect native capture dimensions.`);
  }
  const base = `search-selected-${panel.name}-${stage}-${mode}-s${scale === '2.0' ? '200' : '100'}`;
  const file = join(render, `${base}.png`);
  writeFileSync(file, png);
  execFileSync('mogrify', ['-strip', file]);
  writeFileSync(join(evidence, `${base}.xml`), `${xml}\n`);
  writeFileSync(join(evidence, `${base}.meta.json`), `${JSON.stringify({
    buildCommit, panel: panel.name, physicalPixels: panel.pixels, densityDpi: 390,
    dentPxApprox: panel.name === 'inner' ? [983, 1093] : null,
    deviceState: shell(['cmd', 'device_state', 'print-state']),
    fontScale: Number(shell(['settings', 'get', 'system', 'font_scale'])),
    night: shell(['cmd', 'uimode', 'night']), selectedIme: ime, imeTopPx: keyboardTop,
    layout: 'D51 A', positiveHeadingRemoved: true, stage, probeOnly: true,
  }, null, 2)}\n`);
  console.log(`${base}.png ${png.length} bytes IME top ${keyboardTop ?? 'closed'}`);
};

mkdirSync(render, { recursive: true });
mkdirSync(evidence, { recursive: true });
{
  using settings = restore;
  shell(['settings', 'put', 'global', 'stay_on_while_plugged_in', '7']);
  shell(['ime', 'enable', ime]);
  for (const panel of panels) {
    shell(['cmd', 'device_state', 'base-state', panel.state]);
    pause(1100);
    if (shell(['cmd', 'device_state', 'print-state']) !== panel.state ||
        !shell(['wm', 'size']).includes(panel.pixels.join('x')) ||
        shell(['wm', 'density']) !== 'Physical density: 390') {
      throw new Error(`${panel.name}: physical Fold panel or density differs from captured source.`);
    }
    const line = shell(['dumpsys', 'SurfaceFlinger', '--display-id'])
      .split('\n').find((item) => item.includes(panel.hwc));
    if (!line) throw new Error(`${panel.name}: HWC display missing.`);
    const displayId = line.split(' ')[1];
    for (const mode of ['light', 'dark']) {
      shell(['cmd', 'uimode', 'night', mode === 'dark' ? 'yes' : 'no']);
      pause(1100);
      for (const scale of ['1.0', '2.0']) {
        shell(['settings', 'put', 'system', 'font_scale', scale]);
        shell(['input', 'keyevent', '224']);
        shell(['cmd', 'window', 'dismiss-keyguard']);
        shell(['am', 'force-stop', app]);
        const candidate = panel.name === 'inner' ? 'search-deck-right-lift-empty' : 'search-deck-left-empty';
        shell(['am', 'start', '-W', '-n', activity, '--es', 'candidate',
          `${candidate}${mode === 'light' ? '-light' : ''}`]);
        shell(['ime', 'set', ime]);
        if (panel.name === 'cover') shell(['input', 'tap', '800', '1350']);
        const empty = hierarchy(['content-desc="Back to player"', 'text="Search your music"',
          ...(panel.name === 'inner' ? ['content-desc="Pause"', 'content-desc="Shuffle all folders"'] : [])]);
        capture({ panel, displayId, mode, scale, stage: 'empty', xml: empty, keyboardTop: null });
        shell(['input', 'tap', panel.name === 'inner' ? '1330' : '310', '240']);
        hierarchy(['text="Search your music"']);
        pause(500);
        const keyboardTop = visibleKeyboardTop(panel);
        if (panel.name === 'inner') {
          shell(['input', 'tap', '1038', scale === '2.0' ? '1640' : '1600']);
        } else if (scale === '2.0') {
          shell(['input', 'tap', '540', '2000']);
        } else {
          shell(['input', 'text', 'cam']);
        }
        const results = hierarchy(['text="cam"', 'text="Camellia"', 'text="Another Xronixle"']);
        const actualTop = visibleKeyboardTop(panel);
        capture({ panel, displayId, mode, scale, stage: 'typing', xml: results, keyboardTop: actualTop });
        shell(['input', 'keyevent', '4']);
        const closed = hierarchy(['text="cam"', 'text="Camellia"', 'text="Another Xronixle"']);
        const windowDump = shell(['dumpsys', 'window', 'windows']);
        const imeAt = windowDump.indexOf(' u0 InputMethod}:');
        if (imeAt >= 0) {
          const end = windowDump.indexOf('  Window #', imeAt);
          const window = windowDump.slice(imeAt, end < 0 ? undefined : end);
          if (window.includes('isOnScreen=true') && window.includes('isVisible=true')) {
            throw new Error(`${panel.name}: keyboard remains over the results-closed capture.`);
          }
        }
        capture({ panel, displayId, mode, scale, stage: 'results', xml: closed, keyboardTop: null });
      }
    }
  }
}
