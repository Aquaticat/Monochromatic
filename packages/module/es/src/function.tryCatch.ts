import type { Promisable } from 'type-fest';

export function tryCatch<const T,>(
  tryer: () => T,
  catcher: (error: unknown) => boolean,
): T {
  try {
    return tryer();
  } catch (error) {
    const shouldRetry = catcher(error);
    if (shouldRetry) {
      return tryer();
    }
    throw error;
  }
}

export async function tryCatchAsync<const T,>(
  tryer: () => Promisable<T>,
  catcher: (error: unknown) => Promisable<boolean>,
): Promise<T> {
  try {
    return await tryer();
  } catch (error) {
    const shouldRetry = await catcher(error);
    if (shouldRetry) {
      return await tryer();
    }
    throw error;
  }
}
