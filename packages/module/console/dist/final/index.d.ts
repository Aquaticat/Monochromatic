export declare const assert: (assertion: boolean, ...objs: any[]) => boolean;

export declare function debug<T1>(arg1: T1): T1;

export declare function debug<T2>(...arg2plus: T2[]): T2[];

declare const _default: Readonly<{
    assert: (assertion: boolean, ...objs: any[]) => boolean;
    debug: typeof debug;
    info: typeof info;
    warn: typeof warn;
    error: typeof error;
    log: typeof log;
}>;
export default _default;

export declare function error<T1>(arg1: T1): T1;

export declare function error<T2>(...arg2plus: T2[]): T2[];

export declare function info<T1>(arg1: T1): T1;

export declare function info<T2>(...arg2plus: T2[]): T2[];

export declare const isDirSpecial: () => boolean;

export declare function log<T1>(arg1: T1): T1;

export declare function log<T2>(...arg2plus: T2[]): T2[];

export declare function warn<T1>(arg1: T1): T1;

export declare function warn<T2>(...arg2plus: T2[]): T2[];

export { }
