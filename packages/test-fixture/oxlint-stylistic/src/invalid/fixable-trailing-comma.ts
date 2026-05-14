// Fixture: violations with trailing commas that should be preserved after fix.
// Expected: oxlint --fix preserves trailing commas.

function create(name: string, age: number,): void {}
const items = [1, 2, 3,];
const config = { host: 'localhost', port: 3000, };
const { host, port, } = config;

create('Alice', 30,);

export { config, create, items, };
