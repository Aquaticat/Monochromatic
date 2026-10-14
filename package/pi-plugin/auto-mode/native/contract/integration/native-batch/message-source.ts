/**
 Bind original native message conversions and provider payload construction to their source occurrences.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { replaceOnce } from './build-rebase.ts';

//region Message conversions retain original input and output occurrences

/**
 Message source transformation diagnostics remain separate from runtime lineage observations.
 */
const l = tagged({ tag: 'auto-mode-native-message-source' });

/**
 Observe native message conversions and identity pass-through without changing returned data.

 @param source - qualified original native message conversion module

 @param publicationUrl - owned observer module encoded at the generated import boundary

 @returns original conversions with input and result occurrence observations

 @throws NativeBatchBuildError when an original conversion site is absent or duplicated

 @example
 ```ts
 const generated = handlerMessageSource({ source: originalMessages, publicationUrl });
 ```
 */
export function handlerMessageSource({
  source,
  publicationUrl
}: {
 readonly source: string;
 readonly publicationUrl: string;
}): string {
 /**
  Each conversion source retains its own diagnostic boundary.
  */
 const rl = tagged({
   tag: handlerMessageSource.name,
   l
 });
 rl.debug('preparing original native message conversion observations');
 /**
  The original custom-message conversion spelling must appear exactly once.
  */
 const before='            case "custom": {\n                const content = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;\n                return {\n                    role: "user",\n                    content,\n                    timestamp: m.timestamp,\n                };\n            }';
 /**
  Observation retains the original input and the exact returned native message.
  */
 const after='            case "custom": {\n                const content = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;\n                const converted = {role:"user",content,timestamp:m.timestamp};\n                recordHandlerConversion({before:m,after:converted});\n                return converted;\n            }';
 /**
  Custom message content retains native string and structured-content behavior.
  */
 const customSource = replaceOnce({
   source,
   from: before,
   to: after
 });
 /**
  Bash execution messages keep their original native text conversion.
  */
 const executionSource = replaceOnce({
   source: customSource,
   from:'                return {\n                    role: "user",\n                    content: [{ type: "text", text: bashExecutionToText(m) }],\n                    timestamp: m.timestamp,\n                };',
   to:'                {\n                    const converted = {role:"user",content:[{type:"text",text:bashExecutionToText(m)}],timestamp:m.timestamp};\n                    recordHandlerConversion({before:m,after:converted});\n                    return converted;\n                }'
 });
 /**
  Branch summaries retain their original wrapper text and timestamp.
  */
 const branchSource = replaceOnce({
   source: executionSource,
   from:'            case "branchSummary":\n                return {\n                    role: "user",\n                    content: [{ type: "text", text: BRANCH_SUMMARY_PREFIX + m.summary + BRANCH_SUMMARY_SUFFIX }],\n                    timestamp: m.timestamp,\n                };',
   to:'            case "branchSummary": {\n                const converted = {role:"user",content:[{type:"text",text:BRANCH_SUMMARY_PREFIX + m.summary + BRANCH_SUMMARY_SUFFIX}],timestamp:m.timestamp};\n                recordHandlerConversion({before:m,after:converted});\n                return converted;\n            }'
 });
 /**
  Compaction summaries retain their original native text construction.
  */
 const compactionSource = replaceOnce({
   source: branchSource,
   from:'            case "compactionSummary":\n                return {\n                    role: "user",\n                    content: [\n                        { type: "text", text: COMPACTION_SUMMARY_PREFIX + m.summary + COMPACTION_SUMMARY_SUFFIX },\n                    ],\n                    timestamp: m.timestamp,\n                };',
   to:'            case "compactionSummary": {\n                const converted = {role:"user",content:[{type:"text",text:COMPACTION_SUMMARY_PREFIX + m.summary + COMPACTION_SUMMARY_SUFFIX}],timestamp:m.timestamp};\n                recordHandlerConversion({before:m,after:converted});\n                return converted;\n            }'
 });
 /**
  Native identity pass-through is observed without cloning the returned message.
  */
 const observed=replaceOnce({
   source: compactionSource,
   from:'            case "toolResult":\n                return m;',
   to:'            case "toolResult":\n                copyHandlerAlias({before:m,after:m});\n                return m;'
 });
 return `import {recordHandlerConversion,copyHandlerAlias} from ${JSON.stringify(publicationUrl)};\n${observed}`;
}

//endregion Message conversions retain original input and output occurrences

//region Provider serialization binds the exact native payload to its original context

/**
 Observe native user-content construction directly so payload lineage retains its original source occurrence.

 @param source - qualified native provider serialization module

 @param publicationUrl - owned observer module encoded at the generated import boundary

 @returns native provider source retaining original serialized payload and transcript identities

 @throws NativeBatchBuildError when an original serialization site is absent or duplicated

 @example
 ```ts
 const generated = handlerProviderSource({ source: originalProvider, publicationUrl });
 ```
 */
export function handlerProviderSource({
  source,
  publicationUrl
}: {
 readonly source: string;
 readonly publicationUrl: string;
}): string {
 /**
  Provider transformations retain a separate diagnostic boundary from message conversion.
  */
 const rl = tagged({
   tag: handlerProviderSource.name,
   l
 });
 rl.debug('preparing original provider payload observations');
 /**
  This original user-message construction must remain unique in the qualified provider.
  */
 const before='                params.push({\n                    role: "user",\n                    content,\n                });';
 /**
  The original message is observed before its native payload is exposed to hooks.
  */
 const after='                const userMessage = {role:"user",content};\n                params.push(userMessage);\n                recordHandlerPayload({before:msg,after:userMessage});';
 /**
  Source message and generated payload member retain their original identities.
  */
 const messages=replaceOnce({
   source,
   from: before,
   to: after
 });
 /**
  The original system renderer identifies its exact input, text, and emitted message before callbacks.
  */
 const systemMessages=replaceOnce({
   source:messages,
   from:'                params.push({ role: instructionRole, content: sanitizeSurrogates(text) });',
   to:'                const systemMessage = {role:instructionRole,content:sanitizeSurrogates(text)};\n                nativeSystemPayloads.set(systemMessage,Object.freeze({messages:context.messages,message:msg,text}));\n                params.push(systemMessage);'
 });
 /**
  Tool serialization retains the exact declaration objects selected by the native transcript resolver.
  */
 const toolDeclarations=replaceOnce({
   source:systemMessages,
   from:'        params.tools = convertTools(transcriptTools.requestTools, compat);',
   to:'        params.tools = convertTools(transcriptTools.requestTools, compat);\n        nativeToolPayloads.set(params.tools,Object.freeze({messages:context.messages,tools:transcriptTools.requestTools}));'
 });
 /**
  The serializer binds its payload to the original model and transcript before user callbacks.
  */
 const observed=replaceOnce({
   source:toolDeclarations,
   from:'            const nextParams = await options?.onPayload?.(params, model);',
   to:'            nativeSerializedPayloads.set(params,Object.freeze({model,messages:context.messages,normalizedMessages:normalizedContext.messages}));\n            const nextParams = await options?.onPayload?.(params, model);'
 });
 return `import {recordHandlerPayload} from ${JSON.stringify(publicationUrl)};\n`
  +`const nativeSerializedPayloads=new WeakMap(),nativeSystemPayloads=new WeakMap(),nativeToolPayloads=new WeakMap();\n`
   +`export function readNativeSerializedPayload(payload){return nativeSerializedPayloads.get(payload);}\n`
   +`export function readNativeSystemPayload(payload){return nativeSystemPayloads.get(payload);}\n`
   +`export function readNativeToolPayload(payload){return nativeToolPayloads.get(payload);}\n${observed}`;
}

//endregion Provider serialization binds the exact native payload to its original context
