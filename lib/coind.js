module.exports = function(classes){
  'use strict';

  var Coind = classes.base.define('Coind', function(){
    return {
      construct: function(){
        this.$super();
      }
    };
  });

  return Coind;
};