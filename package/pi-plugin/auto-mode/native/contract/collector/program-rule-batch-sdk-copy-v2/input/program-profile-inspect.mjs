import {readPattern,requireProfile,ResultProgramProfileError} from './result-pattern.mjs';
import {inspectProfileCall} from './profile-call.ts';
import {inspectProfileSuccessors} from './profile-successors.ts';
function inspectCall({
  call,
  group,
  ordinal,
  bindingName,
  allowed,
  source,
  prefix
}){
  return inspectProfileCall({
    call,group,ordinal,bindingName,allowed,source,prefix,readPattern,ResultProgramProfileError
  });
}
/** Inspect only the adopted single-call or producer-and-successor statement shapes. */
export function inspectBody({
  body,
  allowed,
  source,
  prefix
}){
  if(body.length===1){
    const returned=body[0];
    requireProfile(
      {condition:(returned.type==='ReturnStatement')&&(returned.argument
        ?.type
        ==='AwaitExpression'),
      message:'single call requires return await tools.name({...})'}
    );
    const call=returned.argument
      .argument;
    requireProfile(
      {condition:call?.arguments?.[0]
        ?.type
        ==='ObjectExpression',
      message:'single call requires a literal argument object'}
    );
    const site=inspectCall({
      call,
      group:0,
      ordinal:0,
      allowed,
      source,
      prefix
    });
    return {
      bindingName:undefined,
      groups:[{
        ordinal:0,
        kind:'awaited-single',
        members:[site]
      }],
      sites:[site],
      profile:'awaited-literal-single-call'
    };
  }
  const [definition,returned]=body;
  requireProfile(
    {condition:(definition.type==='VariableDeclaration')&&(definition.kind==='const')
      &&(definition.declarations
        .length
        ===1),
    message:'one immutable result binding required'}
  );
  const declaration=definition.declarations[0];
  requireProfile(
    {condition:(declaration.id
      .type
      ==='Identifier')&&(![
      'tools',
      'Promise',
      'console',
      'globalThis'
    ].includes(declaration.id
      .name))
      &&(declaration.init
        ?.type
        ==='AwaitExpression'),
    message:'awaited non-shadowing result binding required'}
  );
  const producer=inspectCall({
    call:declaration.init
      .argument,
    group:0,
    ordinal:0,
    allowed,
    source,
    prefix
  });
  if((returned.type==='ReturnStatement')&&(returned.argument
    ?.type
    ==='Identifier')){
    requireProfile(
      {condition:returned.argument
        .name
        ===declaration.id
        .name,
      message:'single call must return its exact immutable result binding'}
    );
    requireProfile(
      {condition:declaration.init
        .argument
        .arguments[0]
        .type
        ==='ObjectExpression',
      message:'single call requires a literal argument object'}
    );
    return {
      bindingName:declaration.id
        .name,
      groups:[{
        ordinal:0,
        kind:'awaited-single',
        members:[producer]
      }],
      sites:[producer],
      profile:'awaited-literal-single-call'
    };
  }
  requireProfile(
    {condition:(returned.type==='ReturnStatement')&&(returned.argument
      ?.type
      ==='AwaitExpression'),
    message:'return the immutable result directly, or return await a native parallel successor group'}
  );
  return inspectProfileSuccessors({returned,declaration,producer,allowed,source,prefix,inspectCall,ResultProgramProfileError});
}
