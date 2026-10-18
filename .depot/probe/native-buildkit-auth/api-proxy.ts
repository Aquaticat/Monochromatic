
import {createServer,connect} from 'node:http2';
import {once} from 'node:events';import {strict as assert} from 'node:assert';
// This loopback relay prevents CLI NotFound onboarding from listing account projects.
// It preserves the actual CLI token resolution and forwards only this bounded build family.
export async function createGuardedApi({projectId,expectedInitialAuthorization,rows,onUpdate,stubNotFound=false}){
const prefix='/depot.cli.v1.BuildService/';
const allowed=new Set(['CreateBuild','GetBuildKitConnection','ReportBuildHealth','ReportStatusStream','FinishBuild']);
const sessions=new Set();const stats={createRequests:0,forwardedRequests:0,deniedRequests:0,initialCredentialMatched:false,stubNotFound};
const server=createServer();let upstream;let stopping=false;
server.on('session',session=>{sessions.add(session);session.on('error',()=>{});session.on('close',()=>sessions.delete(session));});
server.on('stream',(stream,headers)=>{
const path=String(headers[':path']);const method=path.startsWith(prefix)?path.slice(prefix.length):null;
const row={kind:'guarded-cli-api',path,startedAt:new Date().toISOString(),forwarded:false};rows.push(row);
stream.on('error',error=>{row.streamErrorCode=error.code;onUpdate();});
const deny=reason=>{stats.deniedRequests+=1;row.deniedReason=reason;row.status=403;if(!stream.headersSent)stream.respond({':status':403,'content-type':'application/json'});stream.end(JSON.stringify({code:'permission_denied',message:'Owned research boundary blocked this API method'}));onUpdate();};
if(headers[':method']!=='POST'||!allowed.has(method)){deny('API method outside the exact build allow-list');return;}
if(rows.length>250){deny('Finite request count exceeded');return;}
const forward=body=>{
if(stubNotFound){row.status=404;row.stubbed=true;stream.respond({':status':404,'content-type':'application/json'});stream.end(JSON.stringify({code:'not_found',message:'Owned preflight missing-project control'}));onUpdate();return;}
if(!upstream){upstream=connect('https://api.depot.dev');upstream.on('error',error=>{stats.upstreamErrorCode=error.code;onUpdate();});}
const outgoing={};for(const [key,value]of Object.entries(headers))if(!key.startsWith(':')&&!['host','connection','transfer-encoding'].includes(key))outgoing[key]=value;
Object.assign(outgoing,{':method':'POST',':path':path,':scheme':'https',':authority':'api.depot.dev'});
const target=upstream.request(outgoing);row.forwarded=true;stats.forwardedRequests+=1;
target.on('response',responseHeaders=>{row.status=Number(responseHeaders[':status']);const response={};for(const [key,value]of Object.entries(responseHeaders))if(key===':status'||!key.startsWith(':'))response[key]=value;if(!stream.destroyed)stream.respond(response);onUpdate();});
target.on('error',error=>{row.upstreamErrorCode=error.code;if(!stream.destroyed){if(!stream.headersSent)stream.respond({':status':502});stream.end();}onUpdate();});
target.on('end',()=>{row.finishedAt=new Date().toISOString();onUpdate();});
target.pipe(stream);if(body)target.end(body);else stream.pipe(target);onUpdate();
};
if(method==='CreateBuild'){
stats.createRequests+=1;if(stats.createRequests!==1){deny('Only one build creation is admitted');return;}
stats.initialCredentialMatched=headers.authorization===expectedInitialAuthorization;
if(!stats.initialCredentialMatched){deny('Initial CLI credential did not match the injected job token');return;}
const chunks=[];let bytes=0;stream.on('data',chunk=>{bytes+=chunk.length;if(bytes>65536){deny('CreateBuild request exceeds bounded fixture size');stream.destroy();}else chunks.push(chunk);});
stream.on('end',()=>{if(stream.destroyed)return;const body=Buffer.concat(chunks);row.requestBytes=body.length;row.ownedProjectByteBinding=body.includes(Buffer.from(projectId));if(!row.ownedProjectByteBinding){deny('CreateBuild does not contain the admitted project ID');return;}forward(body);});
}else forward();
});
server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert(address&&typeof address==='object');
return {url:'http://127.0.0.1:'+address.port,stats,async close(){stopping=true;const closed=once(server,'close');server.close();for(const session of sessions)session.destroy();if(upstream)upstream.destroy();await closed;stats.stopped=true;onUpdate();}};
}
