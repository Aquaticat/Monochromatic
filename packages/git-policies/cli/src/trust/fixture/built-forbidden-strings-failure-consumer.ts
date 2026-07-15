/**
 * Packed forbidden-strings failure and severity scenarios.
 *
 * @module
 */
import { writeFile, } from 'node:fs/promises';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';
import {
  assertForbiddenPluginThrew,
  FINDING_CODE,
  initializeForbiddenRepository,
} from './built-forbidden-strings-helpers.ts';

/**
 * One scanner infrastructure scenario.
 */
type FailureScenario = Readonly<{
  /**
   * Input marker interpreted by fake scanner.
   */
  marker: string;
  /**
   * Assertion context.
   */
  context: string;
  /**
   * Disposable repository path.
   */
  repository: string;
}>;

/**
 * Exercises one scanner infrastructure failure.
 *
 * @param scenario - isolated failure fixture
 *
 * @param env - packed wrapper environment
 */
async function verifyFailure({
  scenario,
  env,
}: Readonly<{
  scenario: FailureScenario;
  env: NodeJS.ProcessEnv;
}>): Promise<void> {
  /**
   * Selected failure fixture fields.
   */
  const {
    repository,
    marker,
    context,
  } = scenario;
  await initializeForbiddenRepository({
    repository,
    env,
  },);
  await writeFile(
    `${repository}/failure.txt`,
    `${marker}\n`,
  );
  /**
   * Plugin infrastructure result.
   */
  const result = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--policy',
      'security/forbidden-strings',
      '--',
      'failure.txt',
    ],
    expectedExit: 2,
    cwd: repository,
    env,
  },);
  assertForbiddenPluginThrew({
    result,
    context,
  },);
}

/**
 * Exercises scanner failure classification and warn-unsafe metadata.
 *
 * @param env - packed wrapper environment
 *
 * @example
 * ```ts
 * await verifyForbiddenFailuresAndSeverity(process.env);
 * ```
 */
export async function verifyForbiddenFailuresAndSeverity(env: NodeJS.ProcessEnv,): Promise<void> {
  /**
   * Independent scanner failure fixtures.
   */
  const failureScenarios: readonly FailureScenario[] = [
    {
      marker: 'MALFORMED_SCANNER',
      context: 'malformed scanner output',
      repository: '/work/forbidden-malformed',
    },
    {
      marker: 'READ_ERROR_SCANNER',
      context: 'plugin-owned read failure',
      repository: '/work/forbidden-read-error',
    },
    {
      marker: 'STATUS_TWO',
      context: 'scanner infrastructure status',
      repository: '/work/forbidden-status',
    },
    {
      marker: 'SIGNAL_SCANNER',
      context: 'scanner interruption',
      repository: '/work/forbidden-signal',
    },
  ];
  await Promise.all(failureScenarios.map(async function verifyScenario(scenario,): Promise<void> {
    await verifyFailure({
      scenario,
      env,
    },);
  },),);

  /**
   * Repository with missing configured scanner.
   */
  const missingRepository = '/work/forbidden-missing';
  await initializeForbiddenRepository({
    repository: missingRepository,
    env,
    executable: '/work/missing-forbidden-strings',
  },);
  await writeFile(
    `${missingRepository}/candidate.txt`,
    'clean\n',
  );
  /**
   * Missing executable result.
   */
  const missing = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--policy',
      'security/forbidden-strings',
      '--',
      'candidate.txt',
    ],
    expectedExit: 2,
    cwd: missingRepository,
    env,
  },);
  assertForbiddenPluginThrew({
    result: missing,
    context: 'missing scanner',
  },);

  /**
   * Repository with warn-unsafe scanner policy.
   */
  const warnRepository = '/work/forbidden-warn';
  await initializeForbiddenRepository({
    repository: warnRepository,
    env,
    severity: 'warn',
  },);
  await writeFile(
    `${warnRepository}/candidate.txt`,
    'FORBIDDEN_SCANNER\n',
  );
  /**
   * Non-blocking warn result.
   */
  const warning = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--policy',
      'security/forbidden-strings',
      '--',
      'candidate.txt',
    ],
    cwd: warnRepository,
    env,
  },);
  assertIncludes({
    text: warning.stdout,
    expected: FINDING_CODE,
    context: 'warn finding',
  },);
  assertIncludes({
    text: warning.stdout,
    expected: 'warn-unsafe',
    context: 'warn-unsafe metadata',
  },);
}
