// PROTOTYPE ONLY: Candidate C deterministic local controls.

import { runBriefEditorLocalControls, } from '../prototype-brief-editor-controls.ts';
import { runBriefEditorRuntimeControls, } from '../prototype-brief-editor-runtime-controls.ts';

runBriefEditorLocalControls();
await runBriefEditorRuntimeControls();
console.log('PROTOTYPE brief-before-prose local controls accepted',);
