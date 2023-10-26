import trimWith, {
  trimEndWith,
} from '../trim-with/index';

const MAX_PATH = 255;

const sanitize = (inputString: string, maxPath = MAX_PATH): string =>
  trimWith(
    trimEndWith((inputString || '').trim(), '.')
      .replaceAll(/\s|\/|\\|\||<|>|:|;|"|'|#|\?|\[|]|\(|\)|\{|}|\^|&|%|\*|\$|@|,|\+|=|`/g, '_'),
    '_',
  )
    .replaceAll(/_{2,}/g, '_').slice(0, maxPath) || '_';

export default sanitize;
