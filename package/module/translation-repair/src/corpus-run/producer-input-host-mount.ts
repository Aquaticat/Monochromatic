import {
  isAbsolute,
  normalize,
  relative,
} from 'node:path';
import { ProducerInputRunError, } from './producer-input-error.ts';

//region Metadata-only mount topology, never body or approval authority

/**
 Kernel mount records are observations in the executing host's namespace.
 */
export type ProducerInputHostMount = {
  /**
   Unique reported mount ID, not a filesystem or creation certificate.
   */
  readonly id: string;
  /**
   Canonical decoded kernel mountpoint.
   */
  readonly point: string;
  /**
   Per-mount options are separate from superblock options.
   */
  readonly options: readonly string[];
  /**
   Kernel filesystem type supports the fixed child platform-mount checks.
   */
  readonly filesystem: string;
};

/**
 Fixed mountinfo field positions follow the Linux record grammar.
 */
const MOUNTINFO = {
  minimumFields: 10,
  point: 4,
  options: 5,
  separatorMinimum: 6,
  trailingFields: 4,
  escapeWidth: 4,
} as const;
/**
 Kernel pathname escapes are decoded once, never recursively.
 */
const MOUNT_ESCAPES: Readonly<Record<string, string>> = {
  '\\040': ' ',
  '\\011': '\t',
  '\\012': '\n',
  '\\134': '\\',
};

/**
 Tests component-wise containment rather than admitting sibling prefix collisions.
 
 @param parent - canonical absolute directory
 
 @param child - canonical absolute path
 
 @returns Whether child equals or lies beneath parent
 
 @example
 ```ts
 const contained = producerInputPathWithin({ parent: '/input', child: '/input-more' });
 ```
 */
export function producerInputPathWithin({
  parent,
  child,
}: {
  readonly parent: string;
  readonly child: string
},): boolean {
  /**
   Relative path exposes directory boundaries without filesystem reads.
   */
  const path = relative(
    parent,
    child
  );
  return (path === '') || ((path !== '..') && (!path.startsWith('../'))
    && (!isAbsolute(path)));
}

/**
 Decodes only the kernel's quoted pathname bytes needed for component comparison.
 
 @param value - one mountpoint token, never a whole record diagnostic
 
 @returns Decoded absolute mountpoint
 
 @throws ProducerInputRunError when the pathname grammar cannot be established
 
 @example
 ```ts
 const point = mountPoint('/owned\\040directory');
 ```
 */
function mountPoint(value: string): string {
  /**
   Single-pass pieces preserve literal backslashes produced by an escape.
   */
  const pieces: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value.charAt(index) !== '\\') {
      pieces.push(value.charAt(index));
      continue;
    }
    /**
     Only a complete recognized escape can advance over encoded bytes.
     */
    const escape = MOUNT_ESCAPES[value.slice(
      index,
      index + MOUNTINFO.escapeWidth
    )];
    if (escape === undefined)
      throw new ProducerInputRunError({
        operation: 'verify-host-layout',
        locator: 'host mount topology',
      });
    pieces.push(escape);
    index += MOUNTINFO.escapeWidth - 1;
  }
  /**
   A mountpoint cannot authorize a relative host path.
   */
  const point = pieces.join('');
  if ((!isAbsolute(point)) || (normalize(point) !== point)
    || point.includes('\0'))
    throw new ProducerInputRunError({
      operation: 'verify-host-layout',
      locator: 'host mount topology',
    });
  return point;
}

/**
 Reads the bounded host profile's mountpoint inventory without filesystem-specific device arithmetic.
 Stacked or nested participating mounts are refused by the owning layout check rather than guessed.
 
 @param text - metadata read from the host's own mountinfo file
 
 @returns Owned mount identities and pathnames
 
 @throws ProducerInputRunError when a kernel record or its identity is ambiguous
 
 @example
 ```ts
 const mounts = readProducerInputHostMounts(text);
 ```
 */
export function readProducerInputHostMounts(text: string): readonly ProducerInputHostMount[] {
  if ((text.length === 0) || (!text.endsWith('\n')))
    throw new ProducerInputRunError({
      operation: 'verify-host-layout',
      locator: 'host mount topology',
    });
  /**
   Empty records are not silently removed from a supposedly complete namespace observation.
   */
  const rows = text.slice(
    0,
    -1
  )
    .split('\n')
    .map(function parse(line): ProducerInputHostMount {
    /**
     Space-delimited fields contain escaped, not literal, pathname whitespace.
     */
    const fields = line.split(' ');
    /**
     Optional fields end at one literal separator.
     */
    const separator = fields.indexOf('-');
    /**
     Numeric identity is kept as its canonical kernel spelling.
     */
    const [id] = fields;
    /**
     Missing mountpoints never become an empty fallback path.
     */
    const point = fields[MOUNTINFO.point];
    /**
     Per-mount access flags are never inferred from filesystem-wide options.
     */
    const options = fields[MOUNTINFO.options];
    /**
     Filesystem type follows the extensible optional-field separator.
     */
    const filesystem = fields[separator + 1];
    if ((options === undefined) || (options.length === 0)
      || (filesystem === undefined)
      || (filesystem.length === 0)
      || (fields.length < MOUNTINFO.minimumFields)
      || (separator < MOUNTINFO.separatorMinimum)
      || (fields.length !== (separator
        + MOUNTINFO.trailingFields))
      || (id === undefined)
      || (point === undefined)
      || (!Number.isSafeInteger(Number(id)))
      || (Number(id) <= 0)
      || (String(Number(id)) !== id))
      throw new ProducerInputRunError({
        operation: 'verify-host-layout',
        locator: 'host mount topology',
      });
    return {
      id,
      point: mountPoint(point),
      options: options.split(','),
      filesystem,
    };
  });
  if (new Set(rows.map(function identity(row): string {
    return row.id;
  })).size !== rows.length)
    throw new ProducerInputRunError({
      operation: 'verify-host-layout',
      locator: 'host mount topology',
    });
  return rows;
}

//endregion Metadata-only mount topology, never body or approval authority
