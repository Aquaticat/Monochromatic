import {
  assertThrow,
  assertThrowAsync,
  assertThrowError,
  assertThrowErrorAsync,
  assertThrowRangeError,
  assertThrowRangeErrorAsync,
  assertThrowReferenceError,
  assertThrowReferenceErrorAsync,
  assertThrowTypeError,
  assertThrowTypeErrorAsync,
  assertThrowURIError,
  assertThrowURIErrorAsync,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

describe('assertThrow', () => {
  test('passes when function throws expected error type', () => {
    expect(() => {
      assertThrow(new TypeError('error'), () => {
        throw new TypeError('error');
      });
    })
      .not
      .toThrow();
  });

  test('throws when function does not throw', () => {
    expect(() => {
      assertThrow('Error', () => {
        // no error thrown
      });
    })
      .toThrow("unexpectedly didn't throw");
  });

  test('throws when function throws wrong error type', () => {
    expect(() => {
      assertThrow(new RangeError('error'), () => {
        throw new TypeError('error');
      });
    })
      .toThrow();
  });

  test('accepts error strings', () => {
    expect(() => {
      assertThrow('custom error message', () => {
        throw new Error('custom error message');
      });
    })
      .not
      .toThrow();
  });

  test('handles Error instance comparison', () => {
    const expectedError = new Error('specific error');
    expect(() => {
      assertThrow(expectedError, () => {
        throw new Error('specific error');
      });
    })
      .not
      .toThrow();
  });

  test('accepts general Error type', () => {
    expect(() => {
      assertThrow('Error', () => {
        throw new Error('any error');
      });
    })
      .not
      .toThrow();
  });

  test('checks error name for known error types', () => {
    expect(() => {
      assertThrow('TypeError', () => {
        throw new TypeError('type error');
      });
    })
      .not
      .toThrow();
  });
});

describe('assertThrowAsync', () => {
  test('passes when function throws expected error type', async () => {
    expect(
      assertThrowAsync(new TypeError('error'), async () => {
        throw new TypeError('error');
      }),
    )
      .resolves
      .toBeUndefined();
  });

  test('throws when function does not throw', async () => {
    expect(
      assertThrowAsync('Error', async () => {
        // no error thrown
      }),
    )
      .rejects
      .toThrow("unexpectedly didn't throw");
  });

  test('throws when function throws wrong error type', async () => {
    expect(
      assertThrowAsync(new RangeError('error'), async () => {
        throw new TypeError('error');
      }),
    )
      .rejects
      .toThrow();
  });

  test('handles async functions', async () => {
    expect(
      assertThrowAsync('Error', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('delayed error');
      }),
    )
      .resolves
      .toBeUndefined();
  });
});

describe('convenience functions', () => {
  test('assertThrowError passes with any Error', () => {
    expect(() => {
      assertThrowError(() => {
        throw new Error('any error');
      });
    })
      .not
      .toThrow();
  });

  test('assertThrowTypeError passes with TypeError', () => {
    expect(() => {
      assertThrowTypeError(() => {
        throw new TypeError('type error');
      });
    })
      .not
      .toThrow();
  });

  test('assertThrowRangeError passes with RangeError', () => {
    expect(() => {
      assertThrowRangeError(() => {
        throw new RangeError('range error');
      });
    })
      .not
      .toThrow();
  });

  test('assertThrowReferenceError passes with ReferenceError', () => {
    expect(() => {
      assertThrowReferenceError(() => {
        throw new ReferenceError('reference error');
      });
    })
      .not
      .toThrow();
  });

  test('assertThrowURIError passes with URIError', () => {
    expect(() => {
      assertThrowURIError(() => {
        throw new URIError('uri error');
      });
    })
      .not
      .toThrow();
  });

  test('async convenience functions work correctly', async () => {
    expect(
      assertThrowErrorAsync(async () => {
        throw new Error('error');
      }),
    )
      .resolves
      .toBeUndefined();

    expect(
      assertThrowTypeErrorAsync(async () => {
        throw new TypeError('error');
      }),
    )
      .resolves
      .toBeUndefined();

    expect(
      assertThrowRangeErrorAsync(async () => {
        throw new RangeError('error');
      }),
    )
      .resolves
      .toBeUndefined();

    expect(
      assertThrowReferenceErrorAsync(async () => {
        throw new ReferenceError('error');
      }),
    )
      .resolves
      .toBeUndefined();

    expect(
      assertThrowURIErrorAsync(async () => {
        throw new URIError('error');
      }),
    )
      .resolves
      .toBeUndefined();
  });
});

describe('edge cases', () => {
  test('handles error function that returns an error instance', () => {
    const errorFn = () => new TypeError('generated error');
    expect(() => {
      assertThrow(errorFn, () => {
        throw new TypeError('generated error');
      });
    })
      .not
      .toThrow();
  });

  test('throws with invalid error type', () => {
    expect(() => {
      assertThrow(42 as any, () => {
        throw new Error('42');
      });
    })
      .toThrow('unexpected type');
  });
});
