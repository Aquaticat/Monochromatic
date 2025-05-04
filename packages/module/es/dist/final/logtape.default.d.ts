import { type configure } from '@logtape/logtape';
/**
 @param [appName='monochromatic'] will be used as the name of log file.

 @returns a logtape configuration object with optional specified application name.

 @remarks
 Use it like this in your main executing file:

  ```ts
  import {
    configure,
    getLogger,
  } from '@logtape/logtape';
  import {
    logtapeConfiguration,
    logtapeId,
  } from '@monochromatic-dev/module-util';

  await configure(await logtapeConfiguration());
  const l = getLogger(logtapeId);
  ```

  For logger categories, a is short for app, m is short for module, t is short for test
  Sorry, but terminal space is precious.
  */
export declare const logtapeConfiguration: (appName?: string) => Promise<Parameters<typeof configure>[0]>;
/** Example logger id for your main executing file. */
export declare const logtapeId: readonly ["a", "index"];
export { configure as logtapeConfigure, getLogger as logtapeGetLogger, } from '@logtape/logtape';
