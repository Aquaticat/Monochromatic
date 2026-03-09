import { describe, expect, test } from 'bun:test';

import { createIso } from './iso9660.ts';

describe('createIso', () => {
  const encoder = new TextEncoder();

  test('produces valid ISO9660 with CD001 signature at sector 16', () => {
    const iso = createIso({
      files: [
        { data: encoder.encode('hello'), name: 'test-file', },
      ],
      volumeId: 'TESTLABEL',
    });

    const SECTOR_SIZE = 2_048;
    const pvdOffset = 16 * SECTOR_SIZE;
    const signature = new TextDecoder().decode(iso.slice(pvdOffset + 1, pvdOffset + 6));
    expect(signature).toBe('CD001');
  });

  test('sets volume identifier from volumeId parameter', () => {
    const iso = createIso({
      files: [
        { data: encoder.encode('data'), name: 'file', },
      ],
      volumeId: 'cidata',
    });

    const SECTOR_SIZE = 2_048;
    const pvdOffset = 16 * SECTOR_SIZE;
    const volId = new TextDecoder().decode(iso.slice(pvdOffset + 40, pvdOffset + 46));
    expect(volId).toBe('cidata');
  });

  test('includes terminator descriptor at sector 17', () => {
    const iso = createIso({
      files: [{ data: encoder.encode('x'), name: 'f', }],
      volumeId: 'TEST',
    });

    const SECTOR_SIZE = 2_048;
    const vdstOffset = 17 * SECTOR_SIZE;
    expect(iso[vdstOffset]).toBe(255);
    const sig = new TextDecoder().decode(iso.slice(vdstOffset + 1, vdstOffset + 6));
    expect(sig).toBe('CD001');
  });

  test('embeds file data at expected sectors', () => {
    const content = 'cloud-init-test-data';
    const iso = createIso({
      files: [{ data: encoder.encode(content), name: 'user-data', }],
      volumeId: 'cidata',
    });

    const SECTOR_SIZE = 2_048;
    const fileOffset = 21 * SECTOR_SIZE;
    const extracted = new TextDecoder().decode(iso.slice(fileOffset, fileOffset + content.length));
    expect(extracted).toBe(content);
  });

  test('handles multiple files', () => {
    const iso = createIso({
      files: [
        { data: encoder.encode('#cloud-config\nhostname: test\n'), name: 'user-data', },
        { data: encoder.encode('instance-id: test\n'), name: 'meta-data', },
      ],
      volumeId: 'cidata',
    });

    const SECTOR_SIZE = 2_048;
    /** Two files at sectors 21 and 22, so total is 23 sectors. */
    expect(iso.length).toBe(23 * SECTOR_SIZE);
  });
});
