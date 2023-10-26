import trimWith, {
  trimEndWith,
} from '../trim-with/index.js';

// potentialId generated from a heading or something.
const potentialId = (element: HTMLElement): string => {
  const result = element.id
    || trimWith(
      trimEndWith((element.textContent ?? '').trim(), '.')
        .replaceAll(/\s|\/|\\|\||<|>|:|;|"|'|#|\?|\[|]|\(|\)|\{|}|\^|&|%|\*|\$|@|,|\+|=|`/g, '_'),
      '_',
    )
      .replaceAll(/_{2,}/g, '_')
    || '1';

  element.removeAttribute('id');

  return result;
};

export default potentialId;
