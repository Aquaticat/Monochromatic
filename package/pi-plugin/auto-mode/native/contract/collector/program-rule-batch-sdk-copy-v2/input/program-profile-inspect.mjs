import {readPattern,requireProfile} from './result-pattern.mjs';
function member(
  {node,object,property}
){return (node?.type==='MemberExpression')&&(!node.computed)
  &&(!node.optional)
  &&(node.object
    .type
    ==='Identifier')
  &&(node.object
    .name
    ===object)
  &&(node.property
    .type
    ==='Identifier')
  &&(node.property
    .name
    ===property);}
function inspectCall({
  call,
  group,
  ordinal,
  bindingName,
  allowed,
  source,
  prefix
}){
  requireProfile(
    {condition:(call?.type==='CallExpression')&&(!call.optional)
      &&(call.arguments
        .length
        ===1),
    message:'direct single-argument call required'}
  );const {callee} = call;
  requireProfile(
    {condition:(callee.type==='MemberExpression')&&(!callee.computed)
      &&(!callee.optional)
      &&(callee.object
        .type
        ==='Identifier')
      &&(callee.object
        .name
        ==='tools')
      &&(callee.property
        .type
        ==='Identifier')
      &&allowed.has(callee.property
        .name),
    message:'owned tool identifier required'}
  );
  const start=callee.start-prefix.length;
    const end=callee.end-prefix.length;requireProfile(
    {condition:Number.isSafeInteger(start)&&(start>=0)
      &&(end>start)
      &&(end<=source.length),
    message:'callee source span'}
  );
  return Object.freeze({
    group,
    ordinal,
    name:callee.property
      .name,
    pattern:readPattern({
      node:call.arguments[0],
      bindingName
    }),
    callee:Object.freeze({
      start,
      end,
      text:source.slice(
        start,
        end
      )
    }),
    alias:`__owned_flow_${group}_${ordinal}`
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
  const group=returned.argument
    .argument;
  requireProfile(
    {condition:(group.type==='CallExpression')&&(!group.optional)
      &&[
      'all',
      'allSettled'
    ].some(function isPromiseGroupMethod(name) { return (member(
      {node:group.callee,
      object:'Promise',
      property:name}
    )); })
      &&(group.arguments
        .length
        ===1),
    message:'native parallel combinator required'}
  );
  const array=group.arguments[0];requireProfile(
    {condition:(array.type==='ArrayExpression')&&(array.elements
      .length
      >0)
      &&(array.elements
        .length
        <=32),
    message:'complete successor member array required'}
  );
  const successors=array.elements
    .map(function inspectSuccessorCall(call,
      ordinal) { return (inspectCall({
      call,
      group:1,
      ordinal,
      bindingName:declaration.id
        .name,
      allowed,
      source,
      prefix
    })); });
  return {
    bindingName:declaration.id
      .name,
    groups:[
      {
        ordinal:0,
        kind:'awaited-producer',
        members:[producer]
      },
      {
        ordinal:1,
        kind:group.callee
          .property
          .name,
        members:successors
      }
    ],
    sites:[
      producer,
      ...successors
    ],
    profile:'awaited-string-result-then-literal-parallel'
  };
}
