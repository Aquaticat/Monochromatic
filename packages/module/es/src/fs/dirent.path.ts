import { pathJoin } from "src/fs/fs.pathJoin.default";

export type DirentLike = {parentPath: string, name: string}

export function direntPathPosix(direntLike: DirentLike): string {
  return `${direntLike.parentPath}/${direntLike.name}`;
}

export function direntPath(direntLike: DirentLike): string {
  return pathJoin(direntLike.parentPath, direntLike.name);
}
