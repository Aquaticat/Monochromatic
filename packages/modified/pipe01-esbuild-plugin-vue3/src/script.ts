import { compileScript } from 'vue/compiler-sfc';
import {
  getDesCache,
  getId,
} from './cache.ts';
import type { Options } from './index.ts';
import { getTemplateOptions } from './template.ts';

export function resolveScript(
  filename: string,
  templateOptions: Options['templateOptions'] = {},
) {
  const descriptor = getDesCache(filename);

  const scopeId = getId(filename);

  const res = compileScript(descriptor, {
    id: scopeId,
    inlineTemplate: true,
    templateOptions: descriptor.template ? getTemplateOptions(descriptor, templateOptions) : {},
  });

  return res.content;
}
