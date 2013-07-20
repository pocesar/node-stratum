module.exports = function(classes){
  'use strict';

  var RPC = classes.base.define('RPC', function(){
    return {
      construct: function(){
        this.$super();
      }
    };
  });

  return RPC;
};