// Fixture: type members on the same line.
// Expected violations: stylistic(type-property-per-line)

type Config = { host: string; port: number };

type Nested = { a: number; b: { c: string; d: boolean } };

export type { Config, Nested };
