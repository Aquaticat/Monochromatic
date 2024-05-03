import {
  Extractor,
  ExtractorConfig,
  type ExtractorResult,
} from '@microsoft/api-extractor';
import c from '@monochromatic.dev/module-console';
import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import { $ } from 'zx';
import type { State } from './state.ts';

export default async function dts(): Promise<State> {
  try {
    await fs.access(path.join('api-extractor.json'));
  } catch {
    return ['SKIP', `skipping dts, api-extractor.json doesn't exist.`];
  }

  c.log('vue-tsc');
  await $`vue-tsc`.pipe(process.stdout);

  c.log('api-extractor');

  const extractorConfig: ExtractorConfig = ExtractorConfig.loadFileAndPrepare('api-extractor.json');

  const extractorResult: ExtractorResult = Extractor.invoke(extractorConfig, {
    localBuild: true,
  });
  if (!extractorResult.succeeded) {
    throw new Error(`api-extractor failed with ${extractorResult}`);
  }

  return 'SUCCESS';
}
