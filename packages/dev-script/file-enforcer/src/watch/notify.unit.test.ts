import {
  afterEach,
  describe,
  expect,
  spyOn,
  test,
} from 'bun:test';
import { notifyWriteProtection, } from './notify.ts';

//region notifyWriteProtection

describe('notifyWriteProtection', () => {
  /** Spy on console.warn to verify terminal output */
  const warnSpy = spyOn(console, 'warn',);

  afterEach(() => {
    warnSpy.mockClear();
  },);

  test('logs a warning to the terminal', async () => {
    expect.assertions(1,);
    await notifyWriteProtection('/repo/CLAUDE.md',);
    /** Should have logged with the PROTECTED prefix */
    expect(warnSpy,).toHaveBeenCalledWith(
      expect.stringContaining('PROTECTED',),
    );
  });

  test('includes the file path in the terminal warning', async () => {
    expect.assertions(1,);
    await notifyWriteProtection('/repo/output.txt',);
    expect(warnSpy,).toHaveBeenCalledWith(
      expect.stringContaining('/repo/output.txt',),
    );
  });

  test('does not throw when notify-send is unavailable', async () => {
    expect.assertions(1,);
    // If notify-send fails or is missing, the function should still complete
    await expect(
      notifyWriteProtection('/nonexistent/path.txt',),
    )
      .resolves
      .toBeUndefined();
  });
});

//endregion notifyWriteProtection
