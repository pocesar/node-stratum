"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("./base");
const rpc_1 = require("./rpc");
const toobusy = require("toobusy-js");
const net = require("net");
const daemon_1 = require("./daemon");
const client_1 = require("./client");
const curry = require("better-curry");
const q = require("bluebird");
const _ = require("lodash");
class Server extends base_1.default {
    constructor(opts) {
        super();
        const self = this;
        self.clients = {};
        self.daemons = {};
        opts = opts || {};
        self.opts = _.defaults(_.clone(opts), Server.defaults);
        if (opts.rpc) {
            self.rpc = new rpc_1.default(self.opts.rpc);
            self.expose("mining.connections");
            self.expose("mining.block");
            self.expose("mining.wallet");
            self.expose("mining.alert");
        }
        toobusy.maxLag(self.opts.settings.toobusy);
        self.server = net.createServer();
        Server.debug("Created server");
        self.server.on("connection", function serverConnection(socket) {
            self.newConnection(socket);
        });
    }
    _tooBusy() {
        return toobusy();
    }
    expose(name) {
        if (this.rpc) {
            this.rpc.expose(name, Server.expose(this, name), this);
        }
        else {
            throw new Error("RPC is not enabled in the server");
        }
    }
    /**
     * Emits 'close' event when a connection was closed
     *
     * @param {Client} socket
     */
    closeConnection(socket) {
        var id = socket.id;
        socket.destroy();
        if (typeof this.clients[id] !== "undefined") {
            delete this.clients[id];
        }
        this.emit("close", id);
        Server.debug("(" + id + ") Closed connection " + _.size(this.clients) + " connections");
    }
    /**
     * Add daemons to this instance of Stratum server
     *
     * @return {Server}
     */
    addDaemon(definition) {
        if (typeof definition.name === "undefined") {
            throw new Error("addDaemon expects a full daemon configuration object");
        }
        if (this.daemons[definition.name]) {
            throw new Error('daemon already included "' + definition.name + '"');
        }
        this.daemons[definition.name] = new daemon_1.default(definition);
        return this;
    }
    /**
     * Emits 'busy' event when the server is on high load
     * Emits 'connection' event when there's a new connection, passes the newly created socket as the first argument
     *
     * @param {Socket} socket
     */
    newConnection(socket) {
        var self = this, closeSocket, handleData;
        if (this._tooBusy()) {
            socket.destroy();
            Server.debug("Server is busy, " + _.size(this.clients) + " connections");
            self.emit("busy");
        }
        else {
            socket = new client_1.default(socket, true);
            closeSocket = (function (socket) {
                return function closeSocket() {
                    self.closeConnection(socket);
                };
            })(socket);
            handleData = (function (socket) {
                return function handleData(buffer) {
                    self.handleData(socket, buffer);
                };
            })(socket);
            Server.debug("(" + socket.id + ") New connection");
            this.clients[socket.id] = socket;
            socket.on("end", closeSocket);
            socket.on("error", closeSocket);
            socket.socket.on("data", handleData);
            this.emit("connection", socket);
        }
    }
    /**
     *
     * @param {Client} socket
     * @param {Buffer} buffer
     */
    handleData(socket, buffer) {
        var self = this, c = Server.getStratumCommands(buffer), string = c.string, cmds = c.cmds;
        if (/ HTTP\/1\.1\n/i.test(string)) {
            // getwork trying to access the stratum server, send HTTP header
            socket
                .stratumHttpHeader(this.opts.settings.hostname, this.opts.settings.port)
                .done(function handleDataHttp() {
                self.closeConnection(socket);
            });
        }
        else if (cmds.length) {
            // We got data
            Server.processCommands.call(self, socket, cmds);
        }
    }
    /**
     * Start the Stratum server, the RPC and any coind that are enabled
     *
     * @return {Q.promise}
     */
    listen() {
        var self = this;
        return new q(function (resolve) {
            self.server.listen(self.opts.settings.port, self.opts.settings.host, function serverListen() {
                resolve(Server.debug("Listening on port " + self.opts.settings.port));
            });
            /*istanbul ignore else */
            if (self.rpc) {
                self.rpc.listen();
            }
        });
    }
    close() {
        Server.debug("Shutting down servers...");
        this.server.close();
        /*istanbul ignore else */
        if (this.rpc) {
            this.rpc.close();
        }
        _.forIn(this.daemons, function serverDaemon(daemon) {
            daemon.close();
        });
    }
    /**
     * Sends a Stratum result command directly to one socket
     *
     * @param {String} id UUID of the socket
     * @param {String} type The type of command, as defined in server.commands
     * @param {Array} array Parameters to send
     *
     * @return {Q.promise}
     */
    sendToId(id, type, array) {
        var self = this;
        return new q(function (resolve, reject) {
            if (type && _.isFunction(Server.commands[type])) {
                if (id && _.has(self.clients, id)) {
                    Server.commands[type]
                        .apply(self.clients[id], [id].concat(array))
                        .done(resolve, reject);
                }
                else {
                    reject(new Error(Server.debug('sendToId socket id not found "' + id + '"')));
                }
            }
            else {
                reject(new Error(Server.debug('sendToId command doesnt exist "' + type + '"')));
            }
        });
    }
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
    broadcast(type, data) {
        var self = this, total = 0;
        return new q(function (resolve, reject) {
            if (typeof type === "string" && _.isArray(data)) {
                if (typeof Server.commands[type] === "function" &&
                    Server.commands[type].broadcast === true) {
                    if (_.size(self.clients)) {
                        Server.debug("Brodcasting " + type + " with ", data);
                        q
                            .try(function serverBroadcast() {
                            _.forEach(self.clients, function serverBroadcastEach(socket) {
                                Server.commands[type].apply(socket, [null].concat(data));
                                total++;
                            });
                            return total;
                        })
                            .done(resolve, reject);
                    }
                    else {
                        reject(new Error(Server.debug("No clients connected")));
                    }
                }
                else {
                    reject(new Error(Server.debug('Invalid broadcast type "' + type + '"')));
                }
            }
            else {
                reject(new Error(Server.debug("Missing type and data array parameters")));
            }
        });
    }
    /**
     * Parse the incoming data for commands
     *
     * @param {Buffer} buffer
     * @returns {{string: string, cmds: Array}}
     */
    static getStratumCommands(buffer) {
        var string, cmds = [];
        if (Buffer.isBuffer(buffer) && buffer.length) {
            string = buffer.toString().replace(/[\r\x00]/g, "");
            cmds = _.filter(string.split("\n"), function serverCommandsFilter(item) {
                return !_.isEmpty(item) && !_.isNull(item);
            });
        }
        // Separate cleaned up raw string and commands array
        return { string: string, cmds: cmds };
    }
    /**
     * Process the Stratum commands and act on them
     * Emits 'mining' event
     *
     * @param {Client} socket
     * @param {Array} cmds
     */
    static processCommands(socket, cmds) {
        var command, method, self = this, onClient = this instanceof client_1.default, onServer = !onClient && this instanceof Server;
        Server.debug("(" + socket.id + ") Received command " + cmds);
        _.forEach(cmds, function serverForEachCommand(cmd) {
            try {
                command = JSON.parse(cmd);
                // Is it a method Stratum call?
                if (
                // Deal with method calls only when on Server
                onServer &&
                    typeof command["method"] !== "undefined" &&
                    command.method.indexOf("mining.") !== -1) {
                    method = command.method.split("mining.");
                    command["method"] = method[1];
                    if (method.length === 2 &&
                        typeof Server.commands[method[1]] === "function") {
                        // We don't want client sockets messing around with broadcast functions!
                        if (Server.commands[method[1]].broadcast !== true &&
                            method[1] !== "error") {
                            // only set lastActivity for real mining activity
                            socket.setLastActivity();
                            // Resolved, call the method and send data to socket
                            var accept = Server.bindCommand(socket, method[1], command.id);
                            // Rejected, send error to socket
                            var reject = Server.bindCommand(socket, "error", command.id);
                            (new q(function (resolve, reject) {
                                self.emit("mining", command, {
                                    resolve,
                                    reject
                                }, socket);
                            })).spread(accept).catch(reject);
                        }
                        else {
                            throw new Error("(" +
                                socket.id +
                                ') Client trying to reach a broadcast function "' +
                                method[1] +
                                '"');
                        }
                    }
                    else {
                        Server.commands.error.call(socket, command.id, Server.errors.METHOD_NOT_FOUND);
                        throw new Error('Method not found "' + command.method + '"');
                    }
                }
                else if ((onClient || socket.byServer === true) &&
                    (_.has(command, "result") || _.has(command, "method"))) {
                    // Result commands ONLY when 'self' is an instance of Client
                    // Since (unfortunately) stratum expects every command to be given in order
                    // we need to keep track on what we asked to the server, so we can
                    // act accordingly. This call is either a result from a previous command or a method call (broadcast)
                    socket.fullfill(command);
                }
                else {
                    throw new Error("Stratum request without method or result field");
                }
            }
            catch (e) {
                self.emit("mining.error", Server.debug(e), socket);
            }
        });
    }
    /**
     * Wraps the callback and predefine the ID of the current stratum call
     *
     * @param {Client} socket
     * @param {String} type
     * @param {String} id
     *
     * @returns {Function} curryed function
     */
    static bindCommand(socket, type, id) {
        return curry.predefine(this.commands[type], [id], socket);
    }
    static rejected(msg) {
        return q.reject(Server.debug(msg));
    }
    static expose(base, name) {
        return function serverExposedFunction(args, connection, callback) {
            return new q(function (resolve, reject) {
                rpc_1.default.debug('Method "' + name + '": ' + args);
                base.emit("rpc", name, args, connection, {
                    resolve,
                    reject
                });
            }).then(function serverExposedResolve(res) {
                res = [].concat(res);
                rpc_1.default.debug('Resolve "' + name + '": ' + res);
                callback.call(base, null, [res[0]]);
            }, function serverExposedReject(err) {
                rpc_1.default.debug('Reject "' + name + '": ' + err);
                callback.call(base, [].concat(err)[0]);
            });
        };
    }
    static invalidArgs(id, name, expected, args) {
        var count = _.filter(args, function (i) {
            return typeof i !== "undefined";
        }).length - 1;
        if (id === null || id === undefined || count !== expected) {
            return Server.rejected(id === null || id === undefined
                ? "No ID provided"
                : 'Wrong number of arguments in "' +
                    name +
                    '", expected ' +
                    expected +
                    " but got " +
                    count);
        }
        return true;
    }
}
Server.commands = {
    /**
     * Return subscription parameters to the new client
     *
     * @param id
     * @param {String} difficulty
     * @param {String} subscription
     * @param {String} extranonce1
     * @param {Number} extranonce2_size
     *
     * @returns {Q.promise}
     */
    subscribe(id, difficulty, subscription, extranonce1, extranonce2_size) {
        var ret;
        if ((ret = Server.invalidArgs(id, "subscribe", 4, arguments)) !== true) {
            return ret;
        }
        this.subscription = subscription;
        return this.stratumSend({
            id: id,
            result: [
                [
                    ["mining.set_difficulty", difficulty],
                    ["mining.notify", subscription]
                ],
                extranonce1,
                extranonce2_size
            ],
            error: null
        }, true, "subscribe");
    },
    /**
     * Send if submitted share is valid
     *
     * @param {Number} id ID of the call
     * @param {Boolean} accepted
     * @returns {Q.promise}
     */
    submit(id, accepted) {
        var ret;
        if ((ret = Server.invalidArgs(id, "submit", 1, arguments)) !== true) {
            return ret;
        }
        return this.stratumSend({
            id: id,
            result: !!accepted,
            error: null
        }, false, "submit");
    },
    /**
     * Send an error
     *
     * @param {Number} id
     * @param {Array|String} error
     * @returns {Q.promise}
     */
    error(id, error) {
        var ret;
        if ((ret = Server.invalidArgs(id, "error", 1, arguments)) !== true) {
            return ret;
        }
        Server.debug("Stratum error: " + error);
        return this.stratumSend({
            id: id,
            error: error,
            result: null
        }, true, "error");
    },
    /**
     * Authorize the client (or not). Must be subscribed
     *
     * @param {Number} id
     * @param {Boolean} authorized
     *
     * @returns {Q.promise}
     */
    authorize(id, authorized) {
        var ret;
        if ((ret = Server.invalidArgs(id, "authorize", 1, arguments)) !== true) {
            return ret;
        }
        if (!this.subscription) {
            return Server.commands.error.call(this, id, Server.errors.NOT_SUBSCRIBED);
        }
        this.authorized = !!authorized;
        return this.stratumSend({
            id: id,
            result: this.authorized,
            error: null
        }, true, "authorize");
    },
    /**
     * Miner is asking for pool transparency
     *
     * @param {String} id txlist_jobid
     * @param {*} merkles
     */
    get_transactions(id, merkles) {
        var ret;
        if ((ret = Server.invalidArgs(id, "get_transactions", 1, arguments)) !==
            true) {
            return ret;
        }
        return this.stratumSend({
            id: id,
            result: [].concat(merkles),
            error: null
        }, false, "get_transactions");
    },
    /**
     * Notify of a new job
     *
     * @param {Number} id
     * @param {*} job_id
     * @param {String} previous_hash
     * @param {String} coinbase1
     * @param {String} coinbase2
     * @param {Array} branches
     * @param {String} block_version
     * @param {String} nbit
     * @param {String} ntime
     * @param {Boolean} clean
     *
     * @returns {Q.promise}
     */
    notify(id, job_id, previous_hash, coinbase1, coinbase2, branches, block_version, nbit, ntime, clean) {
        var ret;
        if ((ret = Server.invalidArgs(false, "notify", 9, arguments)) !== true) {
            return ret;
        }
        return this.stratumSend({
            id: null,
            method: "mining.notify",
            params: [
                job_id,
                previous_hash,
                coinbase1,
                coinbase2,
                branches,
                block_version,
                nbit,
                ntime,
                clean
            ]
        }, true, "notify");
    },
    /**
     * Set the difficulty
     *
     * @param {Number} id
     * @param {Number} value
     * @returns {Q.promise}
     */
    set_difficulty(id, value) {
        var ret;
        if ((ret = Server.invalidArgs(false, "set_difficulty", 1, arguments)) !==
            true) {
            return ret;
        }
        return this.stratumSend({
            id: null,
            method: "mining.set_difficulty",
            params: [value]
        }, true, "set_difficulty");
    }
};
Server.errors = {
    FEE_REQUIRED: [-10, "Fee required", null],
    SERVICE_NOT_FOUND: [-2, "Service not found", null],
    METHOD_NOT_FOUND: [-3, "Method not found", null],
    UNKNOWN: [-20, "Unknown error", null],
    STALE_WORK: [-21, "Stale work", null],
    DUPLICATE_SHARE: [-22, "Duplicate share", null],
    HIGH_HASH: [-23, "Low difficulty share", null],
    UNAUTHORIZED_WORKER: [-24, "Unauthorized worker", null],
    NOT_SUBSCRIBED: [-25, "Not subscribed", null]
};
/**
 * Coin daemons, will spawn a process for each enabled process
 */
Server.daemons = {
    bitcoin: {
        name: "Bitcoin",
        path: "/usr/bin/bitcoind",
        user: "user",
        password: "password",
        port: 8332,
        host: "127.0.0.1",
        args: [] // extra args to pass to the daemon
    },
    litecoin: {
        name: "Litecoin",
        path: "/usr/bin/litecoind",
        user: "user",
        password: "password",
        port: 9332,
        host: "127.0.0.1",
        args: [] // extra args to pass to the daemon
    },
    ppcoin: {
        name: "PPcoin",
        path: "/usr/bin/ppcoind",
        user: "user",
        password: "password",
        port: 9902,
        host: "127.0.0.1",
        args: [] // extra args to pass to the daemon
    },
    primecoin: {
        name: "Primecoin",
        path: "/usr/bin/primecoind",
        user: "user",
        password: "password",
        port: 9911,
        host: "127.0.0.1",
        args: [] // extra args to pass to the daemon
    }
};
Server.defaults = {
    /**
     * RPC to listen interface for this server
     */
    rpc: {
        /**
         * Bind to address
         *
         * @type {String}
         */
        host: "localhost",
        /**
         * RPC port
         *
         * @type {Number}
         */
        port: 1337,
        /**
         * RPC password, this needs to be a SHA256 hash, defaults to 'password'
         * To create a hash out of your password, launch node.js and write
         *
         * require('crypto').createHash('sha256').update('password').digest('hex');
         *
         * @type {String}
         */
        password: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
        /**
         * Mode to listen. By default listen only on TCP, but you may use 'http' or 'both' (deal
         * with HTTP and TCP at same time)
         */
        mode: "tcp"
    },
    /**
     * The server settings itself
     */
    settings: {
        /**
         * Address to set the X-Stratum header if someone connects using HTTP
         * @type {String}
         */
        hostname: "localhost",
        /**
         * Max server lag before considering the server "too busy" and drop new connections
         * @type {Number}
         */
        toobusy: 70,
        /**
         * Bind to address, use 0.0.0.0 for external access
         * @type {string}
         */
        host: "localhost",
        /**
         * Port for the stratum TCP server to listen on
         * @type {Number}
         */
        port: 3333
    }
};
exports.default = Server;
Server.commands.notify['broadcast'] = true;
Server.commands.set_difficulty['broadcast'] = true;
Server.commands.error['serverOnly'] = true;
//# sourceMappingURL=server.js.map