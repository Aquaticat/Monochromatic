import { execSync } from 'node:child_process';

/**
 * Validates that pnpm dependencies are properly installed
 */
console.log('🔍 Checking dependencies...\n');

try {
  // Run pnpm ls to check dependencies
  execSync('pnpm ls --depth 0', { 
    encoding: 'utf8',
    stdio: 'inherit' // Show the full output
  });
  
  console.log('\n✅ Dependencies installed');
} catch (error) {
  console.error('\n❌ Dependencies check failed');
  console.error('Run: pnpm install');
  process.exit(1);
}