import { execSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import {
  homedir,
  platform,
  release,
} from 'node:os';
import { join } from 'node:path';

/**
 * Detects the current Linux distribution and version
 * @returns Distribution info or null if not Linux/unknown
 */
function detectLinuxDistro(): { name: string; version: string; } | null {
  if (platform() !== 'linux') { return null; }

  try {
    // Try /etc/os-release first (most modern distros)
    if (existsSync('/etc/os-release')) {
      const content = readFileSync('/etc/os-release', 'utf8');
      const lines = content.split('\n');
      const info: Record<string, string> = {};

      for (const line of lines) {
        const [key, value] = line.split('=');
        if (key && value) {
          info[key] = value.replace(/^"(.*)"$/, '$1');
        }
      }

      return {
        name: info.ID || info.NAME || 'unknown',
        version: info.VERSION_ID || info.VERSION || 'unknown',
      };
    }

    // Fallback to checking for specific distro files
    if (existsSync('/etc/debian_version')) {
      return { name: 'debian', version: 'unknown' };
    }
    if (existsSync('/etc/redhat-release')) {
      return { name: 'rhel', version: 'unknown' };
    }
    if (existsSync('/etc/arch-release')) {
      return { name: 'arch', version: 'rolling' };
    }
  } catch {
    // Unable to detect
  }

  return null;
}

/**
 * Checks if running in WSL environment
 * @returns true if running in WSL
 */
function isWSL(): boolean {
  try {
    const kernelRelease = release().toLowerCase();
    return kernelRelease.includes('microsoft') || kernelRelease.includes('wsl');
  } catch {
    return false;
  }
}

/**
 * Installs system dependencies for Playwright based on the OS
 * @returns true if dependencies were installed successfully
 */
function installSystemDependencies(): boolean {
  const os = platform();
  const distro = detectLinuxDistro();

  console.log('\n🔧 Installing Playwright system dependencies...\n');

  try {
    if (os === 'linux') {
      if (isWSL()) {
        console.log('🐧 Detected WSL environment');
      }

      // Try to install dependencies using playwright's built-in installer
      try {
        console.log("Using Playwright's built-in dependency installer...");
        execSync('pnpm exec playwright install-deps', { stdio: 'inherit' });
        return true;
      } catch {
        console.warn("⚠️  Playwright's automatic dependency installation failed.");
        console.log('Attempting manual installation...\n');

      // Manual installation based on distro
      if (distro) {
        if (distro.name === 'ubuntu' || distro.name === 'debian') {
          console.log(`📦 Installing dependencies for ${distro.name}...`);
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
            'libx11-xcb1', // The missing library from the error
          ];

          try {
            // Not really necessary normally on an up-to-date system, and we assume so.
            // execSync('sudo apt-get update', { stdio: 'inherit' });
            execSync(`sudo apt-get install -y ${deps.join(' ')}`, { stdio: 'inherit' });
            return true;
          } catch {
            console.error('❌ Failed to install dependencies with apt-get');
          }   }     else if (distro.name === 'arch') {
          console.log(`📦 Installing dependencies for ${distro.name}...`);
          const deps = [
            'nss', 'nspr' ,'atk', 'at-spi2-core', 'at-spi2-atk', 'gtk3', 'cups', 'xcb-util', 'libxcb', 'libx11', 'libxcomposite', 'libdrm', 'mesa', 'libxcomposite', 'libxdamage', 'libxrandr' ,'libxkbcommon', 'pango', 'cairo' ,'alsa-lib'
          ];

          try {
                        // Not really necessary normally on an up-to-date system, and we assume so.
            // execSync('sudo pacman -Sy', { stdio: 'inherit' });
            execSync(`sudo pacman -S --noconfirm ${deps.join(' ')}`, { stdio: 'inherit' });
            return true;
          } catch {
            console.error('❌ Failed to install dependencies with pacman');
          }
        } else if (distro.name === 'fedora' || distro.name === 'rhel') {
          console.log(`📦 Installing dependencies for ${distro.name}...`);
          try {
            execSync('sudo dnf install -y playwright', { stdio: 'inherit' });
            return true;
          } catch {
            console.error('❌ Failed to install dependencies with dnf');
          }
        }}
      }
    } else if (os === 'darwin') {
      console.log('🍎 macOS detected - no additional system dependencies needed');
      return true;
    } else if (os === 'win32') {
      console.log('🪟 Windows detected - no additional system dependencies needed');
      return true;
    }
  } catch (error) {
    console.error('❌ Error installing system dependencies:', error);
  }

  // If we get here, automatic installation failed
  console.log('\n⚠️  MANUAL INSTALLATION REQUIRED ⚠️');
  console.log('━'.repeat(50));
  console.log(
    '\nPlaywright requires system dependencies that could not be automatically installed.',
  );
  console.log('\nPlease run ONE of the following commands based on your system:\n');

  console.log('For Ubuntu/Debian:');
  console.log('  sudo apt-get update && sudo apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 libatspi2.0-0 libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libxcb1 libxkbcommon0 libpango-1.0-0 libcairo2 libasound2 libx11-xcb1\n');

  console.log('For Fedora/RHEL:');
  console.log('  sudo dnf install -y playwright\n');

  console.log('For Arch Linux:');
  console.log('  sudo pacman -S --needed nss nspr atk at-spi2-atk cups libdrm mesa libxcomposite libxdamage libxrandr libxkbcommon pango cairo alsa-lib\n');

  console.log("Or try Playwright's official installer:");
  console.log('  pnpm exec playwright install-deps\n');

  console.log('━'.repeat(50));
  console.log('\nAfter installing dependencies, run this command again.\n');

  return false;
}

try {
  // Check common browser paths to see if any playwright browsers exist
  const homeDir = homedir();
  const possiblePaths = [
    // Linux/macOS
    join(homeDir, '.cache', 'ms-playwright'),
    // Windows
    join(homeDir, 'AppData', 'Local', 'ms-playwright'),
    // Windows under WSL might use the Windows path
    '/mnt/c/Users/user/AppData/Local/ms-playwright',
  ];

  let hasAnyBrowsers = false;
  for (const basePath of possiblePaths) {
    if (existsSync(basePath)) {
      // Check for any browser directory (chromium, firefox, webkit)
      const browserDirs = ['chromium-', 'firefox-', 'webkit-'];
      for (const browserPrefix of browserDirs) {
        // Quick check: if any directory starts with browser prefix, there are browsers
        try {
          const entries = readdirSync(basePath);
          if (entries.some((entry: string) => entry.startsWith(browserPrefix))) {
            hasAnyBrowsers = true;
            break;
          }
        } catch {
          // Directory not readable, continue
        }
      }
      if (hasAnyBrowsers) { break; }
    }
  }

  execSync(`pnpm exec playwright install`);

  // First, ensure system dependencies are installed (Linux only)
  if (platform() === 'linux') {
    const depsInstalled = installSystemDependencies();
    if (!depsInstalled) {
      // Exit with error if manual installation is required
      process.exit(1);
    }
  }

  if (hasAnyBrowsers) {
    console.log('✅ Playwright browsers already installed');
  } else {
    console.log('📥 Installing Playwright browsers...');
    execSync('pnpm exec playwright install', { stdio: 'inherit' });
    console.log('✅ Playwright browsers installed successfully');
  }
} catch (error) {
  console.error('❌ Error preparing Playwright:', error);
  process.exit(1);
}
