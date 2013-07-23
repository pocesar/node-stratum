module.exports = function (classes){
  'use strict';

  var
    q = classes.q,
    _ = classes.lodash;

  var Client = classes.base.define('Client', function (){
    return {
      construct       : function (socket, isServer){
        var self = this;

        this.$super();

        this.currentId = 1;
        this.socket = Client.socket(socket);
        this.authorized = false;
        this.id = '';

        this.socket.on('end', function(){
          self.emit('end', self);
        });

        this.socket.on('error', function(){
          self.emit('error', self);
        });

        this.socket.on('drain', function(){
          self.emit('drain', self);
        });

        if (isServer !== true) {
          this.socket.on('data', this.handleData.bind(this, socket));
        }
      },
      handleData: function(socket, buffer){
        var
          c = classes.server.getStratumCommands(buffer),
          string = c.string,
          cmds = c.cmds;

        classes.server.processCommands.call(this, socket, cmds, false);
      },
      close: function(exception){
        return this.socket.destroy(exception);
      },
      connect: function(opts){
        var d = q.defer();

        this.socket.connect(opts, d.resolve.bind(this));

        return d.promise;
      },
      stratumHttpHeader: function (hostname, port, cb){
        var
          self = this,
          result = '{"error": null, "result": false, "id": 0}',
          header = [
          'HTTP/1.1 200 OK',
          'X-Stratum: stratum+tcp://' + hostname + ':' + port,
          'Connection: Close',
          'Content-Length: ' + (result.length + 1),
          '',
          '',
          result
        ];

        Client.debug('Sending Stratum HTTP header');

        this.socket.write(header.join('\n'), cb);
      },
      stratumSubscribe: function (UA){
        return this.stratumSend({
          'method': 'mining.subscribe',
          'id'    : this.currentId++,
          'params': typeof UA !== 'undefined' ? [UA] : []
        }, true);
      },
      stratumAuthorize: function (user, pass){
        return this.stratumSend({
          'method': 'mining.authorize',
          'id'    : this.currentId++,
          'params': [user, pass]
        }, true);
      },
      stratumSubmit   : function (worker, job_id, extranonce2, ntime, nonce){
        return this.stratumSend({
          'method': 'mining.submit',
          'id'    : this.currentId++,
          'params': [worker, job_id, extranonce2, ntime, nonce]
        });
      },
      stratumError    : function (name){
        return this.stratumSend({
          id    : this.currentId++,
          result: null,
          error : classes.server.errors[name]
        });
      },
      /**
       * Send stratum object
       *
       * @param data
       * @param bypass
       * @returns {send|*}
       */
      stratumSend     : function (data, bypass){
        if (!this.authorized || bypass === true) {
          return this.send(JSON.stringify(data) + '\n');
        } else {
          this.emit('mining.error', classes.server.errors['unauthorized-worker']);
          return false;
        }
      },
      send            : function (data){
        Client.debug('(' + this.id + ') Sent command ' + (data));
        return this.socket.write(data);
      }
    };
  }, {
    socket: function (socket){
      if (!socket) {
        socket = classes.net.Socket();
      }
      socket.setNoDelay(true);
      socket.setKeepAlive(true, 120);
      return socket;
    }
  });

  return Client;
};