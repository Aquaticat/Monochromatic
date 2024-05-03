import type { Root } from 'hast';

declare function hastShiki(tree: Root): Promise<Root>;
export default hastShiki;

export { }
