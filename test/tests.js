'use strict';

var
  expect = require('expect.js'),
  stratum = require('../lib'),
  sinon = require('sinon'),
  EventEmitter = require('events').EventEmitter,
  child_process;

module.exports = {
  before: function(){
    var em = new EventEmitter();

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
        expect(this.server.$instanceOf(stratum.Base)).to.be.ok();
        expect(this.server.$instanceOf(stratum.Server)).to.be.ok();
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

    },
    Daemon: {
      testCreationExceptions: function(){
        expect(function(){
          stratum.Daemon.create();
        }).to.throwError(/Daemon options must not be empty/);

        expect(function(){
          stratum.Daemon.create({path: '//', port: 8080});
        }).to.throwError(/Daemon must have all options set, there are no defaults/);

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
      testCloseException: function(done){
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