(function() {
  'use strict';

  angular
    .module('transApp')
    .directive('myLoadingSpinner', myLoadingSpinner);

  /** @ngInject */
  function myLoadingSpinner() {
    return {
     restrict: 'A',
     replace: true,
     transclude: true,
     scope: {
       loading: '=myLoadingSpinner'
     },
     templateUrl: 'app/components/loadingSpinner/spin.html',
     link: function(scope, element, attrs) {
       var spinner = new Spinner().spin();
       var loadingContainer = element.find('.my-loading-spinner-container')[0];
       loadingContainer.appendChild(spinner.el);
     }
   }
  }

})();
