export declare function equals(equalTo: any): (input: any) => boolean;
export declare function equalsAsync(equalTo: any): (input: any) => Promise<boolean>;
export declare function equalsOrThrow<T_input>(equalTo: any): (input: T_input) => T_input;
export declare function equalsAsyncOrThrow<T_input>(equalTo: any): (input: T_input) => Promise<T_input>;
