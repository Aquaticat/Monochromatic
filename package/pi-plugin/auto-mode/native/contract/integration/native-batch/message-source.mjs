import assert from 'node:assert/strict';

function once({
  source,
  before,
  after
}){
 assert.equal(
   source.split(before)
     .length,
   2,
   `Native handler conversion edit: ${before}`
 );
 return source.replace(
   before,
   after
 );
}

/** Observe native message conversions and identity pass-through without changing their returned data. */
export function handlerMessageSource({
  source,
  publicationUrl
}){
 const before='            case "custom": {\n                const content = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;\n                return {\n                    role: "user",\n                    content,\n                    timestamp: m.timestamp,\n                };\n            }';
 const after='            case "custom": {\n                const content = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;\n                const converted = {role:"user",content,timestamp:m.timestamp};\n                recordHandlerConversion({before:m,after:converted});\n                return converted;\n            }';
 let converted=once({
   source,
   before,
   after
 });
 converted=once({
   source:converted,
   before:'                return {\n                    role: "user",\n                    content: [{ type: "text", text: bashExecutionToText(m) }],\n                    timestamp: m.timestamp,\n                };',
   after:'                {\n                    const converted = {role:"user",content:[{type:"text",text:bashExecutionToText(m)}],timestamp:m.timestamp};\n                    recordHandlerConversion({before:m,after:converted});\n                    return converted;\n                }'
 });
 converted=once({
   source:converted,
   before:'            case "branchSummary":\n                return {\n                    role: "user",\n                    content: [{ type: "text", text: BRANCH_SUMMARY_PREFIX + m.summary + BRANCH_SUMMARY_SUFFIX }],\n                    timestamp: m.timestamp,\n                };',
   after:'            case "branchSummary": {\n                const converted = {role:"user",content:[{type:"text",text:BRANCH_SUMMARY_PREFIX + m.summary + BRANCH_SUMMARY_SUFFIX}],timestamp:m.timestamp};\n                recordHandlerConversion({before:m,after:converted});\n                return converted;\n            }'
 });
 converted=once({
   source:converted,
   before:'            case "compactionSummary":\n                return {\n                    role: "user",\n                    content: [\n                        { type: "text", text: COMPACTION_SUMMARY_PREFIX + m.summary + COMPACTION_SUMMARY_SUFFIX },\n                    ],\n                    timestamp: m.timestamp,\n                };',
   after:'            case "compactionSummary": {\n                const converted = {role:"user",content:[{type:"text",text:COMPACTION_SUMMARY_PREFIX + m.summary + COMPACTION_SUMMARY_SUFFIX}],timestamp:m.timestamp};\n                recordHandlerConversion({before:m,after:converted});\n                return converted;\n            }'
 });
 const observed=once({
   source:converted,
   before:'            case "toolResult":\n                return m;',
   after:'            case "toolResult":\n                copyHandlerAlias({before:m,after:m});\n                return m;'
 });
 return `import {recordHandlerConversion,copyHandlerAlias} from ${JSON.stringify(publicationUrl)};\n${observed}`;
}

/** Observe the native user-content construction itself, never infer lineage from output ordinals. */
export function handlerProviderSource({
  source,
  publicationUrl
}){
 const before='                params.push({\n                    role: "user",\n                    content,\n                });';
 const after='                const userMessage = {role:"user",content};\n                params.push(userMessage);\n                recordHandlerPayload({before:msg,after:userMessage});';
 const messages=once({
   source,
   before,
   after
 });
 const observed=once({
   source:messages,
   before:'            const nextParams = await options?.onPayload?.(params, model);',
   after:'            nativeSerializedPayloads.set(params,Object.freeze({model,messages:context.messages}));\n            const nextParams = await options?.onPayload?.(params, model);'
 });
 return `import {recordHandlerPayload} from ${JSON.stringify(publicationUrl)};\n`
  +`const nativeSerializedPayloads=new WeakMap();\n`
   +`export function readNativeSerializedPayload(payload){return nativeSerializedPayloads.get(payload);}\n${observed}`;
}
