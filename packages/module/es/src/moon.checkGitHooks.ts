import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Validates that git hooks are properly installed
 */
console.log('🔍 Checking git hooks...\n');

const gitHooksPath = join(process.cwd(), '.git', 'hooks');
const requiredHooks = ['pre-commit'];
const optionalHooks = ['commit-msg', 'pre-push'];

let hasRequiredHooks = true;

// Check required hooks
console.log('Required hooks:');
for (const hook of requiredHooks) {
  const hookPath = join(gitHooksPath, hook);
  if (existsSync(hookPath)) {
    console.log(`✅ ${hook} hook installed`);
  } else {
    console.error(`❌ ${hook} hook missing`);
    hasRequiredHooks = false;
  }
}

// Check optional hooks
console.log('\nOptional hooks:');
for (const hook of optionalHooks) {
  const hookPath = join(gitHooksPath, hook);
  if (existsSync(hookPath)) {
    console.log(`✅ ${hook} hook installed`);
  } else {
    console.log(`⚠️  ${hook} hook not installed (optional)`);
  }
}

if (!hasRequiredHooks) {
  console.log('\n❌ Required git hooks missing!');
  console.log('Run: moon run installHooks');
  console.log('Or: moon sync hooks');
  process.exit(1);
} else {
  console.log('\n✨ Git hooks properly configured!');
}