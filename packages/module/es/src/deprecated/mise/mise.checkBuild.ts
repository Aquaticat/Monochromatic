import { outdent, } from '@cspotcode/outdent';
import { existsSync, } from 'node:fs';
import { join, } from 'node:path';
import { match, } from 'ts-pattern';

/**
 * Validates that build artifacts exist
 */
console.log('🔍 Checking build artifacts...\n',);

// Check for common build output directories
const buildChecks = [
  { path: 'packages/module/es/dist', name: 'module-es build artifacts', },
  { path: 'packages/config/eslint/dist', name: 'eslint config build', },
  { path: 'packages/config/vite-deprecated/dist', name: 'vite config build', },
  // Note: typescript config package has no build artifacts (just config files)
];

const checkResults = buildChecks.map(check => {
  const fullPath = join(process.cwd(), check.path,);
  const exists = existsSync(fullPath,);

  match(exists,)
    .with(true, () => {
      console.log(`✅ ${check.name} exist`,);
    },)
    .with(false, () => {
      console.error(`❌ ${check.name} missing`,);
    },)
    .exhaustive();

  return { check, exists, };
},);

const missingArtifacts = checkResults.filter(result => !result.exists);

match(missingArtifacts.length,)
  .with(0, () => {
    console.log('\n✨ All build artifacts exist!',);
  },)
  .otherwise(() => {
    throw new Error(outdent`
      ❌ Build artifacts missing!
      Run: mise run build
    `,);
  },);
