import { configure } from '@logtape/logtape';
import {
  logtapeConfiguration,
  suite,
  test,
} from '@monochromatic-dev/module-util/ts';

await configure(logtapeConfiguration());
