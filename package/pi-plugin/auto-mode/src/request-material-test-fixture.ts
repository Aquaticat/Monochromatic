/**
 Disposable original-reference doubles for maintained request-content consumption.

 @module
 */
import type {
  consumeRequestMaterial,
  RequestMaterialEvidence,
  RequestMaterialRelation,
} from '@monochromatic-dev/pi-plugin-auto-mode';

/**
 Each fixture owns its request, evidence and callback counters.
 */
export type RequestMaterialFixture = {
  /**
   Equal-byte copies remain different request occurrences.
   */
  readonly request: { readonly body: string; };
  /**
   Original test record is borrowed, not frozen by the consumer.
   */
  readonly record: RequestMaterialEvidence;
  /**
   Invocation counts distinguish abstention from attempted policy use.
   */
  readonly calls: { reads: number; acceptances: number; };
  /**
   Maintained consumer input contract is reused directly.
   */
  readonly options: Parameters<typeof consumeRequestMaterial>[0];
};

/**
 Create isolated references without claiming actual native evidence authentication.

 @param choice - supported content relation for this control

 @returns fresh fixture without shared state or provider access

 @example
 ```ts
 const fixture = createRequestMaterialFixture('none');
 const interpretation = consumeRequestMaterial(fixture.options);
 ```
 */
export function createRequestMaterialFixture(choice: RequestMaterialRelation = 'none',): RequestMaterialFixture {
  /**
   Request bytes deliberately include structured content and escaping without requiring reparsing.
   */
  const request = { body: '{"messages":[{"role":"user","content":"quoted\\\" text\\n<instruction>"}]}', };
  /**
   Mutable counters belong to this fixture alone.
   */
  const calls = { reads: 0, acceptances: 0, };
  /**
   Source and evidence retain the same original request object.
   */
  const record: RequestMaterialEvidence = {
    definitionId: 'request_instruction_content',
    definition: { type: 'choice', },
    binding: { claimScope: 'program-request', requestMaterial: request, },
    model: 'fixture-model',
    answer: { status: 'estimate', value: { choice, probabilities: { [choice]: 1, }, }, },
  };
  /**
   No reader or acceptance callback receives an execution capability.
   */
  const options: Parameters<typeof consumeRequestMaterial>[0] = {
    judgment: {
      requestMaterialFor() {
        calls.reads++;
        return request;
      },
    },
    inputs: { instructionSources: [{ request: { request, }, },], },
    record,
    policy: {
      model: 'fixture-model',
      accepts() {
        calls.acceptances++;
        return true;
      },
    },
  };
  return { request, record, calls, options, };
}
