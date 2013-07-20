'use strict';

var
  d = __dirname + '/',
  classes = {
    base: require(d + 'base')
  };

classes.rpc = require(d + 'rpc')(classes);
classes.client = require(d + 'client')(classes);
classes.pool = require(d + 'pool')(classes);
classes.server = require(d + 'server')(classes);

module.exports = classes;