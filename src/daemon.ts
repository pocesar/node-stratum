import { spawn } from  "child_process"
import Base from "./base";
import * as _ from "lodash";
import * as q from "bluebird";
import * as fs from "fs";
const RPC = require("json-rpc2").Client;
import * as path from "path";

export default class Daemon extends Base {
  spawn: typeof spawn
  opts: any;
  name: string;
  rpc: any;
  process: any | null;

  constructor(opts?) {
    super();

    this.spawn = spawn;

    if (!_.isPlainObject(opts)) {
      throw new Error("Daemon options must not be empty");
    } else {
      var keys = _.keys(opts),
        mustHave = ["user", "password", "port", "host", "name"];

      if (
        !_.every(mustHave, function(item) {
          return (
            _.includes(keys, item) &&
            (!_.isEmpty(opts[item]) || _.isNumber(opts[item]))
          );
        })
      ) {
        throw new Error(
          'Daemon must have options "' +
            mustHave.join(", ") +
            '" set, there are no defaults'
        );
      }
    }

    if (!_.has(opts, "args") || !_.isArray(opts["args"])) {
      opts["args"] = [];
    }

    if (_.has(opts, "rpcserver")) {
      if (
        !_.has(opts.rpcserver, "notify") ||
        !_.isArray(opts.rpcserver["notify"])
      ) {
        opts.rpcserver["notify"] = [];
      } else {
        if (!_.has(opts.rpcserver, "notifyPath")) {
          opts.rpcserver["notifyPath"] = path.join(
            "..",
            "bin",
            "stratum-notify"
          );
        }
        Daemon.notify(opts);
      }
    }

    if (!_.has(opts, "path")) {
      opts["path"] = false;
    } else {
      if (!_.has(opts, "datadir")) {
        throw new Error(
          'The option "datadir" must be set to the place your wallet.dat is set.'
        );
      }
      Array.prototype.push.apply(opts["args"], [
        "-daemon", // daemon must be called with -daemon
        // rpc stuff
        { "-rpcuser": opts.user },
        { "-rpcpassword": opts.password },
        { "-rpcport": opts.port },
        // datadir
        { "-datadir": opts.datadir }
      ]);
    }

    Daemon.mountArgs(opts);

    this.opts = opts;

    this.name = this.opts.name;

    this.rpc = new RPC(opts.port, opts.host, opts.user, opts.password);

    this.process = null;
  }

  /**
   * Starts the daemon process.
   * Throws an error if the path doesn't exists.
   *
   * @throws Error
   * @returns {boolean}
   */
  start() {
    var self = this;

    if (_.isNull(this.process)) {
      self._pathExists();

      try {
        self.process = self.spawn(this.opts.path, this.opts.args);

        self.process.on("close", function daemonProcessClose() {
          Daemon.debug("Process closed");
          self.process = null;
          self.emit("close");
        });

        return true;
      } catch (e) {
        self.process = null;
        Daemon.debug(e);

        return false;
      }
    } else {
      return false;
    }
  }

  /**
   * Timeout
   *
   * @param fn
   * @param delay
   * @returns {*|setTimeout}
   * @private
   */
  _timeout(fn, delay) {
    return setTimeout(fn, delay);
  }

  /**
   * Check if the path of the process exists
   *
   * @throws Error
   * @private
   */
  _pathExists() {
    if (this.opts.path !== false && !fs.existsSync(this.opts.path)) {
      throw new Error(
        'Provided daemon "' + this.opts.path + '" path doesnt exist'
      );
    }
  }

  /**
   * Send a 'stop' RPC command to the daemon before trying to kill it
   *
   * @param {Number} wait Wait seconds before trying to kill it, defaults to 5 seconds
   * @returns {Q.promise}
   */
  close(wait) {
    var timeout,
      self = this;

    return new q(function(resolve, reject) {
      if (!_.isNull(self.process)) {
        timeout = self._timeout(function daemonProcessTimeout() {
          self.process.kill();
          self.process = null;
          reject(Daemon.debug("Process didnt respond and was killed"));
        }, wait ? wait * 1000 : 5000);

        self
          .call("stop")
          .then(
            function daemonProcessStopSuccess() {
              clearTimeout(timeout);
              self.process = null;
              resolve("Stopped " + self.name);
            },
            function daemonProcessStopFailed(err) {
              clearTimeout(timeout);
              reject(Daemon.debug(err));
            }
          )
          .done();
      } else {
        reject(Daemon.debug("Process wasnt started"));
      }
    });
  }

  /**
   * Communicate with the daemon using RPC calls
   *
   * @param {String} method Method
   * @param {Array} [params] Array of parameters
   *
   * @return {Q.promise}
   */
  call(method, params?) {
    var self = this,
      timeout;

    return new q(function(resolve, reject) {
      params = params === undefined ? [] : params;

      timeout = self._timeout(function daemonCallTimeout() {
        reject(Daemon.debug("Command timed out"));
      }, 4000);

      self.rpc.call(
        method,
        _.isArray(params) ? params : [params],
        function daemonRPCCall(err, result) {
          clearTimeout(timeout);

          if (err) {
            return reject(err);
          }

          return resolve(result);
        }
      );
    });
  }
  /**
   * 'Destructive' function that alters the input object, for the 'args' parameter
   *
   * @param {Object} opts
   */
  static mountArgs(opts) {
    if (_.has(opts, "args") && opts.args.length) {
      _.forEach(opts.args, function daemonForEach(i, index) {
        if (_.isString(i)) {
          if (!/^\-/.test(i)) {
            opts.args[index] = "-" + i;
          }
        } else if (_.isPlainObject(i)) {
          _.forIn(i, function daemonForIn(value, key) {
            if (!/^\-/.test(key)) {
              opts.args[index] = "-" + key + "=" + value;
            } else {
              opts.args[index] = key + "=" + value;
            }
          });
        } else {
          opts["args"][index] = null;
        }
      });

      opts["args"] = _.filter(opts["args"]);

      return opts["args"];
    }
    return opts;
  }
  /**
   * 'Destructive' function that alters the incoming object, for the 'args' parameter,
   * depending on the 'notify' parameter
   *
   * @param {Object} opts
   */
  static notify(opts) {
    var obj = [];

    if (_.has(opts, "rpcserver")) {
      var rpc = opts.rpcserver;

      if (
        _.has(rpc, "notify") &&
        _.has(rpc, "port") &&
        _.has(rpc, "host") &&
        _.has(rpc, "password") &&
        _.isArray(rpc.notify) &&
        _.has(rpc, "notifyPath")
      ) {
        _.forEach(rpc.notify, function daemonNotifyForEach(i) {
          var n = {};
          n[i + "notify"] =
            '"' +
            rpc.notifyPath +
            " --source " +
            opts.name +
            " --password " +
            rpc.password +
            " --host " +
            rpc.host +
            " --port " +
            rpc.port +
            " --type " +
            i +
            ' --data %s"';
          obj.push(n);
        });

        opts["args"] = opts["args"].concat(obj);
      }
    }

    return obj;
  }
}
