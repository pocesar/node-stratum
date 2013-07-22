module.exports = function (classes){
  'use strict';

  var
    _ = classes.lodash,
    q = classes.q,
    uuid = classes.uuid,
    toobusy = require('toobusy');

  var Server = classes.base.define('Server', function (){
    return {
      construct            : function (opts){
        this.$super();

        this.clients = {};

        opts = opts || {};

        this.opts = _.defaults(opts, Server.defaults);

        toobusy.maxLag(this.opts.settings.toobusy);

        this.rpc = classes.rpc.create(this.opts.rpc);

        this.server = classes.net.createServer();

        Server.debug('Created server');

        this.server.on('connection', this.newConnection.bind(this));
      },
      /**
       * @param {Client} socket
       */
      closeConnection: function(socket){
        this.emit('close', socket);

        if (typeof this.clients[socket.id] !== 'undefined') {
          delete this.clients[socket.id];
        }

        Server.debug('Closed connection ' + socket.id + ', ' + _.size(this.clients) + ' connections');
      },
      /**
       * @param {Socket} socket
       */
      newConnection: function(socket){
        if (toobusy()){
          socket.destroy();

          Server.debug('Server is busy, ' + _.size(this.clients) + ' connections');

          this.emit('busy');
        } else {
          socket = classes.client.create(socket, true);
          socket.id = uuid.v1();

          Server.debug('New connection id ' + socket.id);

          this.clients[socket.id] = socket;

          socket.on('end', this.closeConnection.bind(this, socket));
          socket.on('error', this.closeConnection.bind(this, socket));

          socket.socket.on('data', this.handleData.bind(this, socket));

          this.emit('connection', socket);
        }
      },
      /**
       * @param {Client} socket
       * @param {Buffer} buffer
       */
      handleData           : function (socket, buffer){
        var
          c = Server.getStratumCommands(buffer),
          string = c.string,
          cmds = c.cmds;

        if (/ HTTP\/1\.1\n/i.test(string)){
          socket.stratumHttpHeader(this.opts.settings.hostname, this.opts.settings.port);
        } else if (cmds.length) {
          Server.processCommands.call(this, socket, cmds, true);
        }
      },
      /**
       * Start the Stratum server, the RPC and any coind that are enabled
       */
      start                : function (){
        var self = this;

        this.server.listen(this.opts.settings.port, this.opts.settings.host, function(){
          Server.debug('Listening on port ' + self.opts.settings.port);
        });
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
        var self = this, d = q.defer(), total = 0;

        process.nextTick(function(){
          _.forEach(self.clients, function(socket){
            self.mining[type].apply(socket, data);
            total++;
          });

          d.resolve();
        });

        return d.promise;
      }
    };
  }, {
    getStratumCommands: function(buffer){
      var
        string = buffer.toString().replace(/\r/g, ''),
        cmds = _.filter(string.split('\n'), function(item){ return !_.isEmpty(item); });

      return {string: string, cmds: cmds};
    },
    processCommands: function(socket, cmds, isServer){
      var command, method, self = this;

      _.forEach(cmds, function(cmd){
        try {
          command = JSON.parse(cmd);
          if (typeof command['method'] !== 'undefined' && command.method.indexOf('mining.') !== -1) {
            method = command.method.split('mining.');
            if (method.length === 2 && typeof Server.mining[method[1]] === 'function') {
              var d = q.defer();
              d.promise.done(Server.mining[method[1]].bind(socket));
              self.emit('mining', command, q.resolve);
            } else {
              Server.debug('Method not found "' + command.method + '"');
              socket.stratumError('method-not-found');
            }
          } else {
            throw new Error('Stratum request without method field');
          }
        } catch (e) {
          Server.debug(e);
        }
      });

    },
    mining  : {
      subscribe: function (subscription, extranonce1, extranonce2_size){
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
        pass: 'password'
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

  return Server;
};
