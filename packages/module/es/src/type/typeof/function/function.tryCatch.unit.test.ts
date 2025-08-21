import {
  consoleLogger,
  logtapeConfiguration,
  logtapeConfigure,
  tryCatch,
  tryCatchAsync,
  wait,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

// Sync API
describe(tryCatch, () => {
  //region Success and retry behaviour -- Direct success paths and retry control

  describe('success and retry behaviour', () => {
    test('returns the result when tryer succeeds', () => {
      const result = tryCatch(
        () => 'success',
        () => false,
      );
      expect(result,).toBe('success',);
    });

    test('does not call catcher when tryer succeeds', () => {
      let catcherCalls = 0;

      const result = tryCatch(
        () => 'success-sync',
        () => {
          catcherCalls++;
          return false;
        },
      );

      expect(result,).toBe('success-sync',);
      expect(catcherCalls,).toBe(0,);
    });

    test('retries and succeeds when catcher returns true', () => {
      let attempts = 0;
      let catcherCalls = 0;
      let caughtError: unknown;

      const tryer = () => {
        attempts++;
        if (attempts === 1)
          throw new Error('first attempt failed',);
        return 'success';
      };

      const catcher = (error: unknown,) => {
        catcherCalls++;
        caughtError = error;
        return true; // Request retry
      };

      const result = tryCatch(tryer, catcher,);

      expect(result,).toBe('success',);
      expect(attempts,).toBe(2,);
      expect(catcherCalls,).toBe(1,);
      expect(caughtError,).toEqual(new Error('first attempt failed',),);
    });

    test('throws when catcher returns false', () => {
      const error = new Error('test error',);
      let tryerCalls = 0;
      let catcherCalls = 0;
      let caughtError: unknown;

      const tryer = () => {
        tryerCalls++;
        throw error;
      };

      const catcher = (err: unknown,) => {
        catcherCalls++;
        caughtError = err;
        return false; // Re-throw
      };

      expect(() => tryCatch(tryer, catcher,)).toThrow(error,);
      expect(tryerCalls,).toBe(1,);
      expect(catcherCalls,).toBe(1,);
      expect(caughtError,).toBe(error,);
    });

    test('throws when retry also fails', () => {
      const error = new Error('test error',);
      let tryerCalls = 0;
      let catcherCalls = 0;

      const tryer = () => {
        tryerCalls++;
        throw error;
      };

      const catcher = () => {
        catcherCalls++;
        return true; // Request retry
      };

      expect(() => tryCatch(tryer, catcher,)).toThrow(error,);
      expect(tryerCalls,).toBe(2,); // Initial + retry
      expect(catcherCalls,).toBe(1,);
    });
  });

  //endregion Success and retry behaviour

  //region Null suppression behaviour -- Catcher returns null returns undefined; includes custom handling

  describe('null suppression behaviour', () => {
    test('returns undefined when catcher returns null', () => {
      const error = new Error('test error',);
      let tryerCalls = 0;
      let catcherCalls = 0;
      let caughtError: unknown;

      const tryer = () => {
        tryerCalls++;
        throw error;
      };

      const catcher = (err: unknown,) => {
        catcherCalls++;
        caughtError = err;
        return null; // Suppress error
      };

      const result = tryCatch(tryer, catcher,);

      expect(result,).toBeUndefined();
      expect(tryerCalls,).toBe(1,);
      expect(catcherCalls,).toBe(1,);
      expect(caughtError,).toBe(error,);
    });

    test('returns undefined with custom error handling when catcher returns null', () => {
      const error = new Error('network error',);
      let tryerCalls = 0;
      let catcherCalls = 0;
      let processedError: string | undefined;

      const tryer = () => {
        tryerCalls++;
        throw error;
      };

      const catcher = (err: unknown,) => {
        catcherCalls++;
        // Custom error handling logic
        if (err instanceof Error)
          processedError = `Suppressing error: ${err.message}`;
        return null; // Suppress error
      };

      const result = tryCatch(tryer, catcher,);

      expect(result,).toBeUndefined();
      expect(tryerCalls,).toBe(1,);
      expect(catcherCalls,).toBe(1,);
      expect(processedError,).toBe('Suppressing error: network error',);
    });
  });

  //endregion Null suppression behaviour

  //region Tuple control behaviour -- Context propagation, rethrow semantics, and suppression via tuples

  describe('tuple control behaviour', () => {
    test('tuple true recursively retries with updated context', () => {
      type Ctx = { retry: number; };
      let tryerCalls = 0;
      const seen: number[] = [];

      const tryer = (ctx?: Ctx,) => {
        tryerCalls++;
        seen.push(ctx?.retry ?? -1,);
        if ((ctx?.retry ?? 0) < 2)
          throw new Error('fail',);
        return 'ok';
      };

      const catcher = (_err: unknown, ctx?: Ctx,): [boolean, Ctx,] => {
        return [true, { retry: (ctx?.retry ?? 0) + 1, },];
      };

      const result = tryCatch(tryer, catcher, { retry: 0, },);
      expect(result,).toBe('ok',);
      expect(tryerCalls,).toBe(3,);
      expect(seen,).toEqual([0, 1, 2,],);
    });

    test('tuple false throws with context-serialized message and preserves cause', () => {
      type Ctx = { code: number; note: string; };
      const original = new Error('boom',);
      const newContext: Ctx = { code: 123, note: 'failed', };

      const tryer = () => {
        throw original;
      };

      const catcher = (): [false, Ctx,] => [false, newContext,];

      try {
        // Expect to throw a new Error with message = JSON.stringify(newContext)
        void tryCatch(tryer, catcher,);
        // If the line above didn't throw, fail the test
        expect(true,).toBe(false,);
      }
      catch (thrown) {
        const err = thrown as Error & { cause?: unknown; };
        expect(err,).toBeInstanceOf(Error,);
        expect(err.message,).toBe(JSON.stringify(newContext,),);
        expect(err.cause,).toBe(original,);
      }
    });

    test('tuple null suppresses and logs with context', () => {
      type Ctx = { state: string; };
      const original = new Error('network',);
      const updated: Ctx = { state: 'updated', };

      const messages: string[] = [];
      const l = { ...consoleLogger, error: (message: string,) => {
        messages.push(message,);
        return undefined;
      }, };

      let catcherCalls = 0;

      const tryer = () => {
        throw original;
      };

      const catcher = (_e: unknown, _ctx?: Ctx,): [null, Ctx,] => {
        catcherCalls++;
        return [null, updated,];
      };

      const result = tryCatch(tryer, catcher, { state: 'initial', }, l,);
      expect(result,).toBeUndefined();
      expect(catcherCalls,).toBe(1,);

      expect(messages.length,).toBe(1,);
      const message = String(messages[0] ?? '',);
      expect(message,).toContain('ignored',);
      expect(message,).toContain(JSON.stringify(updated,),);
    });
  });

  //#endregion Tuple control behaviour

  //region Logging integration -- Logger interactions for suppression paths

  describe('logging integration', () => {
    test('direct null suppresses and logs original error', () => {
      const messages: string[] = [];

      let catcherCalls = 0;

      const result = tryCatch(() => {
        throw new Error('direct-null');
      }, () => {
        catcherCalls++;
        return null;
      }, undefined, {
        ...consoleLogger,
        error: (message: string,) => {
          messages.push(message,);
          return undefined;
        },
      },);
      expect(result,).toBeUndefined();
      expect(catcherCalls,).toBe(1,);
      expect(messages.length,).toBe(1,);
    });
  });

  //endregion Logging integration

  //region Validation and type checking -- Invalid returns and tuple decision elements

  describe('validation and type checking', () => {
    test('invalid catcher return throws TypeError (direct invalid)', () => {
      const tryer = () => {
        throw new Error('oops',);
      };

      // Invalid non-boolean/non-null non-tuple value
      const catcher = () => 'invalid' as unknown as boolean;

      expect(() => tryCatch(tryer, catcher,)).toThrow(TypeError,);
    });

    test('invalid tuple decision type throws TypeError', () => {
      type Ctx = { ok: boolean; };
      const ctx: Ctx = { ok: true, };

      const tryer = () => {
        throw new Error('oops',);
      };

      // Invalid first element (must be boolean|null)
      const catcher = () => [42 as unknown as boolean, ctx,] as [boolean, Ctx,];

      expect(() => tryCatch(tryer, catcher,)).toThrow(TypeError,);
    });
  });

  //endregion Validation and type checking
});

// Async API
describe(tryCatchAsync, () => {
  //region Success and retry behaviour -- Direct success paths and retry control (async)

  describe('success and retry behaviour', () => {
    test('returns the result when tryer succeeds', async () => {
      const result = await tryCatchAsync(
        async () => 'success',
        async () => false,
      );
      expect(result,).toBe('success',);
    });

    test('supports sync tryer in async context and does not call catcher', async () => {
      let catcherCalls = 0;

      const result = await tryCatchAsync(
        () => 'ok-sync-in-async',
        async () => {
          catcherCalls++;
          return false;
        },
      );

      expect(result,).toBe('ok-sync-in-async',);
      expect(catcherCalls,).toBe(0,);
    });

    test('retries and succeeds when catcher returns true', async () => {
      let attempts = 0;
      let catcherCalls = 0;
      let caughtError: unknown;

      const tryer = async () => {
        attempts++;
        if (attempts === 1)
          throw new Error('first attempt failed',);
        return 'success';
      };

      const catcher = async (error: unknown,) => {
        catcherCalls++;
        caughtError = error;
        return true; // Request retry
      };

      const result = await tryCatchAsync(tryer, catcher,);

      expect(result,).toBe('success',);
      expect(attempts,).toBe(2,);
      expect(catcherCalls,).toBe(1,);
      expect(caughtError,).toEqual(new Error('first attempt failed',),);
    });

    test('throws when catcher returns false', async () => {
      const error = new Error('test error',);
      let tryerCalls = 0;
      let catcherCalls = 0;
      let caughtError: unknown;

      const tryer = async () => {
        tryerCalls++;
        throw error;
      };

      const catcher = async (err: unknown,) => {
        catcherCalls++;
        caughtError = err;
        return false; // Re-throw
      };

      await expect(tryCatchAsync(tryer, catcher,),).rejects.toThrow(error,);
      expect(tryerCalls,).toBe(1,);
      expect(catcherCalls,).toBe(1,);
      expect(caughtError,).toBe(error,);
    });

    test('throws when retry also fails', async () => {
      const error = new Error('test error',);
      let tryerCalls = 0;
      let catcherCalls = 0;

      const tryer = async () => {
        tryerCalls++;
        throw error;
      };

      const catcher = async () => {
        catcherCalls++;
        return true; // Request retry
      };

      await expect(tryCatchAsync(tryer, catcher,),).rejects.toThrow(error,);
      expect(tryerCalls,).toBe(2,); // Initial + retry
      expect(catcherCalls,).toBe(1,);
    });

    test('supports sync catcher in async context', async () => {
      const error = new Error('async error',);
      let caughtError: unknown;

      const tryer = async () => {
        throw error;
      };

      // Sync catcher (not async)
      const catcher = (err: unknown,) => {
        caughtError = err;
        return false;
      };

      await expect(tryCatchAsync(tryer, catcher,),).rejects.toThrow(error,);
      expect(caughtError,).toBe(error,);
    });
  });

  //endregion Success and retry behaviour

  //region Null suppression behaviour -- Catcher returns null returns undefined; includes custom handling (async)

  describe('null suppression behaviour', () => {
    test('returns undefined when catcher returns null', async () => {
      const error = new Error('test error',);
      let tryerCalls = 0;
      let catcherCalls = 0;
      let caughtError: unknown;

      const tryer = async () => {
        tryerCalls++;
        throw error;
      };

      const catcher = async (err: unknown,) => {
        catcherCalls++;
        caughtError = err;
        return null; // Suppress error
      };

      const result = await tryCatchAsync(tryer, catcher,);

      expect(result,).toBeUndefined();
      expect(tryerCalls,).toBe(1,);
      expect(catcherCalls,).toBe(1,);
      expect(caughtError,).toBe(error,);
    });

    test('returns undefined with custom async error handling when catcher returns null', async () => {
      const error = new Error('database connection failed',);
      let tryerCalls = 0;
      let catcherCalls = 0;
      let processedError: string | undefined;
      let waitExecuted = false;

      const tryer = async () => {
        tryerCalls++;
        throw error;
      };

      const catcher = async (err: unknown,) => {
        catcherCalls++;
        // Custom async error handling logic
        // Simulate async operation
        await wait(1,);
        waitExecuted = true;
        if (err instanceof Error)
          processedError = `Suppressing async error: ${err.message}`;
        return null; // Suppress error
      };

      const result = await tryCatchAsync(tryer, catcher,);

      expect(result,).toBeUndefined();
      expect(tryerCalls,).toBe(1,);
      expect(catcherCalls,).toBe(1,);
      expect(waitExecuted,).toBe(true,);
      expect(processedError,).toBe('Suppressing async error: database connection failed',);
    });
  });

  //endregion Null suppression behaviour

  //region Tuple control behaviour -- Context propagation, rethrow semantics, and suppression via tuples (async)

  describe('tuple control behaviour', () => {
    test('tuple true recursively retries with updated context', async () => {
      type Ctx = { retry: number; };
      let tryerCalls = 0;
      const seen: number[] = [];

      const tryer = async (ctx?: Ctx,) => {
        tryerCalls++;
        seen.push(ctx?.retry ?? -1,);
        if ((ctx?.retry ?? 0) < 2)
          throw new Error('fail',);
        return 'ok';
      };

      const catcher = async (_e: unknown, ctx?: Ctx,): Promise<[boolean, Ctx,]> => {
        return [true, { retry: (ctx?.retry ?? 0) + 1, },];
      };

      const result = await tryCatchAsync(tryer, catcher, { retry: 0, },);
      expect(result,).toBe('ok',);
      expect(tryerCalls,).toBe(3,);
      expect(seen,).toEqual([0, 1, 2,],);
    });

    test('tuple false throws with context-serialized message and preserves cause', async () => {
      type Ctx = { step: number; };
      const original = new Error('boom-async',);
      const newContext: Ctx = { step: 7, };

      const tryer = async () => {
        throw original;
      };

      const catcher = async (): Promise<[false, Ctx,]> => [false, newContext,];

      try {
        await tryCatchAsync(tryer, catcher,);
        expect(true,).toBe(false,);
      }
      catch (thrown) {
        const err = thrown as Error & { cause?: unknown; };
        expect(err,).toBeInstanceOf(Error,);
        expect(err.message,).toBe(JSON.stringify(newContext,),);
        expect(err.cause,).toBe(original,);
      }
    });

    test('tuple null suppresses and logs with context', async () => {
      type Ctx = { state: string; };
      const original = new Error('async-suppress',);
      const updated: Ctx = { state: 'updated-async', };

      const messages: string[] = [];
      const l = { ...consoleLogger, error: (message: string,) => {
        messages.push(message,);
        return undefined;
      }, };

      let catcherCalls = 0;

      const tryer = async () => {
        throw original;
      };

      const catcher = async (_e: unknown, _ctx?: Ctx,): Promise<[null, Ctx,]> => {
        catcherCalls++;
        return [null, updated,];
      };

      const result = await tryCatchAsync(tryer, catcher, { state: 'initial', }, l,);
      expect(result,).toBeUndefined();
      expect(catcherCalls,).toBe(1,);

      expect(messages.length,).toBe(1,);
      const message = String(messages[0] ?? '',);
      expect(message,).toContain('ignored',);
      expect(message,).toContain(JSON.stringify(updated,),);
    });
  });

  //endregion Tuple control behaviour

  //region Logging integration -- Logger interactions for suppression paths (async)

  describe('logging integration', () => {
    test('direct null suppresses and logs original error', async () => {
      const original = new Error('async-direct-null',);

      const messages: string[] = [];
      const l = { ...consoleLogger, error: (message: string,) => {
        messages.push(message,);
        return undefined;
      }, };

      let catcherCalls = 0;

      const tryer = async () => {
        throw original;
      };

      const catcher = async () => {
        catcherCalls++;
        return null;
      };

      const result = await tryCatchAsync(tryer, catcher, undefined, l,);
      expect(result,).toBeUndefined();
      expect(catcherCalls,).toBe(1,);
      expect(messages.length,).toBe(1,);
    });
  });

  //endregion Logging integration

  //region Validation and type checking -- Invalid returns and tuple decision elements (async)

  describe('validation and type checking', () => {
    test('invalid catcher return throws TypeError (direct invalid)', async () => {
      const tryer = async () => {
        throw new Error('oops',);
      };

      const catcher = async () => 'invalid' as unknown as boolean;

      await expect(tryCatchAsync(tryer, catcher,),).rejects.toBeInstanceOf(TypeError,);
    });

    test('invalid tuple decision type throws TypeError', async () => {
      type Ctx = { done: boolean; };
      const ctx: Ctx = { done: false, };

      const tryer = async () => {
        throw new Error('oops',);
      };

      const catcher = async () => [42 as unknown as boolean, ctx,] as [boolean, Ctx,];

      await expect(tryCatchAsync(tryer, catcher,),).rejects.toBeInstanceOf(TypeError,);
    });
  });

  //endregion Validation and type checking
});
