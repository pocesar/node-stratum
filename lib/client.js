"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("./base");
const curry = require("better-curry");
const server_1 = require("./server");
const net = require("net");
const q = require("bluebird");
const uuid = require("uuid");
const _ = require("lodash");
/**
 * @param {Socket} socket
 * @param {Boolean} isServer
 * @constructor
 */
class Client extends base_1.default {
    constructor(socket, isServer) {
        super();
        this.pending = {};
        const self = this;
        // although BFGMiner starts at id 0, we start at 1, because it makes sense
        self.currentId = 1;
        // our TCP_NODELAY and KeepAlive'd socket
        self.socket = Client.createSocket(socket);
        self.authorized = false;
        self.byServer = isServer === undefined ? false : isServer;
        self.subscription = "";
        self.name = "";
        self.pending = {};
        self.id = uuid.v4();
        // Last activity is now!
        self.setLastActivity();
        self.socket.on("end", function clientSocketEnd() {
            if (self.emit) {
                self.emit("end", self);
            }
        });
        self.socket.on("error", function clientSocketError(err) {
            if (self.emit) {
                self.emit("error", self, err);
            }
        });
        self.socket.on("drain", function clientSocketDrain() {
            if (self.emit) {
                self.emit("drain", self);
            }
        });
        if (isServer !== true) {
            self.socket.on("data", function clientSocketData(data) {
                curry.predefine(self.handleData, [self], self)(data);
            });
        }
    }
    /**
     * Keep track of idle sockets, update the last activity
     *
     * @param {Number} [time] Unix Timestamp
     *
     * @return {this}
     */
    setLastActivity(time) {
        this.lastActivity = _.isNumber(time) ? time : Date.now();
        return this;
    }
    /**
     * Either emit an event, or fulfill a pending request by id
     */
    fullfill(command) {
        var self = this, method;
        if (_.has(command, "error") &&
            (!_.isNull(command["error"]) && !_.isEmpty(command["error"]))) {
            // we have an error, we need to act on that, regardless of other members in the command received
            throw Object.assign(new Error(command.error[1]), {
                stratum_code: command.error[0],
                stack: command.error[2],
                id: command.id
            });
        }
        else if (_.has(command, "id") && _.isNull(command["id"])) {
            // null id, it's a broadcast most likely, we need to check the last command
            if (_.has(command, "method")) {
                method = command.method.split("mining.");
                if (server_1.default.commands[method[1]].broadcast === true ||
                    method[1] === "error") {
                    command["method"] = method[1];
                    self.emit("mining", command, self, "broadcast");
                }
                else {
                    throw new Error("Server sent unknown command: " + JSON.stringify(command));
                }
            }
            else {
                throw new Error("Broadcast without a method: " + JSON.stringify(command));
            }
        }
        else if (_.has(command, "id") && _.has(self.pending, command["id"])) {
            // need to resolve pending requests by id
            Client.debug("Received pending request response: " + command + " " + self.pending);
            switch (self.pending[command["id"]]) {
                case "mining.subscribe":
                    self.subscription = command["result"];
                    break;
                case "mining.authorize":
                    self.authorized =
                        !!command["result"] ||
                            (command["error"] === null || command["error"] === undefined);
                    break;
            }
            self.emit("mining", command, self, "result", self.pending[command["id"]]);
            delete self.pending[command["id"]];
        }
        else if (_.has(command, "id") && _.has(command, "result")) {
            // regular result that wasnt issued by this socket
            self.emit("mining", command, self, "result");
        }
        else {
            throw new Error("No suitable command was issued from the server");
        }
    }
    /**
     * Get the current socket IP address
     *
     * @returns {{port: Number, address: String, family: String}}
     */
    address() {
        return this.socket.address();
    }
    /**
     * This method is exposed just for testing purposes
     *
     * @param {Socket} socket
     * @param {Buffer} buffer
     * @private
     */
    handleData(socket, buffer) {
        var c = server_1.default.getStratumCommands(buffer), cmds = c.cmds;
        server_1.default.processCommands.call(this, this, cmds);
    }
    /**
     * Destroy the socket and unattach any listeners
     */
    destroy() {
        this.removeAllListeners();
        this.socket.destroy();
    }
    /**
     * Connect to somewhere
     *
     * @param {Object} opts Where to connect
     * @returns {Q.promise}
     */
    connect(opts) {
        var self = this;
        return new q(function (resolve) {
            self.socket.connect(opts, function clientSocketConnect() {
                resolve(self);
            });
        });
    }
    /**
     * Don't use this functions directly, they are called from the server side,
     * it's not a client side command, but an answer
     *
     * @return {Q.promise}
     * @private
     */
    set_difficulty(args) {
        return server_1.default.commands.set_difficulty.apply(this, [null].concat(args));
    }
    /**
     * Don't use this functions directly, they are called from the server side
     * it's not a client side command, but an answer
     *
     * @return {Q.promise}
     * @private
     */
    notify(args) {
        return server_1.default.commands.notify.apply(this, [null].concat(args));
    }
    /**
     * Send HTTP header
     *
     * @param {String} hostname
     * @param {Number} port
     *
     * @return {Q.promise}
     */
    stratumHttpHeader(hostname, port) {
        var result = '{"error": null, "result": false, "id": 0}';
        var header = [
            "HTTP/1.1 200 OK",
            "X-Stratum: stratum+tcp://" + hostname + ":" + port,
            "Connection: Close",
            "Content-Length: " + (result.length + 1),
            "",
            "",
            result
        ];
        var self = this;
        return new q(function (resolve) {
            Client.debug("Sending Stratum HTTP header");
            self.socket.write(header.join("\n"), resolve);
        });
    }
    /**
     * Subscribe to the pool
     *
     * @param {String} [UA] Send the User-Agent
     * @returns {Q.promise}
     */
    stratumSubscribe(UA) {
        this.name = UA;
        return this.stratumSend({
            method: "mining.subscribe",
            id: this.currentId,
            params: typeof UA !== "undefined" ? [UA] : []
        }, true);
    }
    /**
     * Asks for authorization
     *
     * @param {String} user
     * @param {String} pass
     * @returns {Q.promise}
     */
    stratumAuthorize(user, pass) {
        return this.stratumSend({
            method: "mining.authorize",
            id: this.currentId,
            params: [user, pass]
        }, true);
    }
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
    stratumSubmit(worker, job_id, extranonce2, ntime, nonce) {
        this.setLastActivity();
        return this.stratumSend({
            method: "mining.submit",
            id: this.currentId,
            params: [worker, job_id, extranonce2, ntime, nonce]
        });
    }
    /**
     * Send Stratum command
     *
     * @param {Object} data
     * @param {Boolean} bypass Bypass unauthorized
     * @param {String} name Call from the server
     *
     * @returns {Q.promise}
     */
    stratumSend(data, bypass, name) {
        if (this.authorized === true || bypass === true) {
            this.pending[data.id || this.currentId++] = name || data.method;
            return this.send(JSON.stringify(data) + "\n");
        }
        else {
            var error = Client.debug(server_1.default.errors.UNAUTHORIZED_WORKER);
            this.emit("mining.error", error);
            return server_1.default.rejected(error);
        }
    }
    /**
     * Send raw data to the server
     *
     * @param {*} data
     * @returns {Q.promise}
     */
    send(data) {
        Client.debug("(" + this.id + ") Sent command " + data);
        var self = this;
        return new q(function (resolve, reject) {
            self.socket.write(data, function clientSocketWrite(err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(self);
                }
            });
        });
    }
    static createSocket(socket) {
        if (!socket) {
            socket = new net.Socket();
        }
        socket.setNoDelay(true);
        socket.setKeepAlive(true, 120);
        return socket;
    }
}
exports.default = Client;
//# sourceMappingURL=client.js.map