module.exports = function(classes){
  'use strict';

  var Client = classes.base.define('Client', function(){
    return {
      construct: function(){
        this.$super();
      }
    };
  });

  return Client;
};