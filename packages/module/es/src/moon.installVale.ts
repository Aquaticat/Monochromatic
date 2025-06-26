import spawn from 'nano-spawn';
import { platform } from 'node:os';
import { match } from 'ts-pattern';

const startTotal = performance.now();

console.log('Checking if vale is installed...');
const startCheck = performance.now();

const currentPlatform = platform();
const valeExists = await (async function checkVale(platformName: NodeJS.Platform): Promise<boolean> {
  try {
    await match(platformName)
      .with('win32', async () => {
        // Windows: use where.exe
        await spawn('where.exe', ['vale'], { stdio: 'ignore' });
      })
      .otherwise(async () => {
        // Linux/macOS: use which
        await spawn('which', ['vale'], { stdio: 'ignore' });
      });
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

await match(valeExists)
  .with(false, async () => {
    console.log('Installing vale...');
    const startInstall = performance.now();

    await match(currentPlatform)
      .with('win32', async () => {
        await spawn('winget', ['install', 'errata-ai.Vale'], { stdio: 'inherit' });
      })
      .with('darwin', async () => {
        await spawn('brew', ['install', 'vale'], { stdio: 'inherit' });
      })
      .with('linux', async () => {
        // Check if snap is available first
        try {
          await spawn('which', ['snap'], { stdio: 'ignore' });

          try {
            // Assume snap install works without elevation first.
            await spawn('snap', ['install', 'vale'], { stdio: 'inherit' });
          } catch {
            // TODO: Reorganize this file to provide better error messages.
            await spawn('sudo', ['snap', 'install', 'vale'], { stdio: 'inherit' });
          }
        } catch {
          throw new Error('snap not found. Please install vale manually.');
        }
      })
      .otherwise(() => {
        throw new Error(`Unsupported platform: ${currentPlatform}`);
      });

    console.log(
      `Installation completed in ${(performance.now() - startInstall).toFixed(2)}ms`,
    );
  })
  .otherwise(() => {});

console.log(`Total time: ${(performance.now() - startTotal).toFixed(2)}ms`);
