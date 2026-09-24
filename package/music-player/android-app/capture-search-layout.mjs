import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Capture design-only compositions, not a working index or the rejected all-pixel-strip guard.
const sdk = process.env.ANDROID_HOME;
if (!sdk) throw new Error('ANDROID_HOME is unset; run through the prototype mise task.');
const adb = join(sdk, 'platform-tools', 'adb');
const serial = process.env.ANDROID_SERIAL ?? 'emulator-5554';
const packageName = 'dev.monochromatic.musicplayer';
const activity = `${packageName}/.DesignCandidateActivity`;
const renderDirectory = resolve('../design/questions/render');
const evidenceDirectory = resolve('../design/questions/evidence');
const adbText = (args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' });
const remote = (command) => adbText(['shell', command]);
const sleep = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
const before = {
  state: remote('cmd device_state print-state').trim(),
  font: remote('settings get system font_scale').trim(),
  night: remote('cmd uimode night').trim(),
  stayOn: remote('settings get global stay_on_while_plugged_in').trim(),
};
const screens = [
  { name: 'inner', state: '2', pixels: [2076, 2152], display: '(HWC display 0)' },
  { name: 'cover', state: '0', pixels: [1080, 2424], display: '(HWC display 1)' },
];
const states = [
  { name: 'player', markers: ['content-desc="Search music"', 'text="Camellia"'] },
  { name: 'empty', markers: ['content-desc="Back to player"', 'text="Search your music"'] },
  { name: 'results', markers: ['content-desc="Back to player"', 'text="Results for “cam”"'] },
  { name: 'none', markers: ['content-desc="Back to player"', 'No results for'] },
  { name: 'unavailable', markers: ['content-desc="Back to player"', 'text="Library unavailable"'] },
];
mkdirSync(renderDirectory, { recursive: true });
mkdirSync(evidenceDirectory, { recursive: true });

const waitForCompose = (markers) => {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    try {
      adbText(['shell', 'uiautomator', 'dump', '/sdcard/fold-search-layout-ready.xml']);
      const xml = adbText(['exec-out', 'cat', '/sdcard/fold-search-layout-ready.xml']);
      if (markers.every((marker) => xml.includes(marker))) return xml;
    } catch (error) {
      console.error(`Waiting for Search layout: ${String(error)}`);
    }
    sleep(300);
  }
  throw new Error(`Candidate did not expose native nodes: ${markers.join(', ')}`);
};

const readRoles = (mode) => {
  const text = adbText(['shell', 'cmd', 'overlay', 'dump', 'com.android.systemui:dynamic']);
  return Object.fromEntries(
    [...text.matchAll(new RegExp(`-> color 0x([0-9a-f]{8}) \\(color/system_([a-z0-9_]+)_${mode}\\)`, 'g'))]
      .map((match) => [match[2], `#${match[1].slice(2).toUpperCase()}`]),
  );
};

const restoreSetting = ({ namespace, key, value }) => {
  if (value === 'null') remote(`settings delete ${namespace} ${key}`);
  else remote(`settings put ${namespace} ${key} '${value}'`);
};

try {
  remote('settings put global stay_on_while_plugged_in 7');
  for (const screen of screens) {
    if (remote('cmd device_state print-state').trim() !== screen.state) {
      remote(`cmd device_state base-state ${screen.state}`);
      sleep(5000);
    }
    const actualState = remote('cmd device_state print-state').trim();
    const size = remote('wm size').trim();
    const density = remote('wm density').trim();
    if (actualState !== screen.state || !size.includes(screen.pixels.join('x')) || density !== 'Physical density: 390') {
      throw new Error(`${screen.name}: expected state ${screen.state}, ${screen.pixels.join('x')} and 390dpi; got ${actualState}, ${size}, ${density}.`);
    }
    const displayLine = adbText(['shell', 'dumpsys', 'SurfaceFlinger', '--display-id'])
      .split('\n').find((line) => line.includes(screen.display));
    if (!displayLine) throw new Error(`No active ${screen.name} display ID.`);
    const displayId = displayLine.split(' ')[1];
    for (const mode of ['dark', 'light']) {
      remote(`cmd uimode night ${mode === 'dark' ? 'yes' : 'no'}`);
      sleep(1200);
      const roles = readRoles(mode);
      if (!roles.on_surface || !roles.surface_container_high) throw new Error(`${screen.name}/${mode}: dynamic roles unavailable.`);
      writeFileSync(join(evidenceDirectory, `search-layout-${screen.name}-roles-${mode}.json`),
        `${JSON.stringify({ android: { api: 37, deviceState: screen.state, displayPixels: screen.pixels, densityDpi: 390, night: mode }, roles }, null, 2)}\n`);
      const variants = screen.name === 'inner' ? ['docked', 'wide-list', 'wide-grid'] : ['docked'];
      for (const variant of variants) {
        const captures = screen.name === 'cover' || variant === 'docked' ? states : states.filter((stage) => stage.name !== 'player');
        for (const capture of [...captures.map((stage) => ({ stage, scale: '1.0' })), { stage: states[2], scale: '2.0' }]) {
          const { stage, scale } = capture;
          remote(`settings put system font_scale ${scale}`);
          remote('input keyevent 224');
          remote('cmd window dismiss-keyguard');
          sleep(700);
          adbText(['shell', 'am', 'force-stop', packageName]);
          const candidate = `search-layout-${variant}-${stage.name}${mode === 'light' ? '-light' : ''}`;
          adbText(['shell', 'am', 'start', '-W', '-n', activity, '--es', 'candidate', candidate]);
          const xml = waitForCompose(stage.markers);
          const base = `search-layout-${screen.name}-${variant}-${stage.name}-${mode}-s${scale === '1.0' ? '100' : '200'}`;
          const png = execFileSync(adb, ['-s', serial, 'exec-out', 'screencap', '-d', displayId, '-p']);
          if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
              png.readUInt32BE(16) !== screen.pixels[0] || png.readUInt32BE(20) !== screen.pixels[1]) {
            throw new Error(`${base}: screenshot did not match the native physical panel.`);
          }
          const observedScale = remote('settings get system font_scale').trim();
          const observedMode = remote('cmd uimode night').trim();
          const observedState = remote('cmd device_state print-state').trim();
          if (observedScale !== scale || observedMode !== `Night mode: ${mode === 'dark' ? 'yes' : 'no'}` || observedState !== screen.state) {
            throw new Error(`${base}: scene state changed during capture: ${observedScale}, ${observedMode}, ${observedState}.`);
          }
          writeFileSync(join(renderDirectory, `${base}.png`), png);
          writeFileSync(join(evidenceDirectory, `${base}.xml`), `${xml.trim()}\n`);
          writeFileSync(join(evidenceDirectory, `${base}.meta.json`), `${JSON.stringify({
            deviceState: observedState, physicalPixels: screen.pixels, densityDpi: 390,
            night: mode, fontScale: Number(observedScale), variant, stage: stage.name,
          }, null, 2)}\n`);
          console.log(`${base}.png ${screen.pixels.join('x')} ${png.length} bytes`);
        }
      }
    }
  }
} finally {
  remote(`cmd device_state base-state ${before.state}`);
  restoreSetting({ namespace: 'system', key: 'font_scale', value: before.font });
  remote(`cmd uimode night ${before.night.includes('yes') ? 'yes' : 'no'}`);
  restoreSetting({ namespace: 'global', key: 'stay_on_while_plugged_in', value: before.stayOn });
}
