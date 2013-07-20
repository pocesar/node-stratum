module.exports = function (classes){
  'use strict';

  var Stratum = classes.base.define('Stratum', function(){
    return {
      construct: function (opts){
        var self = this;

        this.server = jayson.server({
          'mining.subscribe'   : function (){
            self.log('Subscribe', arguments);
          },
          'mining.authorize'   : function (){
            self.log('Authorize', arguments);
          },
          'mining.submit'      : function (){
            self.log('Submit', arguments);
          },
          'mining.update_block': function (password, hash, callback){
            self.log('Update block', arguments);
          }
        });

        this.port = opts.port || 8080;
        this.tcp = this.server.tcp();
      },
      listen   : function (cb){
        var self = this;

        self.tcp.listen(self.port, function (){
          if (self.debug === true) {
            console.log('Listening on port ' + self.port);
          }
          if (cb) {
            cb();
          }
        });

        return self;
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

  return Stratum;
};
