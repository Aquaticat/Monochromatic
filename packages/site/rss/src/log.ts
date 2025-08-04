import {
  logtapeConfiguration,
  logtapeConfigure,
  logtapeGetLogger,
  type LogtapeLogger,
} from '@monochromatic-dev/module-es';

await logtapeConfigure(await logtapeConfiguration('rss',),);

export const l: LogtapeLogger = logtapeGetLogger(['a', 'i',],);
export const lAsset: LogtapeLogger = logtapeGetLogger(['a', 'asset',],);
export const lFeed: LogtapeLogger = logtapeGetLogger(['a', 'feed',],);
export const lHtml: LogtapeLogger = logtapeGetLogger(['a', 'html',],);
export const lItem: LogtapeLogger = logtapeGetLogger(['a', 'item',],);
export const lOpmls: LogtapeLogger = logtapeGetLogger(['a', 'opmls',],);
export const lOutline: LogtapeLogger = logtapeGetLogger(['a', 'outline',],);
