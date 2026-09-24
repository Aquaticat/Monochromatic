import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Capture the D47 to D49 Search study on both physical Pixel 9 Pro Fold panels.
const sdk = process.env.ANDROID_HOME;
if (!sdk) throw new Error('ANDROID_HOME is unset; run through the Android prototype mise task.');
const adb = join(sdk, 'platform-tools', 'adb');
const serial = process.env.ANDROID_SERIAL ?? 'emulator-5554';
const packageName = 'dev.monochromatic.musicplayer';
const activity = `${packageName}/.DesignCandidateActivity`;
const renderDirectory = resolve('../design/questions/render');
const evidenceDirectory = resolve('../design/questions/evidence');
const adbText = (args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' });
const remote = (command) => adbText(['shell', command]);
const sleep = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
const original = {
  deviceState: remote('cmd device_state print-state').trim(),
  fontScale: remote('settings get system font_scale').trim(),
  night: remote('cmd uimode night').trim(),
  stayOn: remote('settings get global stay_on_while_plugged_in').trim(),
};
const screens = [
  { name: 'inner', state: '2', pixels: [2076, 2152], display: '(HWC display 0)' },
  { name: 'cover', state: '0', pixels: [1080, 2424], display: '(HWC display 1)' },
];
const states = [
  { name: 'player', markers: ['content-desc="Search music"', 'text="Camellia"'] },
  { name: 'open-empty', markers: ['content-desc="Back to player"', 'text="Search your music"'] },
  { name: 'open-results', markers: ['content-desc="Back to player"', 'text="Camellia"'] },
  { name: 'open-none', markers: ['content-desc="Back to player"', 'No results for'] },
  { name: 'open-unavailable', markers: ['content-desc="Back to player"', 'text="Library unavailable"'] },
];
mkdirSync(renderDirectory, { recursive: true });
mkdirSync(evidenceDirectory, { recursive: true });

const waitForCompose = (markers) => {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    try {
      adbText(['shell', 'uiautomator', 'dump', '/sdcard/fold-search-ready.xml']);
      const xml = adbText(['exec-out', 'cat', '/sdcard/fold-search-ready.xml']);
      if (markers.every((marker) => xml.includes(marker))) return xml;
    } catch (error) {
      console.error(`Waiting for Search study: ${String(error)}`);
    }
    sleep(300);
  }
  throw new Error(`Search study did not expose expected native nodes: ${markers.join(', ')}`);
};

const readRoles = (mode) => {
  const text = adbText(['shell', 'cmd', 'overlay', 'dump', 'com.android.systemui:dynamic']);
  // The bounded Android overlay dump uses a fixed color-resource grammar.
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
    if (remote('cmd device_state print-state').trim() !== screen.state) {
      throw new Error(`Expected device state ${screen.state} for ${screen.name}.`);
    }
    const size = remote('wm size').trim();
    const density = remote('wm density').trim();
    if (!size.includes(screen.pixels.join('x')) || density !== 'Physical density: 390') {
      throw new Error(`${screen.name} is ${size} at ${density}; expected ${screen.pixels.join('x')} at 390dpi.`);
    }
    const line = adbText(['shell', 'dumpsys', 'SurfaceFlinger', '--display-id'])
      .split('\n').find((entry) => entry.includes(screen.display));
    if (!line) throw new Error(`No physical ${screen.name} display in SurfaceFlinger.`);
    const displayId = line.split(' ')[1];
    for (const mode of ['dark', 'light']) {
      remote(`cmd uimode night ${mode === 'dark' ? 'yes' : 'no'}`);
      sleep(1200);
      const roles = readRoles(mode);
      if (!roles.on_surface || !roles.surface_container_high || !roles.outline) {
        throw new Error(`${screen.name}/${mode} dynamic roles did not settle: ${JSON.stringify(roles)}`);
      }
      writeFileSync(join(evidenceDirectory, `fold-search-${screen.name}-roles-${mode}.json`),
        `${JSON.stringify({ android: { api: 37, deviceState: screen.state, displayPixels: screen.pixels, densityDpi: 390, night: mode }, roles }, null, 2)}\n`);
      for (const scale of ['1.0', '2.0']) {
        const subset = scale === '1.0' ? states : states.filter((stage) => stage.name === 'player' || stage.name === 'open-results');
        for (const stage of subset) {
          remote(`settings put system font_scale ${scale}`);
          remote('input keyevent 224');
          remote('cmd window dismiss-keyguard');
          sleep(700);
          adbText(['shell', 'am', 'force-stop', packageName]);
          adbText(['shell', 'am', 'start', '-W', '-n', activity, '--es', 'candidate',
            `search-page-${stage.name}${mode === 'light' ? '-light' : ''}`]);
          const xml = waitForCompose(stage.markers);
          const base = `fold-search-${screen.name}-${stage.name}-${mode}-${scale === '1.0' ? 's100' : 's200'}`;
          const png = execFileSync(adb, ['-s', serial, 'exec-out', 'screencap', '-d', displayId, '-p']);
          if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
              png.readUInt32BE(16) !== screen.pixels[0] || png.readUInt32BE(20) !== screen.pixels[1]) {
            throw new Error(`${base} did not return the opaque panel's physical PNG dimensions.`);
          }
          const pngPath = join(renderDirectory, `${base}.png`);
          writeFileSync(pngPath, png);
          if (screen.name === 'inner') {
            // E2's [414,438)dp connector covers physical x [1009,1068) on this display.
            // Inspect every pixel between the measured safe top 136px and navigation start 2074px.
            // A pixel-only check misses transparent clickable rows, so inspect native nodes too.
            const connectorWidth = 59;
            const connectorTop = 136;
            const rgba = execFileSync('magick', [pngPath, '-crop', `${connectorWidth}x1938+1009+${connectorTop}`, '+repage', '-depth', '8', 'rgba:-'], { maxBuffer: 1_000_000 });
            if (rgba.length !== connectorWidth * 1938 * 4) throw new Error(`${base}: incomplete connector pixel extraction.`);
            const expected = mode === 'dark' ? 0 : 255;
            for (let offset = 0; offset < rgba.length; offset += 4) {
              if (rgba[offset] !== expected || rgba[offset + 1] !== expected || rgba[offset + 2] !== expected || rgba[offset + 3] !== 255) {
                const pixel = offset / 4;
                throw new Error(`${base}: unfolded connector x=[1009,1068) has wrong ${mode} fill at (${1009 + pixel % connectorWidth},${connectorTop + Math.floor(pixel / connectorWidth)}).`);
              }
            }
            const nodes = [...xml.matchAll(/<node\b[^>]*>/g)].map((match) => match[0]);
            const crossing = nodes.filter((node) => node.includes(`package="${packageName}"`) &&
              (/text="[^"]+"/.test(node) || /content-desc="[^"]+"/.test(node) ||
                node.includes('clickable="true"') || node.includes('focusable="true"') || node.includes('scrollable="true"')))
              .find((node) => {
                const bounds = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
                if (!bounds) throw new Error(`${base}: semantic app node has no parseable screen bounds: ${node.slice(0, 330)}`);
                return Number(bounds[1]) < 1068 && Number(bounds[3]) > 1009;
              });
            if (crossing) {
              throw new Error(`${base}: app content or target spans the unfolded connector: ${crossing.slice(0, 330)}`);
            }
          }
          const observedScale = remote('settings get system font_scale').trim();
          const observedMode = remote('cmd uimode night').trim();
          const observedState = remote('cmd device_state print-state').trim();
          if (observedScale !== scale || observedMode !== `Night mode: ${mode === 'dark' ? 'yes' : 'no'}` || observedState !== screen.state) {
            throw new Error(`${base}: scene state changed during native capture: font ${observedScale}, ${observedMode}, device ${observedState}.`);
          }
          writeFileSync(join(evidenceDirectory, `${base}.xml`), `${xml.trim()}\n`);
          writeFileSync(join(evidenceDirectory, `${base}.meta.json`), `${JSON.stringify({ deviceState: observedState, physicalPixels: screen.pixels, densityDpi: 390, night: mode, fontScale: Number(observedScale) }, null, 2)}\n`);
          console.log(`${base}.png ${screen.pixels.join('x')} ${png.length} bytes at 390dpi and ${observedScale} font scale; connector clear`);
        }
      }
    }
  }
} finally {
  try {
    restoreSetting({ namespace: 'system', key: 'font_scale', value: original.fontScale });
    remote(`cmd uimode night ${original.night.endsWith('yes') ? 'yes' : 'no'}`);
    restoreSetting({ namespace: 'global', key: 'stay_on_while_plugged_in', value: original.stayOn });
    remote(`cmd device_state base-state ${original.deviceState}`);
    remote('rm -f /sdcard/fold-search-ready.xml');
  } catch (error) {
    console.error(`Failed to restore Fold capture settings: ${String(error)}`);
  }
}
