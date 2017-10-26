/// <reference types="node" />
/// <reference types="bluebird" />
import Base from "./base";
import RPCServer from "./rpc";
import * as net from "net";
import * as q from "bluebird";
export default class Server extends Base {
    clients: any;
    daemons: any;
    opts: any;
    rpc: RPCServer;
    server: net.Server;
    constructor(opts?: any);
    _tooBusy(): any;
    expose(name: any): void;
    /**
     * Emits 'close' event when a connection was closed
     *
     * @param {Client} socket
     */
    closeConnection(socket: any): void;
    /**
     * Add daemons to this instance of Stratum server
     *
     * @return {Server}
     */
    addDaemon(definition: any): this;
    /**
     * Emits 'busy' event when the server is on high load
     * Emits 'connection' event when there's a new connection, passes the newly created socket as the first argument
     *
     * @param {Socket} socket
     */
    newConnection(socket: any): void;
    /**
     *
     * @param {Client} socket
     * @param {Buffer} buffer
     */
    handleData(socket: any, buffer: any): void;
    /**
     * Start the Stratum server, the RPC and any coind that are enabled
     *
     * @return {Q.promise}
     */
    listen(): q<{}>;
    close(): void;
    /**
     * Sends a Stratum result command directly to one socket
     *
     * @param {String} id UUID of the socket
     * @param {String} type The type of command, as defined in server.commands
     * @param {Array} array Parameters to send
     *
     * @return {Q.promise}
     */
    sendToId(id?: any, type?: any, array?: any): q<{}>;
    /**
     * Send a mining method or result to all connected
     * sockets
     *
     * Returns a promise, so when it's done sending, you can
     * do:
     *
     * server.broadcast('notify', [...params]).then(function(){
     *  console.log('done');
     * });
     *
     * @param {String} type
     * @param {Array} data
     * @returns {Q.promise}
     */
    broadcast(type?: any, data?: any): q<{}>;
    /**
     * Parse the incoming data for commands
     *
     * @param {Buffer} buffer
     * @returns {{string: string, cmds: Array}}
     */
    static getStratumCommands(buffer: any): {
        string: any;
        cmds: any[];
    };
    /**
     * Process the Stratum commands and act on them
     * Emits 'mining' event
     *
     * @param {Client} socket
     * @param {Array} cmds
     */
    static processCommands(socket: any, cmds: any): void;
    /**
     * Wraps the callback and predefine the ID of the current stratum call
     *
     * @param {Client} socket
     * @param {String} type
     * @param {String} id
     *
     * @returns {Function} curryed function
     */
    static bindCommand(socket: any, type: any, id: any): any;
    static rejected(msg: any): q<never>;
    static expose(base: any, name: any): (args: any, connection: any, callback: any) => q<void>;
    static invalidArgs(id: any, name: any, expected: any, args: any): true | q<never>;
    static commands: {
        subscribe(id?: any, difficulty?: any, subscription?: any, extranonce1?: any, extranonce2_size?: any): any;
        submit(id?: any, accepted?: any): any;
        error(id?: any, error?: any): any;
        authorize(id?: any, authorized?: any): any;
        get_transactions(id?: any, merkles?: any): any;
        notify(id?: any, job_id?: any, previous_hash?: any, coinbase1?: any, coinbase2?: any, branches?: any, block_version?: any, nbit?: any, ntime?: any, clean?: any): any;
        set_difficulty(id?: any, value?: any): any;
    };
    static errors: {
        FEE_REQUIRED: (string | number)[];
        SERVICE_NOT_FOUND: (string | number)[];
        METHOD_NOT_FOUND: (string | number)[];
        UNKNOWN: (string | number)[];
        STALE_WORK: (string | number)[];
        DUPLICATE_SHARE: (string | number)[];
        HIGH_HASH: (string | number)[];
        UNAUTHORIZED_WORKER: (string | number)[];
        NOT_SUBSCRIBED: (string | number)[];
    };
    /**
     * Coin daemons, will spawn a process for each enabled process
     */
    static daemons: {
        bitcoin: {
            name: string;
            path: string;
            user: string;
            password: string;
            port: number;
            host: string;
            args: any[];
        };
        litecoin: {
            name: string;
            path: string;
            user: string;
            password: string;
            port: number;
            host: string;
            args: any[];
        };
        ppcoin: {
            name: string;
            path: string;
            user: string;
            password: string;
            port: number;
            host: string;
            args: any[];
        };
        primecoin: {
            name: string;
            path: string;
            user: string;
            password: string;
            port: number;
            host: string;
            args: any[];
        };
    };
    static defaults: {
        rpc: {
            host: string;
            port: number;
            password: string;
            mode: string;
        };
        settings: {
            hostname: string;
            toobusy: number;
            host: string;
            port: number;
        };
    };
}
