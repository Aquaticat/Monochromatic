import spawn from 'nano-spawn';
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { match } from 'ts-pattern';

const startTotal = performance.now();

// Read .vale.ini to get the packages list
console.log('Reading .vale.ini...');
const startRead = performance.now();
const valeIniPath = join(process.cwd(), '.vale.ini');
const valeIniContent = readFileSync(valeIniPath, 'utf8');

// Get packages from line that starts with "Packages = "
const packagesLine = valeIniContent.split('\n').find((line) =>
  line.startsWith('Packages = ')
);

await match(packagesLine)
  .with(undefined, () => {
    console.log('No Packages line found in .vale.ini');
    console.log(`Total time: ${(performance.now() - startTotal).toFixed(2)}ms`);
    // Exit successfully - no packages to sync
  })
  .otherwise(async (line) => {
    const packages = line
      .replace('Packages = ', '')
      .split(',')
      .map((pkg) => pkg.trim())
      .filter((pkg) => pkg.length > 0);

    console.log(
      `Found packages: ${packages.join(', ')} in ${
        (performance.now() - startRead)
          .toFixed(2)
      }ms`,
    );

    // Check if all packages exist in .vale directory
    console.log('Checking installed packages...');
    const startCheck = performance.now();
    const valePath = join(process.cwd(), '.vale');
    
    const allPackagesExist = packages.every((pkg) => {
      const packagePath = join(valePath, pkg);
      const exists = existsSync(packagePath);
      
      match(exists)
        .with(false, () => console.log(`Package ${pkg} not found at ${packagePath}`))
        .otherwise(() => {});
      
      return exists;
    });

    console.log(`Check completed in ${(performance.now() - startCheck).toFixed(2)}ms`);

    await match(allPackagesExist)
      .with(true, () => {
        console.log('All vale packages already installed');
      })
      .with(false, async () => {
        console.log('Running vale sync...');
        const startSync = performance.now();
        await spawn('vale', ['sync'], { stdio: 'inherit' });
        console.log(`Vale sync completed in ${(performance.now() - startSync).toFixed(2)}ms`);
      })
      .exhaustive();

    console.log(`Total time: ${(performance.now() - startTotal).toFixed(2)}ms`);
  });
