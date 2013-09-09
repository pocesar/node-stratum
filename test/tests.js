'use strict';

var
  expect = require('expect.js'),
  stratum = require('../lib'),
  sinon = require('sinon'),
  _ = stratum.lodash,
  EventEmitter = require('events').EventEmitter,
  em,
  child_process;

module.exports = {
  before: function(){
    em = new EventEmitter();

    child_process = sinon.stub({
      kill: function(){},
      on: function(name, cb){
        em.on(name, cb);
      },
      emit: function(){
        em.emit.call(child_process, Array.prototype.slice.call(arguments));
      }
    });
  },
  Stratum: {
    Base: {

    },
    Server: {
      beforeEach: function(){
        this.server = stratum.Server.create();
      },
      testInheritance: function(){
        expect(this.server).to.be.ok();
        expect(this.server.$instanceOf(stratum.Base)).to.equal(true);
        expect(this.server.$instanceOf(stratum.Server)).to.equal(true);
      },
      testgetStratumCommands: function(){
        var buffer = [
          JSON.stringify({'jsonrpc': '2.0', 'method': 'authorize', 'params': [], 'id': 1}),
          JSON.stringify({'jsonrpc': '2.0', 'method': 'subscribe', 'params': [], 'id': 2}),
          '', null
        ];

        expect(stratum.Server.getStratumCommands(buffer.join('\n\r'))).to.eql({string: buffer.join('\n'), cmds: [
          buffer[0],
          buffer[1]
        ]});
      },
      afterEach: function(){
        if (this.server.server._handle) {
          this.server.close();
        }
        this.server = null;
      }
    },
    Client: {

    },
    RPC: {
      before: function(){
        // password = 123 = a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3
        this.opts = {port: 9999, password: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'};
      },
      testLock: function(){
        var rpc = stratum.RPCServer.create(_.assign({lock: false}, this.opts));

        rpc.opts.mode = 'http';

        expect(rpc.opts.mode).to.equal('http');

        rpc = stratum.RPCServer.create(this.opts);

        expect(function(){
          rpc.opts.mode = 'http';
        }).to.throwException();

        expect(rpc.opts.mode).to.equal('tcp');
      },
      testDefaults: function(){
        var rpc = stratum.RPCServer.create(this.opts);

        expect(rpc.opts).to.eql({
          'lock': true,
          'mode': 'tcp',
          'port': 9999,
          'host': 'localhost',
          'password': 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'
        });
      },
      testMissingRequireParameters: function(){
        expect(function(){
          stratum.RPCServer.create();
        }).to.throwError(/Port must be set/);

        expect(function(){
          stratum.RPCServer.create({port: 9999});
        }).to.throwError(/Password must be set/);
      },
      testMalformedBase64Password: function(){
        var rpc = stratum.RPCServer.create(this.opts);

        expect(rpc._password('9s7w45fcsaplw735gfal')).to.equal(false);
      },
      testBase64Password: function(){
        var rpc = stratum.RPCServer.create(this.opts);

        // YmFzZTY0 = base64
        expect(rpc._password('YmFzZTY0')).to.equal('371a286d5872a3730d644327581546ec3e658bbf1a3c7f7f0de2bc19905d4402');
      },
      testAuthentication: function(){
        var rpc = stratum.RPCServer.create(this.opts),
            cb = sinon.spy(),
            Context = sinon.stub({
              'exposed': function(){ return true; }
            });

        var exposed = rpc._authenticate('test', Context.exposed, Context);

        cb.reset();
        exposed([true, 1], {}, cb);

        expect(cb.calledWith('No password provided')).to.equal(true);

        cb.reset();
        exposed(['YmFzZTY0', 1], {}, cb);

        expect(cb.calledWith('Unauthorized access')).to.equal(true);

        // MTIz = 123
        cb.reset();
        exposed(['MTIz', 1], {}, cb);

        expect(Context.exposed.calledOn(Context)).to.equal(true);
        expect(Context.exposed.calledWith([1], {}, cb)).to.equal(true);
        expect(cb.called).to.equal(false);
      },
      testTcpRPCCommand: function(done){
        var server = stratum.RPCServer.create(this.opts),
            exposed = {
              'func': function(args, opts, callback){
                callback(null, args);
              }
            },
            spy = sinon.spy(exposed, 'func'),
            client = stratum.rpc.Client.create(server.opts.port, 'localhost');

        server.expose('func', exposed.func, exposed).listen();

        client.connectSocket(function(err, conn){
          conn.call('func', ['MTIz', 1, 2], function(err, result){
            expect(result).to.eql([1,2]);
            expect(spy.calledWith([1,2])).to.equal(true);
            server.close();
            done();
          });
        });
      },
      testHttpRPCCommand: function(done){
        var server = stratum.RPCServer.create(_.defaults({mode:'http'}, this.opts)),
            exposed = {
              'func': function(args, opts, callback){
                callback(null, args);
              }
            },
            spy = sinon.spy(exposed, 'func'),
            client = stratum.rpc.Client.create(server.opts.port, 'localhost');

        server.expose('func', exposed.func, exposed).listen();

        client.call('func', ['MTIz', 1, 2], function(err, result){
          expect(result).to.eql([1,2]);
          expect(spy.calledWith([1,2])).to.equal(true);
          server.close();
          done();
        });
      },
      testHybridRPCCommand: function(done){
        var server = stratum.RPCServer.create(_.defaults({mode:'both'}, this.opts)),
            exposed = {
              'func': function(args, opts, callback){
                callback(null, args);
              }
            },
            spy = sinon.spy(exposed, 'func'),
            client = stratum.rpc.Client.create(server.opts.port, 'localhost');

        server.expose('func', exposed.func, exposed).listen();

        client.connectSocket(function(err, conn){
          conn.call('func', ['MTIz', 1, 2], function(err, result){
            expect(result).to.eql([1,2]);
            expect(spy.calledWith([1,2])).to.equal(true);

            client.call('func', ['MTIz', 1, 2], function(err, result){
              expect(result).to.eql([1,2]);
              expect(spy.calledWith([1,2])).to.equal(true);
              server.close();
              done();
            });
          });
        });
      }
    },
    Daemon: {
      testCreationExceptions: function(){
        expect(function(){
          stratum.Daemon.create();
        }).to.throwError(/Daemon options must not be empty/);

        expect(function(){
          stratum.Daemon.create({path: '//', port: 8080});
        }).to.throwError(/Daemon must have options user, password, port, host, name set, there are no defaults/);

        expect(function(){
          stratum.Daemon.create({
            path: '/doesnt/exist/%s',
            port: 8080,
            host: 'localhost',
            user: 'user',
            password: 'pass',
            name: 'Mycoin'
          }).start();
        }).to.throwError(/Provided daemon "\/doesnt\/exist\/%s" path doesnt exist/);

      },
      testNotify: function(){
        var obj = {
          'port': 8080,
          'host': 'localhost',
          'user': 'rpcuser',
          'password': 'bitcoindpassword',
          'name': 'Bitcoin',
          'rpcserver': {
            'port': 8888,
            'host': 'localhost',
            'password': 'rpcpassword',
            'notify': ['wallet','alert','block'],
            'notifyPath': 'stratum-notify'
          },
          'args': [{'blockminsize':1000},{'blockmaxsize':250000}, 'testnet', 'upnp']
        };

        expect(stratum.Daemon.notify(obj)).to.eql([
          { walletnotify: '"stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type wallet --data %s"' },
          { alertnotify: '"stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type alert --data %s"' } ,
          { blocknotify: '"stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type block --data %s"' }
        ]);
      },
      testArguments: function(){
        var obj = {
          'port': 8080,
          'host': 'localhost',
          'user': 'rpcuser',
          'password': 'rpcpassword',
          'name': 'Bitcoin',
          'args': [{'blockminsize':1000},{'blockmaxsize':250000}, 'testnet', 'upnp']
        };

        expect(stratum.Daemon.mountArgs(obj)).to.eql([
          '-blockminsize=1000',
          '-blockmaxsize=250000',
          '-testnet',
          '-upnp'
        ]);
      },
      testArgumentsAndNotify: function(){
        var obj = {
          'port': 8080,
          'host': 'localhost',
          'user': 'rpcuser',
          'password': 'rpcpassword',
          'name': 'Bitcoin',
          'rpcserver': {
            'port': 8888,
            'host': 'localhost',
            'password': 'rpcpassword',
            'notify': ['wallet','alert','block'],
            'notifyPath': 'stratum-notify'
          },
          'args': [{'blockminsize':1000},{'blockmaxsize':250000}, 'testnet', 'upnp']
        };

        stratum.Daemon.notify(obj);

        expect(stratum.Daemon.mountArgs(obj)).to.eql([
          '-blockminsize=1000',
          '-blockmaxsize=250000',
          '-testnet',
          '-upnp',
          '-walletnotify="stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type wallet --data %s"',
          '-alertnotify="stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type alert --data %s"',
          '-blocknotify="stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type block --data %s"'
        ]);
      },
      testClose: function(done){
        var daemon = stratum.Daemon.create({
            path: '/doesnt/exist/%s',
            port: 8080,
            host: 'localhost',
            user: 'user',
            password: 'pass',
            name: 'Mycoin'
        });

        sinon.stub(daemon, '_pathExists', function(){ return true; });
        sinon.stub(daemon, '_timeout', function(fn){ return setTimeout(fn, 0); });

        expect(daemon._pathExists).to.not.throwException();

        daemon.close().then(function(){

        }, function(message){
          expect(message).to.be('Process wasnt started');
        });

        daemon.process = child_process;

        expect(daemon.start()).to.be(false);

        daemon.close().then(function(){
        }, function(message){
          expect(message).to.be('Process didnt respond and was killed');
          expect(daemon.process.kill.called).to.be(true);
          done();
        });
      }
    }
  }
};