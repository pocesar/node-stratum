'use strict';

var
  expect = require('expect.js'),
  stratum = require('../lib'),
  sinon = require('sinon');

module.exports = {
  Stratum: {
    Base: {

    },
    Server: {
      beforeEach: function(){
        this.server = stratum.server.create();
      },
      testInheritance: function(){
        expect(this.server).to.be.ok();
        expect(this.server.$instanceOf(stratum.base)).to.be.ok();
        expect(this.server.$instanceOf(stratum.server)).to.be.ok();
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
    Coind: {

    }
  }
};