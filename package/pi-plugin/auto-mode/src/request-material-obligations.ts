/**
 Keep content interpretation separate from governing use and complete source coverage.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { RequestMaterialInterpretation, RequestMaterialPremiseIssue, } from './request-material-types.ts';

/**
 Diagnostics never serialize the interpreted request or borrowed evidence.
 */
const l = tagged({ tag: 'auto-mode-request-material-obligations', },);

/**
 Retain original domain obligations and add independent uncertainty about instruction use.
 This consumes an interpretation produced from authenticated evidence, not a caller admission flag.
 A fresh result array leaves the caller's issue list unchanged.
 Only a rewritten domain issue or a newly created obligation is frozen.
 No request-wide directive, authority, permission or completeness is inferred.

 @param issues - original compiler premise diagnostics

 @param interpretation - original content-use result without authority or permission

 @returns existing obligations plus independent unresolved content or governing-use obligations

 @example
 ```ts
 const issues = retainRequestMaterialObligations({ issues: [], interpretation });
 // A potential instruction needs governing-use accounting even without a domain hold.
 ```
 */
export function retainRequestMaterialObligations(
  { issues, interpretation, }: {
    readonly issues: readonly RequestMaterialPremiseIssue[];
    readonly interpretation: RequestMaterialInterpretation;
  },
): RequestMaterialPremiseIssue[] {
  /**
   Attribute content-use diagnostics separately from admission policy.
   */
  const rl = tagged({ tag: retainRequestMaterialObligations.name, l, },);
  rl.debug('retaining original request material obligations',);
  /**
   Unrelated issues retain their exact references and details.
   */
  const result: RequestMaterialPremiseIssue[] = issues.map(function retainIssue(issue,) {
    return issue.kind === 'request-source-domain'
      ? Object.freeze({
        ...issue,
        requestMaterialInterpretation: interpretation,
        reason: 'The complete original request material was selected and assessed; origin association, instruction authority, valid delegation and exhaustive governing sufficiency are not established by that content estimate.',
      },)
      : issue;
  },);
  if (interpretation.admission === 'admitted' && interpretation.relation === 'potential-instruction') {
    rl.debug('retaining independent potential-instruction use obligation',);
    result.push(Object.freeze({
      premise: 'qualified-rule-interpretation',
      kind: 'request-material-instruction-use',
      request: interpretation.request,
      evidence: interpretation.evidence,
      reason: 'Original request material may contain operative instructions, including repeated indexed text, but no source-bound consumer establishes their represented or independent governing use. This content estimate supplies neither another directive nor uniform request authority.',
    },),);
  }
  if (interpretation.admission !== 'admitted' || interpretation.relation === 'unknown') {
    rl.debug('retaining unresolved request-content interpretation',);
    result.push(Object.freeze({
      premise: 'qualified-rule-interpretation',
      kind: 'request-material-interpretation',
      request: interpretation.request,
      evidence: interpretation.evidence,
      reason: 'The original whole-request material has no admitted resolved content interpretation.',
    },),);
  }
  return result;
}
