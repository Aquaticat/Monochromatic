/**
 @remarks
 Compared to built-in Array.of 's definition in TypeScript, actually accepts mixed types.

 @param elements - Elements used to create the array.
 */
export declare function arrayOf<const T_elements extends any[]>(...elements: T_elements): T_elements;
export declare function genOf<const T_elements extends any[]>(...elements: T_elements): Generator<T_elements[number]>;
