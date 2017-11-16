"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rpc = require("json-rpc2");
const crypto = require("crypto");
const base_1 = require("./base");
const _ = require("lodash");
class RPC extends base_1.Base {
    constructor(opts) {
        super();
        opts = opts || {};
        opts = _.defaults(opts, {
            mode: "tcp",
            port: false,
            host: "localhost",
            password: false
        });
        if (!opts.port) {
            throw new Error("Port must be set");
        }
        if (!opts.password) {
            throw new Error("Password must be set");
        }
        this.opts = opts;
        this.server = new rpc.Server({ type: this.opts.mode });
        this._server = null;
    }
    /**
     * Generate a SHA 256 hex from a base64 string
     *
     * @param {String} base64 The base64 string of the password
     * @returns {Boolean|String} False if invalid Base64, the SHA256 hex otherwise
     * @private
     */
    _password(base64) {
        var ascii = new Buffer(base64, "base64").toString("ascii"), check = new Buffer(ascii).toString("base64");
        if (base64 === check) {
            return crypto
                .createHash("sha256")
                .update(ascii, "ascii")
                .digest("hex");
        }
        return false;
    }
    /**
     * Returns a bound function to the current exposed name, functions and context
     *
     * @param {String} name
     * @param {Function} func
     * @param {Object} [context]
     *
     * @returns {Function}
     * @private
     */
    _authenticate(name, func, context) {
        var self = this;
        return function rpcAuthenticate(args, connection, callback) {
            var password = false;
            RPC.debug('Received request for "' + name + '" with args "' + args + '"');
            if (typeof args[0] === "string") {
                password = self._password(args[0]);
            }
            else {
                callback(RPC.debug("No password provided"));
            }
            if (password && password === self.opts.password) {
                func.apply(context || self, [args.slice(1), connection, callback]);
            }
            else {
                callback(RPC.debug("Unauthorized access"));
            }
        };
    }
    /**
     * Expose a function, but first check if the password
     * is valid (as the first parameter from the RPC call).
     *
     * This isn't standard, but forces each call to be signed,
     * so there's no need to keep track of sessions, connections,
     * etc.
     *
     * So make sure that each request it's made, the first param
     * is the base64 password
     *
     * {
     *  "method":"any_method",
     *  "params":["base64ed_password", "param1", "param2"],
     *  "id": 1
     * }
     *
     * @param {String} method Name of the RPC method
     * @param {Function} func Function that will be called with the args, connection and the callback.
     * The callback must be called, so that the remote RPC endpoint receives an answer
     * <code>
     *   RPC.expose('name', function(args, connection, callback){
     *     if (args.length === 0){
     *       callback(error);
     *     } else {
     *       callback(null, result);
     *     }
     *   });
     * </code>
     * @param {Object} [context] The "this" of the previous parameter, func
     * @returns {RPC}
     */
    expose(method, func, context) {
        var self = this;
        RPC.debug('Exposing "' + method + '"');
        self.server.expose(method, self._authenticate(method, func, context));
        return self;
    }
    /**
     * Listen the RPC on the defined port
     *
     * @returns {RPC}
     */
    listen() {
        if (_.isNull(this._server)) {
            RPC.debug("Listening on port " + this.opts.port);
            var func;
            switch (this.opts.mode) {
                case "both":
                    func = this.server.listenHybrid;
                    break;
                case "http":
                    func = this.server.listen;
                    break;
                case "tcp":
                    func = this.server.listenRaw;
                    break;
            }
            this._server = func.call(this.server, this.opts.port, this.opts.host);
        }
        else {
            throw new Error(RPC.debug("Server already listening on port " + this.opts.port));
        }
        return this;
    }
    /**
     * Close the RPC server
     *
     * @returns {RPC}
     */
    close() {
        if (!_.isNull(this._server) && this._server.close) {
            this._server.close();
            this._server = null;
        }
        return this;
    }
}
exports.RPC = RPC;
//# sourceMappingURL=rpc.js.map