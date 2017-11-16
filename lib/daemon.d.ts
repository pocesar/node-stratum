/// <reference types="node" />
/// <reference types="bluebird" />
import { spawn, ChildProcess } from "child_process";
import { Base } from "./base";
import * as q from "bluebird";
export interface Options {
    name?: string;
    path?: string;
    user?: string;
    password?: string;
    port?: number;
    rpcserver?: {
        notify?: any;
        notifyPath?: any;
    };
    notify?: string;
    datadir?: string;
    host?: string;
    args?: string[];
}
export declare class Daemon extends Base {
    spawn: typeof spawn;
    opts: any;
    name: string;
    rpc: any;
    process: ChildProcess | null;
    constructor(opts?: any);
    /**
     * Starts the daemon process.
     * Throws an error if the path doesn't exists.
     *
     * @throws Error
     * @returns {boolean}
     */
    start(): boolean;
    /**
     * Timeout
     *
     * @param fn
     * @param delay
     * @returns {*|setTimeout}
     * @private
     */
    _timeout(fn: any, delay: any): number;
    /**
     * Check if the path of the process exists
     *
     * @throws Error
     * @private
     */
    _pathExists(): void;
    /**
     * Send a 'stop' RPC command to the daemon before trying to kill it
     *
     * @param {Number} wait Wait seconds before trying to kill it, defaults to 5 seconds
     * @returns {Q.promise}
     */
    close(wait: any): q<{}>;
    /**
     * Communicate with the daemon using RPC calls
     *
     * @param {String} method Method
     * @param {Array} [params] Array of parameters
     *
     * @return {Q.promise}
     */
    call(method: any, params?: any): q<{}>;
    /**
     * 'Destructive' function that alters the input object, for the 'args' parameter
     *
     * @param {Object} opts
     */
    static mountArgs(opts: any): any;
    /**
     * 'Destructive' function that alters the incoming object, for the 'args' parameter,
     * depending on the 'notify' parameter
     *
     * @param {Object} opts
     */
    static notify(opts: any): any[];
}
