// CSS mixins as functions -- solves the @mixin/@apply problem from TROUBLESHOOTING.md.
// Import resolution works because this is JS. Composition works via template literals.

export const flexCenter = () => `
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const resetList = () => `
  list-style: none;
  margin: 0;
  padding: 0;
`;

export const truncate = (lines = 1) =>
  lines === 1
    ? `
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
    : `
  display: -webkit-box;
  -webkit-line-clamp: ${lines};
  -webkit-box-orient: vertical;
  overflow: hidden;
`;
