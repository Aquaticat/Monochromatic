/**
 Preserve original native prompt-base preparation and ownership boundaries.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { replaceOnce } from './build-rebase.ts';
import { NativeBatchBuildError } from './build-entries.ts';
import { privatizeNativeMembers } from './build-members.ts';

//region Qualified native source transformations retain original prompt and input owners

/**
 Native prompt-base preparation retains a separate diagnostic boundary.
 */
const l = tagged({ tag: 'auto-mode-native-prompt-base-source' });

/**
 Retain original resource reads and native refresh composition inside their prompt owners.

 @param source - qualified original native source before this preparation phase

 @returns source retaining original prompt and input ownership

 @throws NativeBatchBuildError when qualified original source boundaries change

 @example
 ```ts
 const generated = preparePromptBase(source);
 ```
 */
export function preparePromptBase(source: string): string {
 /**
  This transformation keeps its own source preparation diagnostic boundary.
  */
 const rl = tagged({ tag: preparePromptBase.name, l });
 rl.debug('preparing original native prompt source');
 /**
  Ordered transformations preserve the original native construction and handler sequence.
  */
 let value=source;
 /**
  The qualified rebuild declaration begins the original base prompt construction.
  */
 const marker='    _rebuildSystemPrompt(toolNames) {';
   /**
  The original rebuild declaration locates the replacement boundary.
  */
 const start=value.indexOf(marker);
   /**
  The next native declaration ends the original rebuild block.
  */
 const end=value.indexOf(
   '\n    /**',
   start
 );
 if (start === -1 || end <= start) throw new NativeBatchBuildError('Original native base prompt rebuild boundary is unavailable');
 /**
  The original rebuild body retains resource reads and option normalization.
  */
 const block=value.slice(
   start,
   end
 );
   /**
  The qualified normalization assignment identifies its original input expression.
  */
 const assignment='        this.#baseSystemPromptOptions = normalizeBuildSystemPromptOptions(';
   /**
  The original assignment separates resource reads from normalized input.
  */
 const split=block.indexOf(assignment);
 if (split <= 0) throw new NativeBatchBuildError('Original native base prompt normalization is unavailable');
 /**
  Original resource reads remain inside the owned composition callback.
  */
 const prefix=block.slice(
   marker.length+1,
   split
 );
 /**
  The original normalization tail contains its input and closing method boundary.
  */
 const tail=block.slice(split+assignment.length);
 if (!tail.endsWith(');\n    }')) throw new NativeBatchBuildError('Original native base prompt normalization tail changed');
 /**
  Original input handling retains the same normalization and native dispatch behavior.
  */
 const input=tail.slice(
   0,
   -');\n    }'.length
 );
 value=`${value.slice(
   0,
   start
 )}    _rebuildSystemPrompt(toolNames) { return this.#rebuildSystemPrompt(toolNames); }
    #rebuildSystemPrompt(toolNames) {
        this.#baseSystemPromptOptions = this.#basePromptOwner.build({
            binding:this.#resourceInputBinding,loader:this.#resourceLoader,normalize:normalizeBuildSystemPromptOptions,
            read:()=>{
${
   prefix
   }        const input = ${
   input
   };
        return {input,resources:{contextFiles:loadedContextFiles,systemPrompt:loaderSystemPrompt,appendSystemPrompt:loaderAppendSystemPrompt}};
            }
        });
    }${
   value.slice(end)}`;
 value=privatizeNativeMembers({source:value,members:['_rebuildSystemPrompt'],renames:{_rebuildSystemPrompt:'rebuildSystemPrompt'}});
 value=replaceOnce({
   source:value,
   from:'getSystemPromptOptions: () => this.#baseSystemPromptOptions,',
   to:'getSystemPromptOptions: () => copyPromptOptions(this.#baseSystemPromptOptions),'
 });
 value=replaceOnce({
   source:value,
   from:'            this.#runSystemPromptOptions = undefined;',
   to:'            this.#runSystemPromptOptions = undefined;\n            this.#runPromptOwner.reset();'
 });
 /**
  The original refresh options declaration begins the native tool update block.
  */
 const refreshStart=value.indexOf('            const runOptions = this.#runSystemPromptOptions ?? this.#baseSystemPromptOptions;');
 /**
  The original result construction ends the native tool update block.
  */
 const refreshEnd=value.indexOf(
   '            return {',
   refreshStart
 );
 if (refreshStart === -1 || refreshEnd <= refreshStart) throw new NativeBatchBuildError('Original native run prompt refresh boundary is unavailable');
 /**
  Original refresh statements retain native tool metadata and update construction.
  */
 const originalRefresh=value.slice(
   refreshStart,
   refreshEnd
 );
 /**
  Refresh option selection moves inside the retained run composition owner.
  */
 const selectedRefresh=replaceOnce({
   source:originalRefresh,
   from:'const runOptions = this.#runSystemPromptOptions ?? this.#baseSystemPromptOptions;',
   to:'const runOptions = previous ?? base;'
 });
 /**
  Original tool metadata reads use the retained base prompt composition.
  */
 const metadataRefresh=selectedRefresh.replaceAll(
   'this.#baseSystemPromptOptions.toolSnippets',
   'base.toolSnippets'
 )
   .replaceAll(
     'this.#baseSystemPromptOptions.toolGuidelines',
     'base.toolGuidelines'
   );
 /**
  The generated update message remains available after the composition callback.
  */
 const messageRefresh=replaceOnce({
   source:metadataRefresh,
   from:'            const updateMessage =',
   to:'            updateMessage ='
 });
 /**
  The original normalized options become the owned refresh result.
  */
 const returnedRefresh=replaceOnce({
   source:messageRefresh,
   from:'            this.#runSystemPromptOptions = options;',
   to:'            return options;'
 });
 value=`${value.slice(
   0,
   refreshStart
 )}            let updateMessage;\n            this.#runSystemPromptOptions = this.#runPromptOwner.refresh({previousOptions:this.#runSystemPromptOptions,compose:({previous,base})=>{\n${returnedRefresh}            }});\n${value.slice(refreshEnd)}`;
 return value;
}

//endregion Qualified native source transformations retain original prompt and input owners
