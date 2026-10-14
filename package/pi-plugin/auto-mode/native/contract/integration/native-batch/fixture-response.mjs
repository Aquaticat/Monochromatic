/** Local SSE only: feed the actual installed serializer without a provider request. */
export function fixtureResponse({model='fixture',proposal,code,programs=1,direct=false}){
 if(![1,2].includes(programs))throw new Error('Fixture program count must remain bounded');
 const programCalls=Array.from({length:programs},(_,index)=>({index,id:index===0?'program':'program-'+index,type:'function',function:{name:'codemode',arguments:JSON.stringify({code})}}));
 const toolCalls=[...programCalls,...(direct?[{index:programs,id:'direct',type:'function',function:{name:'fixture_value',arguments:JSON.stringify({path:'seed'})}}]:[])];
 const delta=proposal?{role:'assistant',tool_calls:toolCalls}:{role:'assistant',content:'done'};
 const chunk={id:'fixture-response',object:'chat.completion.chunk',created:0,model};
 const first={...chunk,choices:[{index:0,delta,finish_reason:null}]};
 const last={...chunk,choices:[{index:0,delta:{},finish_reason:proposal?'tool_calls':'stop'}],usage:{prompt_tokens:100,completion_tokens:10,total_tokens:110}};
 return new Response('data: '+JSON.stringify(first)+'\n\ndata: '+JSON.stringify(last)+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
}
