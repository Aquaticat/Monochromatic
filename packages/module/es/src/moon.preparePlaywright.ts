import spawn from 'nano-spawn';
import {
  existsSync,
  readdirSync,
} from 'node:fs';
import {
  homedir,
  platform,
} from 'node:os';
import { join } from 'node:path';
import { match } from 'ts-pattern';

/**
 * Installs system dependencies for Playwright based on the OS
 */
async function installSystemDependencies(): Promise<void> {
  await match(platform())
    .with('linux', async () => {
      console.log('\n🔧 Installing Playwright system dependencies...\n');
      // Try Playwright's native installer first
      try {
        console.log("Using Playwright's built-in dependency installer...");
        await spawn('pnpm', ['exec', 'playwright', 'install-deps'], { stdio: 'inherit' });
        console.log('✅ System dependencies installed successfully');
        return;
      } catch {
        console.warn("⚠️  Playwright's automatic dependency installation failed.");
        console.log('Attempting manual installation...\n');
      }

      // Fallback: Check which package manager is available and install dependencies
      await match(true)
        .when(() => existsSync('/usr/bin/apt'), async () => {
          console.log('📦 Installing dependencies with apt...');
          const deps = [
            'libnss3',
            'libnspr4',
            'libatk1.0-0',
            'libatk-bridge2.0-0',
            'libcups2',
            'libdrm2',
            'libdbus-1-3',
            'libatspi2.0-0',
            'libx11-6',
            'libxcomposite1',
            'libxdamage1',
            'libxext6',
            'libxfixes3',
            'libxrandr2',
            'libgbm1',
            'libxcb1',
            'libxkbcommon0',
            'libpango-1.0-0',
            'libcairo2',
            'libasound2',
            'libx11-xcb1',
          ];
          await spawn('sudo', ['apt-get', 'install', '-y', ...deps], {
            stdio: 'inherit',
          });
        })
        .when(() => existsSync('/usr/bin/pacman'), async () => {
          console.log('📦 Installing dependencies with pacman...');
          const deps = [
            'nss',
            'nspr',
            'atk',
            'at-spi2-core',
            'at-spi2-atk',
            'gtk3',
            'cups',
            'xcb-util',
            'libxcb',
            'libx11',
            'libxcomposite',
            'libdrm',
            'mesa',
            'libxdamage',
            'libxrandr',
            'libxkbcommon',
            'pango',
            'cairo',
            'alsa-lib',
          ];
          await spawn('sudo', ['pacman', '-S', '--noconfirm', ...deps], {
            stdio: 'inherit',
          });
        })
        .when(() => existsSync('/usr/bin/dnf'), async () => {
          console.log('📦 Installing dependencies with dnf...');
          await spawn('sudo', ['dnf', 'install', '-y', 'playwright'], {
            stdio: 'inherit',
          });
        })
        .when(() => existsSync('/usr/bin/zypper'), async () => {
          console.log('📦 Installing dependencies with zypper...');
          await spawn('sudo', ['zypper', 'install', '-y', 'chromium'], {
            stdio: 'inherit',
          });
        })
        .otherwise(() => {
          throw new Error(
            'No supported package manager found (apt, pacman, dnf, zypper). Please install Playwright dependencies manually.',
          );
        });
    })
    .with('darwin', () => {
      console.log('🍎 macOS detected - no additional system dependencies needed');
    })
    .with('win32', () => {
      console.log('🪟 Windows detected - no additional system dependencies needed');
    })
    .otherwise(() => {
      throw new Error(
        `Unknown operating system: ${platform()}. Playwright dependencies installation not supported.`,
      );
    });
}

// First, ensure system dependencies are installed (Linux only)
await installSystemDependencies();

// Check common browser paths to see if any playwright browsers exist
const homeDir = homedir();
const possiblePaths = [
  // Linux/macOS
  join(homeDir, '.cache', 'ms-playwright'),
  // Windows
  join(homeDir, 'AppData', 'Local', 'ms-playwright'),
];

const hasAnyBrowsers = possiblePaths.some((basePath) => {
  if (!existsSync(basePath)) {
    return false;
  }

  // Check for any browser directory (chromium, firefox, webkit)
  const browserDirs = ['chromium-', 'firefox-', 'webkit-'];
  const entries = readdirSync(basePath);

  return browserDirs.some((browserPrefix) =>
    entries.some((entry: string) => entry.startsWith(browserPrefix))
  );
});

if (hasAnyBrowsers) {
  console.log('✅ Playwright browsers already installed');
} else {
  console.log('📥 Installing Playwright browsers...');
  await spawn('pnpm', ['exec', 'playwright', 'install'], { stdio: 'inherit' });
  console.log('✅ Playwright browsers installed successfully');
}
