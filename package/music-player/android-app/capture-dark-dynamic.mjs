import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const serial = process.env.ANDROID_SERIAL ?? 'emulator-5564';
const sdk = process.env.ANDROID_HOME;
if (!sdk) {
  throw new Error('ANDROID_HOME is unset; the android-sdk mise tool exports it.');
}
const adb = join(sdk, 'platform-tools', 'adb');
const packageName = 'dev.monochromatic.musicplayer';
const activity = `${packageName}/.DesignCandidateActivity`;
const renderDirectory = resolve('../design/questions/render');
const evidenceDirectory = resolve('../design/questions/evidence');
const adbText = (args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' });
const remote = (command) => adbText(['shell', command]);
const sleep = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
const displayLine = adbText(['shell', 'dumpsys', 'SurfaceFlinger', '--display-id'])
  .split('\n')
  .find((line) => line.includes('(HWC display 0)'));
if (!displayLine) {
  throw new Error('The emulator did not report its unfolded HWC display 0.');
}
const displayId = displayLine.split(' ')[1];
const strategies = ['stable', 'zoned', 'tonal'];
const environments = [
  { key: 'wallpaper', label: 'Measured current wallpaper seed', seed: '45588C', style: 'TONAL_SPOT', styleNumber: '1', contrast: '0.0' },
  { key: 'coral', label: 'Warm coral', seed: 'D45D42', style: 'TONAL_SPOT', styleNumber: '1', contrast: '0.0' },
  { key: 'green', label: 'Forest green', seed: '2E7D32', style: 'TONAL_SPOT', styleNumber: '1', contrast: '0.0' },
  { key: 'gold', label: 'Gold vibrant', seed: 'C49000', style: 'VIBRANT', styleNumber: '2', contrast: '0.0' },
  { key: 'magenta-medium', label: 'Magenta expressive, medium contrast', seed: 'A43D96', style: 'EXPRESSIVE', styleNumber: '3', contrast: '0.5' },
  { key: 'monochrome-high', label: 'Monochrome, high contrast', seed: '808080', style: 'MONOCHROMATIC', styleNumber: '7', contrast: '1.0' },
];
const strategyMappings = {
  stable: {
    canvas: '#000000', picker: '#000000', rail: '#000000', deck: '#0A0A0D', tracks: '#000000', currentRow: '#0A0A0D',
    generated: ['primary and onPrimary', 'secondaryContainer and onSecondaryContainer', 'onSurface', 'onSurfaceVariant', 'outline', 'outlineVariant'],
  },
  zoned: {
    canvas: '#000000', picker: '#000000', rail: 'surfaceContainerLow', deck: 'surfaceContainerLow', tracks: '#000000', currentRow: 'surfaceContainerLow',
    generated: ['all component accent and foreground roles', 'surfaceContainerLow', 'surfaceContainerHighest', 'outline roles'],
  },
  tonal: {
    canvas: '#000000', picker: 'surfaceContainerLow', rail: 'surfaceContainer', deck: 'surfaceContainerHigh', tracks: '#000000', currentRow: 'surfaceContainerLow',
    generated: ['all component accent and foreground roles', 'surface container ladder', 'outline roles'],
  },
};
const original = {
  customization: remote('settings get secure theme_customization_overlay_packages').trim(),
  contrast: remote('settings get secure contrast_level').trim(),
  fontScale: remote('settings get system font_scale').trim(),
  night: remote('cmd uimode night').trim(),
};

mkdirSync(renderDirectory, { recursive: true });
mkdirSync(evidenceDirectory, { recursive: true });

const readDynamicRoles = () => {
  const dump = adbText(['shell', 'cmd', 'overlay', 'dump', 'com.android.systemui:dynamic']);
  return Object.fromEntries(
    [...dump.matchAll(/-> color 0x([0-9a-f]{8}) \(color\/system_([a-z0-9_]+)_dark\)/g)]
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
      roles = readDynamicRoles();
      if (contrastReady && styleReady && paletteReady && roles.primary && roles.surface_container_low) {
        return roles;
      }
    } catch (error) {
      console.error(`Waiting for Android dynamic roles: ${String(error)}`);
    }
  }
  throw new Error(`Android dynamic roles did not settle for ${environment.key}: ${JSON.stringify(roles)}`);
};

const waitForCompose = () => {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    try {
      adbText(['shell', 'uiautomator', 'dump', '/sdcard/dark-dynamic-ready.xml']);
      const hierarchy = adbText(['exec-out', 'cat', '/sdcard/dark-dynamic-ready.xml']);
      if (hierarchy.includes('text="Camellia"') && hierarchy.includes('content-desc="Repeat track"')) {
        return hierarchy;
      }
    } catch (error) {
      console.error(`Waiting for Compose content: ${String(error)}`);
    }
    sleep(300);
  }
  throw new Error('Compose did not replace the Android launch splash.');
};

const restoreSetting = ({ namespace, key, value }) => {
  if (value === 'null') {
    remote(`settings delete ${namespace} ${key}`);
    return;
  }
  remote(`settings put ${namespace} ${key} '${value}'`);
};

try {
  remote('settings put system font_scale 1.0');
  remote('cmd uimode night yes');
  for (const environment of environments) {
    const roles = applyEnvironment(environment);
    for (const strategy of strategies) {
      adbText(['shell', 'am', 'force-stop', packageName]);
      adbText(['shell', 'am', 'start', '-W', '-n', activity, '--es', 'candidate', `dark-${strategy}`]);
      const hierarchy = waitForCompose();
      const png = execFileSync(adb, ['-s', serial, 'exec-out', 'screencap', '-d', displayId, '-p']);
      const basename = `dark-dynamic-${environment.key}-${strategy}`;
      writeFileSync(join(renderDirectory, `${basename}.png`), png);
      writeFileSync(join(evidenceDirectory, `${basename}.xml`), hierarchy);
      console.log(`${basename}.png ${png.length} bytes`);
    }
    const evidence = {
      android: { api: 37, displayPixels: [2076, 2152], fontScale: 1.0 },
      composeMaterial3: '1.5.0-alpha27',
      request: environment,
      settledSetting: remote('settings get secure theme_customization_overlay_packages').trim(),
      resolvedDarkRoles: roles,
      strategyMappings,
    };
    writeFileSync(join(evidenceDirectory, `dark-dynamic-${environment.key}-roles.json`), `${JSON.stringify(evidence, null, 2)}\n`);
  }
} finally {
  try {
    restoreSetting({ namespace: 'secure', key: 'theme_customization_overlay_packages', value: original.customization });
    restoreSetting({ namespace: 'secure', key: 'contrast_level', value: original.contrast });
    remote(`settings put system font_scale ${original.fontScale}`);
    remote(`cmd uimode night ${original.night.endsWith('yes') ? 'yes' : 'no'}`);
    remote('rm -f /sdcard/dark-dynamic-ready.xml');
  } catch (error) {
    console.error(`Failed to restore emulator settings: ${String(error)}`);
  }
}
