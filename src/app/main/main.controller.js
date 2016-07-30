(function() {
  'use strict';

  angular
    .module('transApp')
    .controller('MainController', MainController);

  /** @ngInject */
  function MainController(idbService, $q) {
    var vm = this;
    vm.viewLoading = true;

    var stationRequest = new Request('http://api.bart.gov/api/stn.aspx?cmd=stns&key=MW9S-E7SL-26DU-VV8V');
    var scheduleDepartTemplate = 'http://api.bart.gov/api/sched.aspx?cmd=depart&orig=%orig%&dest=%dest%&key=MW9S-E7SL-26DU-VV8V&b=2&a=2&l=1';
    var scheduleAvailable = true;

    showOfflineStations().then(function(){
    	populateAndShowStations();
    }).catch(function(error){
    	populateAndShowStations();
    });

    function populateAndShowStations(){
      vm.stationList = [];
      vm.viewLoading = true;
    	return getJSON(stationRequest).then(function(responseJSON){
    		responseJSON.root.stations.station.forEach(function(station){
          vm.stationList.push(station.name['#text'] + ' - ' + station.abbr['#text']);
      	});

        vm.fromStation = vm.stationList[0];
        vm.toStation = vm.stationList[1];
        idbService.storeDefaultValues(vm.fromStation, vm.toStation);

        idbService.storeStationsToIDB(responseJSON.root.stations.station);
        vm.viewLoading = false;
    	});
    }

    function showOfflineStations(){
      var deferred = $q.defer();
      vm.viewLoading = true;
      vm.stationList = [];
      var stationsFromIDB = idbService.getStationsFromIDB();
      var defaultStationFrom = idbService.getDefaultStationFrom();
      var defaultStationTo = idbService.getDefaultStationTo();

      stationsFromIDB.then(function(stations){
        stations.forEach(function(station){
          vm.stationList.push(station.name['#text'] + ' - ' + station.abbr['#text']);
        });
      }).catch(function(error){
      	deferred.reject();
        vm.viewLoading = false;
      });

      defaultStationFrom.then(function(from){
        vm.fromStation = from;
      }).catch(function(error){
      	deferred.reject();
        vm.viewLoading = false;
      });

      defaultStationTo.then(function(to){
        vm.toStation = to;
      }).catch(function(error){
      	deferred.reject();
        vm.viewLoading = false;
      });

      if(vm.stationList && vm.fromStation && vm.toStation) {
        deferred.resolve();
        vm.viewLoading = false;
      }
      return deferred.promise;
    }

    function showPopulateSchedule(origin, destination){
    	if(!origin || !destination) return;
    	showOfflineSchedule(origin, destination).then(function(){
    		populateSchedule(origin, destination);
    	}).catch(function(error){
      	populateSchedule(origin, destination);
      });
    }

    function showOfflineSchedule(origin, destination){
      var deferred = $q.defer();
      vm.viewLoading = true;
      var offlineSchedule = idbService.getDefaultSchedule(origin, destination);
      offlineSchedule.then(function(trips){
        if(trips)
          showSchedule(trips);
        else
          showNoSchedule();
        deferred.resolve();
        vm.viewLoading = false;
      }).catch(function(error){
        deferred.reject();
        vm.viewLoading = false;
      });

      return deferred.promise;
    }

    function populateSchedule(origin, destination){
    	if(!origin || !destination) return;
      vm.viewLoading = true;
    	var scheduleRequest = new Request(scheduleDepartTemplate.replace('%orig%', (origin.split('-')[1]).trim()).replace('%dest%', (destination.split('-')[1]).trim()));
    	getJSON(scheduleRequest).then(function(responseJSON){
    		if(!responseJSON.root.schedule.request) return;
    		var scheduleObject = getScheduleObject(responseJSON.root.schedule.request.trip);
    		showSchedule(scheduleObject);
        idbService.storeScheduleToIDB(scheduleObject, origin, destination);
        vm.viewLoading = false;
    	}).catch(function(error){
    		if(!error) return;
        vm.viewLoading = false;
    	});
    }

    function showSchedule(trips){
      vm.schedules = [];
      scheduleAvailable = true;

    	trips.forEach(function(trip){
    		var scheduleLine = '';
        var line = '';
    		if(trip.leg.forEach){
    			trip.leg.forEach(function(leg){
            vm.schedules.push(leg);
    			});

    		}
    		else {
    			vm.schedules.push(trip.leg);
    		}
    	});
    }

    function showNoSchedule(){
    	if(scheduleAvailable){
        vm.schedules = [];
    		scheduleAvailable = false;

    	}
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

    vm.fromStationChanged =  function(event){

      var fromStation = vm.fromStation;
    	var toStation = vm.toStation;

    	if(!fromStation || !toStation) return;

      showPopulateSchedule(fromStation, toStation);
      idbService.storeDefaultValues(fromStation, toStation);

    };

    vm.toStationChanged =  function(event){

        var fromStation = vm.fromStation;
      	var toStation = vm.toStation;

      	if(!fromStation || !toStation) return;

        showPopulateSchedule(fromStation, toStation);
        idbService.storeDefaultValues(fromStation, toStation);

    };

    vm.tripDetails =  function(){
      alert("Coming Soon...");
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
