import { EventEmitter } from "eventemitter3";
export default class Base extends EventEmitter {
    static debug(...msg: any[]): string;
}
