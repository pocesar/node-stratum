import Base from "./base";
export default class RPC extends Base {
    opts: any;
    server: any;
    _server: any;
    constructor(opts?: any);
    /**
     * Generate a SHA 256 hex from a base64 string
     *
     * @param {String} base64 The base64 string of the password
     * @returns {Boolean|String} False if invalid Base64, the SHA256 hex otherwise
     * @private
     */
    _password(base64: any): string | false;
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
    _authenticate(name?: any, func?: any, context?: any): (args: any, connection: any, callback: any) => void;
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
    expose(method?: any, func?: any, context?: any): this;
    /**
     * Listen the RPC on the defined port
     *
     * @returns {RPC}
     */
    listen(): this;
    /**
     * Close the RPC server
     *
     * @returns {RPC}
     */
    close(): this;
}
