import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const startTotal = performance.now();

try {
  // Read .vale.ini to get the packages list
  console.log('Reading .vale.ini...');
  const startRead = performance.now();
  const valeIniPath = join(process.cwd(), '.vale.ini');
  const valeIniContent = readFileSync(valeIniPath, 'utf8');
  
  // Extract packages from line that starts with "Packages = "
  const packagesLine = valeIniContent.split('\n').find(line => line.startsWith('Packages = '));
  if (!packagesLine) {
    console.log('No Packages line found in .vale.ini');
    process.exit(0);
  }
  
  const packages = packagesLine
    .replace('Packages = ', '')
    .split(',')
    .map(pkg => pkg.trim())
    .filter(pkg => pkg.length > 0);
  
  console.log(`Found packages: ${packages.join(', ')} in ${(performance.now() - startRead).toFixed(2)}ms`);
  
  // Check if all packages exist in .vale directory
  console.log('Checking installed packages...');
  const startCheck = performance.now();
  const valePath = join(process.cwd(), '.vale');
  let allPackagesExist = true;
  
  for (const pkg of packages) {
    const packagePath = join(valePath, pkg);
    if (!existsSync(packagePath)) {
      console.log(`Package ${pkg} not found at ${packagePath}`);
      allPackagesExist = false;
      break;
    }
  }
  
  console.log(`Check completed in ${(performance.now() - startCheck).toFixed(2)}ms`);
  
  if (allPackagesExist) {
    console.log('All vale packages already installed');
  } else {
    console.log('Running vale sync...');
    const startSync = performance.now();
    execSync('vale sync', { stdio: 'inherit' });
    console.log(`Vale sync completed in ${(performance.now() - startSync).toFixed(2)}ms`);
  }
  
  console.log(`Total time: ${(performance.now() - startTotal).toFixed(2)}ms`);
} catch (error) {
  console.error('Error during vale sync:', error);
  process.exit(1);
}