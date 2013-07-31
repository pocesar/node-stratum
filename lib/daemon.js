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
          var keys = _.keys(opts);

          if (!_.every(['path','user','password','port','host','name'], function(item){
            return _.contains(keys, item) && !_.isEmpty(opts[item]) || _.isNumber(opts[item]);
          })) {
            throw new Error('Daemon must have all options set, there are no defaults');
          }
        }

        if (!_.has(opts, 'args')) {
          opts['args'] = [];
        }

        this.freezeProperty('opts', opts);

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
      _spawn: function(){
        return spawn(this.opts.path, this.opts.args);
      },
      _timeout: function(fn, delay){
        return setTimeout(fn, delay);
      },
      _pathExists: function(){
        if (!fs.existsSync(this.opts.path)) {
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
  });

  return Daemon;
};