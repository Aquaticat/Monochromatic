// Fixture: object properties on the same line.
// Expected violations: stylistic(object-property-per-line)

const config = { host: 'localhost', port: 3000 };

const nested = { a: 1, b: { c: 2, d: 3 } };

export { config, nested };
