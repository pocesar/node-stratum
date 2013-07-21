module.exports = function (classes){
  'use strict';

  var
    net = require('net'),
    rpc = classes.rpc;

  var Client = classes.base.define('Client', function (){
    return {
      construct       : function (socket){
        this.$super();
        this.currentId = 1;
        this.socket = Client.socket(socket);
        this.authorized = false;
      },
      stratumSubscribe: function (){
        return this.stratumSend({
          'method': 'mining.subscribe',
          'id'    : this.currentId,
          'params': []
        });
      },
      stratumAuthorize: function (user, pass){
        return this.stratumSend({
          'method': 'mining.authorize',
          'id'    : this.currentId,
          'params': [user, pass]
        });
      },
      stratumSubmit   : function (worker, job_id, extranonce2, ntime, nonce){
        return this.stratumSend({
          'method': 'mining.submit',
          'id'    : this.currentId,
          'params': [worker, job_id, extranonce2, ntime, nonce]
        });
      },
      stratumError    : function (name){
        return this.stratumSend({
          id    : this.currentId,
          result: null,
          error : this.$class.errors[name]
        });
      },
      stratumSend     : function (data){
        return this.send(JSON.stringify(data) + '\n');
      },
      send            : function (data){
        return this.socket.write(data);
      }
    };
  }, {
    socket: function (socket){
      if (!socket) {
        socket = net.Socket();
      }
      socket.setNoDelay(true);
      socket.setKeepAlive(true, 120);
      return socket;
    },
    errors: {
      'fee-required'       : [-10, 'Fee required', null],
      'service-not-found'  : [-2, 'Service not found', null],
      'method-not-found'   : [-3, 'Method not found', null],
      'unknown'            : [-20, 'Unknown error', null],
      'stale-work'         : [-21, 'Stale work', null],
      'duplicate-share'    : [-22, 'Duplicate share', null],
      'high-hash'          : [-23, 'Low difficulty share', null],
      'unauthorized-worker': [-24, 'Unauthorized worker', null],
      'not-subscribed'     : [-25, 'Not subscribed', null]
    }
  });

  return Client;
};