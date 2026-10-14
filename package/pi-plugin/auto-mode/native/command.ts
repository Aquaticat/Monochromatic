#!/usr/bin/env node
/**
 Start the maintained native host through the ordinary Pi command.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';

//region Command resolution fails visibly when the maintained build is absent.

tagged({ tag: 'auto-mode-native-command' }).debug('starting maintained native Pi host');
await import(new URL('../dist/native/cli.mjs', import.meta.url).href);

//endregion
