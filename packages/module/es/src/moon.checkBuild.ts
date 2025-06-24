import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Validates that build artifacts exist
 */
console.log('🔍 Checking build artifacts...\n');

// Check for common build output directories
const buildChecks = [
  { path: 'packages/module/es/dist', name: 'module-es build artifacts' },
  { path: 'packages/config/eslint/dist', name: 'eslint config build' },
  { path: 'packages/config/vite/dist', name: 'vite config build' },
  // Note: typescript config package has no build artifacts (just config files)
];

let hasErrors = false;

for (const check of buildChecks) {
  const fullPath = join(process.cwd(), check.path);
  if (existsSync(fullPath)) {
    console.log(`✅ ${check.name} exist`);
  } else {
    console.error(`❌ ${check.name} missing`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.log('\n❌ Build artifacts missing!');
  console.log('Run: moon run build');
  process.exit(1);
} else {
  console.log('\n✨ All build artifacts exist!');
}