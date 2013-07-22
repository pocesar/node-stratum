module.exports = function(classes){
  'use strict';

  var
    _ = classes.lodash,
    rpc = require('json-rpc2');

  var RPC = classes.base.define('RPC', function(){
    return {
      construct: function(opts){
        this.$super();

        this.opts = opts;

        this.server = rpc.Server.create();
      },
      /**
       * Expose a function, but first check if the password
       * is valid (as the first parameter from the RPC call)
       *
       */
      expose: function(name, func){
        var self = this;

        this.server.expose(name, function(password){
          var args = _.toArray(arguments).slice(1);
          func.apply();
        });
      },
      listen: function(){
        this.$class.debug('Initiated RPC server');

        this.server.listenRaw(this.opts.port, this.opts.host);
      },
      close: function(){
        this.server.close();
      }
    };
  });

  return RPC;
};