/**
 Preserve original native prompt preparation and ownership boundaries.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { NativeBatchBuildError } from './build-entries.ts';
import { preparePromptInputs } from './prompt-input-source.ts';
import { preparePromptOwners } from './prompt-owner-source.ts';
import { preparePromptBase } from './prompt-base-source.ts';
import { preparePromptRun } from './prompt-run-source.ts';
export { promptEmitterSource } from './prompt-emitter-source.ts';

//region Qualified native source transformations retain original prompt and input owners

/**
 Native prompt preparation retains a separate diagnostic boundary.
 */
const l = tagged({ tag: 'auto-mode-native-prompt-source' });



/**
 Compose original input, resource, base, and run prompt ownership before native getter publication.

 @param source - qualified original native source before this preparation phase

 @returns source retaining original prompt and input ownership

 @throws NativeBatchBuildError when qualified original source boundaries change

 @example
 ```ts
 const generated = promptSessionSource(source);
 ```
 */
export function promptSessionSource(source: string): string {
 /**
  This transformation keeps its own source preparation diagnostic boundary.
  */
 const rl = tagged({
   tag: promptSessionSource.name,
   l
 });
 rl.debug('preparing original native prompt source');
 /**
  Input capture and private fields precede native prompt owner binding.
  */
 const ownedInputs=preparePromptInputs(source);
 /**
  Native resource, context, and lifetime owners precede base composition.
  */
 const ownedSources=preparePromptOwners(ownedInputs);
 /**
  Owned base construction and refresh precede native run preparation.
  */
 const baseComposition=preparePromptBase(ownedSources);
 /**
  Owned run preparation retains the original prompt getter publication.
  */
 const runComposition=preparePromptRun(baseComposition);
 return `${runComposition}\nnativePromptGetter = Object.getOwnPropertyDescriptor(AgentSession.prototype,"systemPrompt").get;\n`;
}

//endregion Qualified native source transformations retain original prompt and input owners
