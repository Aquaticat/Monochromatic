/**
 Prepare original native program modules after capturing their complete source inputs.

 @module
 */
import {
  readFile,
  writeFile
} from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { parse } from 'yuku-parser';
import { sdk } from '../current-sdk/paths.ts';
import { helperUrl } from './build-rebase.ts';
import {
  readStagedInput,
  replaceStagedImport
} from './staged-import.ts';
import {
  programExecutorSource,
  programDefinitionSource,
  nativeScriptValueSource,
} from './program-source.ts';
import type { NativePreparationInput } from './prepare-types.ts';

//region Native program preparation retains original dispatcher, judgment, and result identities

/**
 Program preparation keeps diagnostics separate from native runtime judgments.
 */
const l = tagged({ tag: 'auto-mode-native-prepare-program' });

/**
 Prepare original native program execution and judgment modules before publishing generated files.

 @param output - directory receiving generated modules from this build occurrence

 @param imports - qualified import selector retaining original module locations

 @throws NativeBatchBuildError when original source or staged import qualification changes

 @example
 ```ts
 await prepareProgram({ output, imports });
 ```
 */
export async function prepareProgram({
  output,
  imports
}: Pick<NativePreparationInput, 'output' | 'imports'>): Promise<void> {
  /**
   This asynchronous phase retains its original source preparation diagnostic boundary.
   */
  const rl = tagged({
    tag: prepareProgram.name,
    l
  });
  rl.debug('reading original native program execution and judgment sources');
  /**
   The installed executor owns original sandbox and result conversion behavior.
   */
  const executorPath = join(
    sdk,
    'dist/extensions/codemode/execute.js'
  );
  /**
   The maintained original runner retains declared program and nested group ownership.
   */
  const programRunnerUrl = new URL(
    '../../collector/program-rule-batch-sdk-copy-v2/input/program-runner.mjs',
    import.meta.url
  );
  /**
   Native result consumption retains its original conversion dependency occurrence.
   */
  const returnConsumerUrl = new URL(
    '../../collector/program-rule-batch-sdk-copy-v2/input/native-return-consumer.ts',
    import.meta.url
  );
  /**
   Dispatcher error identities remain attached to this original module URL.
   */
  const dispatcherUrl = new URL(
    '../../collector/program-rule-batch-sdk-copy-v2/input/prepared-dispatch.mjs',
    import.meta.url
  );
  /**
   The original child judgment retains its request, budget, and dependency owners.
   */
  const judgmentUrl = new URL(
    '../../collector/program-rule-batch-sdk-copy-v2/input/child-constructor.mjs',
    import.meta.url
  );
  /**
   Every finite source read completes before generated modules are written.
   */
  const [executorSource, originalReturnConsumer] = await Promise.all([
    readFile(
      executorPath,
      'utf8'
    ),
    readStagedInput(returnConsumerUrl),
  ]);
  /**
   The executor retains installed dependency identity after declared group routing is connected.
   */
  const executor = imports({
    source: programExecutorSource(executorSource),
    path: executorPath
  });
  /**
   Native conversion functions are extracted from this same original executor source.
   */
  const scriptValue = nativeScriptValueSource({
    source: executorSource,
    parse
  });
  /**
   The definition closure retains original factory identity and the generated executor URL.
   */
  const definition = programDefinitionSource({
    nativeToolUrl: pathToFileURL(join(
      sdk,
      'dist/extensions/codemode/tool.js'
    ))
      .href,
    executorUrl: pathToFileURL(join(
      output,
      'program-executor.mjs'
    ))
      .href,
  });
  /**
   Original request tool snapshots supply every reached native group.
   */
  const programRunner = `export {createReachedRunnerClass} from ${JSON.stringify(programRunnerUrl.href)};\n`;
  /**
   The original native runner and recorder remain shared with the declared group dispatcher.
   */
  const runnerShim = `import {NestedToolCallRunner as NativeRunner,NestedCallRecorder} from ${
     JSON.stringify(pathToFileURL(join(
       sdk,
       'dist/core/nested-tool-calls.js'
     ))
       .href)
     };\n`
    + `import {createReachedRunnerClass} from "./program-runner.mjs";\n`
    + `import {dispatchPreparedBatch} from ${
     helperUrl('../../collector/result-program-sdk-copy-guarded/input/child-prepared-dispatch.mjs')
     };\n`
    + `export const NestedToolCallRunner=createReachedRunnerClass({NestedToolCallRunner:NativeRunner,NestedCallRecorder,dispatchPreparedBatch});\n`;
  /**
   Only the qualified original conversion import selects the generated native conversion module.
   */
  const returnConsumer = await replaceStagedImport({
    source: originalReturnConsumer,
    binding: 'convertNativeOutcome',
    expected: new URL(
      '../../collector/program-rule-batch-sdk-copy-v2/input/native-script-value.mjs',
      import.meta.url
    ),
    replacement: pathToFileURL(join(
      output,
      'native-script-value.mjs'
    ))
      .href,
  });
  /**
   Prepared dispatcher exports retain their original error classes and group mode.
   */
  const dispatcher = `export {dispatchPreparedBatch,PreparedBatchContractError,PreparedBatchExecutionError} from ${JSON.stringify(dispatcherUrl.href)};\n`;
  /**
   The maintained judgment already contains its native source and program bindings.
   */
  const judgment = `export {createJudgmentConstructor,JudgmentConstructionError} from ${JSON.stringify(judgmentUrl.href)};\n`;
  rl.debug('writing qualified original native program modules');
  await Promise.all([
    writeFile(
      join(
        output,
        'program-executor.mjs'
      ),
      executor,
      { mode: 0o600 }
    ),
    writeFile(
      join(
        output,
        'native-script-value.mjs'
      ),
      scriptValue,
      { mode: 0o600 }
    ),
    writeFile(
      join(
        output,
        'program-definition.mjs'
      ),
      definition,
      { mode: 0o600 }
    ),
    writeFile(
      join(
        output,
        'program-runner.mjs'
      ),
      programRunner,
      { mode: 0o600 }
    ),
    writeFile(
      join(
        output,
        'program-native-runner.mjs'
      ),
      runnerShim,
      { mode: 0o600 }
    ),
    writeFile(
      join(
        output,
        'native-return-consumer.mjs'
      ),
      returnConsumer,
      { mode: 0o600 }
    ),
    writeFile(
      join(
        output,
        'prepared-dispatch.mjs'
      ),
      dispatcher,
      { mode: 0o600 }
    ),
    writeFile(
      join(
        output,
        'judgment.mjs'
      ),
      judgment,
      { mode: 0o600 }
    ),
  ]);
}

//endregion Native program preparation retains original dispatcher, judgment, and result identities
