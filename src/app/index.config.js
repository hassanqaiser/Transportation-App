(function() {
  'use strict';

  angular
  .module('transApp')
  .config(config);

  /** @ngInject */
  function config($logProvider) {
    // Enable log
    $logProvider.debugEnabled(true);


  }

})();
