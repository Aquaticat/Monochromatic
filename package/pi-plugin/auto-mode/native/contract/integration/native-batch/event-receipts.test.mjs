import {env} from './event-receipt-fixture.mjs';
import {verifyEventPhases} from './event-receipt-phases.mjs';
import {verifyEventMethods} from './event-receipt-methods.mjs';
import {verifyEventTraversal} from './event-receipt-traversal.mjs';
import {verifyEventBounds} from './event-receipt-bounds.mjs';
import {verifyEventFailures} from './event-receipt-failures.mjs';

//region One original native environment owns the complete ordered event-receipt pass.
await using cleanup={async [Symbol.asyncDispose](){await env.drain();}};

await verifyEventPhases();
await verifyEventMethods();
verifyEventTraversal();
await verifyEventBounds();
verifyEventFailures();
 console.log(JSON.stringify({
   complete:true,
   nativeEventMethods:6,
   groupedCallbackPhases:90,
   groupedSources:1
 }));
//endregion
