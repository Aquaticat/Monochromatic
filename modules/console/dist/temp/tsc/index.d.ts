declare function debug<T1>(arg1: T1): T1;
declare function debug<T2>(...arg2plus: T2[]): T2[];
declare function info<T1>(arg1: T1): T1;
declare function info<T2>(...arg2plus: T2[]): T2[];
declare function warn<T1>(arg1: T1): T1;
declare function warn<T2>(...arg2plus: T2[]): T2[];
declare function error<T1>(arg1: T1): T1;
declare function error<T2>(...arg2plus: T2[]): T2[];
declare function log<T1>(arg1: T1): T1;
declare function log<T2>(...arg2plus: T2[]): T2[];
declare const _default: Readonly<{
    assert: (assertion: boolean, ...objs: any[]) => boolean;
    debug: typeof debug;
    info: typeof info;
    warn: typeof warn;
    error: typeof error;
    log: typeof log;
}>;
export default _default;
//# sourceMappingURL=index.d.ts.map
