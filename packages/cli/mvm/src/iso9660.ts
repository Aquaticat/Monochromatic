/**
 * Minimal ISO9660 image generator for cloud-init NoCloud seed ISOs.
 * Produces a valid ISO containing small text files with a specified volume label.
 * Avoids any external dependency on `genisoimage` or `mkisofs`.
 */

/* oxlint-disable import/namespace -- iso9660-layout exports 35+ constants and helpers; namespace import avoids 40 lines of individual imports that push this file over max-lines */
import * as L from './iso9660-layout.ts';

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
  const recordLen = L.DIR_FIXED_HEADER_SIZE + nameLen + (nameLen % 2 === 0 ? 1 : 0);

  buf[offset] = recordLen;
  L.writeBoth32(view, offset + L.DIR_EXTENT_OFFSET, opts.sector);
  L.writeBoth32(view, offset + L.DIR_SIZE_OFFSET, opts.size);
  L.writeTimestamp7(buf, offset + L.DIR_TIMESTAMP_OFFSET);
  buf[offset + L.DIR_FLAGS_OFFSET] = opts.isDir ? 0x02 : 0x00;
  L.writeBoth16(view, offset + L.DIR_VOL_SEQ_OFFSET, 1);
  buf[offset + L.DIR_NAME_LEN_OFFSET] = nameLen;

  if (opts.name === '\u0000') {
    buf[offset + L.DIR_NAME_DATA_OFFSET] = 0;
  } else if (opts.name === '\u0001') {
    buf[offset + L.DIR_NAME_DATA_OFFSET] = 1;
  } else {
    L.writeStr(buf, offset + L.DIR_NAME_DATA_OFFSET, opts.name, nameLen);
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
  let nextSector = L.FIRST_FILE_DATA_SECTOR;
  const entries = files.map(function mapFileEntry(f) {
    const sector = nextSector;
    nextSector += Math.ceil(f.data.length / L.SECTOR_SIZE) || 1;
    return { data: f.data, name: f.name, sector, };
  });

  const totalSectors = nextSector;
  const iso = new Uint8Array(totalSectors * L.SECTOR_SIZE);
  const view = new DataView(iso.buffer);
  const rootDirSize = L.SECTOR_SIZE;

  //region Primary Volume Descriptor (sector 16)
  const pvd = L.PVD_SECTOR * L.SECTOR_SIZE;
  iso[pvd] = 1;
  L.writeStr(iso, pvd + 1, 'CD001', L.CD001_LENGTH);
  iso[pvd + L.PVD_VERSION_OFFSET] = 1;
  L.writeStr(iso, pvd + L.PVD_SYSTEM_ID_OFFSET, '', L.ISO_STRING_FIELD_LENGTH);
  L.writeStr(iso, pvd + L.PVD_VOLUME_ID_OFFSET, volumeId, L.ISO_STRING_FIELD_LENGTH);
  L.writeBoth32(view, pvd + L.PVD_VOLUME_SPACE_OFFSET, totalSectors);
  L.writeBoth16(view, pvd + L.PVD_VOLUME_SET_SIZE_OFFSET, 1);
  L.writeBoth16(view, pvd + L.PVD_VOLUME_SEQ_OFFSET, 1);
  L.writeBoth16(view, pvd + L.PVD_BLOCK_SIZE_OFFSET, L.SECTOR_SIZE);
  L.writeBoth32(view, pvd + L.PVD_PATH_TABLE_SIZE_OFFSET, L.PATH_TABLE_SIZE);
  view.setUint32(pvd + L.PVD_PATH_TABLE_L_OFFSET, L.PATH_TABLE_LE_SECTOR, true);
  view.setUint32(pvd + L.PVD_PATH_TABLE_M_OFFSET, L.PATH_TABLE_BE_SECTOR, false);
  writeDirEntry(iso, view, pvd + L.PVD_ROOT_DIR_RECORD_OFFSET, { isDir: true, name: '\u0000', sector: L.ROOT_DIRECTORY_SECTOR, size: rootDirSize, });
  L.writeTimestamp17(iso, pvd + L.PVD_CREATION_TIMESTAMP_OFFSET);
  L.writeTimestamp17(iso, pvd + L.PVD_MODIFICATION_TIMESTAMP_OFFSET);
  L.writeTimestamp17(iso, pvd + L.PVD_EXPIRATION_TIMESTAMP_OFFSET);
  L.writeTimestamp17(iso, pvd + L.PVD_EFFECTIVE_TIMESTAMP_OFFSET);
  iso[pvd + L.PVD_FILE_STRUCTURE_VERSION_OFFSET] = 1;
  //endregion

  //region Volume Descriptor Set Terminator (sector 17)
  const vdst = L.VDST_SECTOR * L.SECTOR_SIZE;
  iso[vdst] = 255;
  L.writeStr(iso, vdst + 1, 'CD001', L.CD001_LENGTH);
  iso[vdst + L.PVD_VERSION_OFFSET] = 1;
  //endregion

  //region Path tables (sectors 18 LE, 19 BE)
  for (const [ptSector, le] of [[L.PATH_TABLE_LE_SECTOR, true], [L.PATH_TABLE_BE_SECTOR, false]] as const) {
    const pt = ptSector * L.SECTOR_SIZE;
    iso[pt] = 1;
    view.setUint32(pt + 2, L.ROOT_DIRECTORY_SECTOR, le);
    view.setUint16(pt + L.PATH_TABLE_PARENT_DIR_OFFSET, 1, le);
  }
  //endregion

  //region Root directory (sector 20)
  let pos = L.ROOT_DIRECTORY_SECTOR * L.SECTOR_SIZE;
  pos += writeDirEntry(iso, view, pos, { isDir: true, name: '\u0000', sector: L.ROOT_DIRECTORY_SECTOR, size: rootDirSize, });
  pos += writeDirEntry(iso, view, pos, { isDir: true, name: '\u0001', sector: L.ROOT_DIRECTORY_SECTOR, size: rootDirSize, });

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
    iso.set(entry.data, entry.sector * L.SECTOR_SIZE);
  }
  //endregion

  return iso;
}
