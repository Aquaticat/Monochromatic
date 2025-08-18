import type { GlobalThis } from "type-fest";
import type { Logger } from "./string.log.ts";

export type Monochromatic = {
  logger?: Logger
}

export type MonochromaticGlobalThis = GlobalThis & {monochromatic?: Monochromatic};
