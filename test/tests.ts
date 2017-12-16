import { expect } from 'chai'

import * as stratum from '../lib'
import * as sinon from 'sinon'
import * as _ from 'lodash'
import * as net from 'net'
import * as Bluebird from 'bluebird'
import * as path from 'path'
import * as rpc from 'json-rpc2'

let child_process: any

function promisesArray(defers) {
  var out = []
  defers.forEach(function (t) {
    out.push(t.promise)
  })
  return out
}

function createDefers(defers) {
  var out = []
  for (var i = 0; i < defers; i++) {
    (function () {
      var resolve, reject

      var defer = new Bluebird(function (_resolve, _reject) {
        resolve = _resolve
        reject = _reject
      })

      out.push({ promise: defer, resolve, reject })
    })()
  }
  return {
    promise: Bluebird.all(promisesArray(out)),
    next: function (value = null) {
      if (defers === 0) {
        throw new Error('Exceeded next calls')
      }
      out[--defers].resolve(value)
      return out[defers].promise
    },
    get current() {
      return defers
    }
  }
}

suite('Stratum', function () {

  suite('Base', function () {

    test('events', function (done) {
      var base = new stratum.Base()

      base.on('event', function (arg) {
        expect(arg).to.equal(1)
        done()
      })

      base.emit('event', 1)
    })

  })

  suite('Server', function () {

    test('inheritance from base', function () {
      var server = new stratum.Server()

      expect(server).to.be.ok()
      expect(server instanceof stratum.Base).to.equal(true)
      expect(server instanceof stratum.Server).to.equal(true)
    })

    test('instance sets RPC server if in options', function () {
      sinon.stub(stratum.RPCServer.prototype, 'expose').callsFake(function () { })

      var server = new stratum.Server({
        rpc: {
          port: 8080,
          password: 'password'
        }
      })

      expect(server.rpc.expose.callCount).to.be(4)

      delete server.rpc

      expect(server.expose.bind(server, '')).to.throwException(/RPC is not enabled in the server/)

      stratum.RPCServer.prototype.expose.restore()
    })

    test('close socket connection', function (done) {
      var
        socket = new stratum.Client(),
        calls = 0,
        id = socket.id,
        server = new stratum.Server()

      server.clients[id] = socket

      server.on('close', function (_id) {
        expect(_id).to.be(id)
        if (calls === 0) {
          socket = new stratum.Client()
          id = socket.id
        }
        if (calls++ === 1) {
          done()
        } else {
          server.closeConnection(socket)
        }
      })

      server.closeConnection(socket)
    })

    test('socket connection calls newConnection', function (done) {
      var server = new stratum.Server()

      sinon.stub(server, 'newConnection').callsFake(function (socket) {
        expect(socket).to.be(true)
        done()
      })

      server.server.emit('connection', true)
    })

    test('emits busy event when too much CPU', function (done) {
      var
        server = new stratum.Server(),
        socket = new stratum.Client()

      sinon.stub(server, '_tooBusy').callsFake(function () {
        return true
      })

      server.on('busy', function () {
        server._tooBusy.restore()
        done()
      })

      server.newConnection(socket)
    })

    test('wraps net Socket in Client class on new connection', function (done) {
      var
        socket = new net.Socket(),
        found = false,
        server = new stratum.Server()

      server.on('connection', function (_socket) {
        for (var uuid in server.clients) {
          if (server.clients[uuid].socket === socket) {
            found = true
            break
          }
        }

        sinon.stub(server, 'closeConnection').callsFake(function (s) {
          expect(s).to.be(_socket)
          _socket.socket.emit('data')
        })
        sinon.stub(server, 'handleData').callsFake(function () {
          expect('called').to.be('called')
          done()
        })

        expect(found).to.be(true)
        expect(_socket.byServer).to.be(true)
        expect(_socket.socket).to.be(socket)
        expect(_socket).to.be.a(stratum.Client)
        _socket.emit('end')
      })

      server.newConnection(socket)
    })

    test('getStratumCommands should parse the JSON string', function () {
      var buffer = [
        JSON.stringify({ 'jsonrpc': '2.0', 'method': 'authorize', 'params': [], 'id': 1 }),
        JSON.stringify({ 'jsonrpc': '2.0', 'method': 'subscribe', 'params': [], 'id': 2 }),
        '', null, JSON.stringify({ 'jsonrpc': '2.0', 'method': 'subscribe', 'params': [], 'id': 3 })
      ]

      expect(stratum.Server.getStratumCommands(new Buffer(buffer.join('\r\n')))).to.eql({
        string: buffer.join('\n'), cmds: [
          buffer[0],
          buffer[1],
          buffer[4]
        ]
      })
    })

    test('process commands on the server', function (done) {
      var
        client = new stratum.Client(),
        server = new stratum.Server(),
        defers = createDefers(6),
        cmd = '{"method":"mining.subscribe","params":[],"id":1}\n{"method":"mining.authorize","params":[],"id":1}\n',
        cmds = stratum.Server.getStratumCommands(new Buffer(cmd))

      sinon.stub(client, 'send')

      server.on('mining', function (req, deferred, socket) {
        expect(socket).to.be(client)
        expect(this).to.be(server)

        if (/authorize|subscribe|set_difficulty/.test(req.method)) {
          defers.next(req.method)
        }
      })

      server.on('mining.error', function (error, socket) {
        expect(socket).to.be(client)
        expect(error).to.match(/Client trying to reach a broadcast function|Stratum request without method or result field|Method not found/)
        defers.next(error.toString())
      })

      stratum.Server.processCommands.call(
        server,
        client,
        cmds.cmds
      )

      stratum.Server.processCommands.call(
        server,
        client,
        stratum.Server.getStratumCommands(new Buffer('{"method":"mining.subscribe","params":[],"id":1}\n')).cmds
      )

      stratum.Server.processCommands.call(
        server,
        client,
        stratum.Server.getStratumCommands(new Buffer('{"method":"mining.invalid","params":[],"id":1}\n')).cmds
      )

      stratum.Server.processCommands.call(
        server,
        client,
        stratum.Server.getStratumCommands(new Buffer('{"method":"mining.set_difficulty","params":[],"id":1}\n')).cmds
      )

      stratum.Server.processCommands.call(
        server,
        client,
        stratum.Server.getStratumCommands(new Buffer('{"jsonrpc":"2.0","params":[],"id":0}')).cmds
      )

      defers.promise.spread(function (err, broadcast, invalid, sub2, authorize, sub1) {
        expect(sub1).to.be('subscribe')
        expect(authorize).to.be('authorize')
        expect(sub2).to.be('subscribe')
        expect(broadcast).to.match(/ Client trying to reach a broadcast function/)
        expect(err).to.match(/Stratum request without method or result field/)
        expect(invalid).to.match(/Method not found/)

        server.removeAllListeners()
        done()
      })
    })

    test('process commands on the client', function (done) {
      var
        client = new stratum.Client(),
        defers = createDefers(2),
        cmd = new Buffer('{"result":true,"error":null,"id":1}\n{"result":false,"error":null,"id":2}\n'),
        cmds = stratum.Server.getStratumCommands(cmd)

      sinon.stub(client, 'send')

      client.on('mining', function (req, socket, type) {
        expect(type).to.be('result')
        expect(socket).to.be(client)

        defers.next(req.result)
      })

      stratum.Server.processCommands.call(
        client,
        client,
        cmds.cmds
      )

      defers.promise.done(function (res) {
        expect(res[0]).to.be(false)
        expect(res[1]).to.be(true)
        done()
      })
    })

    test('expose', function (done) {
      var
        ev = new stratum.Base(),
        spy = sinon.spy(),
        defers = createDefers(2),
        f = stratum.Server.expose(ev, 'test')

      ev.on('rpc', function (name, args, connection, d) {
        expect(this).to.be(ev)
        expect(name).to.be('test')

        if (defers.current === 2) {
          expect(args).to.eql([1, 2, 3])
          d.resolve(['ok!'])

          d.promise.then(function () {
            expect(spy.lastCall.thisValue).to.be(ev)
            expect(spy.lastCall.args).to.eql([null, ['ok!']])

            defers.next()

            f([], {}, spy)
          })
        } else if (defers.current === 1) {
          d.reject(['fail'])
          d.promise.catch(function () {
            expect(spy.lastCall.thisValue).to.be(ev)
            expect(spy.lastCall.args).to.eql(['fail'])
            defers.next()
          })
        }
      })

      f([1, 2, 3], {}, spy)

      defers.promise.done(function () {
        done()
      })
    })

    test('handle socket data', function (done) {
      var
        client = new stratum.Client(),
        server = new stratum.Server(),
        cmd = new Buffer('{"method":"subscribe","params":[],"id":1}\n{"method":"authorize","params":[],"id":1}'),
        cmds = stratum.Server.getStratumCommands(cmd),
        defers = createDefers(3),
        buf = new Buffer(['GET / HTTP/1.1', ''].join('\n'))

      sinon.spy(stratum.Server, 'getStratumCommands')

      sinon.stub(client, 'stratumHttpHeader').callsFake(function (host, port) {
        expect(host).to.equal(server.opts.settings.hostname)
        expect(port).to.equal(server.opts.settings.port)

        return defers.next()
      })

      sinon.stub(server, 'closeConnection')

      sinon.stub(stratum.Server, 'processCommands').callsFake(function () {
        var args = stratum.Server.processCommands.args[0]
        expect(stratum.Server.processCommands.thisValues[0]).to.be(server)
        expect(args[0]).to.be(client)
        expect(args[1]).to.eql(cmds.cmds)
        defers.next()
      })

      server.handleData(client, buf); // HTTP

      server.handleData(client, cmd); // Stratum

      server.handleData(client, ' '); // Empty

      server.handleData(client, new Buffer('\x10\x19\x18\x10\x00\x00\x00\x12')); // Garbage

      server.handleData(client, new Buffer(0)); // really empty

      defers.promise.done(function () {
        expect(stratum.Server.getStratumCommands.callCount).to.equal(5)
        stratum.Server.processCommands.restore()
        stratum.Server.getStratumCommands.restore()
        done()
      })
    })

    test('listen on selected port and close', function (done) {

      var
        opts = {
          settings: {
            port: 8080,
            host: 'localhost'
          }
        },
        server = new stratum.Server(opts)

      server.rpc = sinon.createStubInstance(stratum.RPCServer)

      sinon.stub(server.server, 'listen').callsFake(function (port, host, cb) {
        expect(port).to.be(opts.settings.port)
        expect(host).to.be(opts.settings.host)
        cb()
      })

      sinon.stub(server.server, 'close').callsFake(function () { })

      server.listen().done(function () {
        expect(server.rpc.listen.called).to.be(true)
        server.daemons = {
          'dummy': sinon.stub({ 'close': function () { } })
        }
        server.close()
        expect(server.server.close.called).to.be(true)
        expect(server.daemons.dummy.close.called).to.be(true)
        done()
      })
    })

    test('send to id', function (done) {
      var
        number = 0,
        server = new stratum.Server(),
        client = new stratum.Client()

      server.clients[client.id] = client

      server.sendToId().catch(function (err) {
        number++
        expect(err).to.match(/sendToId command doesnt exist "undefined"/)
      })
        .then(function () {
          return server.sendToId(null, 'doesnt')
        })
        .catch(function (err) {
          number++
          expect(err).to.match(/sendToId command doesnt exist "doesnt"/)
        })
        .then(function () {
          return server.sendToId('invalidid', 'subscribe')
        })
        .catch(function (err) {
          number++
          expect(err).to.match(/sendToId socket id not found "invalidid"/)
        })
        .then(function () {
          sinon.stub(client, 'stratumSend').callsFake(function () {
            return Bluebird.resolve('done')
          })
          return server.sendToId(client.id, 'subscribe', ['difficulty', 'subscription', 'extranonce1', 'extranonce2_size'])
        })
        .done(function (command) {
          expect(command).to.be('done')
          expect(number).to.be(3)
          done()
        })
    })

    test('bindCommand', function (done) {
      var
        client = new stratum.Client(),
        functions = Object.keys(stratum.Server.commands),
        defers = [], f,
        size = functions.length,
        spy = sinon.spy(stratum.Server, 'rejected')

      stratum.Server.commands.subscribe().catch(function (err) {
        expect(err).to.be('No ID provided')
      }).done()

      client.subscription = "true"

      sinon.stub(client, 'stratumSend').callsFake(function (opts, bypass) {
        return Bluebird.resolve({
          opts: opts,
          bypass: bypass
        })
      })

      for (var i = 0; i < size; i++) {
        f = stratum.Server.bindCommand(client, functions[i], 'asdf')
        //console.log(functions[i], f)
        defers.push(f())
      }

      Bluebird.all(defers).catch(function (err) {
        //console.log(err)
      }).done(function () {
        expect(spy.callCount).to.equal(size + 1)
        stratum.Server.rejected.restore()
        done()
      })
    })

    test('addDaemon throws', function () {
      var server = new stratum.Server()
      expect(server.addDaemon.bind(server, {})).to.throwException(/addDaemon expects a full daemon configuration object/)
      var dummy = { 'name': 'bitcoin', 'user': ' ', 'password': ' ', 'host': ' ', 'port': ' ' }
      server.addDaemon(dummy)
      expect(function () {
        server.addDaemon(dummy)
      }).to.throwException(/daemon already included "bitcoin"/)

      expect(Object.keys(server.daemons)).to.have.length(1)
    })

    test('broadcast', function (done) {
      var
        i = 0, server = new stratum.Server(), events = { connection: 0 }

      server.broadcast('set_difficulty', ['asdf']).catch(function (err) {
        expect(err).to.match(/No clients connected/)

        server.on('connection', function (s) {
          events.connection++

          s.on('mining', function () {
            //console.log(arguments)
          })
        })

        while (i++ < 10) {
          var client = new net.Socket()

          server.newConnection(client)
        }

        for (var id in server.clients) {
          sinon.stub(server.clients[id], 'send').callsFake(function (cli) {
            return Bluebird.resolve(cli)
          }.bind(server.clients[id]))
        }

        server.broadcast().catch(function (err) {
          expect(err).to.match(/Missing type and data array parameters/)
          return server.broadcast('set_difficulty')
        }).catch(function (err) {
          expect(err).to.match(/Missing type and data array parameters/)
          return server.broadcast('subscribe', ['asdf'])
        }).catch(function (err) {
          expect(err).to.match(/Invalid broadcast type "subscribe"/)
          return Bluebird.all([
            server.broadcast('set_difficulty', ['asdf']),
            server.broadcast('notify', ['asdf', 'adf', 'asdf', 'asdf', 'adf', 'adsf', 'adsf', 'asdf', 'asdf'])
          ])
        }).done(function (results) {
          expect(results[0]).to.equal(i - 1)
          expect(results[1]).to.equal(i - 1)
          expect(events.connection).to.equal(i - 1)
          done()
        })
      })
    })

  })

  suite('Client', function () {

    test('accepts existing socket', function () {
      var socket = new net.Socket()

      expect(stratum.Client.createSocket(socket)).to.be(socket)
    })

    test('setLastActivity', function (done) {
      var client = new stratum.Client()

      client.setLastActivity()
      setTimeout(function () {
        expect(client.lastActivity).to.be.lessThan(Date.now())
        client.setLastActivity(1)
        expect(client.lastActivity).to.be(1)
        done()
      }, 10)
    })

    test('events emitted from underlaying socket', function (done) {
      var
        client = new stratum.Client(),
        defers = createDefers(3),
        cb, socket = client.socket

      cb = function (self) {
        defers.next(self)
      }


      client.on('drain', cb)

      client.on('end', cb)

      client.on('error', cb)

      socket.emit('drain')
      socket.emit('end')
      socket.emit('error')

      // destroy the client, but the socket is alive and bound, shouldn't throw

      //client.$destroy()

      socket.emit('drain')
      socket.emit('end')
      socket.emit('error')

      defers.promise.spread(function (drain, end, error) {
        expect(drain).to.be(client)
        expect(end).to.be(client)
        expect(error).to.be(client)
        done()
      })
    })

  })

  suite('ClientServer', function () {

    test('built in commands', function (done) {
      var
        socket = new (require('stream')).PassThrough(),
        client, defers = createDefers(6),
        server = new stratum.Server()

      socket.setNoDelay = function () { }
      socket.setKeepAlive = function () { }

      server.on('connection', function (s) {
        client = s

        client.on('mining', function (req, cli, type, method) {
          defers.next(method)
          //console.log('client', req, type, method)

          switch (method) {
            case 'subscribe':
              expect(req.result).to.eql([[
                ['mining.set_difficulty', 'a'],
                ['mining.notify', 'b']
              ],
                'c',
                'd'
              ])
              expect(cli.authorized).to.be(false)
              s.stratumAuthorize('user', 'pass')
              break
            case 'authorize':
              expect(req.result).to.be(true)
              expect(cli.authorized).to.be(true)
              s.stratumSubmit('a', 'b', 'c', 'd', 'f')
              break
            case 'submit':
              expect(req.result).to.be(true)
              break
          }

        })

        client.on('mining.error', function (err) {
          //console.log('client.error', err)
        })

        s.stratumSubscribe('Test')
      })

      server.on('mining', function (req, res) {
        //console.log('server', req)
        defers.next(req.method)
        switch (req.method) {
          case 'subscribe':
            expect(req.params).to.eql(['Test'])
            res.resolve(['a', 'b', 'c', 'd'])
            break
          case 'authorize':
            expect(req.params).to.eql(['user', 'pass'])
            res.resolve([true])
            break
          case 'submit':
            expect(req.params).to.eql(['a', 'b', 'c', 'd', 'f'])
            res.resolve([true])
            break
        }
      })

      server.on('mining.error', function (err) {
        //console.log('server.error', err)
      })

      server.newConnection(socket)

      defers.promise.spread(function () {
        done()
      })
    })

  })

  suite('RPC', function () {
    setup(function () {
      // password = 123 = a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3
      this.opts = { port: 9999, password: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3' }
    })

    test('default opts', function () {
      var rpc = new stratum.RPCServer(this.opts)

      expect(rpc.opts).to.eql({
        'mode': 'tcp',
        'port': 9999,
        'host': 'localhost',
        'password': 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'
      })
    })

    test('missing required parameters', function () {
      expect(function () {
        new stratum.RPCServer()
      }).to.throwError(/Port must be set/)

      expect(function () {
        new stratum.RPCServer({ port: 9999 })
      }).to.throwError(/Password must be set/)
    })

    test('malformed base64 password', function () {
      var rpc = new stratum.RPCServer(this.opts)

      expect(rpc._password('9s7w45fcsaplw735gfal')).to.equal(false)
    })

    test('working base64 password', function () {
      var rpc = new stratum.RPCServer(this.opts)

      // YmFzZTY0 = base64
      expect(rpc._password('YmFzZTY0')).to.equal('371a286d5872a3730d644327581546ec3e658bbf1a3c7f7f0de2bc19905d4402')
    })

    test('authentication', function () {
      const rpc = new stratum.RPCServer(this.opts)
      const cb = sinon.spy()
      const Context = sinon.stub({
        'exposed': function () { return true; }
      })

      var exposed = rpc._authenticate('test', Context['exposed'], Context)

      cb.reset()
      exposed([true, 1], {}, cb)

      expect(cb.calledWith('No password provided')).to.equal(true)

      cb.reset()
      exposed(['YmFzZTY0', 1], {}, cb)

      expect(cb.calledWith('Unauthorized access')).to.equal(true)

      // MTIz = 123
      cb.reset()
      exposed(['MTIz', 1], {}, cb)

      expect(Context['exposed'].calledOn(Context)).to.equal(true)
      expect(Context['exposed'].calledWith([1], {}, cb)).to.equal(true)
      expect(cb.called).to.equal(false)
    })

    test('no context', function () {
      var
        rpc = new stratum.RPCServer(this.opts),
        cb = sinon.spy()

      rpc['testing'] = function () {
        return true
      }

      sinon.spy(rpc, 'testing')

      var exposed = rpc._authenticate('test', rpc.testing)

      exposed(['MTIz', '1', 2], {}, cb)
      expect(cb.called).to.be(false)
      expect(rpc.testing.called).to.be(true)
      expect(rpc.testing.calledWith(['1', 2], {}, cb)).to.be(true)
    })

    test('already listening exception', function () {
      var server = new stratum.RPCServer(this.opts)

      server._server = true

      expect(function () {
        server.listen()
      }).to.throwException(/Server already listening on port 9999/)
    })

    test('tcp RPC command', function (done) {
      var server = new stratum.RPCServer(this.opts),
        exposed = {
          'func': function (args, opts, callback) {
            callback(null, args)
          }
        },
        spy = sinon.spy(exposed, 'func'),
        bound = { _server: null },
        client = new rpc.Client(server.opts.port, 'localhost')


      expect(stratum.RPCServer.prototype.close.bind(bound)()).to.be(bound)

      server.expose('func', exposed.func, exposed).listen()

      client.connectSocket(function (err, conn) {
        conn.call('func', ['MTIz', 1, 2], function (err, result) {
          expect(result).to.eql([1, 2])
          expect(spy.calledWith([1, 2])).to.equal(true)
          server.close()
          done()
        })
      })
    })

    test('http RPC command', function (done) {
      var server = new stratum.RPCServer(_.defaults({ mode: 'http' }, this.opts)),
        exposed = {
          'func': function (args, opts, callback) {
            callback(null, args)
          }
        },
        spy = sinon.spy(exposed, 'func'),
        client = new rpc.Client(server.opts.port, 'localhost')

      server.expose('func', exposed.func, exposed).listen()

      client.call('func', ['MTIz', 1, 2], function (err, result) {
        expect(result).to.eql([1, 2])
        expect(spy.calledWith([1, 2])).to.equal(true)
        server.close()
        done()
      })
    })

    test('TCP/HTTP RPC command', function (done) {
      var server = new stratum.RPCServer(_.defaults({ mode: 'both' }, this.opts)),
        exposed = {
          'func': function (args, opts, callback) {
            callback(null, args)
          }
        },
        spy = sinon.spy(exposed, 'func'),
        client = new rpc.Client(server.opts.port, 'localhost')

      server.expose('func', exposed.func, exposed).listen()

      client.connectSocket(function (err, conn) {
        conn.call('func', ['MTIz', 1, 2], function (err, result) {
          expect(result).to.eql([1, 2])
          expect(spy.calledWith([1, 2])).to.equal(true)

          client.call('func', ['MTIz', 1, 2], function (err, result) {
            expect(result).to.eql([1, 2])
            expect(spy.calledWith([1, 2])).to.equal(true)
            server.close()
            done()
          })
        })
      })
    })
  })

  suite('Daemon', function () {

    setup(function () {
      child_process = function () {
        var em = new EventEmitter()

        em['kill'] = sinon.spy()

        return em
      }
    })

    test('creation exceptions', function () {
      expect(function () {
        new stratum.Daemon()
      }).to.throwError(/Daemon options must not be empty/)

      expect(function () {
        new stratum.Daemon({ path: '//', port: 8080 })
      }).to.throwError(/Daemon must have options "user, password, port, host, name" set, there are no defaults/)

      expect(function () {
        new stratum.Daemon({
          path: '/doesnt/exist/%s',
          datadir: 'data/dir',
          port: 8080,
          host: 'localhost',
          user: 'user',
          password: 'pass',
          name: 'Mycoin'
        }).start()
      }).to.throwError(/Provided daemon "\/doesnt\/exist\/%s" path doesnt exist/)

      expect(function () {
        new stratum.Daemon({
          path: '/doesnt/exist/%s',
          port: 8080,
          host: 'localhost',
          user: 'user',
          password: 'pass',
          name: 'Mycoin'
        }).start()
      }).to.throwError(/The option "datadir" must be set to the place your wallet.dat is set./)

    })

    test('notify args builder', function () {
      var obj = {
        'port': 8080,
        'host': 'localhost',
        'user': 'rpcuser',
        'datadir': 'data/dir',
        'password': 'bitcoindpassword',
        'name': 'Bitcoin',
        'rpcserver': {
          'port': 8888,
          'host': 'localhost',
          'password': 'rpcpassword',
          'notify': ['wallet', 'alert', 'block'],
          'notifyPath': 'stratum-notify'
        },
        'args': [
          { 'blockminsize': 1000 },
          { 'blockmaxsize': 250000 },
          'testnet',
          'upnp'
        ]
      }

      expect(stratum.Daemon.notify(obj)).to.eql([
        { walletnotify: '"stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type wallet --data %s"' },
        { alertnotify: '"stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type alert --data %s"' },
        { blocknotify: '"stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type block --data %s"' }
      ])

    })

    test('args creation from options', function () {
      var daemon = new stratum.Daemon({
        'port': 8080,
        'datadir': 'data/dir',
        'host': 'localhost',
        'user': 'rpcuser',
        'password': 'bitcoindpassword',
        'name': 'Bitcoin',
        'args': 'invalid args, must be array'
      })

      expect(daemon.opts.args).to.eql([])
    })

    test('arguments helper', function () {
      var obj = {
        'port': 8080,
        'host': 'localhost',
        'user': 'rpcuser',
        'datadir': 'data/dir',
        'password': 'rpcpassword',
        'name': 'Bitcoin',
        'args': [
          { 'blockminsize': 1000 },
          { 'blockmaxsize': 250000 },
          'testnet',
          'upnp',
          '-argstartingwithdash',
          1,
          { '-objargwithdash': true }
        ]
      }

      expect(stratum.Daemon.mountArgs(obj)).to.eql([
        '-blockminsize=1000',
        '-blockmaxsize=250000',
        '-testnet',
        '-upnp',
        '-argstartingwithdash',
        '-objargwithdash=true'
      ])
    })

    test('arguments and notify', function () {
      var obj = {
        'port': 8080,
        'host': 'localhost',
        'user': 'rpcuser',
        'datadir': 'data/dir',
        'password': 'rpcpassword',
        'name': 'Bitcoin',
        'rpcserver': {
          'port': 8888,
          'host': 'localhost',
          'password': 'rpcpassword',
          'notify': ['wallet', 'alert', 'block'],
          'notifyPath': 'stratum-notify'
        },
        'args': [
          { 'blockminsize': 1000 },
          { 'blockmaxsize': 250000 },
          'testnet',
          'upnp'
        ]
      }

      stratum.Daemon.notify(obj)

      expect(stratum.Daemon.mountArgs(obj)).to.eql([
        '-blockminsize=1000',
        '-blockmaxsize=250000',
        '-testnet',
        '-upnp',
        '-walletnotify="stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type wallet --data %s"',
        '-alertnotify="stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type alert --data %s"',
        '-blocknotify="stratum-notify --source Bitcoin --password rpcpassword --host localhost --port 8888 --type block --data %s"'
      ])
    })

    test('throws on invalid path', function () {
      expect(stratum.Daemon.prototype._pathExists.bind({ opts: { path: true } })).to.throwException()
      expect(stratum.Daemon.prototype._pathExists.bind({ opts: { path: __filename } })).to.not.throwException()
    })

    test('close', function (done) {
      var clock = sinon.useFakeTimers()

      var daemon = new stratum.Daemon({
        path: '/doesnt/exist/%s',
        port: 8080,
        host: 'localhost',
        datadir: 'data/dir',
        user: 'user',
        password: 'pass',
        name: 'Mycoin'
      })

      sinon.stub(daemon, '_pathExists').callsFake(function () { return true; })

      sinon.stub(daemon.rpc, 'call').callsFake(function (name, params, callback) {
        if (daemon.callerror === true) {
          callback('error')
        } else {
          callback(null, 'success')
        }
      })

      expect(daemon._pathExists).to.not.throwException()

      daemon.close().catch(function (message) {
        expect(message).to.be('Process wasnt started')
      }).done()

      var child = child_process()

      daemon.process = child

      expect(daemon.start()).to.be(false)

      var promise = daemon.close()

      clock.tick(5000); // make the timeout be met

      promise.catch(function (message) {
        expect(message).to.be('Process didnt respond and was killed')
        daemon.process = child
        expect(child.kill.called).to.be(true)
        child.kill.reset()

      }).done(function () {
        promise = daemon.close(1)
        clock.tick(1000)

        promise.catch(function (message) {
          expect(message).to.be('Process didnt respond and was killed')
          expect(child.kill.called).to.be(true)
          daemon.process = child
          child.kill.reset()

        }).done(function () {
          daemon.close().done(function () {
            expect(daemon.process).to.be(null)
            daemon.callerror = true
            daemon.process = child

            daemon.close().catch(function (message) {
              expect(message).to.be('error')
            }).done(function () {
              clock.restore()
              done()
            })
          })
        })
      })
    })

    test('failed RPC call', function (done) {
      var clock = sinon.useFakeTimers()

      var daemon = new stratum.Daemon({
        path: '/doesnt/exist/%s',
        datadir: 'data/dir',
        port: 8080,
        host: 'localhost',
        user: 'user',
        password: 'pass',
        name: 'Mycoin'
      })

      sinon.stub(daemon.rpc, 'call').callsFake(function (name, params, callback) {
        if (name === 'test') {
          callback('error')
        }
      })

      daemon.call('test').catch(function (message) {
        expect(message).to.equal('error')
      }).done(function () {
        var promise = daemon.call('timeout')
        clock.tick(4000)

        promise.catch(function (message) {
          expect(message).to.be('Command timed out')
        }).done(function () {
          clock.restore()
          done()
        })
      })

    })

    test('RPC server args', function () {
      sinon.spy(stratum.Daemon, 'notify')

      var opts = {
        path: '/doesnt/exist/%s',
        port: 8080,
        host: 'localhost',
        user: 'user',
        datadir: 'data/dir',
        password: 'pass',
        'rpcserver': {
          'port': 8888,
          'host': 'localhost',
          'password': 'rpcpassword',
          'notify': ['wallet', 'alert', 'block'],
          'notifyPath': 'stratum-notify'
        },
        name: 'Mycoin'
      },
        daemon = new stratum.Daemon(opts)

      expect(stratum.Daemon.notify.called).to.be(true)
      expect(daemon.opts.rpcserver.notifyPath).to.equal('stratum-notify')

      stratum.Daemon.notify.reset()
      delete opts.rpcserver.notifyPath

      daemon = new stratum.Daemon(opts)

      expect(daemon.opts.rpcserver.notifyPath).to.equal(path.join('..', 'bin', 'stratum-notify'))

      stratum.Daemon.notify.reset()
      delete opts.rpcserver.notify

      daemon = new stratum.Daemon(opts)
      expect(stratum.Daemon.notify.called).to.be(false)
      expect(daemon.opts.rpcserver.notify).to.eql([])

      stratum.Daemon.notify.restore()

      expect(stratum.Daemon.notify()).to.eql([])
      expect(stratum.Daemon.notify({ rpcserver: {} })).to.eql([])
    })

    test('spawn daemon', function (done) {
      var invalid = 1, daemon = new stratum.Daemon({
        path: '/doesnt/exist/%s',
        port: 8080,
        datadir: 'data/dir',
        host: 'localhost',
        user: 'user',
        password: 'pass',
        name: 'Mycoin',
        args: [
          'one',
          'two',
          invalid
        ]
      })

      var child = child_process()

      sinon.stub(daemon, '_pathExists').callsFake(function () { return true; })
      sinon.stub(daemon, 'spawn').callsFake(function () { return child; })

      expect(daemon.start()).to.be(true)

      expect(daemon.spawn.calledWith(
        '/doesnt/exist/%s',
        ['-one',
          '-two',
          '-daemon',
          '-rpcuser=user',
          '-rpcpassword=pass',
          '-rpcport=8080',
          '-datadir=data/dir']
      )).to.be(true)

      expect(daemon.process).to.be(child)

      daemon.process.on('close', function () {
        expect(daemon.process).to.equal(null)

        daemon.spawn.restore()

        sinon.stub(daemon, 'spawn').callsFake(function () { throw new Error('failed to create process'); })

        expect(daemon.start()).to.be(false)
        done()
      })

      daemon.process.emit('close')
    })

    test('RPC communication', function (done) {
      var
        daemon = new stratum.Daemon({
          port: 59881,
          host: 'localhost',
          datadir: 'data/dir',
          user: 'user',
          password: 'pass',
          name: 'Communicoin'
        })


      sinon.stub(daemon.rpc, 'call').callsFake(function (args, opts, callback) {
        expect(opts).to.eql([
          { dummy: true }
        ])
        callback(null, 1)
      })

      daemon.call('getdifficulty', [
        { dummy: true }
      ]).done(function (res) {
        expect(res).to.equal(1)
        daemon.call('getdifficulty', { dummy: true }).then(function (res) {
          expect(res).to.equal(1)
          done()
        }).done()
      })
    })
  })
})
