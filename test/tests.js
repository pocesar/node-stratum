'use strict';

var
  expect = require('expect.js'),
  stratum = require('../lib'),
  server;

module.exports = {
  beforeEach: function(){
  },
  afterEach: function(){
  },
  Stratum: {
    testDeferred: function(done){
      var
        q = stratum.q,
        d = q.defer();

      setTimeout(function(){
        d.resolve([1,2,3]);
      }, 0);

      d.promise.then(function(){ done(); });
    },
    testExceptionOnListening: function(){
    },
    testEventEmitter: function(){
    },
    testMethods: function(){
    }
  }
};