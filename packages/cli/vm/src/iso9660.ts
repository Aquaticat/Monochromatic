/**
 * Minimal ISO9660 image generator for cloud-init NoCloud seed ISOs.
 * Produces a valid ISO containing small text files with a specified volume label.
 * Avoids any external dependency on `genisoimage` or `mkisofs`.
 */

/** ISO9660 logical sector size in bytes. */
const SECTOR_SIZE = 2048;

//region Binary format helpers

/** Writes a space-padded ASCII string at the given offset. */
function writeStr(buf: Uint8Array, offset: number, str: string, len: number): void {
  for (let idx = 0; idx < len; idx++) {
    buf[offset + idx] = idx < str.length ? str.charCodeAt(idx) : 0x20;
  }
}

/** Writes a 16-bit value in both little-endian and big-endian (ISO 7.3.3). */
function writeBoth16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
  view.setUint16(offset + 2, value, false);
}

/** Writes a 32-bit value in both little-endian and big-endian (ISO 7.3.3). */
function writeBoth32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
  view.setUint32(offset + 4, value, false);
}

/** Writes a 7-byte recording timestamp (ISO 9.1.5). */
function writeTimestamp7(buf: Uint8Array, offset: number): void {
  buf[offset] = 126;   // year since 1900 (2026)
  buf[offset + 1] = 1; // month
  buf[offset + 2] = 1; // day
}

/** Writes a 17-byte descriptor timestamp (ISO 8.4.26.1). */
function writeTimestamp17(buf: Uint8Array, offset: number): void {
  writeStr(buf, offset, '2026010100000000', 16);
}

//endregion

//region Directory record writer

/**
 * Writes a single ISO9660 directory entry at the given buffer offset.
 *
 * @returns Number of bytes written (the record length)
 */
function writeDirEntry(
  buf: Uint8Array,
  view: DataView,
  offset: number,
  opts: { isDir: boolean; name: string; sector: number; size: number },
): number {
  const nameLen = opts.name === '\x00' || opts.name === '\x01' ? 1 : opts.name.length;
  /** Record length must be even per ISO9660. */
  const recordLen = 33 + nameLen + (nameLen % 2 === 0 ? 1 : 0);

  buf[offset] = recordLen;
  writeBoth32(view, offset + 2, opts.sector);
  writeBoth32(view, offset + 10, opts.size);
  writeTimestamp7(buf, offset + 18);
  buf[offset + 25] = opts.isDir ? 0x02 : 0x00;
  writeBoth16(view, offset + 28, 1);
  buf[offset + 32] = nameLen;

  if (opts.name === '\x00') {
    buf[offset + 33] = 0;
  } else if (opts.name === '\x01') {
    buf[offset + 33] = 1;
  } else {
    writeStr(buf, offset + 33, opts.name, nameLen);
  }

  return recordLen;
}

//endregion

/**
 * Creates a minimal ISO9660 image containing the given files.
 *
 * Layout: system area (sectors 0-15), PVD (16), VDST (17),
 * path table L (18), path table M (19), root directory (20), file data (21+).
 *
 * File identifiers use lowercase names with ";1" version suffix.
 * This is technically non-Level-1-compliant but the Linux kernel reads it correctly,
 * which is all cloud-init needs.
 *
 * @param options - Volume ID string and array of files with name and data
 * @returns Complete ISO9660 image as a byte array
 *
 * @example
 * ```ts
 * const iso = createIso({
 *   volumeId: 'cidata',
 *   files: [
 *     { name: 'user-data', data: new TextEncoder().encode('#cloud-config\n') },
 *     { name: 'meta-data', data: new TextEncoder().encode('instance-id: test\n') },
 *   ],
 * });
 * ```
 */
export function createIso({ files, volumeId }: {
  files: ReadonlyArray<{ data: Uint8Array; name: string }>;
  volumeId: string;
}): Uint8Array {
  const ROOT_SECTOR = 20;
  const FIRST_FILE_SECTOR = 21;

  let nextSector = FIRST_FILE_SECTOR;
  const entries = files.map((f) => {
    const sector = nextSector;
    nextSector += Math.ceil(f.data.length / SECTOR_SIZE) || 1;
    return { data: f.data, name: f.name, sector, };
  });

  const totalSectors = nextSector;
  const iso = new Uint8Array(totalSectors * SECTOR_SIZE);
  const view = new DataView(iso.buffer);
  const rootDirSize = SECTOR_SIZE;

  //region Primary Volume Descriptor (sector 16)
  const pvd = 16 * SECTOR_SIZE;
  iso[pvd] = 1;
  writeStr(iso, pvd + 1, 'CD001', 5);
  iso[pvd + 6] = 1;
  writeStr(iso, pvd + 8, '', 32);
  writeStr(iso, pvd + 40, volumeId, 32);
  writeBoth32(view, pvd + 80, totalSectors);
  writeBoth16(view, pvd + 120, 1);
  writeBoth16(view, pvd + 124, 1);
  writeBoth16(view, pvd + 128, SECTOR_SIZE);
  writeBoth32(view, pvd + 132, 10);
  view.setUint32(pvd + 140, 18, true);
  view.setUint32(pvd + 148, 19, false);
  writeDirEntry(iso, view, pvd + 156, { isDir: true, name: '\x00', sector: ROOT_SECTOR, size: rootDirSize, });
  writeTimestamp17(iso, pvd + 813);
  writeTimestamp17(iso, pvd + 830);
  writeTimestamp17(iso, pvd + 847);
  writeTimestamp17(iso, pvd + 864);
  iso[pvd + 881] = 1;
  //endregion

  //region Volume Descriptor Set Terminator (sector 17)
  const vdst = 17 * SECTOR_SIZE;
  iso[vdst] = 255;
  writeStr(iso, vdst + 1, 'CD001', 5);
  iso[vdst + 6] = 1;
  //endregion

  //region Path tables (sectors 18 LE, 19 BE)
  for (const [ptSector, le] of [[18, true], [19, false]] as const) {
    const pt = ptSector * SECTOR_SIZE;
    iso[pt] = 1;
    view.setUint32(pt + 2, ROOT_SECTOR, le);
    view.setUint16(pt + 6, 1, le);
  }
  //endregion

  //region Root directory (sector 20)
  let pos = ROOT_SECTOR * SECTOR_SIZE;
  pos += writeDirEntry(iso, view, pos, { isDir: true, name: '\x00', sector: ROOT_SECTOR, size: rootDirSize, });
  pos += writeDirEntry(iso, view, pos, { isDir: true, name: '\x01', sector: ROOT_SECTOR, size: rootDirSize, });

  for (const entry of entries) {
    pos += writeDirEntry(iso, view, pos, {
      isDir: false,
      name: `${entry.name};1`,
      sector: entry.sector,
      size: entry.data.length,
    });
  }
  //endregion

  //region File data
  for (const entry of entries) {
    iso.set(entry.data, entry.sector * SECTOR_SIZE);
  }
  //endregion

  return iso;
}
