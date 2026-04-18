/**
 * Shared type definitions for the SSG build pipeline.
 */
import type { tagged, } from '@monochromatic-dev/module-logger/tagged';

/** Tagged logger instance type used across build modules. */
export type Logger = ReturnType<typeof tagged>;
