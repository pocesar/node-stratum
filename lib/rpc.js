module.exports = function(classes){
  'use strict';

  var
    _ = classes.lodash,
    rpc = require('json-rpc2'),
    crypto = require('crypto');

  var RPC = classes.Base.define('RPC', function StratumRPC(){
    return {
      construct: function(opts){
        this.$super();

        // opts can't be changed from outside, extra safety measure
        this.freezeProperty('opts', opts);

        this.server = rpc.Server.create();
      },
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
       */
      expose: function(name, func, context){
        var self = this;

        RPC.debug('Exposing ' + name);

        self.server.expose(name, function(args, connection, callback){
          var password = false;

          RPC.debug('Received request for "' + name + '" with args "' + args + '"');

          try {
            if (typeof args[0] === 'string') {
              password =
                crypto
                  .createHash('sha256')
                  .update(
                    (new Buffer(args[0], 'base64')).toString('ascii')
                  ).digest('hex');
            } else {
              callback(RPC.debug('Invalid password'));
            }
          } catch (e) {
            RPC.debug(e);
          }

          if (password === self.opts.pass) {
            func.apply(context || this, [args.slice(1), connection, callback]);
          } else {
            callback(RPC.debug('Unauthorized access from ' + connection.address()));
          }
        });

        return self;
      },
      listen: function(){
        RPC.debug('Listening on port ' + this.opts.port);

        var func;

        switch (this.opts.mode) {
          case 'both':
            func = this.server.listenHybrid;
            break;
          case 'http':
            func = this.server.listen;
            break;
          case 'tcp':
            func = this.server.listenRaw;
            break;
        }

        func.call(this.server, this.opts.port, this.opts.host);
      },
      close: function(){
        this.server.close();
      }
    };
  });

  return RPC;
};