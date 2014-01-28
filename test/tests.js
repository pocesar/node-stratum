'use strict';

var
  expect = require('expect.js'),
  stratum = require('../lib'),
  sinon = require('sinon'),
  _ = stratum.lodash,
  EventEmitter = stratum.Base,
  child_process;

function promisesArray(defers){
  var out = [];
  defers.forEach(function (t){
    out.push(t.promise);
  });
  return out;
}

module.exports = {
  Stratum: {
    Base        : {
      testEvent      : function (done){
        var base = stratum.Base.create();

        base.on('event', function (arg){
          expect(arg).to.equal(1);
          done();
        });

        base.emit('event', 1);
      }
    },
    Server      : {
      testInheritance            : function (){
        var server = stratum.Server.create();

        expect(server).to.be.ok();
        expect(server.$instanceOf(stratum.Base)).to.equal(true);
        expect(server.$instanceOf(stratum.Server)).to.equal(true);
      },
      testgetStratumCommands     : function (){
        var buffer = [
          JSON.stringify({'jsonrpc': '2.0', 'method': 'authorize', 'params': [], 'id': 1}),
          JSON.stringify({'jsonrpc': '2.0', 'method': 'subscribe', 'params': [], 'id': 2}),
          '', null
        ];

        expect(stratum.Server.getStratumCommands(buffer.join('\r\n'))).to.eql({string: buffer.join('\n'), cmds: [
          buffer[0],
          buffer[1]
        ]});
      },
      testProcessCommandsOnServer: function (done){
        var
          client = stratum.Client.create(),
          server = stratum.Server.create(),
          defers = [
            stratum.q.defer(),
            stratum.q.defer()
          ],
          cmd = '{"method":"mining.subscribe","params":[],"id":1}\n{"method":"mining.authorize","params":[],"id":1}\n',
          cmds = stratum.Server.getStratumCommands(cmd);

        server.on('mining', function (req, deferred, socket){
          expect(socket).to.be(client);
          expect(this).to.be(server);
          if (/authorize|subscribe|set_difficulty/.test(req.method)) {
            defers[0].resolve();
          }
        });

        server.on('mining.error', function (error, socket){
          expect(socket).to.be(client);
          expect(error).to.match(/Client trying to reach a broadcast function|Stratum request without method or result field/);
          defers[1].resolve();
        });

        stratum.Server.processCommands.call(
          server,
          client,
          cmds.cmds
        );

        stratum.Server.processCommands.call(
          server,
          client,
          stratum.Server.getStratumCommands('{"method":"mining.subscribe","params":[],"id":1}\n').cmds
        );

        stratum.Server.processCommands.call(
          server,
          client,
          stratum.Server.getStratumCommands('{"method":"mining.set_difficulty","params":[],"id":1}\n').cmds
        );

        stratum.Server.processCommands.call(
          server,
          client,
          stratum.Server.getStratumCommands('{"jsonrpc":"2.0","params":[],"id":0}').cmds
        );

        stratum.q.allSettled(promisesArray(defers)).done(function (){
          server.removeAllListeners();
          done();
        });
      },
      testProcessCommandsOnClient: function (){
        var
          client = stratum.Client.create(),
          cmd = '{"method":"subscribe","params":[],"id":1}\n{"method":"authorize","params":[],"id":1}',
          cmds = stratum.Server.getStratumCommands(cmd);

        stratum.Server.processCommands.call(client, client, cmds.cmds);
      },
      testHandleData             : function (done){
        var
          client = stratum.Client.create(),
          server = stratum.Server.create(),
          cmd = '{"method":"subscribe","params":[],"id":1}\n{"method":"authorize","params":[],"id":1}',
          cmds = stratum.Server.getStratumCommands(cmd),
          defers = [stratum.q.defer(), stratum.q.defer()],
          buf = ['GET / HTTP/1.1', ''].join('\n');

        sinon.stub(client, 'stratumHttpHeader', function (host, port){
          expect(host).to.equal(server.opts.settings.hostname);
          expect(port).to.equal(server.opts.settings.port);
          defers[0].resolve();

          return defers[0].promise;
        });

        sinon.stub(server, 'closeConnection', function (){});

        sinon.stub(stratum.Server, 'processCommands', function (){
          var args = stratum.Server.processCommands.args[0];
          expect(stratum.Server.processCommands.thisValues[0]).to.eql(server);
          expect(args[0]).to.be(client);
          expect(args[1]).to.eql(cmds.cmds);
          defers[1].resolve();
        });

        server.handleData(client, buf); // HTTP

        server.handleData(client, cmd); // Stratum

        stratum.q.allSettled(promisesArray(defers)).done(function (){
          stratum.Server.processCommands.restore();
          done();
        });
      },
      testBindCommand            : function (done){
        var
          client = stratum.Client.create(),
          functions = {
            'subscribe'       : 0,
            'submit'          : 0,
            'error'           : 0,
            'authorize'       : 0,
            'get_transactions': 0,
            'notify'          : 0,
            'set_difficulty'  : 0
          },
          defers = [],
          size = _.size(functions),
          spy = sinon.spy(stratum.Server, 'rejected');

        sinon.stub(client, 'stratumSend', function (opts, bypass){
          var d = stratum.q.defer();

          d.resolve({
            opts: opts,
            bypass: bypass
          });

          return d.promise;
        });

        for (var i in functions) {
          if (functions.hasOwnProperty(i)) {
            functions[i] = stratum.Server.bindCommand(client, i, 1);
            defers.push(functions[i]());
          }
        }

        stratum.q.allSettled(defers).then(function (){
          expect(spy.callCount).to.equal(size);
        }).done(function (){
          stratum.Server.rejected.restore();
          done();
        });
      }
    },
    Client      : {

    },
    ClientServer: {

    },
    RPC         : {
      before                      : function (){
        // password = 123 = a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3
        this.opts = {port: 9999, password: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'};
      },
      testDefaults                : function (){
        var rpc = stratum.RPCServer.create(this.opts);

        expect(rpc.opts).to.eql({
          'mode'    : 'tcp',
          'port'    : 9999,
          'host'    : 'localhost',
          'password': 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'
        });
      },
      testMissingRequireParameters: function (){
        expect(function (){
          stratum.RPCServer.create();
        }).to.throwError(/Port must be set/);

        expect(function (){
          stratum.RPCServer.create({port: 9999});
        }).to.throwError(/Password must be set/);
      },
      testMalformedBase64Password : function (){
        var rpc = stratum.RPCServer.create(this.opts);

        expect(rpc._password('9s7w45fcsaplw735gfal')).to.equal(false);
      },
      testBase64Password          : function (){
        var rpc = stratum.RPCServer.create(this.opts);

        // YmFzZTY0 = base64
        expect(rpc._password('YmFzZTY0')).to.equal('371a286d5872a3730d644327581546ec3e658bbf1a3c7f7f0de2bc19905d4402');
      },
      testAuthentication          : function (){
        var rpc = stratum.RPCServer.create(this.opts),
          cb = sinon.spy(),
          Context = sinon.stub({
            'exposed': function (){ return true; }
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
      testNoContext : function(){
        var
          rpc = stratum.RPCServer.create(this.opts),
          cb = sinon.spy();

        rpc.$import({
          testing: function(){
            return true;
          }
        });

        sinon.spy(rpc, 'testing');

        var exposed = rpc._authenticate('test', rpc.testing);

        exposed(['MTIz','1',2], {}, cb);
        expect(cb.called).to.be(false);
        expect(rpc.testing.called).to.be(true);
        expect(rpc.testing.calledWith(['1',2], {}, cb)).to.be(true);
      },
      testAlreadyListening: function(){
        var server = stratum.RPCServer.create(this.opts);

        server._server = true;

        expect(function(){
          server.listen();
        }).to.throwException(/Server already listening on port 9999/);
      },
      testTcpRPCCommand           : function (done){
        var server = stratum.RPCServer.create(this.opts),
          exposed = {
            'func': function (args, opts, callback){
              callback(null, args);
            }
          },
          spy = sinon.spy(exposed, 'func'),
          client = stratum.rpc.Client.create(server.opts.port, 'localhost');

        server.expose('func', exposed.func, exposed).listen();

        client.connectSocket(function (err, conn){
          conn.call('func', ['MTIz', 1, 2], function (err, result){
            expect(result).to.eql([1, 2]);
            expect(spy.calledWith([1, 2])).to.equal(true);
            server.close();
            done();
          });
        });
      },
      testHttpRPCCommand          : function (done){
        var server = stratum.RPCServer.create(_.defaults({mode: 'http'}, this.opts)),
          exposed = {
            'func': function (args, opts, callback){
              callback(null, args);
            }
          },
          spy = sinon.spy(exposed, 'func'),
          client = stratum.rpc.Client.create(server.opts.port, 'localhost');

        server.expose('func', exposed.func, exposed).listen();

        client.call('func', ['MTIz', 1, 2], function (err, result){
          expect(result).to.eql([1, 2]);
          expect(spy.calledWith([1, 2])).to.equal(true);
          server.close();
          done();
        });
      },
      testHybridRPCCommand        : function (done){
        var server = stratum.RPCServer.create(_.defaults({mode: 'both'}, this.opts)),
          exposed = {
            'func': function (args, opts, callback){
              callback(null, args);
            }
          },
          spy = sinon.spy(exposed, 'func'),
          client = stratum.rpc.Client.create(server.opts.port, 'localhost');

        server.expose('func', exposed.func, exposed).listen();

        client.connectSocket(function (err, conn){
          conn.call('func', ['MTIz', 1, 2], function (err, result){
            expect(result).to.eql([1, 2]);
            expect(spy.calledWith([1, 2])).to.equal(true);

            client.call('func', ['MTIz', 1, 2], function (err, result){
              expect(result).to.eql([1, 2]);
              expect(spy.calledWith([1, 2])).to.equal(true);
              server.close();
              done();
            });
          });
        });
      }
    },
    Daemon      : {
      before                : function (){
        child_process = function(){
          var em = new EventEmitter();

          em.kill = sinon.spy();

          return em;
        };
      },
      testCreationExceptions: function (){
        expect(function (){
          stratum.Daemon.create();
        }).to.throwError(/Daemon options must not be empty/);

        expect(function (){
          stratum.Daemon.create({path: '//', port: 8080});
        }).to.throwError(/Daemon must have options "user, password, port, host, name" set, there are no defaults/);

        expect(function (){
          stratum.Daemon.create({
            path    : '/doesnt/exist/%s',
            datadir : 'data/dir',
            port    : 8080,
            host    : 'localhost',
            user    : 'user',
            password: 'pass',
            name    : 'Mycoin'
          }).start();
        }).to.throwError(/Provided daemon "\/doesnt\/exist\/%s" path doesnt exist/);

        expect(function (){
          stratum.Daemon.create({
            path    : '/doesnt/exist/%s',
            port    : 8080,
            host    : 'localhost',
            user    : 'user',
            password: 'pass',
            name    : 'Mycoin'
          }).start();
        }).to.throwError(/The option "datadir" must be set to the place your wallet.dat is set./);

      },
      testNotify            : function (){
        var obj = {
          'port'     : 8080,
          'host'     : 'localhost',
          'user'     : 'rpcuser',
          'datadir'  : 'data/dir',
          'password' : 'bitcoindpassword',
          'name'     : 'Bitcoin',
          'rpcserver': {
            'port'      : 8888,
            'host'      : 'localhost',
            'password'  : 'rpcpassword',
            'notify'    : ['wallet', 'alert', 'block'],
            'notifyPath': 'stratum-notify'
          },
          'args'     : [
            {'blockminsize': 1000},
            {'blockmaxsize': 250000},
            'testnet',
            'upnp'
          ]
        };

        expect(stratum.Daemon.notify(obj)).to.eql([
          { walletnotify: '"stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type wallet --data %s"' },
          { alertnotify: '"stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type alert --data %s"' } ,
          { blocknotify: '"stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type block --data %s"' }
        ]);
      },
      testArgsCreation: function(){
        var daemon = new stratum.Daemon({
          'port'     : 8080,
          'datadir'  : 'data/dir',
          'host'     : 'localhost',
          'user'     : 'rpcuser',
          'password' : 'bitcoindpassword',
          'name'     : 'Bitcoin',
          'args'     : 'invalid args, must be array'
        });

        expect(daemon.opts.args).to.eql([]);
      },
      testArguments         : function (){
        var obj = {
          'port'    : 8080,
          'host'    : 'localhost',
          'user'    : 'rpcuser',
          'datadir' : 'data/dir',
          'password': 'rpcpassword',
          'name'    : 'Bitcoin',
          'args'    : [
            {'blockminsize': 1000},
            {'blockmaxsize': 250000},
            'testnet',
            'upnp',
            '-argstartingwithdash',
            1,
            {'-objargwithdash': true}
          ]
        };

        expect(stratum.Daemon.mountArgs(obj)).to.eql([
          '-blockminsize=1000',
          '-blockmaxsize=250000',
          '-testnet',
          '-upnp',
          '-argstartingwithdash',
          '-objargwithdash=true'
        ]);
      },
      testArgumentsAndNotify: function (){
        var obj = {
          'port'     : 8080,
          'host'     : 'localhost',
          'user'     : 'rpcuser',
          'datadir' : 'data/dir',
          'password' : 'rpcpassword',
          'name'     : 'Bitcoin',
          'rpcserver': {
            'port'      : 8888,
            'host'      : 'localhost',
            'password'  : 'rpcpassword',
            'notify'    : ['wallet', 'alert', 'block'],
            'notifyPath': 'stratum-notify'
          },
          'args'     : [
            {'blockminsize': 1000},
            {'blockmaxsize': 250000},
            'testnet',
            'upnp'
          ]
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
      testClose             : function (done){
        var clock = sinon.useFakeTimers();

        var daemon = stratum.Daemon.create({
          path    : '/doesnt/exist/%s',
          port    : 8080,
          host    : 'localhost',
          datadir : 'data/dir',
          user    : 'user',
          password: 'pass',
          name    : 'Mycoin'
        });

        sinon.stub(daemon, '_pathExists', function (){ return true; });

        sinon.stub(daemon.rpc, 'call', function(name, params, callback){
          if (daemon.callerror === true) {
            callback('error');
          } else {
            callback(null, 'success');
          }
        });

        expect(daemon._pathExists).to.not.throwException();

        daemon.close().fail(function (message){
          expect(message).to.be('Process wasnt started');
        }).done();

        var child = child_process();

        daemon.process = child;

        expect(daemon.start()).to.be(false);

        var promise = daemon.close();

        clock.tick(5000); // make the timeout be met

        promise.fail(function (message){
          expect(message).to.be('Process didnt respond and was killed');
          daemon.process = child;
          expect(child.kill.called).to.be(true);
          child.kill.reset();

        }).done(function(){
          promise = daemon.close(1);
          clock.tick(1000);

          promise.fail(function(message){
            expect(message).to.be('Process didnt respond and was killed');
            expect(child.kill.called).to.be(true);
            daemon.process = child;
            child.kill.reset();

          }).done(function(){
            daemon.close().done(function(){
              expect(daemon.process).to.be(null);
              daemon.callerror = true;
              daemon.process = child;

              daemon.close().fail(function(message){
                expect(message).to.be('error');
              }).done(function(){
                clock.restore();
                done();
              });
            });
          });
        });
      },
      testFailedRPCCall: function(done){
        var clock = sinon.useFakeTimers();

        var daemon = stratum.Daemon.create({
          path    : '/doesnt/exist/%s',
          datadir : 'data/dir',
          port    : 8080,
          host    : 'localhost',
          user    : 'user',
          password: 'pass',
          name    : 'Mycoin'
        });

        sinon.stub(daemon.rpc, 'call', function(name, params, callback){
          if (name === 'test') {
            callback('error');
          }
        });

        daemon.call('test').fail(function(message){
          expect(message).to.equal('error');
        }).done(function(){
          var promise = daemon.call('timeout');
          clock.tick(4000);

          promise.fail(function(message){
            expect(message).to.be('Command timed out');
          }).done(function(){
            clock.restore();
            done();
          });
        });

      },
      testRPCServerArgs: function(){
        sinon.spy(stratum.Daemon, 'notify');

        var opts = {
            path    : '/doesnt/exist/%s',
            port    : 8080,
            host    : 'localhost',
            user    : 'user',
            datadir : 'data/dir',
            password: 'pass',
            'rpcserver': {
              'port'      : 8888,
              'host'      : 'localhost',
              'password'  : 'rpcpassword',
              'notify'    : ['wallet', 'alert', 'block']
            },
            name    : 'Mycoin'
          },
          daemon = stratum.Daemon.create(opts);

        expect(stratum.Daemon.notify.called).to.be(true);
        expect(daemon.opts.rpcserver.notifyPath).to.equal(stratum.path.join('..','bin','stratum-notify'));

        stratum.Daemon.notify.reset();
        delete opts.rpcserver.notify;

        daemon = stratum.Daemon.create(opts);
        expect(stratum.Daemon.notify.called).to.be(false);
        expect(daemon.opts.rpcserver.notify).to.eql([]);

        stratum.Daemon.notify.restore();
      },
      testProcessSpawning: function(done){
        var invalid = 1, daemon = stratum.Daemon.create({
            path    : '/doesnt/exist/%s',
            port    : 8080,
            datadir : 'data/dir',
            host    : 'localhost',
            user    : 'user',
            password: 'pass',
            name    : 'Mycoin',
            args    : [
              'one',
              'two',
              invalid
            ]
          });

        var child = child_process();

        sinon.stub(daemon, '_pathExists', function (){ return true; });
        sinon.stub(daemon, 'spawn', function(){ return child; });

        expect(daemon.start()).to.be(true);

        expect(daemon.spawn.calledWith(
          '/doesnt/exist/%s',
          [ '-one',
            '-two',
            '-daemon',
            '-rpcuser=user',
            '-rpcpassword=pass',
            '-rpcport=8080',
            '-datadir=data/dir' ]
        )).to.be(true);

        expect(daemon.process).to.be(child);

        daemon.process.on('close', function(){
          expect(daemon.process).to.equal(null);

          daemon.spawn.restore();

          sinon.stub(daemon, 'spawn', function(){ throw new Error('failed to create process'); });

          expect(daemon.start()).to.be(false);
          done();
        });

        daemon.process.emit('close');
      },
      testCommunication     : function (done){
        var
          daemon = stratum.Daemon.create({
            port    : 59881,
            host    : 'localhost',
            datadir : 'data/dir',
            user    : 'user',
            password: 'pass',
            name    : 'Communicoin'
          })
          ;

        sinon.stub(daemon.rpc, 'call', function (args, opts, callback){
          expect(opts).to.eql([
            {dummy: true}
          ]);
          callback(null, 1);
        });

        daemon.call('getdifficulty', [
            {dummy: true}
        ]).done(function (res){
          expect(res).to.equal(1);
          daemon.call('getdifficulty', {dummy: true}).then(function(res){
            expect(res).to.equal(1);
            done();
          }).done();
        });
      }
    }
  }
};