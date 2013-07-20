module.exports = function(classes){
  'use strict';

  var Pool = classes.base.define('Pool', function(){
    return {
      construct: function(){
        this.$super();
      }
    }
  });

  return Pool;

};