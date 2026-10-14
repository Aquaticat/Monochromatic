import assert from 'node:assert/strict';
import {declareResultProgram} from '../../collector/program-rule-batch-sdk-copy-v2/input/program-profile-reviewed.mjs';
import {assertDeclaredProgram} from '../../collector/program-rule-batch-sdk-copy-v2/input/program-profile.mjs';
import {materializePattern,ResultProgramProfileError} from '../../collector/program-rule-batch-sdk-copy-v2/input/result-pattern.mjs';
import {createOwnedCodemodeDefinition} from './generated/program-definition.mjs';

//region Original declarations preserve complete inspected source and reject hidden execution

const literal={path:'quote";\n tools.write({}); \\ /../',nested:[null,true,-2,{value:'a'}]};
const argument=JSON.stringify(literal);
const accepted=[
  `return await tools.read(${argument});`,
  `const result = await tools.read(${argument}); return result;`,
  String.raw`/* source comment */ return await tools.re\u0061d(${argument});`,
];
for(const source of accepted){
  const declaration=declareResultProgram({source,toolNames:['read']});
  assertDeclaredProgram(declaration);
  assert.equal(declaration.profile,'awaited-literal-single-call');
  assert.equal(declaration.groups.length,1);
  assert.equal(declaration.groups[0].members.length,1);
  assert.equal(declaration.sites.length,1);
  assert.equal(declaration.source,source);
  assert.deepEqual(materializePattern({pattern:declaration.sites[0].pattern}),literal);
  assert.ok(declaration.compiledSource.includes('tools.__owned_flow_0_0('));
  assert.ok(Object.isFrozen(declaration));
  assert.ok(Object.isFrozen(declaration.groups[0].members));
  assert.throws(()=>assertDeclaredProgram({...declaration}),ResultProgramProfileError);
}
const rejected=[
  'return tools.read({});',
  'await tools.read({});',
  'let result = await tools.read({}); return result;',
  'const result = await tools.read({}); return other;',
  'const result = await tools.read({}); return result.value;',
  'const tools = await tools.read({}); return tools;',
  'const result = await tools.read({}); return await tools.read({});',
  'const result = await tools.read({}); result = "changed"; return result;',
  'try { return await tools.read({}); } catch(error) { return error; }',
  'if(true) return await tools.read({});',
  'return await tools["read"]({});',
  'return await tools.read?.({});',
  'return await tools?.read({});',
  'return await tools.write({});',
  'return await tools.read({path:tools.write({})});',
  'return await tools.read({path:(()=>tools.write({}))()});',
  'return await tools.read({get path(){return tools.write({});}});',
  'return await tools.read({...other});',
  'return await tools.read({__proto__:{}});',
  'return await tools.read({path:"a",path:"b"});',
  'return await tools.read({path:`${tools.write({})}`});',
  'return await tools.read({}, tools.write({}));',
  'return await tools.read("path");',
  'return await tools.read([{}]);',
  'return await tools.read({}); tools.write({});',
  'return await tools.read({}); } tools.write({}); async function escaped(){',
];
for(const source of rejected){
  assert.throws(()=>declareResultProgram({source,toolNames:['read']}),ResultProgramProfileError,source);
}
for(const kind of ['all','allSettled']){
  const declaration=declareResultProgram({source:`const result=await tools.read({path:"seed"}); return await Promise.${kind}([tools.read({path:result})]);`,toolNames:['read']});
  assert.equal(declaration.profile,'awaited-string-result-then-literal-parallel');
  assert.equal(declaration.groups.length,2);
  assert.equal(declaration.groups[1].kind,kind);
}
const tool=createOwnedCodemodeDefinition();
assert.ok(tool.description.includes('return await tools.name('));
assert.ok(tool.description.includes('return result;'));
assert.ok(tool.description.includes('try/catch'));
const nested={name:'read',description:'Retained read declaration',parameters:{type:'object',properties:{}}};
const loadout={callable:[nested],declared:[nested],getExposure(){return 'direct';},getNamespace(){return undefined;},getPromptGuidelines(){return [];}};
const prepared=createOwnedCodemodeDefinition({getMode:()=> 'only'}).prepareLoadout(loadout);
assert.ok(prepared.descriptions.codemode.includes('Retained read declaration'));
assert.ok(prepared.descriptions.codemode.includes('return result;'));
assert.deepEqual(prepared.hiddenDeclarations,['read']);
console.log(JSON.stringify({complete:true,singleForms:accepted.length,rejected:rejected.length,priorCombinators:2,originalDeclarationRequired:true,loadoutGuidanceVerified:true}));

//endregion Original declarations preserve complete inspected source and reject hidden execution
