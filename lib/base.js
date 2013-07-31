'use strict';

var
  debug = require('debug')('stratum'),
  slice = Array.prototype.slice;

module.exports = require('es5class').define('Base', {
  /**
   * Freezes a property on the object, making it unchangeable
   * Extra security measure maybe caused by leaky code, we
   * don't want an exploit to make it all go down.
   *
   * The property can't be overwritten nor changed, once it's
   * instanced, it's final.
   *
   * @param {String} where
   * @param {*} options
   */
  freezeProperty: function(where, options) {
    Object.defineProperty(this, where, {
      value: options
    });

    Object.freeze(this[where]);
  }
}, {
  debug: function(msg){
    debug(this.$className + ':  ' + msg);
    return msg;
  }
}).implement(require('events').EventEmitter);