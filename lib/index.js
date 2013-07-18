'use strict';

var
  jayson = require('jayson'),
  Class = require('es5class'),
  events = require('events');

var Stratum = Class.define('Stratum', function (){
  var self = this, debug = false, server, tcp;

  server = jayson.server({
    'mining.subscribe': function(){
      if (debug === true) {
        console.log('Subscribe: %j', arguments);
      }
      self.emit('subscribe');
    },
    'mining.authorize': function(){
      if (debug === true) {
        console.log('Authorize: %j', arguments);
      }
      self.emit('authorize');
    },
    'mining.submit': function(){
      if (debug === true) {
        console.log('Submit: %j', arguments);
      }
      self.emit('submit');
    }
  });

  self.implement(events.EventEmitter);

  return {
    tcp: function(){
      return tcp;
    },
    server: function(){
      return server;
    },
    debug: function(enabled){
      debug = enabled;
    },
    listen: function (port, cb){
      if (!port) {
        throw new Error('Port must be specified');
      }
      return (tcp = server.tcp()).listen(port, function(){
        if (debug === true) {
          console.log('Listening on port ' + port);
        }
        if (cb) {
          cb();
        }
      });
    }
  };
}, {
  errors: {
    20: 'Other/Unknown',
    21: 'Job not found (=stale)',
    22: 'Duplicate share',
    23: 'Low difficulty share',
    24: 'Unauthorized worker',
    25: 'Not subscribed'
  }
});

module.exports = Stratum;