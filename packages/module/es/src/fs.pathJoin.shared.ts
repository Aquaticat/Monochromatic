export function trimPathTrailingSlash(path: string): string {
  return path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;
}

export function trimPathLeadingSlash(path: string): string {
  return path !== '/' && path.startsWith('/') ? path.slice(1) : path;
}
