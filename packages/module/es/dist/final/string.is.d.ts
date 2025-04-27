import type { LangString, LongLangString, ShortLangString } from './string.type';
export declare function isString(value: any): value is string;
export declare function isObjectRegexp(value: any): value is RegExp;
export declare function isShortLangString(value: any): value is ShortLangString;
export declare function isLongLangString(value: any): value is LongLangString;
export declare function isLangString(value: any): value is LangString;
