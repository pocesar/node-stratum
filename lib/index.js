'use strict';

var
  d = __dirname + '/',
  classes = {
    base  : require(d + 'base'),
    lodash: require('lodash'),
    net   : require('net'),
    uuid  : require('uuid'),
    q     : require('q'),
    rpc   : require('json-rpc2')
  };

classes.rpcserver = require(d + 'rpc')(classes);
classes.client = require(d + 'client')(classes);
classes.server = require(d + 'server')(classes);

module.exports = classes;