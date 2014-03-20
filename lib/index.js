'use strict';

var
  classes = {
    path   : require('path'),
    dir    : function (path){
      return this.path.join(__dirname, path);
    },
    fs     : require('fs'),
    lodash : require('lodash'),
    net    : require('net'),
    uuid   : require('uuid'),
    q      : require('bluebird'),
    rpc    : require('json-rpc2'),
    curry  : require('better-curry'),
    toobusy: require('toobusy-js')
  };

classes.Base = require(classes.dir('base'));
classes.RPCServer = require(classes.dir('rpc'))(classes);
classes.Client = require(classes.dir('client'))(classes);
classes.Server = require(classes.dir('server'))(classes);
classes.Daemon = require(classes.dir('daemon'))(classes);

module.exports = classes;