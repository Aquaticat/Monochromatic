export class RequestProducerError extends Error {constructor(
  message,
  options
){super(
  message,
  options
);this.name=this.constructor
  .name;}}
function reference(value){return (value!==null)&&(((typeof value)==='object')||((typeof value)==='function'));}

//region Native call-site and response identity evidence never confers instruction authority or permission.
export function createRequestProducerOwner({
  now,
  createJudgment
}={}){
  const consumers=new WeakMap();
    const claims=new WeakMap();
    const responses=new WeakMap();
    const streams=new WeakMap();
  function responseRecord({
    response,
    stream
  }){
    const record=reference(response)?responses.get(response):undefined;
    const identity=(typeof stream)==='function'?consumers.get(stream):undefined;
    if((!record)||(!identity)
      ||(record.consumer!==identity))throw new RequestProducerError('Response has no producer observation for this exact consumer');
    if(record.ambiguous)throw new RequestProducerError('Response or stream identity was reused across producer invocations');
    return record;
  }
  function describeResponse(input){return responseRecord(input)
    .description;}
  function assertMainAgentResponse(input){if(responseRecord(input)
    .description
    .kind
    !=='main-agent')throw new RequestProducerError('Auxiliary request output is not a main-agent tool response');}
  let beginningJudgment=false;
  function beginJudgment(input){
    if(beginningJudgment)throw new RequestProducerError('Judgment construction cannot reenter');
    if((typeof now)!=='function')throw new RequestProducerError('Owned judgment clock and constructor are unavailable');
    beginningJudgment=true;
    try{
      const startedAt=now();
      if(!Number.isFinite(startedAt))throw new RequestProducerError('Judgment start clock is not finite');
      if((!input)||((typeof input)!=='object'))throw new RequestProducerError('Judgment entry requires an owned response/consumer input');
      const {
        response,
        stream,
        signal
      }=input;
      const record=responseRecord({
        response,
        stream
      });
      if(record.description
        .kind
        !=='main-agent')throw new RequestProducerError('Auxiliary request output cannot own a tool judgment');
      const {construct} = record.consumer;
      if((typeof construct)!=='function')throw new RequestProducerError('This consumer has no owned judgment constructor');
      if(record.judgment!==undefined)throw new RequestProducerError('Response already reserved its enclosing judgment');
      const slot={
        state:'constructing',
        value:undefined,
        error:undefined
      };record.judgment=slot;
      try{
        const value=construct(Object.freeze({
          startedAt,
          signal,
          response,
          stream
        }));
        if((!reference(value))||((typeof value)!=='object')
          ||(!Object.isFrozen(value))
          ||(![
            Object.prototype,
            null
          ].includes(Object.getPrototypeOf(value))))throw new RequestProducerError('Judgment constructor must return an owned frozen plain record');
        for(const key of Reflect.ownKeys(value)){const descriptor=Object.getOwnPropertyDescriptor(
          value,
          key
        );if(((typeof key)!=='string')||(!descriptor)
          ||(!Object.hasOwn(
          descriptor,
          'value'
        ))
          ||(!descriptor.enumerable))throw new RequestProducerError('Judgment result contains an accessor, symbol or hidden property');}
        if((typeof value.then)==='function')throw new RequestProducerError('Judgment constructor cannot return an asynchronous result');
        if((responseRecord({
          response,
          stream
        })!==record)||(record.judgment!==slot))throw new RequestProducerError('Judgment response binding changed during construction');
        slot.value=value;slot.state='active';return value;
      }catch(error){slot.error=error;slot.state='failed';throw error;}
    }finally{beginningJudgment=false;}
  }
  function judgmentFor({
    response,
    stream
  }){
    const slot=responseRecord({
      response,
      stream
    })
      .judgment;
    if(!slot)throw new RequestProducerError('Response has no enclosing judgment reservation');
    if(slot.state==='failed')throw new RequestProducerError(
      'Response judgment construction failed',
      {cause:slot.error}
    );
    if(slot.state!=='active')throw new RequestProducerError('Response judgment is still being constructed');
    return slot.value;
  }
  function makeConsumer({
    handle,
    construct
  }){
    if((typeof handle)!=='function')throw new RequestProducerError('Producer consumer must be an owned function');
    const identity=Object.freeze({construct});
    async function stream(
      model,
      context,
      options
    ){
      const claim=reference(options)?claims.get(options):undefined;
      if((!claim)||(claim.consumer!==identity)
        ||(!claim.open)
        ||claim.consumed)throw new RequestProducerError('Request has no current unused claim for this exact consumer');
      claim.consumed=true;
      const record={
        consumer:identity,
        description:Object.freeze({
          kind:claim.kind,
          instructionAuthority:'not-established',
          humanWitness:'not-established',
          judgmentBudgetAtRequest:'not-created'
        }),
        response:undefined,
        ambiguous:false
      };
      const returned=await handle({
        model,
        context,
        options
      });
      if((!reference(returned))||((typeof returned.result)!=='function')
        ||((typeof returned[Symbol.asyncIterator])!=='function'))throw new RequestProducerError('Producer consumer did not return a result-bearing stream');
      const previousStream=streams.get(returned);
      if(previousStream){previousStream.ambiguous=true;record.ambiguous=true;throw new RequestProducerError('Response or stream identity was reused across producer invocations');}
      streams.set(
        returned,
        record
      );const originalResult=returned.result
        .bind(returned);
      returned.result=async function producerResult(){
        const response=await originalResult();
        if(!reference(response)){record.ambiguous=true;throw new RequestProducerError('Producer stream returned no response object');}
        if((record.response!==undefined)&&(record.response!==response)){record.ambiguous=true;throw new RequestProducerError('Producer stream changed its response object');}
        const previous=responses.get(response);
        if(previous&&(previous!==record)){previous.ambiguous=true;record.ambiguous=true;throw new RequestProducerError('Response or stream identity was reused across producer invocations');}
        record.response=response;responses.set(
          response,
          record
        );return response;
      };
      return returned;
    }
    consumers.set(
      stream,
      identity
    );return stream;
  }
  function bindConsumer(handle){return makeConsumer({
    handle,
    construct:createJudgment
  });}
  function bindJudgmentConsumer({
    handle,
    construct
  }){if((typeof construct)!=='function')throw new RequestProducerError('Consumer judgment constructor must be an owned function');return makeConsumer({
    handle,
    construct
  });}
  async function invoke({
    kind,
    stream,
    model,
    context,
    options
  }){
    const consumer=(typeof stream)==='function'?consumers.get(stream):undefined;
    if(!consumer)throw new RequestProducerError('Native producer stream is not bound to this issuer');
    if((options!==undefined)&&((options===null)||((typeof options)!=='object')
      ||Array.isArray(options)
      ||(![
        Object.prototype,
        null
      ].includes(Object.getPrototypeOf(options)))))throw new RequestProducerError('Native request options must be an owned plain record');
    for(const key of Reflect.ownKeys(options??{})){const descriptor=Object.getOwnPropertyDescriptor(
      options,
      key
    );if((!descriptor)||(!Object.hasOwn(
      descriptor,
      'value'
    ))
      ||(!descriptor.enumerable))throw new RequestProducerError('Native request options contain an accessor or hidden property');}
    const stamped=Object.freeze({...options});
      const claim={
      consumer,
      kind,
      open:true,
      consumed:false
    };claims.set(
      stamped,
      claim
    );
    try{return await stream(
      model,
      context,
      stamped
    );}finally{claim.open=false;}
  }
  return Object.freeze({
    bindConsumer,
    bindJudgmentConsumer,
    fromAgentLoop:function invokeMainAgentStream({
      stream,
      model,
      context,
      options
    }) { return (invoke({
      kind:'main-agent',
      stream,
      model,
      context,
      options
    })); },
    fromAuxiliarySummary:function invokeAuxiliarySummaryStream({
      stream,
      model,
      context,
      options
    }) { return (invoke({
      kind:'auxiliary-summary',
      stream,
      model,
      context,
      options
    })); },
    describeResponse,
    assertMainAgentResponse,
    beginJudgment,
    judgmentFor
  });
}
//endregion
