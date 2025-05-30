import type { Result } from 'happy-rusty';

export function unwrapResult<Ok, Err extends Error,>(
  result: Result<Ok, Err>,
): Ok {
  if (result.isErr()) {
    const unwrappedResultError: Error & { code?: string; } = result.unwrapErr();
    if (unwrappedResultError.message.startsWith('NotFoundError:')) {
      unwrappedResultError.code = 'ENOENT';
    }
    throw unwrappedResultError;
  }
  return result.unwrap();
}
