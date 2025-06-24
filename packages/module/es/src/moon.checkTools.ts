import { execSync } from 'node:child_process';

/**
 * Tool version requirements and checks for the development environment
 */
const REQUIRED_TOOLS = [
  { name: 'moon', command: 'moon --version', minVersion: '1.37.0' },
  { name: 'node', command: 'node --version', minVersion: '20.0.0' },
  { name: 'pnpm', command: 'pnpm --version', minVersion: '9.0.0' },
  { name: 'bun', command: 'bun --version', minVersion: '1.1.0' },
  { name: 'git', command: 'git --version', minVersion: '2.0.0' },
] as const;

const OPTIONAL_TOOLS = [
  { name: 'vale', command: 'vale --version' },
  { name: 'dprint', command: 'dprint --version' },
  { name: 'oxlint', command: 'oxlint --version' },
] as const;

console.log('🔍 Checking development tools...\n');

let hasErrors = false;

// Check required tools
console.log('Required tools:');
for (const tool of REQUIRED_TOOLS) {
  try {
    const version = execSync(tool.command, { encoding: 'utf8' }).trim();
    console.log(`✅ ${tool.name}: ${version}`);
  } catch {
    console.error(`❌ ${tool.name}: NOT INSTALLED (required: ${tool.minVersion}+)`);
    hasErrors = true;
  }
}

console.log('\nOptional tools:');
// Check optional tools
for (const tool of OPTIONAL_TOOLS) {
  try {
    const version = execSync(tool.command, { encoding: 'utf8' }).trim();
    console.log(`✅ ${tool.name}: ${version}`);
  } catch {
    console.log(`⚠️  ${tool.name}: not installed (optional)`);
  }
}

// Check proto
console.log('\nProto tool manager:');
try {
  const protoVersion = execSync('proto --version', { encoding: 'utf8' }).trim();
  console.log(`✅ proto: ${protoVersion}`);
} catch {
  console.error('❌ proto: NOT INSTALLED');
  console.error('   Install with: bash <(curl -fsSL https://moonrepo.dev/install/proto.sh)');
  hasErrors = true;
}

// Check .prototools file
console.log('\nConfiguration files:');
try {
  execSync('test -f .prototools', { stdio: 'ignore' });
  console.log('✅ .prototools file exists');
} catch {
  console.error('❌ .prototools file missing');
  hasErrors = true;
}

// Check moon workspace
try {
  execSync('moon query projects --json', { stdio: 'ignore' });
  console.log('✅ Moon workspace configured');
} catch {
  console.error('❌ Moon workspace not properly configured');
  hasErrors = true;
}

if (hasErrors) {
  console.log('\n❌ Some required tools are missing!');
  console.log('Run: moon run prepareAndBuild');
  process.exit(1);
} else {
  console.log('\n✨ All required tools are installed!');
}