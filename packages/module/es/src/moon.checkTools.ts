import { outdent } from '@cspotcode/outdent';
import spawn from 'nano-spawn';
import { existsSync } from 'node:fs';
import { match } from 'ts-pattern';

/**
 * Tool version requirements and checks for the development environment
 */
const REQUIRED_TOOLS = [
  { name: 'moon', args: ['--version'], minVersion: '1.37.0' },
  { name: 'node', args: ['--version'], minVersion: '20.0.0' },
  { name: 'pnpm', args: ['--version'], minVersion: '9.0.0' },
  { name: 'bun', args: ['--version'], minVersion: '1.1.0' },
  { name: 'git', args: ['--version'], minVersion: '2.0.0' },
] as const;

const OPTIONAL_TOOLS = [
  { name: 'vale', args: ['--version'] },
  { name: 'dprint', args: ['--version'] },
  { name: 'oxlint', args: ['--version'] },
] as const;

console.log('🔍 Checking development tools...\n');

// Check required tools
console.log('Required tools:');
const requiredToolResults = await Promise.all(
  REQUIRED_TOOLS.map(async (tool) => {
    try {
      const { stdout } = await spawn(tool.name, tool.args);
      const version = stdout.trim();
      console.log(`✅ ${tool.name}: ${version}`);
      return { tool, success: true };
    } catch {
      console.error(`❌ ${tool.name}: NOT INSTALLED (required: ${tool.minVersion}+)`);
      return { tool, success: false };
    }
  })
);

console.log('\nOptional tools:');
// Check optional tools
await Promise.all(
  OPTIONAL_TOOLS.map(async (tool) => {
    try {
      const { stdout } = await spawn(tool.name, tool.args);
      const version = stdout.trim();
      console.log(`✅ ${tool.name}: ${version}`);
    } catch {
      console.log(`⚠️  ${tool.name}: not installed (optional)`);
    }
  })
);

// Check proto
console.log('\nProto tool manager:');
const protoCheck = await (async () => {
  try {
    const { stdout } = await spawn('proto', ['--version']);
    const protoVersion = stdout.trim();
    console.log(`✅ proto: ${protoVersion}`);
    return true;
  } catch {
    console.error('❌ proto: NOT INSTALLED');
    console.error('   Install with: bash <(curl -fsSL https://moonrepo.dev/install/proto.sh)');
    return false;
  }
})();

// Check .prototools file
console.log('\nConfiguration files:');
const prototoolsExists = existsSync('.prototools');
match(prototoolsExists)
  .with(true, () => console.log('✅ .prototools file exists'))
  .with(false, () => console.error('❌ .prototools file missing'))
  .exhaustive();

// Check moon workspace
const moonWorkspaceCheck = await (async () => {
  try {
    await spawn('moon', ['query', 'projects', '--json'], { stdio: 'ignore' });
    console.log('✅ Moon workspace configured');
    return true;
  } catch {
    console.error('❌ Moon workspace not properly configured');
    return false;
  }
})();

const hasErrors = 
  requiredToolResults.some((result) => !result.success) ||
  !protoCheck ||
  !prototoolsExists ||
  !moonWorkspaceCheck;

match(hasErrors)
  .with(false, () => console.log('\n✨ All required tools are installed!'))
  .with(true, () => {
    throw new Error(outdent`
      ❌ Some required tools are missing!
      Run: moon run prepareAndBuild
    `);
  })
  .exhaustive();