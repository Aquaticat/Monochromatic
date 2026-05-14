// Fixture: all fixable violations in one file for autofix testing.
// Expected: oxlint --fix transforms this to one-item-per-line format.

function create(name: string, age: number): void {}
const items = [1, 2, 3];
const config = { host: 'localhost', port: 3000 };
const { host, port } = config;
type Options = { verbose: boolean; timeout: number };
type Pair = [string, number];

create('Alice', 30);

export { config, create, items };
