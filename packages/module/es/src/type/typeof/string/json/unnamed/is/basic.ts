import type {$ as json} from '../basic.ts';

export function $(value: string,): value is json {
  try {
    JSON.parse(value, () => null,);
    return true;
  }
  catch {
    return false;
  }
}
