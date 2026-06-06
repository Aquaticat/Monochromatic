/** Ambient type shim for `.svg` files imported with `{ type: 'text' }` attribute. */
declare module '*.svg' {
  const content: string;
  export default content;
}
