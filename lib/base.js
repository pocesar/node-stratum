'use strict';

var
  debug = require('debug')('stratum');

module.exports = require('es5class').define('Base', {}, {
  debug: function(msg){
    debug(this.$className + ':  ' + msg);
  }
}).implement(require('events').EventEmitter);