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
        d = stratum.q.defer(),
        dd = stratum.q.defer(),
        ddd = [stratum.q.defer(), stratum.q.defer()];

      setTimeout(function(){
        d.resolve([1,2,3]);
      }, 0);

      d.promise.spread(function(one, two, three){
        expect(one).to.equal(1);
        expect(two).to.equal(2);
        expect(three).to.equal(3);
        ddd[0].resolve();
      });

      dd.promise.then(function(array){
        expect(array).to.eql([1,2,3]);
        ddd[1].resolve();
      });


      dd.resolve([1,2,3]);

      stratum.q.all([ddd[0].promise, ddd[1].promise]).done(function(){
        done();
      });
    },
    testExceptionOnListening: function(){
    },
    testEventEmitter: function(){
    },
    testMethods: function(){
    }
  }
};