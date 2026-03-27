import {
  describe,
  expect,
  test,
} from 'bun:test';

import {
  detectHypervisor,
  stripJsoncComments,
  validateName,
  vmConfigPath,
  vmDir,
} from './config.ts';

//region validateName -- rejects unsafe VM names, accepts safe ones

describe('validateName', () => {
  test('accepts simple alphanumeric name', () => {
    expect(() => {
      validateName('alpine',);
    },).not.toThrow();
  });

  test('accepts name with hyphens and underscores', () => {
    expect(() => {
      validateName('my-vm_01',);
    },).not.toThrow();
  });

  test('accepts single character name', () => {
    expect(() => {
      validateName('a',);
    },).not.toThrow();
  });

  test('accepts name starting with digit', () => {
    expect(() => {
      validateName('9test',);
    },).not.toThrow();
  });

  test('rejects name starting with hyphen', () => {
    expect(() => {
      validateName('-bad',);
    },).toThrow('invalid VM name',);
  });

  test('rejects name starting with underscore', () => {
    expect(() => {
      validateName('_bad',);
    },).toThrow('invalid VM name',);
  });

  test('rejects path traversal', () => {
    expect(() => {
      validateName('../evil',);
    },).toThrow('invalid VM name',);
  });

  test('rejects name with spaces', () => {
    expect(() => {
      validateName('my vm',);
    },).toThrow('invalid VM name',);
  });

  test('rejects name with dots', () => {
    expect(() => {
      validateName('my.vm',);
    },).toThrow('invalid VM name',);
  });

  test('rejects empty string', () => {
    expect(() => {
      validateName('',);
    },).toThrow('invalid VM name',);
  });

  test('rejects name with slashes', () => {
    expect(() => {
      validateName('a/b',);
    },).toThrow('invalid VM name',);
  });
});

//endregion validateName

//region stripJsoncComments -- removes comments while preserving string content

describe('stripJsoncComments', () => {
  test('returns plain JSON unchanged', () => {
    const input = '{"a": 1, "b": "hello"}';
    expect(stripJsoncComments(input,),).toBe(input,);
  });

  test('strips single-line comment', () => {
    const input = '{"a": 1 // comment\n}';
    expect(stripJsoncComments(input,),).toBe('{"a": 1 \n}',);
  });

  test('strips multi-line comment', () => {
    const input = '{"a": /* block */ 1}';
    expect(stripJsoncComments(input,),).toBe('{"a":  1}',);
  });

  test('preserves comment-like content inside strings', () => {
    const input = '{"url": "http://example.com"}';
    expect(stripJsoncComments(input,),).toBe(input,);
  });

  test('preserves double-slash inside strings', () => {
    const input = '{"msg": "see // this"}';
    expect(stripJsoncComments(input,),).toBe(input,);
  });

  test('preserves block comment syntax inside strings', () => {
    const input = '{"msg": "a /* b */ c"}';
    expect(stripJsoncComments(input,),).toBe(input,);
  });

  test('handles escaped quotes inside strings', () => {
    const input = '{"msg": "say \\"hello\\""}';
    expect(stripJsoncComments(input,),).toBe(input,);
  });

  test('strips multiple single-line comments', () => {
    const input = '{\n// first\n"a": 1,\n// second\n"b": 2\n}';
    const expected = '{\n\n"a": 1,\n\n"b": 2\n}';
    expect(stripJsoncComments(input,),).toBe(expected,);
  });

  test('strips trailing comment after value', () => {
    const input = '{"a": 1} // trailing';
    expect(stripJsoncComments(input,),).toBe('{"a": 1} ',);
  });

  test('handles empty input', () => {
    expect(stripJsoncComments('',),).toBe('',);
  });

  test('result is valid JSON after stripping JSONC comments', () => {
    const input = `{
  // VM name
  "name": "alpine",
  /* disk size in bytes */
  "size": 1024
}`;
    const stripped = stripJsoncComments(input,);
    expect(() => {
      JSON.parse(stripped,);
    },).not.toThrow();
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- test assertion for parsed JSON shape
    const parsed = JSON.parse(stripped,) as { name: string; size: number; };
    expect(parsed.name,).toBe('alpine',);
    expect(parsed.size,).toBe(1024,);
  });
});

//endregion stripJsoncComments

//region vmDir / vmConfigPath -- path construction from VM name

describe('vmDir', () => {
  test('appends name to data directory', () => {
    const result = vmDir('alpine',);
    expect(result,).toMatch(/vmsync\/alpine$/,);
  });

  test('handles name with hyphens', () => {
    const result = vmDir('fedora-dev',);
    expect(result,).toMatch(/vmsync\/fedora-dev$/,);
  });
});

describe('vmConfigPath', () => {
  test('appends config filename to VM directory', () => {
    const result = vmConfigPath('alpine',);
    expect(result,).toMatch(/vmsync\/alpine\/vmsync\.jsonc$/,);
  });
});

//endregion vmDir / vmConfigPath

//region detectHypervisor -- platform-based hypervisor detection

describe('detectHypervisor', () => {
  test('returns kvm on linux', () => {
    // The test environment is Linux, so this should return 'kvm'
    expect(detectHypervisor(),).toBe('kvm',);
  });
});

//endregion detectHypervisor
