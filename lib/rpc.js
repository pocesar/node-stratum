module.exports = function(classes){
  'use strict';

  var RPC = classes.base.define('RPC', function(){
    return {
      construct: function(opts){
        this.$super();
        this.opts = opts;

        this.server = classes.rpc.Server.create();
      },
      isAuthorized: function(password){

      }
    };
  });

  return RPC;
};