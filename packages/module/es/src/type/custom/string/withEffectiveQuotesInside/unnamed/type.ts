import { unnamed as withBackticksInside, } from '../../withBackticksInside/index.ts';
import {
  unnamed as withDoubleQuotesInside,
} from '../../withDoubleQuotesInside/index.ts';
import {
  unnamed as withSingleQuotesInside,
} from '../../withSingleQuotesInside/index.ts';

export type $ = withBackticksInside.type.$ | withDoubleQuotesInside.type.$
  | withSingleQuotesInside.type.$;
