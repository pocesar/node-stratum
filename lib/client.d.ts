/// <reference types="node" />
/// <reference types="bluebird" />
import { Base } from "./base";
import * as net from "net";
import * as q from "bluebird";
/**
 * @param {Socket} socket
 * @param {Boolean} isServer
 * @constructor
 */
export declare class Client extends Base {
    currentId: number;
    socket: net.Socket;
    authorized: boolean;
    byServer: boolean;
    subscription: string;
    name: string;
    pending: any;
    id: string;
    lastActivity: number;
    constructor(socket?: net.Socket, isServer?: boolean);
    /**
     * Keep track of idle sockets, update the last activity
     *
     * @param {Number} [time] Unix Timestamp
     *
     * @return {this}
     */
    setLastActivity(time?: any): this;
    /**
     * Either emit an event, or fulfill a pending request by id
     */
    fullfill(command: any): void;
    /**
     * Get the current socket IP address
     *
     * @returns {{port: Number, address: String, family: String}}
     */
    address(): {
        port: number;
        family: string;
        address: string;
    };
    /**
     * This method is exposed just for testing purposes
     *
     * @param {Socket} socket
     * @param {Buffer} buffer
     * @private
     */
    handleData(socket: any, buffer: any): void;
    /**
     * Destroy the socket and unattach any listeners
     */
    destroy(): void;
    /**
     * Connect to somewhere
     *
     * @param {Object} opts Where to connect
     * @returns {Q.promise}
     */
    connect(opts: any): q<{}>;
    /**
     * Don't use this functions directly, they are called from the server side,
     * it's not a client side command, but an answer
     *
     * @return {Q.promise}
     * @private
     */
    set_difficulty(args: any): any;
    /**
     * Don't use this functions directly, they are called from the server side
     * it's not a client side command, but an answer
     *
     * @return {Q.promise}
     * @private
     */
    notify(args: any): any;
    /**
     * Send HTTP header
     *
     * @param {String} hostname
     * @param {Number} port
     *
     * @return {Q.promise}
     */
    stratumHttpHeader(hostname: any, port: any): q<{}>;
    /**
     * Subscribe to the pool
     *
     * @param {String} [UA] Send the User-Agent
     * @returns {Q.promise}
     */
    stratumSubscribe(UA: any): q<{}>;
    /**
     * Asks for authorization
     *
     * @param {String} user
     * @param {String} pass
     * @returns {Q.promise}
     */
    stratumAuthorize(user: any, pass: any): q<{}>;
    /**
     * Sends a share
     *
     * @param {String} worker
     * @param {String} job_id
     * @param {String} extranonce2
     * @param {String} ntime
     * @param {String} nonce
     * @returns {Q.promise}
     */
    stratumSubmit(worker: any, job_id: any, extranonce2: any, ntime: any, nonce: any): q<{}>;
    /**
     * Send Stratum command
     *
     * @param {Object} data
     * @param {Boolean} bypass Bypass unauthorized
     * @param {String} name Call from the server
     *
     * @returns {Q.promise}
     */
    stratumSend(data: any, bypass?: any, name?: any): q<{}>;
    /**
     * Send raw data to the server
     *
     * @param {*} data
     * @returns {Q.promise}
     */
    send(data: any): q<{}>;
    static createSocket(socket?: net.Socket): net.Socket;
}
