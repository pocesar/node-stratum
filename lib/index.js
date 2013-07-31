'use strict';

var
  d = __dirname + '/',
  classes = {
    fs    : require('fs'),
    lodash: require('lodash'),
    net   : require('net'),
    uuid  : require('uuid'),
    q     : require('q'),
    rpc   : require('json-rpc2')
  };

classes.Base = require(d + 'base');
classes.RPCServer = require(d + 'rpc')(classes);
classes.Client = require(d + 'client')(classes);
classes.Server = require(d + 'server')(classes);
classes.Daemon = require(d + 'daemon')(classes);

module.exports = classes;