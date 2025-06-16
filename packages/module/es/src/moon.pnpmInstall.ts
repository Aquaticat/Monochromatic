import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const startTotal = performance.now();

try {
  // Check if node_modules exists and has content
  console.log('Checking node_modules state...');
  const startCheck = performance.now();
  const nodeModulesPath = join(process.cwd(), 'node_modules');
  const nodeModulesExists = existsSync(nodeModulesPath);
  const lockfilePath = join(process.cwd(), 'pnpm-lock.yaml');
  const lockfileExists = existsSync(lockfilePath);
  console.log(`Check completed in ${(performance.now() - startCheck).toFixed(2)}ms`);
  
  if (!nodeModulesExists || !lockfileExists) {
    // Need to install
    console.log('Running pnpm install...');
    const startInstall = performance.now();
    execSync('pnpm install --prefer-frozen-lockfile --optimistic-repeat-install --prefer-offline', { 
      stdio: 'inherit',
      encoding: 'utf8'
    });
    console.log(`Installation completed in ${(performance.now() - startInstall).toFixed(2)}ms`);
  } else {
    // Check if we're being prompted for reinstall
    console.log('Running pnpm install with auto-decline...');
    const startInstall = performance.now();
    
    const child = spawn('pnpm', ['install', '--prefer-frozen-lockfile', '--optimistic-repeat-install', '--prefer-offline'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
      
      // Check if it's asking about removing modules directory
      if (data.toString().includes('will be removed and reinstalled from scratch')) {
        console.log('\nDeclining reinstall prompt...');
        child.stdin.write('n\n');
      }
    });
    
    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
    
    await new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0 || output.includes('ERR_PNPM_ABORTED_REMOVE_MODULES_DIR')) {
          console.log(`pnpm install check completed in ${(performance.now() - startInstall).toFixed(2)}ms`);
          resolve(code);
        } else {
          reject(new Error(`pnpm install failed with code ${code}`));
        }
      });
    });
  }
  
  console.log(`Total time: ${(performance.now() - startTotal).toFixed(2)}ms`);
} catch (error) {
  console.error('Error during pnpm install:', error);
  process.exit(1);
}