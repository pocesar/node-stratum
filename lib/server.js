module.exports = function (classes){
  'use strict';

  var
    _ = classes.lodash,
    q = classes.q,
    toobusy = require('toobusy');

  var Stratum = classes.base.define('Stratum', function (){
    var stratum = this;

    return {
      construct            : function (opts){
        this.clients = [];

        this.opts = _.extend(stratum.defaults, opts);

        toobusy.maxLag(this.opts.settings.toobusy);

        this.rpc = classes.rpc.create(this.opts.rpc);

        this.server = classes.net.
      },
      sendStratumHttpHeader: function (socket){
        var header = [
          'HTTP/1.1 200 OK',
          'X-Stratum: stratum+tcp://' + this.opts.settings.hostname + ':' + this.opts.settings.port
        ];
        socket.header.join('\n');
      },
      handleData           : function (){

      },
      start                : function (){

      },
      /**
       * Send a mining method or result to all connected
       * sockets
       *
       * Returns a promise, so when it's done sending, you can
       * do:
       *
       * server.broadcast('notify', [...params]).then(function(){
       *  console.log('done');
       * });
       *
       * @param {String} type
       * @param {Array} data
       * @returns {q.defer()}
       */
      broadcast            : function (type, data){
        var self = this, d = q.defer();

        process.nextTick(function(){
          _.forEach(self.clients, function(socket){
            self.mining[type].apply(socket, data);
          });

          d.resolve();
        });

        return d.promise;
      }
    };
  }, {
    mining  : {
      subscribe: function (subscription, extranonce1, extranonce2_size){
        this.currentId = 1;

        return this.stratumSend({
          'id': this.currentId,
          'result': [['mining.notify', subscription], extranonce1, extranonce2_size],
          'error': null
        });
      },
      submit   : function (accepted){
        return this.stratumSend({
          id: this.currentId,
          error: null,
          result: !!accepted
        });
      },
      authorize: function (authorized){
        return this.stratumSend({
          'error': null,
          'id': this.currentId,
          'result': !!authorized
        });
      },
      notify: function(job_id, previous_hash, coinbase1, coinbase2, branches, block_version, nbit, ntime, clean){
        return this.stratumSend({
          id: null,
          method: 'mining.notify',
          params: [job_id, previous_hash, coinbase1, coinbase2, branches, block_version, nbit, ntime, clean]
        });
      },
      set_difficulty: function(value){
        return this.stratumSend({
          id: null,
          method: 'mining.set_difficulty',
          params: [value]
        });
      }
    },
    defaults: {
      /**
       * Coin daemons, will spawn a process for each enabled process
       */
      coinds  : {
        'bitcoin' : {
          enable  : false,                // enable this coind
          path    : '/usr/bin/bitcoind',  // path to the coind daemon to spawn
          user    : 'user',               // RPC username
          password: 'password',           // RPC password
          port    : 8332,                 // RPC port
          host    : '127.0.0.1',          // RPC host
          args    : []                    // extra args to pass to the daemon
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
        'ppcoin'  : {
          enable  : false,                 // enable this coind
          path    : '/usr/bin/ppcoind',    // path to the coind daemon to spawn
          user    : 'user',                // RPC username
          password: 'password',            // RPC password
          port    : 9902,                  // RPC port
          host    : '127.0.0.1',           // RPC host
          args    : []                     // extra args to pass to the daemon
        }
      },
      /**
       * RPC to listen interface for this server
       */
      rpc     : {
        /**
         * Bind to address
         *
         * @type {String}
         */
        host: 'localhost',
        /**
         * RPC port
         *
         * @type {Number}
         */
        port: 1337,
        /**
         * RPC password
         *
         * @type {String}
         */
        pass: 'password',
        /**
         * Set the UNIX socket if you are on unix and will accept only local connections
         * like '/tmp/stratum.sock'
         *
         * @type {String}
         */
        sock: null
      },
      /**
       * The server settings itself
       */
      settings: {
        /**
         * Address to set the X-Stratum header if someone connects using HTTP
         * @type {String}
         */
        hostname: 'localhost',
        /**
         * Max server lag before considering the server "too busy" and drop new connections
         * @type {Number}
         */
        toobusy : 70,
        /**
         * Bind to address, use 0.0.0.0 for external access
         * @type {string}
         */
        host    : 'localhost',
        /**
         * Port for the stratum TCP server to listen on
         * @type {Number}
         */
        port    : 3333
      }
    }
  });

  return Stratum;
};
