import {parse} from "./parser.mjs";
import {declareResultProgram as declare,assertDeclaredProgram} from "./program-profile.mjs";
import {requireProfile} from "./result-pattern.mjs";

/** Check generated single-call returns independently before reconstructing the original source. */
function compiledCalls({body,declaration}){
  if(declaration.profile==='awaited-literal-single-call'){
    if(declaration.bindingName===undefined){
      requireProfile(body.length===1&&body[0].type==='ReturnStatement'&&body[0].argument?.type==='AwaitExpression','compiled single return changed');
      return [body[0].argument.argument];
    }
    const [first,second]=body;
    requireProfile(body.length===2&&first.type==='VariableDeclaration'&&first.kind==='const'&&first.declarations.length===1&&first.declarations[0].id.type==='Identifier'&&first.declarations[0].id.name===declaration.bindingName&&first.declarations[0].init?.type==='AwaitExpression'&&second.type==='ReturnStatement'&&second.argument?.type==='Identifier'&&second.argument.name===declaration.bindingName,'compiled single binding changed');
    return [first.declarations[0].init.argument];
  }
  requireProfile(declaration.profile==='awaited-string-result-then-literal-parallel'&&body.length===2,'compiled profile changed');
  const [first,second]=body;requireProfile(first.type==='VariableDeclaration'&&first.declarations.length===1&&first.declarations[0].id.name===declaration.bindingName&&first.declarations[0].init.type==='AwaitExpression'&&second.type==='ReturnStatement'&&second.argument.type==='AwaitExpression','compiled producer binding changed');
  const producer=first.declarations[0].init.argument,group=second.argument.argument;
  requireProfile(group.type==='CallExpression'&&group.callee.type==='MemberExpression'&&group.callee.object.name==='Promise'&&group.callee.property.name===declaration.groups[1].kind&&group.arguments[0].type==='ArrayExpression','compiled successor changed');
  return [producer,...group.arguments[0].elements];
}

/** Reparse the generated program and reconstruct original bytes without substituting any result data. */
export function declareResultProgram(input){
  const declaration=declare(input);assertDeclaredProgram(declaration);
  const prefix='async function __owned_parent(){',wrapped=prefix+declaration.compiledSource+'\n}',parsed=parse(wrapped,{sourceType:'module',lang:'js',preserveParens:true,semanticErrors:true});
  requireProfile(parsed.diagnostics.length===0&&parsed.program.body.length===1,'compiled parent did not parse');
  const fn=parsed.program.body[0];requireProfile(fn.type==='FunctionDeclaration'&&fn.start===0&&fn.end===wrapped.length,'compiled parent boundary changed');
  const calls=compiledCalls({body:fn.body.body,declaration});requireProfile(calls.length===declaration.sites.length,'compiled member count changed');
  const pieces=[];let cursor=0;
  for(const [index,call] of calls.entries()){
    const site=declaration.sites[index];requireProfile(call?.type==='CallExpression'&&call.callee.type==='MemberExpression'&&call.callee.object.name==='tools'&&call.callee.property.name===site.alias&&!call.callee.computed&&!call.optional,'compiled alias changed');
    const start=call.callee.start-prefix.length,end=call.callee.end-prefix.length;requireProfile(start>=cursor&&end>start&&end<=declaration.compiledSource.length,'compiled alias span');
    pieces.push(declaration.compiledSource.slice(cursor,start),site.callee.text);cursor=end;
  }
  pieces.push(declaration.compiledSource.slice(cursor));requireProfile(pieces.join('')===declaration.source,'compiled program did not reconstruct original source');
  return declaration;
}
