(function() {
  'use strict';

  angular
    .module('transApp')
    .controller('MainController', MainController);

  /** @ngInject */
  function MainController(idbService, $q, $timeout) {
    var vm = this;
    vm.viewLoading = true;
    vm.schedules = [];
    $("#from-station").focus();

    var stationRequest = new Request('http://api.bart.gov/api/stn.aspx?cmd=stns&key=MW9S-E7SL-26DU-VV8V');
    var scheduleDepartTemplate = 'http://api.bart.gov/api/sched.aspx?cmd=depart&orig=%orig%&dest=%dest%&key=MW9S-E7SL-26DU-VV8V&b=2&a=2&l=1';
    var scheduleAvailable = true;

    showOfflineStations().then(function(){
    	cacheAndShowStationsList();
    }).catch(function(error){
    	cacheAndShowStationsList();
    });

    function cacheAndShowStationsList(){
      vm.stationList = [];

    	return getJSON(stationRequest).then(function(responseJSON){
    		responseJSON.root.stations.station.forEach(function(station){
          vm.stationList.push(station.name['#text'] + ' - ' + station.abbr['#text']);
      	});

        vm.fromStation = vm.stationList[0];
        vm.toStation = vm.stationList[1];
        var storeDefaultValues = idbService.storeDefaultValues(vm.fromStation, vm.toStation);

        var storeStationsToIDB = idbService.storeStationsToIDB(responseJSON.root.stations.station);

        $q.all([storeDefaultValues, storeStationsToIDB]).then(function(data) {
          vm.viewLoading = false;
    	  });

      });
    }

    function showOfflineStations(){
      var deferred = $q.defer();
      vm.stationList = [];
      var stationsFromIDB = idbService.getStationsFromIDB();
      var defaultStationFrom = idbService.getDefaultStationFrom();
      var defaultStationTo = idbService.getDefaultStationTo();

      $q.all([stationsFromIDB, defaultStationFrom, defaultStationTo]).then(function(data) {
        data[0].forEach(function(station){
          vm.stationList.push(station.name['#text'] + ' - ' + station.abbr['#text']);
        });

        vm.fromStation = data[1];
        vm.toStation = data[2];
        deferred.resolve();
      });

      return deferred.promise;
    }

    function showOfflineSchedule(origin, destination){
      var deferred = $q.defer();
      var offlineSchedule = idbService.getDefaultSchedule(origin, destination);
      offlineSchedule.then(function(trips){
        if(trips){
          vm.schedules = getSchedules(trips);
        } else {
          if(scheduleAvailable) scheduleAvailable = false;
          vm.schedules = [];
        }
        deferred.resolve();
      }).catch(function(error){
        if(scheduleAvailable) scheduleAvailable = false;
        vm.schedules = [];
        deferred.reject();
      });

      return deferred.promise;
    }

    function cacheAndShowSchedule(origin, destination){
    	if(!origin || !destination) return;
      vm.waitScheduleLoading = true;
      var requestTemplate = scheduleDepartTemplate.replace('%orig%', (origin.split('-')[1]).trim()).replace('%dest%', (destination.split('-')[1]).trim());
      var scheduleRequest = new Request(requestTemplate);
    	getJSON(scheduleRequest).then(function(responseJSON){
    		if(!responseJSON.root.schedule.request) return;
    		var scheduleObject = getScheduleObject(responseJSON.root.schedule.request.trip);
        var storeScheduleToIDB = idbService.storeScheduleToIDB(scheduleObject, origin, destination);
        storeScheduleToIDB.then(function(){
          vm.waitScheduleLoading = false;
          $timeout(function() {
              vm.schedules = getSchedules(scheduleObject);
          }, 500);
        });

    	}).catch(function(error){
    		vm.schedules = [];
        vm.waitScheduleLoading = false;
    	});
    }

    function getSchedules(trips){
      var schedules = [];
      scheduleAvailable = true;

    	trips.forEach(function(trip){
    		var scheduleLine = '';
        var line = '';
        var duration = trip.duration;
    		if(trip.leg.forEach){
    			trip.leg.forEach(function(leg){
            leg.duration = duration;
            schedules.push(leg);
    			});

    		}
    		else {
          var schdObj = trip.leg;
          schdObj.duration = duration;
    			schedules.push(schdObj);
    		}
    	});

      return schedules;
    }

    function getScheduleObject(trips){
    	var schedule = {}
    	var tripsArray = [];
    	var legsArray = [];
    	var legObject = {};
    	var tripObject = {};
    	trips.forEach(function(trip){
    		tripObject = {};
    		legsArray = [];
    		if(trip.leg.forEach){
    			trip.leg.forEach(function(leg){

    				legObject = {
              trainLine: leg['@attributes'].line,
              origTimeMin: leg['@attributes'].origTimeMin,
      				destTimeMin: leg['@attributes'].destTimeMin,
      				origin: leg['@attributes'].origin,
      				destination: leg['@attributes'].destination,
      				order: leg['@attributes'].order,
      				duration: getDuration(leg)
      			}
    			  legsArray.push(legObject);
    		});
    		}
    		else{

    			legObject = {
            trainLine: trip.leg['@attributes'].line,
            origTimeMin: trip.leg['@attributes'].origTimeMin,
      			destTimeMin: trip.leg['@attributes'].destTimeMin,
      			origin: trip.leg['@attributes'].origin,
      			destination: trip.leg['@attributes'].destination,
      			order: trip.leg['@attributes'].order
      		}
      		legsArray.push(legObject);
    	}
    	tripObject = {duration: getDuration(trip), leg : legsArray};

    	tripsArray.push(tripObject);
    });
    	return tripsArray;

    }

    function getDuration(trip){
    	var originTimeStr = trip['@attributes'].origTimeDate + ' ' + trip['@attributes'].origTimeMin;
    	var originTimeDate = new Date(originTimeStr);
    	var destTimeStr = trip['@attributes'].destTimeDate + ' ' + trip['@attributes'].destTimeMin;
    	var destinationTimeDate = new Date(destTimeStr);
    	var duration = (destinationTimeDate - originTimeDate) / (60 * 1000);
    	//This logic is added to fix issue #2 as the BART date representation for 12:00 AM is incorrect
    	if(trip['@attributes'].origTimeMin === '12:00 AM')
    		duration -= (24 * 60);
    	if(trip['@attributes'].destTimeMin === '12:00 AM')
    		duration += (24 * 60);
    	return duration;
    }

    vm.StationChanged =  function(event){

      var fromStation = vm.fromStation;
    	var toStation = vm.toStation;

    	if(!fromStation || !toStation) return;

      showOfflineSchedule(fromStation, toStation).then(function(){
        cacheAndShowSchedule(fromStation, toStation);
      }).catch(function(error){
        cacheAndShowSchedule(fromStation, toStation);
      });

    };

    String.prototype.replaceAll = function(search, replacement) {
    	var target = this;
    	return target.replace(new RegExp(search, 'g'), replacement);
    };

    function getXML(request){
    	return fetch(request).then(function(response){
    		return	 response.text().then(function(responseText){
    			var parser = new DOMParser();
    			return parser.parseFromString(responseText, 'text/xml');
    		});
    	});
    }

    function getJSON(request){
    	return getXML(request).then(function(responseXML){
    		return xmlToJson(responseXML);
    	});
    }

    function xmlToJson(xml) {

    	// Create the return object
    	var obj = {};

    	if (xml.nodeType == 1) { // element
    		// do attributes
    		if (xml.attributes.length > 0) {
    			obj['@attributes'] = {};
    			for (var j = 0; j < xml.attributes.length; j++) {
    				var attribute = xml.attributes.item(j);
    				obj['@attributes'][attribute.nodeName] = attribute.nodeValue;
    			}
    		}
    	} else if (xml.nodeType == 3) { // text
    		obj = xml.nodeValue;
    	}

    	// do children
    	if (xml.hasChildNodes()) {
    		for(var i = 0; i < xml.childNodes.length; i++) {
    			var item = xml.childNodes.item(i);
    			var nodeName = item.nodeName;
    			if (typeof(obj[nodeName]) == 'undefined') {
    				obj[nodeName] = xmlToJson(item);
    			} else {
    				if (typeof(obj[nodeName].push) == 'undefined') {
    					var old = obj[nodeName];
    					obj[nodeName] = [];
    					obj[nodeName].push(old);
    				}
    				obj[nodeName].push(xmlToJson(item));
    			}
    		}
    	}
    	return obj;
    }
  }
})();
