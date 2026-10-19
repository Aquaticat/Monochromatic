/** Built producer completion preserves active consumers, current diagnostics and original identity tombstones. @module */
import { runProducerLifetimeCases } from './native-producer-lifetime-lifecycle.mjs';
import { runProducerMutationControls } from './native-producer-lifetime-mutation.mjs';

//region Controlled streams isolate producer ownership; the separate capacity guard uses the actual native session.
await runProducerLifetimeCases();
await runProducerMutationControls();
//endregion Controlled streams isolate producer ownership; the separate capacity guard uses the actual native session.
