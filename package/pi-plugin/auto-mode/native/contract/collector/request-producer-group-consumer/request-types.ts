/** Original request handoff authenticates producer custody before reading observer receipts. @module */

/** Request observations retain their caller-owned receipt identity and precise source type. */
export type MainAgentRequestInput<Receipt extends object> = Readonly<{
  producerOwner: Readonly<{
    assertMainAgentResponse: (input: Readonly<{ stream: object; response: object }>) => unknown;
  }>;
  observer: Readonly<{ observationFor: (response: object) => Receipt }>;
  stream: object;
  response: object;
}>;
