/**
 Capture actual child completion and complete stderr for receipt probes. @module
 */
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

//region Each child owns its environment, stream buffers and bounded lifetime.
/**
 Bound an unexpectedly stuck fixture child without changing the outer verification process.
 */
const CHILD_TIMEOUT_MS=10_000;
/**
 Execute the built network guard and retain complete terminal results.
 
 @param guard - built native guard loaded by the consuming Node process
 
 @param directory - disposable child home and working directory
 
 @param script - original complete JavaScript program
 
 @param receipt - exact receipt destination without inherited environment leakage
 
 @returns original complete standard output after successful quiet child exit
 
 @throws AssertionError when a child fails, is killed or emits diagnostics
 
 @example await runReceiptProbe({ guard, directory, script, receipt });
 */
export async function runReceiptProbe({
  guard,
  directory,
  script,
  receipt
}:Readonly<{
  guard:string;
  directory:string;
  script:string;
  receipt:string
}>):Promise<string>{
 /**
  Spawn owns only disposable state and the fixture-local synthetic credential.
  */
 const child=spawn(
   process.execPath,
   [
     '--import',
     guard,
     '--input-type=module',
     '--eval',
     script
   ],
   {
     cwd:directory,
     env:{
       ...process.env,
       HOME:directory,
       PI_AUTO_MODE_CLI_FIXTURE_CHILD:'1',
       PI_AUTO_MODE_CLI_FIXTURE_REQUESTS:receipt,
       AUTO_MODE_LLMGATEWAY_API_KEY:'synthetic-local-fixture-only'
     },
     stdio:[
       'ignore',
       'pipe',
       'pipe'
     ],
     signal:AbortSignal.timeout(CHILD_TIMEOUT_MS),
     killSignal:'SIGKILL',
   }
 );
 /**
  Standard output is admitted only after the corresponding process exit.
  */
 const output:Buffer[]=[];
 /**
  No shutdown or callback diagnostic may be silently discarded.
  */
 const diagnostics:Buffer[]=[];
 /**
  Retain original output bytes until the child finishes.

  @param chunk - original unencoded stdout bytes
  */
 function captureReceiptOutput(chunk:Buffer):void {
  output.push(chunk);
 }
 /**
  Retain every diagnostic byte without returning data to the stream emitter.

  @param chunk - original unencoded stderr bytes
  */
 function captureReceiptDiagnostics(chunk:Buffer):void {
  diagnostics.push(chunk);
 }
 child.stdout
   .on(
     'data',
     captureReceiptOutput
   );
 child.stderr
   .on(
     'data',
     captureReceiptDiagnostics
   );
 /**
  Native event values remain unknown until the exact exit contract is asserted.
  */
 const closed:readonly unknown[]=await once(
   child,
   'close'
 );
 /**
  Exit status and signal describe the actual child, not its last output line.
  */
 const[code,signal]=closed;
 /**
  Preserve the complete stderr as assertion evidence.
  */
 const stderr=Buffer.concat(diagnostics)
   .toString('utf8');
 assert.equal(
   signal,
   null,
   stderr
 );assert.equal(
   code,
   0,
   stderr
 );
 assert.equal(
   stderr,
   '',
   'The isolated receipt probe must retain complete empty stderr'
 );
 return Buffer.concat(output)
   .toString('utf8');
}
//endregion
