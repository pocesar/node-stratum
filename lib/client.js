module.exports = function(classes){
  'use strict';

  var Client = classes.base.define('Client', function(){
    return {
      construct: function(socket){
        this.$super();
      },
      send: function(data){

      }
    };
  });

  return Client;
};