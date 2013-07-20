module.exports = function (classes){
  'use strict';

  var
    rpc = require('json-rpc2'),
    _ = require('lodash');

  var Stratum = classes.base.define('Stratum', function (){
    return {
      construct: function (opts){
        var self = this;


        this.port = opts.port || 8080;
        this.tcp = this.server.tcp();
      },
      handle   : function (){

      },
      listen   : function (cb){
        var self = this;

        self.tcp.listen(self.port, function (){
          if (self.debug === true) {
            console.log('Listening on port ' + self.port);
          }
          if (cb) {
            cb();
          }
        });

        return self;
      }
    };
  }, {
    mining  : {
      subscribe       : function (){

      },
      submit          : function (username, job, extranonce2, ntime, nonce){

      },
      authorize       : function (user, pass){

      },
      get_transactions: function (job){

      }
    },
    defaults: {
      coinds   : { // Coin daemons, will spawn a process for each enabled process
        'bitcoin': {
          enable  : false,                // enable this coind
          path    : '/usr/bin/bitcoind',  // path to the coind daemon to spawn
          user    : 'user',               // RPC username
          password: 'password',           // RPC password
          port    : 8332,                 // RPC port
          host    : '127.0.0.1',          // RPC host
          args    : []                     // extra args to pass to the daemon
        },
        'litecoin': {
          enable  : false,                 // enable this coind
          path    : '/usr/bin/litecoind',  // path to the coind daemon to spawn
          user    : 'user',                // RPC username
          password: 'password',            // RPC password
          port    : 9332,                  // RPC port
          host    : '127.0.0.1',           // RPC host
          args    : []                     // extra args to pass to the daemon
        },
        'ppcoin': {
          enable  : false,                 // enable this coind
          path    : '/usr/bin/ppcoind',    // path to the coind daemon to spawn
          user    : 'user',                // RPC username
          password: 'password',            // RPC password
          port    : 9902,                  // RPC port
          host    : '127.0.0.1',           // RPC host
          args    : []                     // extra args to pass to the daemon
        }
      },
      rpc     : { // RPC to listen interface for this server
        host: 'localhost',
        port: 1337,
        user: 'user',
        pass: 'password'
      },
      settings: {
        // or if you are on unix and will accept only local connections
        sock    : null, // '/tmp/stratum.sock',
        toobusy: 70,            // max server lag before considering the server "too busy" and drop new connections
        host   : 'localhost',   // bind to address, use 0.0.0.0 for external access
        port   : 3333           // port for the stratum TCP server to listen on
      }
    },
    errors  : {
      'stale-prevblk': 21,
      'stale-work'   : 21,
      'duplicate'    : 22,
      'H-not-zero'   : 23,
      'high-hash'    : 23
    }
  });

  return Stratum;
};
