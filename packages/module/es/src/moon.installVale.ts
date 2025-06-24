import { execSync } from 'node:child_process';
import { platform } from 'node:os';

const startTotal = performance.now();

try {
  console.log('Checking if vale is installed...');
  const startCheck = performance.now();

  const currentPlatform = platform();
  const valeExists = (function getVale(currentPlatform: NodeJS.Platform): boolean {
    try {
      // Use platform-specific command to check if vale exists
      if (currentPlatform === 'win32') {
        // Windows: use where.exe
        execSync('where.exe vale', { stdio: 'ignore' });
        return true;
      }
      // Linux/macOS: use which
      execSync('which vale', { stdio: 'ignore' });
      return true;
    } catch {
      // Command failed, vale not found
      return false;
    }
  })(currentPlatform);

  console.log(
    `Vale ${valeExists ? 'found' : 'not found'} in ${
      (performance.now() - startCheck)
        .toFixed(2)
    }ms`,
  );

  if (!valeExists) {
    console.log('Installing vale...');
    const startInstall = performance.now();

    switch (currentPlatform) {
      case 'win32':
        execSync('winget install errata-ai.Vale', { stdio: 'inherit' });
        break;
      case 'darwin':
        execSync('brew install vale', { stdio: 'inherit' });
        break;
      case 'linux':
        // Check if snap is available first
        try {
          execSync('which snap', { stdio: 'ignore' });

          // Assume snap install works without elevation.
          execSync('snap install vale', { stdio: 'inherit' });
        } catch {
          console.error('snap not found. Please install vale manually.');
          process.exit(1);
        }
        break;
      default:
        console.error(`Unsupported platform: ${currentPlatform}`);
        process.exit(1);
    }

    console.log(
      `Installation completed in ${(performance.now() - startInstall).toFixed(2)}ms`,
    );
  }

  console.log(`Total time: ${(performance.now() - startTotal).toFixed(2)}ms`);
} catch (error) {
  console.error('Error installing vale:', error);
  process.exit(1);
}
