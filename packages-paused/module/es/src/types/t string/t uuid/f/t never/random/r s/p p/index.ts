/**
 * Generates a cryptographically secure random UUID v4 string via the Web Crypto API.
 */
export const $: typeof crypto.randomUUID = crypto.randomUUID
  .bind(crypto,);
