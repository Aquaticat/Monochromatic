/**
 * Minimal ISO9660 image generator for cloud-init NoCloud seed ISOs.
 * Produces a valid ISO containing small text files with a specified volume label.
 * Avoids any external dependency on `genisoimage` or `mkisofs`.
 */

/** ISO9660 logical sector size in bytes. */
const SECTOR_SIZE = 2_048;

//region ISO 9660 field offsets and sizes
// These constants correspond to byte offsets within ISO 9660 data structures.
// Names follow the pattern: <STRUCTURE>_<FIELD>_OFFSET or <FIELD>_SIZE.

/** ASCII space character used to pad fixed-width string fields. */
const ASCII_SPACE = 0x20;

/** Size of dual-endian 32-bit values (4 bytes LE + 4 bytes BE). */
const DUAL_32_SIZE = 4;

/** Length of the ISO 9660 standard identifier string `CD001`. */
const CD001_LENGTH = 5;

/** Length of a fixed-width ISO 9660 string identifier (system id, volume id). */
const ISO_STRING_FIELD_LENGTH = 32;

/** Length of a 17-byte descriptor timestamp (ISO 8.4.26.1) string portion. */
const TIMESTAMP_17_STR_LENGTH = 16;

//region Directory entry field offsets (relative to record start)
/** Offset of extent location (LBA) within a directory record. */
const DIR_EXTENT_OFFSET = 2;
/** Offset of data length within a directory record. */
const DIR_SIZE_OFFSET = 10;
/** Offset of recording timestamp within a directory record. */
const DIR_TIMESTAMP_OFFSET = 18;
/** Offset of file flags byte within a directory record. */
const DIR_FLAGS_OFFSET = 25;
/** Offset of volume sequence number within a directory record. */
const DIR_VOL_SEQ_OFFSET = 28;
/** Offset of file identifier length within a directory record. */
const DIR_NAME_LEN_OFFSET = 32;
/** Offset of file identifier string within a directory record. */
const DIR_NAME_DATA_OFFSET = 33;
/** Fixed header size before the file identifier in a directory record. */
const DIR_FIXED_HEADER_SIZE = 33;
//endregion Directory entry field offsets

/** Year value stored in 7-byte timestamps: 2026 minus 1900 base year. */
const TIMESTAMP_YEAR_SINCE_1900 = 126;

//region Primary Volume Descriptor field offsets (relative to PVD start)
/** PVD sector number within the ISO image. */
const PVD_SECTOR = 16;
/** Offset of version byte within PVD. */
const PVD_VERSION_OFFSET = 6;
/** Offset of system identifier within PVD. */
const PVD_SYSTEM_ID_OFFSET = 8;
/** Offset of volume identifier within PVD. */
const PVD_VOLUME_ID_OFFSET = 40;
/** Offset of volume space size (total sectors) within PVD. */
const PVD_VOLUME_SPACE_OFFSET = 80;
/** Offset of volume set size within PVD. */
const PVD_VOLUME_SET_SIZE_OFFSET = 120;
/** Offset of volume sequence number within PVD. */
const PVD_VOLUME_SEQ_OFFSET = 124;
/** Offset of logical block size within PVD. */
const PVD_BLOCK_SIZE_OFFSET = 128;
/** Offset of path table size within PVD. */
const PVD_PATH_TABLE_SIZE_OFFSET = 132;
/** Offset of type L path table location within PVD. */
const PVD_PATH_TABLE_L_OFFSET = 140;
/** Offset of type M path table location within PVD. */
const PVD_PATH_TABLE_M_OFFSET = 148;
/** Offset of root directory record within PVD. */
const PVD_ROOT_DIR_RECORD_OFFSET = 156;
/** Offset of volume creation timestamp within PVD. */
const PVD_CREATION_TIMESTAMP_OFFSET = 813;
/** Offset of volume modification timestamp within PVD. */
const PVD_MODIFICATION_TIMESTAMP_OFFSET = 830;
/** Offset of volume expiration timestamp within PVD. */
const PVD_EXPIRATION_TIMESTAMP_OFFSET = 847;
/** Offset of volume effective timestamp within PVD. */
const PVD_EFFECTIVE_TIMESTAMP_OFFSET = 864;
/** Offset of file structure version within PVD. */
const PVD_FILE_STRUCTURE_VERSION_OFFSET = 881;
//endregion Primary Volume Descriptor field offsets

/** VDST sector number (Volume Descriptor Set Terminator). */
const VDST_SECTOR = 17;

/** Path table LE sector number. */
const PATH_TABLE_LE_SECTOR = 18;
/** Path table BE sector number. */
const PATH_TABLE_BE_SECTOR = 19;
/** Offset of parent directory number within a path table entry. */
const PATH_TABLE_PARENT_DIR_OFFSET = 6;

/** Root directory sector number. */
const ROOT_DIRECTORY_SECTOR = 20;
/** First sector available for file data. */
const FIRST_FILE_DATA_SECTOR = 21;
/** Path table size in bytes (single root entry). */
const PATH_TABLE_SIZE = 10;

//endregion ISO 9660 field offsets and sizes

//region Binary format helpers

/**
 * Writes a space-padded ASCII string at the given offset.
 *
 * @param buf - Target byte array
 *
 * @param offset - Byte offset to start writing at
 *
 * @param str - ASCII string to write
 *
 * @param len - Fixed-width field length to fill (padded with spaces)
 */
function writeStr(buf: Uint8Array, offset: number, str: string, len: number): void {
  for (let idx = 0; idx < len; idx++) {
    buf[offset + idx] = idx < str.length ? str.charCodeAt(idx) : ASCII_SPACE;
  }
}

/**
 * Writes a 16-bit value in both little-endian and big-endian (ISO 7.3.3).
 *
 * @param view - DataView for the target buffer
 *
 * @param offset - Byte offset for the LE value (BE follows at offset+2)
 *
 * @param value - 16-bit unsigned integer to write
 */
function writeBoth16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
  view.setUint16(offset + 2, value, false);
}

/**
 * Writes a 32-bit value in both little-endian and big-endian (ISO 7.3.3).
 *
 * @param view - DataView for the target buffer
 *
 * @param offset - Byte offset for the LE value (BE follows at offset+4)
 *
 * @param value - 32-bit unsigned integer to write
 */
function writeBoth32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
  view.setUint32(offset + DUAL_32_SIZE, value, false);
}

/**
 * Writes a 7-byte recording timestamp (ISO 9.1.5).
 *
 * @param buf - Target byte array
 *
 * @param offset - Byte offset to start writing at
 */
function writeTimestamp7(buf: Uint8Array, offset: number): void {
  buf[offset] = TIMESTAMP_YEAR_SINCE_1900;
  buf[offset + 1] = 1; // month
  buf[offset + 2] = 1; // day
}

/**
 * Writes a 17-byte descriptor timestamp (ISO 8.4.26.1).
 *
 * @param buf - Target byte array
 *
 * @param offset - Byte offset to start writing at
 */
function writeTimestamp17(buf: Uint8Array, offset: number): void {
  writeStr(buf, offset, '2026010100000000', TIMESTAMP_17_STR_LENGTH);
}

//endregion

//region Directory record writer

/**
 * Writes a single ISO9660 directory entry at the given buffer offset.
 *
 * @param buf - Target byte array
 *
 * @param view - DataView for the target buffer
 *
 * @param offset - Byte offset within the buffer
 *
 * @param opts - Directory entry parameters (directory flag, name, sector, size)
 *
 * @returns Number of bytes written (the record length)
 */
function writeDirEntry(
  buf: Uint8Array,
  view: DataView,
  offset: number,
  opts: { isDir: boolean; name: string; sector: number; size: number },
): number {
  const nameLen = opts.name === '\u0000' || opts.name === '\u0001' ? 1 : opts.name.length;
  /** Record length must be even per ISO9660. */
  const recordLen = DIR_FIXED_HEADER_SIZE + nameLen + (nameLen % 2 === 0 ? 1 : 0);

  buf[offset] = recordLen;
  writeBoth32(view, offset + DIR_EXTENT_OFFSET, opts.sector);
  writeBoth32(view, offset + DIR_SIZE_OFFSET, opts.size);
  writeTimestamp7(buf, offset + DIR_TIMESTAMP_OFFSET);
  buf[offset + DIR_FLAGS_OFFSET] = opts.isDir ? 0x02 : 0x00;
  writeBoth16(view, offset + DIR_VOL_SEQ_OFFSET, 1);
  buf[offset + DIR_NAME_LEN_OFFSET] = nameLen;

  if (opts.name === '\u0000') {
    buf[offset + DIR_NAME_DATA_OFFSET] = 0;
  } else if (opts.name === '\u0001') {
    buf[offset + DIR_NAME_DATA_OFFSET] = 1;
  } else {
    writeStr(buf, offset + DIR_NAME_DATA_OFFSET, opts.name, nameLen);
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
 * @param files - Array of files to include, each with name and data
 *
 * @param volumeId - Volume identifier string for the ISO
 *
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
  files: readonly { data: Uint8Array; name: string }[];
  volumeId: string;
}): Uint8Array {
  let nextSector = FIRST_FILE_DATA_SECTOR;
  const entries = files.map(function mapFileEntry(f) {
    const sector = nextSector;
    nextSector += Math.ceil(f.data.length / SECTOR_SIZE) || 1;
    return { data: f.data, name: f.name, sector, };
  });

  const totalSectors = nextSector;
  const iso = new Uint8Array(totalSectors * SECTOR_SIZE);
  const view = new DataView(iso.buffer);
  const rootDirSize = SECTOR_SIZE;

  //region Primary Volume Descriptor (sector 16)
  const pvd = PVD_SECTOR * SECTOR_SIZE;
  iso[pvd] = 1;
  writeStr(iso, pvd + 1, 'CD001', CD001_LENGTH);
  iso[pvd + PVD_VERSION_OFFSET] = 1;
  writeStr(iso, pvd + PVD_SYSTEM_ID_OFFSET, '', ISO_STRING_FIELD_LENGTH);
  writeStr(iso, pvd + PVD_VOLUME_ID_OFFSET, volumeId, ISO_STRING_FIELD_LENGTH);
  writeBoth32(view, pvd + PVD_VOLUME_SPACE_OFFSET, totalSectors);
  writeBoth16(view, pvd + PVD_VOLUME_SET_SIZE_OFFSET, 1);
  writeBoth16(view, pvd + PVD_VOLUME_SEQ_OFFSET, 1);
  writeBoth16(view, pvd + PVD_BLOCK_SIZE_OFFSET, SECTOR_SIZE);
  writeBoth32(view, pvd + PVD_PATH_TABLE_SIZE_OFFSET, PATH_TABLE_SIZE);
  view.setUint32(pvd + PVD_PATH_TABLE_L_OFFSET, PATH_TABLE_LE_SECTOR, true);
  view.setUint32(pvd + PVD_PATH_TABLE_M_OFFSET, PATH_TABLE_BE_SECTOR, false);
  writeDirEntry(iso, view, pvd + PVD_ROOT_DIR_RECORD_OFFSET, { isDir: true, name: '\u0000', sector: ROOT_DIRECTORY_SECTOR, size: rootDirSize, });
  writeTimestamp17(iso, pvd + PVD_CREATION_TIMESTAMP_OFFSET);
  writeTimestamp17(iso, pvd + PVD_MODIFICATION_TIMESTAMP_OFFSET);
  writeTimestamp17(iso, pvd + PVD_EXPIRATION_TIMESTAMP_OFFSET);
  writeTimestamp17(iso, pvd + PVD_EFFECTIVE_TIMESTAMP_OFFSET);
  iso[pvd + PVD_FILE_STRUCTURE_VERSION_OFFSET] = 1;
  //endregion

  //region Volume Descriptor Set Terminator (sector 17)
  const vdst = VDST_SECTOR * SECTOR_SIZE;
  iso[vdst] = 255;
  writeStr(iso, vdst + 1, 'CD001', CD001_LENGTH);
  iso[vdst + PVD_VERSION_OFFSET] = 1;
  //endregion

  //region Path tables (sectors 18 LE, 19 BE)
  for (const [ptSector, le] of [[PATH_TABLE_LE_SECTOR, true], [PATH_TABLE_BE_SECTOR, false]] as const) {
    const pt = ptSector * SECTOR_SIZE;
    iso[pt] = 1;
    view.setUint32(pt + 2, ROOT_DIRECTORY_SECTOR, le);
    view.setUint16(pt + PATH_TABLE_PARENT_DIR_OFFSET, 1, le);
  }
  //endregion

  //region Root directory (sector 20)
  let pos = ROOT_DIRECTORY_SECTOR * SECTOR_SIZE;
  pos += writeDirEntry(iso, view, pos, { isDir: true, name: '\u0000', sector: ROOT_DIRECTORY_SECTOR, size: rootDirSize, });
  pos += writeDirEntry(iso, view, pos, { isDir: true, name: '\u0001', sector: ROOT_DIRECTORY_SECTOR, size: rootDirSize, });

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
