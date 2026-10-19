/**
 Emit relocatable native declarations from the incumbent bundled type entry.

 @module
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tagged } from '@monochromatic-dev/module-logger/ts';

//region Built facades reference the closed policy bundle instead of copied source paths.

/**
 Native declaration generation has its own diagnostic module boundary.
 */
const log = tagged({ tag: 'auto-mode-native-build-types' });

/**
 Bind built module declarations to their source owners through the generated declaration bundle.

 @param output - private release directory before activation

 @example
 ```ts
 await writeNativeDeclarations(privateRelease);
 ```
 */
export async function writeNativeDeclarations(output: string): Promise<void> {
  /**
   Generation retains a separate function tag.
   */
  const l = tagged({ tag: writeNativeDeclarations.name, l: log });
  l.debug('writing relocatable native fixture declarations');
  /**
   Every emitted facade lives beside its runtime implementation.
   */
  const directory = join(output, 'contract/integration/native-batch');
  /**
   Finite owned module names, constructor aliases and public type exports define the emission boundary.
   */
  const declarations = [
    ['environment', 'NativeEnvironmentFactory', 'createEnvironment',
      "export type { NativeBatchEnvironment, NativeBatchEnvironmentInput, NativeBatchEnvironmentOptions } from '../../../policy/native-artifact-types.mjs';\n"],
    ['domain-fixture-assessment', 'NativeAssessmentFactory', 'createDomainFixtureAssessment',
      "export type { DomainFixtureAssessmentSender, DomainFixtureAssessmentSettings, DomainFixtureAssessmentObservations } from '../../../policy/native-artifact-types.mjs';\n"],
    ['runtime', 'NativeRuntimeFactory', 'bindNativePolicyRuntime',
      "export { NativePolicyRuntimeError } from '../maintained-policy.mjs';\n"],
    ['session-root', 'NativeSessionFactory', 'createRootSessionFactory', ''],
  ] as const;
  await Promise.all(declarations.map(async function writeDeclaration([moduleName, factoryType, exportName, additionalExports]) {
    await writeFile(join(directory, `${moduleName}.d.mts`),
      `import type { ${factoryType} } from '../../../policy/native-artifact-types.mjs';\n`
      + `export declare const ${exportName}: ${factoryType};\n`
      + additionalExports);
  }));
  await writeFile(join(output, 'contract/integration/maintained-policy.d.mts'),
    "export * from '../../policy/native-policy.mjs';\n"
    + 'export declare const maintainedPolicyEntry: string;\n'
    + 'export declare const maintainedPackageRoot: string;\n');
  l.debug('native fixture declarations written');
}

//endregion
