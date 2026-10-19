/**
 Emit relocatable native declarations from the incumbent bundled type entry.

 @module
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tagged } from '@monochromatic-dev/module-logger/ts';

//region Built facades reference the closed policy bundle instead of copied source paths.

/** Native declaration generation has its own diagnostic module boundary. */
const log = tagged({ tag: 'auto-mode-native-build-types' });

/**
 Bind built module declarations to their source owners through the generated declaration bundle.

 @param output - private release directory before activation

 @returns completion after every declaration has been written
 */
export async function writeNativeDeclarations(output: string): Promise<void> {
  const l = tagged({ tag: writeNativeDeclarations.name, l: log });
  l.debug('writing relocatable native fixture declarations');
  const directory = join(output, 'contract/integration/native-batch');
  const declarations = [
    ['environment', 'NativeEnvironmentFactory', 'createEnvironment'],
    ['domain-fixture-assessment', 'NativeAssessmentFactory', 'createDomainFixtureAssessment'],
    ['runtime', 'NativeRuntimeFactory', 'bindNativePolicyRuntime'],
    ['session-root', 'NativeSessionFactory', 'createRootSessionFactory'],
  ] as const;
  for (const [moduleName, factoryType, exportName] of declarations) {
    await writeFile(join(directory, `${moduleName}.d.mts`),
      `import type { ${factoryType} } from '../../../policy/native-fixture-types.mjs';\n`
      + `export declare const ${exportName}: ${factoryType};\n`);
  }
  await writeFile(join(output, 'contract/integration/maintained-policy.d.mts'),
    "export * from '../../policy/native-policy.mjs';\n"
    + 'export declare const maintainedPolicyEntry: string;\n'
    + 'export declare const maintainedPackageRoot: string;\n');
  await writeFile(join(directory, 'domain-fixture-assessment.d.mts'),
    "import type { NativeAssessmentFactory } from '../../../policy/native-fixture-types.mjs';\n"
    + 'export declare const createDomainFixtureAssessment: NativeAssessmentFactory;\n'
    + "export type { DomainFixtureAssessmentSender } from '../../../policy/native-fixture-types.mjs';\n");
  l.debug('native fixture declarations written');
}

//endregion
