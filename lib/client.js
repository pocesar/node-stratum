module.exports = function (classes){
  'use strict';

  var
    q = classes.q,
    _ = classes.lodash,
    uuid = classes.uuid;

  var Client = classes.Base.$define('Client', {
    construct        : function (socket, isServer){
      var self = this;

      self.$super();

      // although BFGMiner starts at id 0, we start at 1, because it makes sense
      self.currentId = 1;
      // our TCP_NODELAY and KeepAlive'd socket
      self.socket = self.$class.createSocket(socket);
      self.authorized = false;
      self.byServer = isServer === undefined ? false : isServer;
      self.subscription = '';
      self.name = '';
      self.pending = {};
      // Uniquely identify this socket, regardless of clusters or inter-processes,
      // it's unique.
      self.id = uuid.v4();

      // Last activity is now!
      self.setLastActivity();

      self.socket.on('end', function clientSocketEnd(){
        self.emit('end', self);
      });

      self.socket.on('error', function clientSocketError(){
        if (self.emit) {
          self.emit('error', self);
        }
      });

      self.socket.on('drain', function clientSocketDrain(){
        if (self.emit) {
          self.emit('drain', self);
        }
      });

      if (isServer !== true) {
        self.socket.on('data', self.handleData.bind(self, self));
      }
    },
    /**
     * Keep track of idle sockets, update the last activity
     *
     * @param {Number} [time] Unix Timestamp
     */
    setLastActivity: function(time){
      this.lastActivity = _.isNumber(time) ? time : Date.now();
    },
    /**
     * Either emit an event, or fulfill a pending request by id
     */
    fullfill: function(command){
      var self = this, method;

      if (_.has(command, 'error') && (!_.isNull(command['error']) && !_.isEmpty(command['error']))) {
        // we have an error, we need to act on that, regardless of other members in the command received
        self.emit('mining.error', command, self);
      } else if (_.has(command, 'id') && _.isNull(command['id'])) {
        // null id, it's a broadcast most likely, we need to check the last command
        if (_.has(command, 'method')) {
          method = command.method.split('mining.');
          if (['set_difficulty', 'notify', 'error'].indexOf(method[1]) !== -1) {
            command['method'] = method[1];
            self.emit('mining', command, self, 'broadcast');
          } else {
            throw new Error('Server sent unknown command: ' +  JSON.stringify(command));
          }
        } else {
          throw new Error('Broadcast without a method: ' + JSON.stringify(command));
        }
      } else if (_.has(command, 'id') && _.has(self.pending, command['id'])) {
        // need to resolve pending requests by id
        self.$class.debug('Received pending request response', command, self.pending);

        switch (self.pending[command['id']].method) {
          case 'mining.subscribe':
            self.subscription = command['result'];
            break;
          case 'mining.authorize':
            self.authorized = !!command['result'];
            break;
        }

        self.emit('mining', command, self, 'result');

        delete self.pending[command['id']];
      } else {
        throw new Error('Mismatched call id, was expecting ' + self.currentId + ' but got ' + command['id']);
      }
    },
    /**
     * Get the current socket IP address
     *
     * @returns {{port: Number, address: String, family: String}}
     */
    address: function(){
      return this.socket.address();
    },
    /**
     * This method is exposed just for testing purposes
     *
     * @param {Socket} socket
     * @param {Buffer} buffer
     * @private
     */
    handleData       : function (socket, buffer){
      var
        c = classes.Server.getStratumCommands(buffer),
        cmds = c.cmds;

      classes.Server.processCommands.call(this, this, cmds);
    },
    /**
     * Destroy the socket and unattach any listeners
     */
    destroy            : function (){
      this.removeAllListeners();

      this.socket.destroy();

      this.$destroy();
    },
    /**
     * Connect to somewhere
     *
     * @param {Object} opts Where to connect
     * @returns {Q.promise}
     */
    connect          : function (opts){
      var d = q.defer(), self = this;

      this.socket.connect(opts, function clientSocketConnect(){
        d.resolve(self);
      });

      return d.promise;
    },
    /**
     * Don't use this functions directly, they are called from the server side,
     * it's not a client side command, but an answer
     *
     * @return {Q.promise}
     * @private
     */
    set_difficulty: function(args){
      return classes.Server.commands.set_difficulty.apply(this, [null].concat(args));
    },
    /**
     * Don't use this functions directly, they are called from the server side
     * it's not a client side command, but an answer
     *
     * @return {Q.promise}
     * @private
     */
    notify: function(args){
      return classes.Server.commands.notify.apply(this, [null].concat(args));
    },
    /**
     * Send HTTP header
     *
     * @param {String} hostname
     * @param {Number} port
     *
     * @return {Q.promise}
     */
    stratumHttpHeader: function (hostname, port){
      var
        result = '{"error": null, "result": false, "id": 0}',
        d = q.defer(),
        header = [
          'HTTP/1.1 200 OK',
          'X-Stratum: stratum+tcp://' + hostname + ':' + port,
          'Connection: Close',
          'Content-Length: ' + (result.length + 1),
          '',
          '',
          result
        ];

      this.$class.debug('Sending Stratum HTTP header');

      this.socket.write(header.join('\n'), d.resolve);

      return d.promise;
    },
    /**
     * Subscribe to the pool
     *
     * @param {String} [UA] Send the User-Agent
     * @returns {Q.promise}
     */
    stratumSubscribe : function (UA){
      this.name = UA;

      return this.stratumSend({
        'method': 'mining.subscribe',
        'id'    : this.currentId,
        'params': typeof UA !== 'undefined' ? [UA] : []
      }, true);
    },
    /**
     * Asks for authorization
     *
     * @param {String} user
     * @param {String} pass
     * @returns {Q.promise}
     */
    stratumAuthorize : function (user, pass){
      return this.stratumSend({
        'method': 'mining.authorize',
        'id'    : this.currentId,
        'params': [user, pass]
      }, true);
    },
    /**
     * Sends a share
     *
     * @param {String} worker
     * @param {String} job_id
     * @param {String} extranonce2
     * @param {String} ntime
     * @param {String} nonce
     * @returns {Q.promise}
     */
    stratumSubmit    : function (worker, job_id, extranonce2, ntime, nonce){
      this.setLastActivity();

      return this.stratumSend({
        'method': 'mining.submit',
        'id'    : this.currentId,
        'params': [worker, job_id, extranonce2, ntime, nonce]
      });
    },
    /**
     * Send Stratum command
     *
     * @param {Object} data
     * @param {Boolean} bypass Bypass unauthorized
     * @returns {Q.promise}
     */
    stratumSend      : function (data, bypass){
      if (this.authorized === true || bypass === true) {

        if (this.byServer === false) {
          var id = this.currentId++;
          this.pending[id] = data;
        }
        return this.send(JSON.stringify(data) + '\n');
      } else {
        var error = this.$class.debug(classes.Server.errors.UNAUTHORIZED_WORKER);

        this.emit('mining.error', error);

        return classes.Server.rejected(error);
      }
    },
    /**
     * Send raw data to the server
     *
     * @param {*} data
     * @returns {Q.promise}
     */
    send             : function (data){
      this.$class.debug('(' + this.id + ') Sent command ' + (data));

      var d = q.defer(), self = this;

      self.socket.write(data, function clientSocketWrite(err){
        if (err) {
          d.reject(self, err);
        } else {
          d.resolve(self);
        }
      });

      return d.promise;
    }
  }, {
    createSocket: function (socket){
      if (!socket) {
        socket = new classes.net.Socket();
      }
      socket.setNoDelay(true);
      socket.setKeepAlive(true, 120);
      return socket;
    }
  });

  return Client;
};