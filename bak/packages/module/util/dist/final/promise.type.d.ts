export type NotPromise<T = any> = Exclude<T, Promise<any>>;
