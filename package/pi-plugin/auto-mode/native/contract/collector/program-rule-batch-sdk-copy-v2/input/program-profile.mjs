import {createHash} from 'node:crypto';
import {parse} from "./parser.mjs";
import {assertSourceCoverage} from "../../../research/composed-literal-facts/coverage.mjs";
import {readPattern,requireProfile} from "./result-pattern.mjs";
const declarations=new WeakSet();
function member(node,object,property){return node?.type==='MemberExpression'&&!node.computed&&!node.optional&&node.object.type==='Identifier'&&node.object.name===object&&node.property.type==='Identifier'&&node.property.name===property;}
function inspectCall({call,group,ordinal,bindingName,allowed,source,prefix}){
  requireProfile(call?.type==='CallExpression'&&!call.optional&&call.arguments.length===1,'direct single-argument call required');const callee=call.callee;
  requireProfile(callee.type==='MemberExpression'&&!callee.computed&&!callee.optional&&callee.object.type==='Identifier'&&callee.object.name==='tools'&&callee.property.type==='Identifier'&&allowed.has(callee.property.name),'owned tool identifier required');
  const start=callee.start-prefix.length,end=callee.end-prefix.length;requireProfile(Number.isSafeInteger(start)&&start>=0&&end>start&&end<=source.length,'callee source span');
  return Object.freeze({group,ordinal,name:callee.property.name,pattern:readPattern({node:call.arguments[0],bindingName}),callee:Object.freeze({start,end,text:source.slice(start,end)}),alias:'__owned_flow_'+group+'_'+ordinal});
}
/** Inspect only the adopted single-call or producer-and-successor statement shapes. */
function inspectBody({body,allowed,source,prefix}){
  if(body.length===1){
    const returned=body[0];
    requireProfile(returned.type==='ReturnStatement'&&returned.argument?.type==='AwaitExpression','single call requires return await tools.name({...})');
    const call=returned.argument.argument;
    requireProfile(call?.arguments?.[0]?.type==='ObjectExpression','single call requires a literal argument object');
    const site=inspectCall({call,group:0,ordinal:0,allowed,source,prefix});
    return {bindingName:undefined,groups:[{ordinal:0,kind:'awaited-single',members:[site]}],sites:[site],profile:'awaited-literal-single-call'};
  }
  const [definition,returned]=body;
  requireProfile(definition.type==='VariableDeclaration'&&definition.kind==='const'&&definition.declarations.length===1,'one immutable result binding required');
  const declaration=definition.declarations[0];
  requireProfile(declaration.id.type==='Identifier'&&!['tools','Promise','console','globalThis'].includes(declaration.id.name)&&declaration.init?.type==='AwaitExpression','awaited non-shadowing result binding required');
  const producer=inspectCall({call:declaration.init.argument,group:0,ordinal:0,allowed,source,prefix});
  if(returned.type==='ReturnStatement'&&returned.argument?.type==='Identifier'){
    requireProfile(returned.argument.name===declaration.id.name,'single call must return its exact immutable result binding');
    requireProfile(declaration.init.argument.arguments[0].type==='ObjectExpression','single call requires a literal argument object');
    return {bindingName:declaration.id.name,groups:[{ordinal:0,kind:'awaited-single',members:[producer]}],sites:[producer],profile:'awaited-literal-single-call'};
  }
  requireProfile(returned.type==='ReturnStatement'&&returned.argument?.type==='AwaitExpression','return the immutable result directly, or return await a native parallel successor group');
  const group=returned.argument.argument;
  requireProfile(group.type==='CallExpression'&&!group.optional&&['all','allSettled'].some(name=>member(group.callee,'Promise',name))&&group.arguments.length===1,'native parallel combinator required');
  const array=group.arguments[0];requireProfile(array.type==='ArrayExpression'&&array.elements.length>0&&array.elements.length<=32,'complete successor member array required');
  const successors=array.elements.map((call,ordinal)=>inspectCall({call,group:1,ordinal,bindingName:declaration.id.name,allowed,source,prefix}));
  return {bindingName:declaration.id.name,groups:[{ordinal:0,kind:'awaited-producer',members:[producer]},{ordinal:1,kind:group.callee.property.name,members:successors}],sites:[producer,...successors],profile:'awaited-string-result-then-literal-parallel'};
}
/** Preserve complete source coverage and original callsite ownership for each adopted profile. */
export function declareResultProgram({source,toolNames}){
  requireProfile(typeof source==='string'&&source.isWellFormed()&&Buffer.byteLength(source)<=65536,'source byte/encoding bound');
  requireProfile(Array.isArray(toolNames)&&toolNames.length<=64&&new Set(toolNames).size===toolNames.length&&toolNames.every(name=>typeof name==='string'&&/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)&&!name.startsWith('__owned_flow_')),'unique exact callable identifiers required');
  const prefix='async function __owned_parent(){',wrapped=prefix+source+'\n}',parsed=parse(wrapped,{sourceType:'module',lang:'js',preserveParens:true,semanticErrors:true});requireProfile(parsed.diagnostics.length===0,'parser diagnostic');assertSourceCoverage({source:wrapped,statements:parsed.program.body,comments:parsed.comments});
  requireProfile(parsed.program.body.length===1,'source escaped parent');const fn=parsed.program.body[0];requireProfile(fn.type==='FunctionDeclaration'&&fn.id?.name==='__owned_parent'&&fn.async&&!fn.generator&&fn.params.length===0&&fn.start===0&&fn.end===wrapped.length&&fn.body.start===prefix.length-1&&[1,2].includes(fn.body.body.length),'exact parent boundary and one or two inspected statements required; use a returned awaited literal call or an immutable result binding');
  const inspected=inspectBody({body:fn.body.body,allowed:new Set(toolNames),source,prefix});
  const sites=Object.freeze(inspected.sites),pieces=[];let cursor=0;for(const site of sites){requireProfile(site.callee.start>=cursor,'overlapping callsites');pieces.push(source.slice(cursor,site.callee.start),'tools.'+site.alias);cursor=site.callee.end;}pieces.push(source.slice(cursor));const compiledSource=pieces.join('');requireProfile(Buffer.byteLength(compiledSource)<=65536,'compiled source byte bound');
  const groups=Object.freeze(inspected.groups.map(group=>Object.freeze({...group,members:Object.freeze(group.members)})));
  const result=Object.freeze({source,sourceSHA256:createHash('sha256').update(source).digest('hex'),compiledSource,compiledSHA256:createHash('sha256').update(compiledSource).digest('hex'),bindingName:inspected.bindingName,groups,sites,profile:inspected.profile,effectQualification:'not-established',instructionAuthority:'not-established'});declarations.add(result);return result;
}
/** Membership of a declaration object is data provenance, not a safety verdict. */
export function assertDeclaredProgram(declaration){requireProfile(declarations.has(declaration),'declaration is not owned by this source decoder');}
//endregion
