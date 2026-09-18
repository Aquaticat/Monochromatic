import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const serial = process.env.ANDROID_SERIAL ?? 'emulator-5564';
const sdk = process.env.ANDROID_HOME;
if (!sdk) {
  throw new Error('ANDROID_HOME is unset; the android-sdk mise tool exports it.');
}
const adb = join(sdk, 'platform-tools', 'adb');
const magick = 'magick';
const packageName = 'dev.monochromatic.musicplayer';
const activity = `${packageName}/.DesignCandidateActivity`;
const renderDirectory = resolve('../design/questions/render');
const evidenceDirectory = resolve('../design/questions/evidence');
const adbText = (args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' });
const remote = (command) => adbText(['shell', command]);
const sleep = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);

const originalDeviceState = remote('cmd device_state print-state').trim();
if (originalDeviceState !== '0') {
  remote('cmd device_state base-state 0');
  sleep(6000);
}
const foldedState = remote('cmd device_state print-state').trim();
if (foldedState !== '0') {
  throw new Error(`The emulator must be folded (device state 0) for cover captures; print-state reported ${foldedState}.`);
}
remote('input keyevent 224');
remote('cmd window dismiss-keyguard');
sleep(1500);
const coverSize = remote('wm size').trim();
if (!coverSize.includes('1080x2424')) {
  throw new Error(`The folded default display must measure 1080x2424; wm size reported ${coverSize}.`);
}
const displayLine = adbText(['shell', 'dumpsys', 'SurfaceFlinger', '--display-id'])
  .split('\n')
  .find((line) => line.includes('(HWC display 1)'));
if (!displayLine) {
  throw new Error('The emulator did not report the folded cover panel as HWC display 1.');
}
const displayId = displayLine.split(' ')[1];

const environments = {
  wallpaper: { key: 'wallpaper', label: 'Measured current wallpaper seed', seed: '45588C', style: 'TONAL_SPOT', styleNumber: '1', contrast: '0.0' },
  coral: { key: 'coral', label: 'Warm coral', seed: 'D45D42', style: 'TONAL_SPOT', styleNumber: '1', contrast: '0.0' },
};
const captures = [
  { candidate: 'cover-dark-wallpaper', scale: '1.0', scaleKey: 's100', night: true, environment: 'wallpaper' },
  { candidate: 'cover-dark-wallpaper', scale: '0.85', scaleKey: 's085', night: true, environment: 'wallpaper' },
  { candidate: 'cover-dark-wallpaper', scale: '1.5', scaleKey: 's150', night: true, environment: 'wallpaper' },
  { candidate: 'cover-dark-wallpaper', scale: '2.0', scaleKey: 's200', night: true, environment: 'wallpaper' },
  { candidate: 'cover-light-l1', scale: '1.0', scaleKey: 's100', night: false, environment: 'wallpaper' },
  { candidate: 'cover-light-l2', scale: '1.0', scaleKey: 's100', night: false, environment: 'wallpaper' },
  { candidate: 'cover-light-l3', scale: '1.0', scaleKey: 's100', night: false, environment: 'wallpaper' },
  { candidate: 'cover-light-l1', scale: '2.0', scaleKey: 's200', night: false, environment: 'wallpaper' },
  { candidate: 'cover-dark-coral', scale: '1.0', scaleKey: 's100', night: true, environment: 'coral' },
  { candidate: 'cover-picker-k1', scale: '1.0', scaleKey: 's100', night: true, environment: 'wallpaper', markers: ['text="Cult of Luna"', 'content-desc="Navigate up"'] },
  { candidate: 'cover-picker-k2', scale: '1.0', scaleKey: 's100', night: true, environment: 'wallpaper', markers: ['text="Cult of Luna"', 'text="Open"'] },
  { candidate: 'cover-picker-k3', scale: '1.0', scaleKey: 's100', night: true, environment: 'wallpaper', markers: ['text="Cult of Luna"', 'text="Open"'] },
  { candidate: 'cover-picker-k1', scale: '2.0', scaleKey: 's200', night: true, environment: 'wallpaper', markers: ['text="Cult of Luna"', 'content-desc="Navigate up"'] },
  { candidate: 'cover-picker-k1-light', scale: '1.0', scaleKey: 's100', night: false, environment: 'wallpaper', markers: ['text="Cult of Luna"', 'content-desc="Navigate up"'] },
];
const coverMappings = {
  dark: {
    window: '#000000', topRow: '#000000', list: '#000000', deck: '#0A0A0D',
    currentRow: 'surfaceContainerLow (D42)', generated: ['component accents and foregrounds', 'outline roles'],
  },
  'light-l1': {
    window: 'surfaceDim', topRow: 'surfaceContainerLow', list: 'surfaceContainerLowest', deck: 'surfaceContainerLow',
    seam: 'outlineVariant hairline at the deck seam only',
  },
  'light-l2': {
    window: 'surfaceDim', topRow: 'surfaceContainerLow', list: 'surfaceContainerLowest', deck: 'surfaceContainerLow',
    seam: 'no hairlines; tonal ramp only',
  },
  'light-l3': {
    window: 'surfaceContainerLowest', topRow: 'surfaceContainerLowest', list: 'surfaceContainerLowest', deck: 'surfaceContainerLowest',
    seam: 'outlineVariant hairlines at both the top-row and deck seams',
  },
};

const original = {
  customization: remote('settings get secure theme_customization_overlay_packages').trim(),
  contrast: remote('settings get secure contrast_level').trim(),
  fontScale: remote('settings get system font_scale').trim(),
  night: remote('cmd uimode night').trim(),
  deviceState: originalDeviceState,
};

mkdirSync(renderDirectory, { recursive: true });
mkdirSync(evidenceDirectory, { recursive: true });

const readDynamicRoles = (mode) => {
  const dump = adbText(['shell', 'cmd', 'overlay', 'dump', 'com.android.systemui:dynamic']);
  return Object.fromEntries(
    [...dump.matchAll(new RegExp(`-> color 0x([0-9a-f]{8}) \\(color/system_([a-z0-9_]+)_${mode}\\)`, 'g'))]
      .map((match) => [match[2], `#${match[1].slice(2).toUpperCase()}`]),
  );
};

const applyEnvironment = (environment) => {
  adbText(['logcat', '-c']);
  remote(`settings put secure contrast_level ${environment.contrast}`);
  const setting = JSON.stringify({
    'android.theme.customization.system_palette': environment.seed,
    'android.theme.customization.accent_color': environment.seed,
    'android.theme.customization.theme_style': environment.style,
    _applied_timestamp: Date.now(),
  });
  remote(`settings put secure theme_customization_overlay_packages '${setting}'`);
  let roles = {};
  for (let attempt = 0; attempt < 80; attempt += 1) {
    sleep(500);
    try {
      const service = adbText(['shell', 'dumpsys', 'activity', 'service', 'com.android.systemui/.SystemUIService']);
      const logs = adbText(['logcat', '-d', '-s', 'ThemeOverlayController:D']);
      const contrastReady = service.includes(`mContrast=${environment.contrast}`);
      const styleReady = service.includes(`mThemeStyle=${environment.styleNumber}`);
      const paletteReady = logs.includes('Writing boot animation colors 1:');
      roles = readDynamicRoles('dark');
      if (contrastReady && styleReady && paletteReady && (roles.primary || roles.surface_container_low)) {
        return roles;
      }
    } catch (error) {
      console.error(`Waiting for Android dynamic roles: ${String(error)}`);
    }
  }
  throw new Error(`Android dynamic roles did not settle for ${environment.key}: ${JSON.stringify(roles)}`);
};

const settleNightRoles = (mode) => {
  let roles = {};
  for (let attempt = 0; attempt < 20; attempt += 1) {
    sleep(400);
    roles = readDynamicRoles(mode);
    if (roles.primary && roles.surface_container_low && roles.outline_variant) {
      return roles;
    }
  }
  throw new Error(`Android ${mode} roles did not settle: ${JSON.stringify(roles)}`);
};

const waitForCompose = (markers) => {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    try {
      adbText(['shell', 'uiautomator', 'dump', '/sdcard/cover-round-ready.xml']);
      const hierarchy = adbText(['exec-out', 'cat', '/sdcard/cover-round-ready.xml']);
      if (markers.every((marker) => hierarchy.includes(marker))) {
        return hierarchy;
      }
    } catch (error) {
      console.error(`Waiting for Compose cover content: ${String(error)}`);
    }
    sleep(300);
  }
  throw new Error('Compose did not replace the Android launch splash on the cover display.');
};

const restoreSetting = ({ namespace, key, value }) => {
  if (value === 'null') {
    remote(`settings delete ${namespace} ${key}`);
    return;
  }
  remote(`settings put ${namespace} ${key} '${value}'`);
};

try {
  for (const environmentKey of ['wallpaper', 'coral']) {
    const environment = environments[environmentKey];
    applyEnvironment(environment);
    for (const night of [true, false]) {
      remote(`cmd uimode night ${night ? 'yes' : 'no'}`);
      sleep(800);
      const mode = night ? 'dark' : 'light';
      const roles = settleNightRoles(mode);
      writeFileSync(
        join(evidenceDirectory, `cover-round-${environment.key}-roles-${mode}.json`),
        `${JSON.stringify({
          android: { api: 37, displayPixels: [1080, 2424], foldedDeviceState: 0, night },
          composeMaterial3: '1.5.0-alpha27',
          request: environment,
          settledSetting: remote('settings get secure theme_customization_overlay_packages').trim(),
          resolvedRoles: roles,
          coverMappings,
        }, null, 2)}\n`,
      );
      for (const capture of captures.filter((entry) => entry.environment === environmentKey && entry.night === night)) {
        remote(`settings put system font_scale ${capture.scale}`);
        sleep(800);
      adbText(['shell', 'am', 'force-stop', packageName]);
      adbText(['shell', 'am', 'start', '-W', '-n', activity, '--es', 'candidate', capture.candidate]);
      const hierarchy = waitForCompose(capture.markers ?? ['text="Camellia"', 'content-desc="Repeat track"', 'content-desc="Pause"']);
      const png = execFileSync(adb, ['-s', serial, 'exec-out', 'screencap', '-d', displayId, '-p']);
      const basename = `cover-round-${capture.candidate}-${capture.scaleKey}`;
      const pngPath = join(renderDirectory, `${basename}.png`);
      writeFileSync(pngPath, png);
      const dimensions = execFileSync(magick, ['identify', '-format', '%wx%h', pngPath], { encoding: 'utf8' }).trim();
      if (dimensions !== '1080x2424') {
        throw new Error(`${basename}.png measured ${dimensions}; expected the opaque cover panel 1080x2424.`);
      }
        writeFileSync(join(evidenceDirectory, `${basename}.xml`), `${hierarchy}\n`);
        console.log(`${basename}.png ${png.length} bytes ${dimensions}`);
      }
    }
  }
} finally {
  try {
    restoreSetting({ namespace: 'secure', key: 'theme_customization_overlay_packages', value: original.customization });
    restoreSetting({ namespace: 'secure', key: 'contrast_level', value: original.contrast });
    remote(`settings put system font_scale ${original.fontScale}`);
    remote(`cmd uimode night ${original.night.endsWith('yes') ? 'yes' : 'no'}`);
    remote(`cmd device_state base-state ${original.deviceState}`);
    remote('rm -f /sdcard/cover-round-ready.xml');
  } catch (error) {
    console.error(`Failed to restore emulator settings: ${String(error)}`);
  }
}
