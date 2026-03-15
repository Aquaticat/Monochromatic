import { outdent, } from '@cspotcode/outdent';
import spawn from 'nano-spawn';

/**
 * Validates that pnpm dependencies are properly installed
 */
console.log('🔍 Checking dependencies...\n',);

try {
  // Run pnpm ls to check dependencies
  await spawn('pnpm', ['ls', '--depth', '0',], {
    stdio: 'inherit', // Show the full output
  },);

  console.log('\n✅ Dependencies installed',);
}
catch (error) {
  throw new Error(outdent`
    ❌ Dependencies check failed
    Run: pnpm install
  `, { cause: error, },);
}
