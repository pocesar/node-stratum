module.exports = function(classes){
  'use strict';

  var
    spawn = require('child_process').spawn,
    _ = classes.lodash,
    fs = classes.fs,
    q = classes.q,
    rpc = classes.rpc.Client;

  var Daemon = classes.Base.define('Daemon', function(){
    return {
      construct: function(opts){
        this.$super();

        if (!_.isPlainObject(opts)) {
          throw new Error('Daemon options must not be empty');
        } else {
          var keys = _.keys(opts), mustHave = ['user','password','port','host','name'];

          if (!_.every(mustHave, function(item){
            return _.contains(keys, item) && (!_.isEmpty(opts[item]) || _.isNumber(opts[item]));
          })) {
            throw new Error('Daemon must have options ' + mustHave.join(', ') + ' set, there are no defaults');
          }
        }

        if (!_.has(opts, 'args') || !_.isArray(opts['args'])) {
          opts['args'] = [];
        }

        if (_.has(opts, 'rpcserver')) {
          if (!_.has(opts.rpcserver, 'notify') || !_.isArray(opts.rpcserver['notify'])) {
            opts.rpcserver['notify'] = [];
          } else {
            if (!_.has(opts.rpcserver,'notifyPath')) {
              opts.rpcserver['notifyPath'] = fs.normalize('../bin/stratum-notify');
            }
            Daemon.notify(opts);
          }
        }

        if (!_.has(opts, 'path')) {
          opts['path'] = false;
        }

        Daemon.mountArgs(opts);

        if (opts.lock !== false) {
          this.freezeProperty('opts', opts);
        } else {
          this.opts = opts;
        }

        this.rpc = rpc.create(opts.port, opts.host, opts.user, opts.password);

        this.process = null;
      },
      /**
       *
       * @returns {boolean}
       */
      start: function(){
        if (_.isNull(this.process)) {
          this._pathExists();

          try {
            var self = this;

            this.process = this._spawn();

            this.process.on('close', function(){
              Daemon.debug('Process closed');
              self.process = null;
            });

            return true;
          } catch (e) {
            this.process = null;
            this.$class.debug(e);
            return false;
          }
        } else {
          return false;
        }
      },
      /**
       * Spawn a new process using opts.path and opts.args
       *
       * @returns {Process}
       * @private
       */
      _spawn: function(){
        return spawn(this.opts.path, this.opts.args);
      },
      /**
       *
       * @param fn
       * @param delay
       * @returns {*|setTimeout}
       * @private
       */
      _timeout: function(fn, delay){
        return setTimeout(fn, delay);
      },
      /**
       *
       * @private
       */
      _pathExists: function(){
        if (this.opts.path !== false && !fs.existsSync(this.opts.path)) {
          throw new Error('Provided daemon "' + this.opts.path + '" path doesnt exist');
        }
      },
      /**
       * Send a 'stop' RPC command to the daemon before trying to kill it
       *
       * @param {Number} wait Wait seconds before trying to kill it, defaults to 5 seconds
       * @returns {Q.promise}
       */
      close: function(wait){
        var d = q.defer(), timeout, self = this;

        if (!_.isNull(this.process)) {
          timeout = self._timeout(function(){
            self.process.kill();
            d.reject(Daemon.debug('Process didnt respond and was killed'));
          }, wait ? wait * 1000 : 5000);

          this.call('stop').then(function(){
            clearTimeout(timeout);
            d.resolve();
          });
        } else {
          d.reject(Daemon.debug('Process wasnt started'));
        }

        return d.promise;
      },
      /**
       * Communicate with the daemon using RPC calls
       *
       * @param {String} method Method
       * @param {Array} [params] Array of parameters
       *
       * @return {Q.promise}
       */
      call: function(method, params){
        var d = q.defer(), self = this, timeout;

        timeout = self._timeout(function(){
          d.reject(Daemon.debug('Command timed out'));
        }, 4000);

        this.rpc.call(method, _.isArray(params) ? params : [], function(err, result){
          clearTimeout(timeout);

          if (err) {
            return d.reject(err);
          }

          return d.resolve(result);
        });

        return d.promise;
      }
    };
  }, {
    /**
     * 'Destructive' function that alters the input object, for the 'args' parameter
     *
     * @param {Object} opts
     */
    mountArgs: function(opts){
      if (_.has(opts,'args') && opts.args.length) {
        _.forEach(opts.args, function(i, index){
          if (_.isString(i)) {
            if (!/^\-/.test(i)) {
              opts.args[index] = '-' + i;
            }
          } else if (_.isPlainObject(i)) {
            _.forIn(i, function(value, key){
              if (!/^\-/.test(value)) {
                opts.args[index] = '-' + key + '=' + value;
              } else {
                opts.args[index] = key + '=' + value;
              }
            });
          } else {
            opts['args'][index] = null;
          }
        });

        opts['args'] = _.filter(opts['args']);

        return opts['args'];
      }
      return opts;
    },
    /**
     * 'Destructive' function that alters the incoming object, for the 'args' parameter,
     * depending on the 'notify' parameter
     *
     * @param {Object} opts
     */
    notify: function(opts){
      var obj = [];

      if (_.has(opts, 'rpcserver')) {
        var rpc = opts.rpcserver;

        if (_.has(rpc, 'notify') &&
            _.has(rpc, 'port') &&
            _.has(rpc, 'host') &&
            _.has(rpc, 'password') &&
            _.isArray(rpc.notify) &&
            _.has(rpc, 'notifyPath')) {
          _.forEach(rpc.notify, function(i){
            var n = {};
            n[i + 'notify'] = '"' + rpc.notifyPath +
                              ' --source ' + opts.name +
                              ' --password ' + rpc.password +
                              ' --host ' + rpc.host +
                              ' --port ' + rpc.port +
                              ' --type ' + i +
                              ' --data %s"';
            obj.push(
              n
            );
          });

           opts['args'] = opts['args'].concat(obj);
        }
      }

      return obj;
    }
  });

  return Daemon;
};