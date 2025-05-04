export declare function spreadArguments<Fn extends (...args: any) => any>(fn: Fn): (argumentsArray: Parameters<Fn>) => ReturnType<Fn>;
export declare function gatherArguments<Fn extends (arg: any[]) => any>(fn: Fn): (...argumentsArray: Parameters<Fn>[0]) => ReturnType<Fn>;
