import { outdent, } from '@cspotcode/outdent';
import { existsSync, } from 'node:fs';
import { join, } from 'node:path';
import { match, } from 'ts-pattern';

/**
 * Validates that git hooks are properly installed
 */
console.log('🔍 Checking git hooks...\n',);

const gitHooksPath = join(process.cwd(), '.git', 'hooks',);
const requiredHooks = ['pre-commit',];
const optionalHooks = ['commit-msg', 'pre-push',];

// Check required hooks
console.log('Required hooks:',);
const requiredHookResults = requiredHooks.map(hook => {
  const hookPath = join(gitHooksPath, hook,);
  const exists = existsSync(hookPath,);

  match(exists,)
    .with(true, () =>{  console.log(`✅ ${hook} hook installed`,); },)
    .with(false, () =>{  console.error(`❌ ${hook} hook missing`,); },)
    .exhaustive();

  return exists;
},);

// Check optional hooks
console.log('\nOptional hooks:',);
optionalHooks.forEach(hook => {
  const hookPath = join(gitHooksPath, hook,);
  const exists = existsSync(hookPath,);

  match(exists,)
    .with(true, () =>{  console.log(`✅ ${hook} hook installed`,); },)
    .with(false, () =>{  console.log(`⚠️  ${hook} hook not installed (optional)`,); },)
    .exhaustive();
},);

const hasAllRequiredHooks = requiredHookResults.every(Boolean,);

match(hasAllRequiredHooks,)
  .with(true, () =>{  console.log('\n✨ Git hooks properly configured!',); },)
  .with(false, () => {
    throw new Error(outdent`
      ❌ Required git hooks missing!
      Run: mise run installHooks
      Or: moon sync hooks
    `,);
  },)
  .exhaustive();
