import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  AUDIT_ARMS,
  AUDIT_SOURCE_TEXT,
  RUN_MODELS,
  type RenderingAuditReport,
  runRenderingAudit,
} from '../dist/final/node/index.mjs';
import {
  type AuditWireReport,
  auditScriptedClient,
} from './audit-scripted-client.test-fixture.ts';

//region Audit report
// A REAL RENDERING AUDIT REPORT OVER A SCRIPTED ROSTER, for the cases that
// read what a report prints without building one by hand.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. The audit runs for real over the sensitivity
// fixtures and a scripted client, so the report is what production would
// build from the same answers.

/**
 Runs the audit over the flipped or the clean rendering with scripted
 auditors.

 @param reportFor - report each roster auditor casts

 @param silent - auditors whose voice is always lost, none by default

 @param clean - whether the clean rendering is audited rather than the flipped one

 @returns The report the audit builds

 @example
 ```ts
 const report = await auditReportOver({ reportFor: function quiet() { return QUIET_AUDIT_REPORT; }, clean: false, },);
 ```
 */
export async function auditReportOver(
  {
    reportFor,
    silent = [],
    clean,
  }: {
    readonly reportFor: (modelId: string,) => AuditWireReport;
    readonly silent?: readonly string[];
    readonly clean: boolean;
  },
): Promise<RenderingAuditReport> {
  /**
   Rendering the arm audits.
   */
  const arm = nonNullishOrThrow(AUDIT_ARMS[clean ? 1 : 0],);

  return await runRenderingAudit({
    client: auditScriptedClient({
      reportFor,
      asked: [],
      silent,
    },),
    subject: {
      sourceText: AUDIT_SOURCE_TEXT,
      candidateText: arm.candidateText,
    },
    modelIds: RUN_MODELS.checkerModelIds,
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    l: tagged({ tag: 'audit-report-fixture', },),
  },);
}

//endregion Audit report
