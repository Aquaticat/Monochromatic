import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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
          const entries = require('fs').readdirSync(basePath);
          if (entries.some((entry: string) => entry.startsWith(browserPrefix))) {
            hasAnyBrowsers = true;
            break;
          }
        } catch {
          // Directory not readable, continue
        }
      }
      if (hasAnyBrowsers) break;
    }
  }

  if (hasAnyBrowsers) {
    console.log('Playwright browsers already installed');
  } else {
    console.log('Installing Playwright browsers...');
    execSync('pnpm exec playwright install', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('Error checking/installing Playwright:', error);
  process.exit(1);
}
