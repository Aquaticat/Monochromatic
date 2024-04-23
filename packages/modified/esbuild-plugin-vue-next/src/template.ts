import {
  compileTemplate,
  type SFCDescriptor,
  type SFCTemplateCompileOptions,
} from 'vue/compiler-sfc';
import {
  getDesCache,
  getId,
} from './cache.ts';
import type { Options } from './index.ts';

export function resolveTemplate(filename: string, options: Options['templateOptions'] = {}) {
  const descriptor = getDesCache(filename);

  return compileTemplate(getTemplateOptions(descriptor, options)).code;
}

export function getTemplateOptions(
  descriptor: SFCDescriptor,
  options: Options['templateOptions'],
): SFCTemplateCompileOptions {
  const filename = descriptor.filename;
  const scopeId = getId(filename);
  return {
    source: descriptor.template!.content,
    filename,
    id: scopeId,
    compilerOptions: {
      ...options?.compilerOptions,
      scopeId,
    },
  };
}
