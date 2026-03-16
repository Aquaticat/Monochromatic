/**
 * Shared type definitions for the SSG build pipeline.
 */
import type { $ as tagged, } from '@monochromatic-dev/module-es/tagged';

/** Tagged logger instance type used across build modules. */
export type Logger = ReturnType<typeof tagged>;
