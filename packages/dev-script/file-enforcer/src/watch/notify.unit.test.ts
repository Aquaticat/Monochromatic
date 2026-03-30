import {
  afterEach,
  describe,
  expect,
  spyOn,
  test,
} from 'bun:test';
import { l, } from '../log.ts';
import { notifyWriteProtection, } from './notify.ts';

//region notifyWriteProtection

describe('notifyWriteProtection', () => {
  /** Spy on l.warn to verify terminal output -- tagged wrapper calls through l */
  const warnSpy = spyOn(l, 'warn',);

  afterEach(() => {
    warnSpy.mockClear();
  },);

  test('logs a warning via tagged logger', async () => {
    await notifyWriteProtection('/repo/CLAUDE.md',);
    /** Should have logged with the PROTECTED prefix */
    expect(warnSpy,).toHaveBeenCalledWith(
      expect.stringContaining('PROTECTED',),
    );
  });

  test('includes the file path in the warning', async () => {
    await notifyWriteProtection('/repo/output.txt',);
    expect(warnSpy,).toHaveBeenCalledWith(
      expect.stringContaining('/repo/output.txt',),
    );
  });

  test('does not throw when notify-send is unavailable', async () => {
    // If notify-send fails or is missing, the function should still complete
    await expect(
      notifyWriteProtection('/nonexistent/path.txt',),
    )
      .resolves
      .toBeUndefined();
  });
});

//endregion notifyWriteProtection
