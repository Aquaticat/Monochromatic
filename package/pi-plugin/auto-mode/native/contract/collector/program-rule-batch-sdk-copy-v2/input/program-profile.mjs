import {inspectBody} from './program-profile-inspect.mjs';
import {createHash} from 'node:crypto';
import {parse} from "./parser.mjs";
import {assertSourceCoverage} from "../../../research/composed-literal-facts/coverage.mjs";
import {
  requireProfile
} from "./result-pattern.mjs";

const declarations=new WeakSet();

/** Scan the original ASCII callable profile once with constant stack usage. */
function isCallableIdentifier(name){
  if((typeof name)!=='string'||name.length===0||name.startsWith('__owned_flow_'))return false;
  for(let index=0;index<name.length;index++){
    const code=name.charCodeAt(index);
    const letter=(code>=65&&code<=90)||(code>=97&&code<=122)||code===95||code===36;
    const digit=index>0&&code>=48&&code<=57;
    if(!letter&&!digit)return false;
  }
  return true;
}
/** Preserve complete source coverage and original callsite ownership for each adopted profile. */
export function declareResultProgram({
  source,
  toolNames
}){
  requireProfile(
    {condition:((typeof source)==='string')&&source.isWellFormed()
      &&(Buffer.byteLength(source)<=65_536),
    message:'source byte/encoding bound'}
  );
  requireProfile(
    {condition:Array.isArray(toolNames)&&(toolNames.length<=64)
      &&(new Set(toolNames).size===toolNames.length)
      &&toolNames.every(isCallableIdentifier),
    message:'unique exact callable identifiers required'}
  );
  const prefix='async function __owned_parent(){';
    const wrapped=`${prefix+source}\n}`;
    const parsed=parse(
    wrapped,
    {
      sourceType:'module',
      lang:'js',
      preserveParens:true,
      semanticErrors:true
    }
  );requireProfile(
    {condition:parsed.diagnostics
      .length
      ===0,
    message:'parser diagnostic'}
  );assertSourceCoverage({
    source:wrapped,
    statements:parsed.program
      .body,
    comments:parsed.comments
  });
  requireProfile(
    {condition:parsed.program
      .body
      .length
      ===1,
    message:'source escaped parent'}
  );const fn=parsed.program
    .body[0];requireProfile(
    {condition:(fn.type==='FunctionDeclaration')&&(fn.id
      ?.name
      ==='__owned_parent')
      &&fn.async
      &&(!fn.generator)
      &&(fn.params
        .length
        ===0)
      &&(fn.start===0)
      &&(fn.end===wrapped.length)
      &&(fn.body
        .start
        ===(prefix.length
        -1))
      &&[
      1,
      2
    ].includes(fn.body
      .body
      .length),
    message:'exact parent boundary and one or two inspected statements required; use a returned awaited literal call or an immutable result binding'}
  );
  const inspected=inspectBody({
    body:fn.body
      .body,
    allowed:new Set(toolNames),
    source,
    prefix
  });
  const sites=Object.freeze(inspected.sites);
  const pieces=[];let cursor=0;for(const site of sites){requireProfile(
    {condition:site.callee
      .start
      >=cursor,
    message:'overlapping callsites'}
  );pieces.push(
    source.slice(
      cursor,
      site.callee
        .start
    ),
    `tools.${site.alias}`
  );cursor=site.callee
    .end;}pieces.push(source.slice(cursor));const compiledSource=pieces.join('');requireProfile(
    {condition:Buffer.byteLength(compiledSource)<=65_536,
    message:'compiled source byte bound'}
  );
  const groups=Object.freeze(inspected.groups
    .map(function freezeDeclaredGroup(group) { return (Object.freeze({
      ...group,
      members:Object.freeze(group.members)
    })); }));
  const result=Object.freeze({
    source,
    sourceSHA256:createHash('sha256')
      .update(source)
      .digest('hex'),
    compiledSource,
    compiledSHA256:createHash('sha256')
      .update(compiledSource)
      .digest('hex'),
    bindingName:inspected.bindingName,
    groups,
    sites,
    profile:inspected.profile,
    effectQualification:'not-established',
    instructionAuthority:'not-established'
  });declarations.add(result);return result;
}
/** Membership of a declaration object is data provenance, not a safety verdict. */
export function assertDeclaredProgram(declaration){requireProfile(
  {condition:declarations.has(declaration),
  message:'declaration is not owned by this source decoder'}
);}
//endregion
