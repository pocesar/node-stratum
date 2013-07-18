'use strict';

var
  expect = require('expect.js'),
  stratum = require('../lib/index.js'),
  server;

module.exports = {
  beforeEach: function(){
    server = stratum.create();
  },
  afterEach: function(){
    var tcp = (server, server.server());
    if (tcp && tcp.close) {
      tcp.close();
    }
    server = null;
  },
  Stratum: {
    testExceptionOnListening: function(){
      expect(server.listen).to.throwError();
    },
    testEventEmitter: function(done){
      server.listen(3002, function(){
        expect(server.on).to.be.a('function');
        expect(server.emit).to.be.a('function');
        done();
      });
    },
    testMethods: function(done){
      server.listen(3004, function(){
        var tcp = server.server();
        expect(tcp.hasMethod('mining.subscribe')).to.equal(true);
        expect(tcp.hasMethod('mining.authorize')).to.equal(true);
        expect(tcp.hasMethod('mining.submit')).to.equal(true);
        done();
      });
    }
  }
};