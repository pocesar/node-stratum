import { EventEmitter } from "eventemitter3";
export declare class Base extends EventEmitter {
    static debug(...msg: any[]): string;
}
