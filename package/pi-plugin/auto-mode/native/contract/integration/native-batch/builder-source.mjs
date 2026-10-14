import assert from 'node:assert/strict';

function once({source,before,after}){
 assert.equal(source.split(before).length,2,'Native builder capture edit: '+before);
 return source.replace(before,after);
}

/** Preserve the native builder while recording fragments it actually constructs. */
export function promptBuilderSource({source,skillsSource}){
 let value=once({source,before:'import { formatSkillsForPrompt } from "./skills.js";',after:''});
 value=once({source:value,before:'function renderProjectContext(contextFiles) {\n    return [\n        "Project-specific instructions and guidelines:",',after:'function renderProjectContext(contextFiles, recordGenerated) {\n    const introduction = "Project-specific instructions and guidelines:";\n    recordGenerated({slot:"project-context-introduction",content:introduction});\n    return [\n        introduction,'});
 value=once({source:value,before:'renderProjectContext(contextFiles);',after:'renderProjectContext(contextFiles, recordGenerated);'});
 value=once({source:value,before:'function buildRules(selectedTools, toolGuidelines, promptGuidelines) {',after:'function buildRules(selectedTools, toolGuidelines, promptGuidelines, recordGenerated, recordGuideline) {'});
 value=once({source:value,before:'    const hasBash = selectedTools.includes("bash");',after:'    const addBuiltInRule = rule => { const before = rules.length; addRule(rule); recordGenerated({slot:"default-rule",content:rule,nativeRuleInsertion:rules.length>before?"inserted":"not-inserted"}); };\n    const hasBash = selectedTools.includes("bash");'});
 let literalRules=0;
 value=value.replace(/addRule\(("[^"\n]+")\);/g,(_,literal)=>{literalRules++;return 'addBuiltInRule('+literal+');';});
 assert.equal(literalRules,5,'Native literal default-rule branches');
 value=once({source:value,before:'    for (const name of selectedTools) {\n        for (const rule of toolGuidelines[name] ?? [])\n            addRule(rule);\n    }\n    for (const rule of promptGuidelines)\n        addRule(rule);',after:'    for (const name of selectedTools) {\n        for (const [ordinal, rule] of (toolGuidelines[name] ?? []).entries()) {\n            const before = rules.length;\n            addRule(rule);\n            recordGuideline({field:"toolGuidelines",toolName:name,ordinal,content:rule,nativeRuleInsertion:rules.length>before?"inserted":"not-inserted"});\n        }\n    }\n    for (const [ordinal, rule] of promptGuidelines.entries()) {\n        const before = rules.length;\n        addRule(rule);\n        recordGuideline({field:"promptGuidelines",ordinal,content:rule,nativeRuleInsertion:rules.length>before?"inserted":"not-inserted"});\n    }'});
 value=once({source:value,before:'buildRules(declaredTools, toolGuidelines, promptGuidelines);',after:'buildRules(declaredTools, toolGuidelines, promptGuidelines, recordGenerated, recordGuideline);'});
 value=once({source:value,before:'export function buildSystemPromptSections(input) {',after:'export function buildSystemPromptSections(input, recordGenerated = () => {}, recordGuideline = () => {}) {'});
 value=once({source:value,before:'        const visibleTools = declaredTools.filter',after:'        recordGenerated({slot:"default-preamble",content:promptSections.preamble});\n        const visibleTools = declaredTools.filter'});
 const discovery='In addition to the tools above, you may have access to other custom tools depending on the project.';
 value=once({source:value,before:'        promptSections.tools = `${tools}\\n\\n'+discovery+'`;',after:'        const discoveryGuidance = '+JSON.stringify(discovery)+';\n        recordGenerated({slot:"tool-discovery-guidance",content:discoveryGuidance});\n        promptSections.tools = `${tools}\\n\\n${discoveryGuidance}`;'});
 value=once({source:value,before:'    }\n    if (appendSystemPrompt)',after:'        recordGenerated({slot:"documentation-guidance",content:promptSections.docs});\n    }\n    if (appendSystemPrompt)'});
 value=once({source:value,before:'formatSkillsForPrompt(skills, skillFileReadTool).trim()',after:'formatSkillsForPrompt(skills, skillFileReadTool, recordGenerated).trim()'});
 const start=skillsSource.indexOf('export function formatSkillsForPrompt('),end=skillsSource.indexOf('\n/**',start);
 assert(start>=0&&end>start,'Native skill formatter and escape helper');
 let skills=skillsSource.slice(start,end);
 skills=once({source:skills,before:'fileReadTool = "read")',after:'fileReadTool = "read", recordGenerated = () => {})'});
 skills=once({source:skills,before:'    for (const skill of visibleSkills) {',after:'    recordGenerated({slot:"skill-usage-guidance",content:lines.slice(0,-1).join("\\n")});\n    for (const skill of visibleSkills) {'});
 return value+'\n'+skills+'\nexport function buildOwnedSystemPromptSections(input, recordGuideline = () => {}) {\n const generated=[];\n const sections=buildSystemPromptSections(input,value=>generated.push(Object.freeze(value)),recordGuideline);\n return Object.freeze({sections,generated:Object.freeze(generated)});\n}\n';
}
