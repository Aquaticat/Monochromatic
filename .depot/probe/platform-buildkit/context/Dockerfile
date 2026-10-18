# syntax=docker.io/docker/dockerfile@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
FROM docker.io/library/node@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS base
ARG TARGETARCH
ARG TARGETOS
ARG BUILD_HARNESS_SHA
ENV BUILD_HARNESS_SHA=${BUILD_HARNESS_SHA}
WORKDIR /app
COPY probe.json /app/probe.json
RUN ["node","--input-type=module-typescript","-e","import {mkdirSync,writeFileSync} from 'node:fs'; import {availableParallelism,totalmem,cpus} from 'node:os'; const count=availableParallelism(); const memory=totalmem(); if(count>16||memory>32*1024**3) throw new Error('Builder exceeds declared 16CPU/32GiB resource bound'); const architecture: string=process.arch; const expected=process.env.TARGETARCH==='amd64'?'x64':'arm64'; if(architecture!==expected) throw new Error('Runtime architecture does not match requested platform'); mkdirSync('/proof',{recursive:true}); writeFileSync('/proof/builder.json',JSON.stringify({architecture,targetArchitecture:process.env.TARGETARCH,targetOs:process.env.TARGETOS,cpuCount:count,memoryBytes:memory,cpuModels:[...new Set(cpus().map(cpu=>cpu.model))],nodeVersion:process.version,harnessCommit:process.env.BUILD_HARNESS_SHA}));"]
FROM base AS service
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=1s --timeout=2s --start-period=1s --retries=3 CMD ["node","--input-type=module-typescript","-e","const response=await fetch('http://127.0.0.1:8080/health',{signal:AbortSignal.timeout(1000)}); const body=await response.json(); if(!response.ok||body.status!=='ok') throw new Error('Fixture health response failed');"]
CMD ["node","--input-type=module-typescript","-e","import {createServer} from 'node:http'; import {readFileSync} from 'node:fs'; const input=JSON.parse(readFileSync('/app/probe.json','utf8')); const nonce: string=process.env.MONO_RESEARCH_NONCE??input.cohort; const server=createServer((request,response)=>{const path=new URL(request.url??'/', 'http://fixture.invalid').pathname; const status=path==='/health'||path==='/nonce'?200:404; response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'}); response.end(JSON.stringify({status:status===200?'ok':'not-found',nonce,cohort:input.cohort,repositoryBase:input.repositoryBase,harnessCommit:process.env.BUILD_HARNESS_SHA,architecture:process.arch,nodeVersion:process.version,path}));}); server.on('error',error=>{throw error;}); process.on('SIGTERM',()=>server.close()); server.listen(Number(process.env.PORT??8080),'0.0.0.0');"]
FROM scratch AS source-evidence
COPY --from=base /app/probe.json /probe.json
COPY --from=base /proof/builder.json /builder.json
FROM base AS forwarding
ARG EXPECTED_SECRET_HASH
ARG EXPECTED_AGENT_NONCE
COPY --from=fixtureinput input.json /proof/context.json
RUN --mount=type=secret,id=fixture,required=true --mount=type=ssh,id=fixture,required=true ["node","--input-type=module-typescript","-e","import {readFileSync,writeFileSync} from 'node:fs'; import {createHash} from 'node:crypto'; import {createConnection} from 'node:net'; import {once} from 'node:events'; const secret=readFileSync('/run/secrets/fixture'); const digest=createHash('sha256').update(secret).digest('hex'); if(digest!==process.env.EXPECTED_SECRET_HASH) throw new Error('Secret mount consumer digest mismatch'); const socket=createConnection({path:process.env.SSH_AUTH_SOCK}); await once(socket,'connect'); const packet=Buffer.alloc(5); packet.writeUInt32BE(1); packet[4]=11; socket.write(packet); let received=Buffer.alloc(0); for await(const chunk of socket){received=Buffer.concat([received,chunk]); if(received.length>4096) throw new Error('Agent fixture exceeded packet bound'); if(received.length>=4&&received.length>=4+received.readUInt32BE(0)) break;} socket.destroy(); if(received[4]!==12||received.readUInt32BE(5)!==1||!received.includes(Buffer.from(process.env.EXPECTED_AGENT_NONCE))) throw new Error('Forwarded keyless SSH agent identity response mismatch'); writeFileSync('/proof/forwarding.json',JSON.stringify({secretSha256:digest,sshAgentComment:process.env.EXPECTED_AGENT_NONCE,privateKeyUsed:false}));"]
FROM scratch AS evidence
COPY --from=forwarding /proof/ /
