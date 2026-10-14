/**
 Retain the original prompt builder while recording fragments it actually constructs.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { NativeBatchBuildError } from './build-entries.ts';
import { rewriteNativeLiteralRules } from './build-literal-rules.ts';
import { replaceOnce } from './build-rebase.ts';

//region Native skill guidance remains attached to original formatter occurrences

/**
 Source instrumentation diagnostics remain separate from runtime prompt observation.
 */
const l = tagged({ tag: 'auto-mode-native-builder-source' });

/**
 Retain the qualified skill formatter and observe its generated usage guidance.

 @param source - original native skills module containing the formatter and escape helper

 @returns original formatter with observation at its qualified guidance boundary

 @throws NativeBatchBuildError when original formatter boundaries or exact edits change
 */
function skillFormatterSource(source: string): string {
 /**
  The formatter keeps a separate source transformation diagnostic boundary.
  */
 const rl = tagged({ tag: skillFormatterSource.name, l });
 rl.debug('capturing original native skill formatter');
 /**
  The original exported formatter begins the retained source region.
  */
 const start = source.indexOf('export function formatSkillsForPrompt(');
 /**
  The next documented declaration terminates the qualified formatter and helper region.
  */
 const end = source.indexOf('\n/**', start);
 if (start === -1 || end <= start) throw new NativeBatchBuildError('Native skill formatter and escape helper are unavailable');
 /**
  Formatter bytes are retained before the owned callback parameter is added.
  */
 const original = source.slice(start, end);
 /**
  Native callers retain their original default behavior when no observer is supplied.
  */
 const parameterSource = replaceOnce({
   source: original,
   from:'fileReadTool = "read")',
   to:'fileReadTool = "read", recordGenerated = () => {})'
 });
 return replaceOnce({
   source: parameterSource,
   from:'    for (const skill of visibleSkills) {',
   to:'    recordGenerated({slot:"skill-usage-guidance",content:lines.slice(0,-1).join("\\n")});\n    for (const skill of visibleSkills) {'
 });
}

//endregion Native skill guidance remains attached to original formatter occurrences

//region Each original prompt construction stage retains its captured fragment

/**
 Preserve the native builder while recording fragments it actually constructs.

 @param source - original native system-prompt module

 @param skillsSource - original skills module supplying its qualified formatter

 @returns generated builder retaining original fragment and guideline insertion observations

 @throws NativeBatchBuildError when qualified source boundaries or literal-rule membership change

 @example
 ```ts
 const generated = promptBuilderSource({ source: originalBuilder, skillsSource: originalSkills });
 ```
 */
export function promptBuilderSource({
  source,
  skillsSource
}: {
 readonly source: string;
 readonly skillsSource: string;
}): string {
 /**
  Every generated builder retains a diagnostic linked to its original source transformation.
  */
 const rl = tagged({ tag: promptBuilderSource.name, l });
 rl.debug('preparing original native prompt fragment observations');
 /**
  The captured original formatter replaces its original static import.
  */
 const importSource = replaceOnce({
   source,
   from:'import { formatSkillsForPrompt } from "./skills.js";',
   to:''
 });
 /**
  Project-context introduction is captured before native string assembly.
  */
 const introductionSource = replaceOnce({
   source: importSource,
   from:'function renderProjectContext(contextFiles) {\n    return [\n        "Project-specific instructions and guidelines:",',
   to:'function renderProjectContext(contextFiles, recordGenerated) {\n    const introduction = "Project-specific instructions and guidelines:";\n    recordGenerated({slot:"project-context-introduction",content:introduction});\n    return [\n        introduction,'
 });
 /**
  The original project-context call receives this build's fragment observer.
  */
 const contextSource = replaceOnce({
   source: introductionSource,
   from:'renderProjectContext(contextFiles);',
   to:'renderProjectContext(contextFiles, recordGenerated);'
 });
 /**
  Rule construction distinguishes generated fragments from supplied guidelines.
  */
 const rulesSource = replaceOnce({
   source: contextSource,
   from:'function buildRules(selectedTools, toolGuidelines, promptGuidelines) {',
   to:'function buildRules(selectedTools, toolGuidelines, promptGuidelines, recordGenerated, recordGuideline) {'
 });
 /**
  Literal rule observations retain whether native deduplication inserted their value.
  */
 const insertionSource = replaceOnce({
   source: rulesSource,
   from:'    const hasBash = selectedTools.includes("bash");',
   to:'    const addBuiltInRule = rule => { const before = rules.length; addRule(rule); recordGenerated({slot:"default-rule",content:rule,nativeRuleInsertion:rules.length>before?"inserted":"not-inserted"}); };\n    const hasBash = selectedTools.includes("bash");'
 });
 /**
  Original executable literal calls are enumerated independently of comments and strings.
  */
 const literalSource = rewriteNativeLiteralRules(insertionSource);
 /**
  Dynamic guidelines retain original tool names, list ordinals, and native insertion outcomes.
  */
 const guidelineSource = replaceOnce({
   source: literalSource,
   from:'    for (const name of selectedTools) {\n        for (const rule of toolGuidelines[name] ?? [])\n            addRule(rule);\n    }\n    for (const rule of promptGuidelines)\n        addRule(rule);',
   to:'    for (const name of selectedTools) {\n        for (const [ordinal, rule] of (toolGuidelines[name] ?? []).entries()) {\n            const before = rules.length;\n            addRule(rule);\n            recordGuideline({field:"toolGuidelines",toolName:name,ordinal,content:rule,nativeRuleInsertion:rules.length>before?"inserted":"not-inserted"});\n        }\n    }\n    for (const [ordinal, rule] of promptGuidelines.entries()) {\n        const before = rules.length;\n        addRule(rule);\n        recordGuideline({field:"promptGuidelines",ordinal,content:rule,nativeRuleInsertion:rules.length>before?"inserted":"not-inserted"});\n    }'
 });
 /**
  The original rule-building call carries both observation channels.
  */
 const callSource = replaceOnce({
   source: guidelineSource,
   from:'buildRules(declaredTools, toolGuidelines, promptGuidelines);',
   to:'buildRules(declaredTools, toolGuidelines, promptGuidelines, recordGenerated, recordGuideline);'
 });
 /**
  Original native callers preserve default behavior when observers are absent.
  */
 const parameterSource = replaceOnce({
   source: callSource,
   from:'export function buildSystemPromptSections(input) {',
   to:'export function buildSystemPromptSections(input, recordGenerated = () => {}, recordGuideline = () => {}) {'
 });
 /**
  Default preamble observation precedes tool filtering and rendering.
  */
 const preambleSource = replaceOnce({
   source: parameterSource,
   from:'        const visibleTools = declaredTools.filter',
   to:'        recordGenerated({slot:"default-preamble",content:promptSections.preamble});\n        const visibleTools = declaredTools.filter'
 });
 /**
  The qualified discovery sentence is retained exactly from the original builder.
  */
 const discovery='In addition to the tools above, you may have access to other custom tools depending on the project.';
 /**
  The original discovery fragment is encoded only where inserted into generated JavaScript.
  */
 const discoverySource = replaceOnce({
   source: preambleSource,
   from:`        promptSections.tools = \`\${tools}\\n\\n${discovery}\`;`,
   to:`        const discoveryGuidance = ${JSON.stringify(discovery)};\n        recordGenerated({slot:"tool-discovery-guidance",content:discoveryGuidance});\n        promptSections.tools = \`\${tools}\\n\\n\${discoveryGuidance}\`;`
 });
 /**
  Native documentation guidance is captured before appended instructions are processed.
  */
 const documentationSource = replaceOnce({
   source: discoverySource,
   from:'    }\n    if (appendSystemPrompt)',
   to:'        recordGenerated({slot:"documentation-guidance",content:promptSections.docs});\n    }\n    if (appendSystemPrompt)'
 });
 /**
  The original skills call receives the same fragment observer as native prompt sections.
  */
 const completedSource = replaceOnce({
   source: documentationSource,
   from:'formatSkillsForPrompt(skills, skillFileReadTool).trim()',
   to:'formatSkillsForPrompt(skills, skillFileReadTool, recordGenerated).trim()'
 });
 return `${completedSource}\n${
   skillFormatterSource(skillsSource)
   }\nexport function buildOwnedSystemPromptSections(input, recordGuideline = () => {}) {\n const generated=[];\n const sections=buildSystemPromptSections(input,value=>generated.push(Object.freeze(value)),recordGuideline);\n return Object.freeze({sections,generated:Object.freeze(generated)});\n}\n`;
}

//endregion Each original prompt construction stage retains its captured fragment
