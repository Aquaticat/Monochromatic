import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sdk} from '../current-sdk/paths.ts';
import {parse} from '../../collector/program-rule-batch-sdk-copy-v2/input/parser.mjs';
import {helperUrl} from './build-rebase.ts';
import {readStagedInput,replaceStagedImport} from './staged-import.ts';
import {judgmentSource} from './judgment-source.ts';
import {preparedDispatcherSource,programJudgmentSource,programExecutorSource,programRunnerSource,programDefinitionSource,nativeScriptValueSource} from './program-source.ts';

/** Prepare the original native prepareProgram modules with qualified source edits. */
export async function prepareProgram({output,imports}) {
  const executorPath=join(
    sdk,
    'dist/extensions/codemode/execute.js'
  ),executorSource=await readFile(
    executorPath,
    'utf8'
  );
  const executor=imports({
    source:programExecutorSource(executorSource),
    path:executorPath
  });
  await writeFile(
    join(output,'program-executor.mjs'),
    executor,
    {mode:0o600}
  );
  await writeFile(
    join(output,'native-script-value.mjs'),
    nativeScriptValueSource({source:executorSource,parse}),
    {mode:0o600}
  );
  await writeFile(
    join(output,'program-definition.mjs'),
    programDefinitionSource({nativeToolUrl:pathToFileURL(join(sdk,'dist/extensions/codemode/tool.js')).href,executorUrl:pathToFileURL(join(output,'program-executor.mjs')).href}),
    {mode:0o600}
  );
  const programRunner=programRunnerSource(
    await readStagedInput(new URL("../../collector/program-rule-batch-sdk-copy-v2/input/program-runner.mjs",import.meta.url)),
  );
  await writeFile(
    join(output,'program-runner.mjs'),
    programRunner,
    {mode:0o600}
  );
  const runnerShim='import {NestedToolCallRunner as NativeRunner,NestedCallRecorder} from '+JSON.stringify(pathToFileURL(join(sdk,'dist/core/nested-tool-calls.js')).href)
    +';\n'
    +'import {createReachedRunnerClass} from "./program-runner.mjs";\n'
    +'import {dispatchPreparedBatch} from '
    +helperUrl("../../collector/result-program-sdk-copy-guarded/input/child-prepared-dispatch.mjs")
    +';\n'
    +'export const NestedToolCallRunner=createReachedRunnerClass({NestedToolCallRunner:NativeRunner,NestedCallRecorder,dispatchPreparedBatch});\n';
  await writeFile(
    join(output,'program-native-runner.mjs'),
    runnerShim,
    {mode:0o600}
  );
  const returnConsumer=await replaceStagedImport({
    source:await readStagedInput(new URL("../../collector/program-rule-batch-sdk-copy-v2/input/native-return-consumer.mjs",import.meta.url)),
    binding:'toScriptValue',
    expected:new URL("../../collector/program-rule-batch-sdk-copy-v2/input/native-script-value.mjs",import.meta.url),
    replacement:pathToFileURL(join(output,'native-script-value.mjs')).href
  });
  await writeFile(
    join(output,'native-return-consumer.mjs'),
    returnConsumer,
    {mode:0o600}
  );
  const dispatcherUrl=new URL(
    "../../collector/program-rule-batch-sdk-copy-v2/input/prepared-dispatch.mjs",
    import.meta.url
  );
  await writeFile(
    join(output,'prepared-dispatch.mjs'),
    preparedDispatcherSource({source:await readStagedInput(dispatcherUrl),originalUrl:dispatcherUrl.href}),
    {mode:0o600}
  );
  const originalJudgment=await replaceStagedImport({
    source:await readStagedInput(new URL("../../collector/program-rule-batch-sdk-copy-v2/input/child-constructor.mjs",import.meta.url)),
    binding:'createNativeReturnConsumer',
    expected:new URL("../../collector/program-rule-batch-sdk-copy-v2/input/native-return-consumer.mjs",import.meta.url),
    replacement:pathToFileURL(join(output,'native-return-consumer.mjs')).href
  });
  const judgment=programJudgmentSource(judgmentSource({
    source:originalJudgment,
    indexUrl:new URL('../../lifecycle/governing-rule-candidates/set.mjs',import.meta.url).href
  }));
  await writeFile(
    join(output,'judgment.mjs'),
    judgment,
    {mode:0o600}
  );
}
