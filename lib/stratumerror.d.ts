export declare type Tuple = [number, string, string];
export declare class StratumError extends Error {
    error: Tuple;
    constructor(message: string, error: Tuple);
    static fromError(): void;
}
