'use strict';

/**
 * @ngdoc service
 * @name publicTransAppApp.idb
 * @description
 * # idb
 * Factory in the publicTransAppApp.
 */
angular.module('transApp')
  .factory('idbService', function ($log) {

    function openDatabase() {
      if (!navigator.serviceWorker) {
        return Promise.resolve();
      }

      return idb.open('transApp', 1 ,function(upgradeDb){
        var storeStations, storeSchedule, storeDefault ;
    		switch(upgradeDb.version){
    			case 1:
      			storeStations = upgradeDb.createObjectStore('stations', {keyPath : 'id'});
            storeStations.createIndex('by-stations', 'id');
      			storeSchedule = upgradeDb.createObjectStore('schedule', {keyPath : ['from', 'to'] });
            //storeSchedule.createIndex('by-schedule', ['from', 'to']);
      			storeDefault = upgradeDb.createObjectStore('default', {keyPath: 'id'});
            //storeDefault.createIndex('by-default', 'id');
    		}
    	} );


    }

    var _dbPromise = openDatabase();

    // Public API here
    return {
      getDB: function () {
        return _dbPromise;
      },
      printConsole: function (){
        console.log('I am printed');
      },

      storeDefaultValues: function (origin, destination){
        if (!origin) {
          return Promise.resolve(origin);
        }
        if (!destination) {
          return Promise.resolve(origin);
        }

        return _dbPromise.then(function(db) {
          if (db) {
            var tx = db.transaction('default', 'readwrite');
            var defaultStore = tx.objectStore('default');

            var fromObject = {id : 'from', displayValue : origin, value : origin};
            var toObject = {id : 'to', displayValue : destination, value : destination};

            defaultStore.put(fromObject);
		        defaultStore.put(toObject);

            $log.log('Default Values cached');
          }

          return Promise.resolve(origin + ' ' + destination);
        });
      },

      storeStationsToIDB: function(stations){
        return _dbPromise.then(function(db) {
    			if(!db) return;

    			var objectStore = db.transaction('stations', 'readwrite').objectStore('stations');
    			//delete all old entries
    			objectStore.clear().then(function(){
    				stations.forEach(function(station){
    					station.id = station.abbr['#text'];
    					objectStore.put(station);
    				});

    			});
    		});
      },

      storeScheduleToIDB: function(scheduleObject, origin, destination){
        return _dbPromise.then(function(db) {
    			if(!db) return;

    			var trips = scheduleObject;
    			trips.from = origin;
    			trips.to = destination;
    			var store = db.transaction('schedule', 'readwrite').objectStore('schedule');
    			store.put(trips);

    		});
      },

      getStationsFromIDB: function(){
        return _dbPromise.then(function(db) {
    			if(!db) return Promise.reject();

          return db.transaction('stations').objectStore('stations')
            .getAll()
            .then(function(stations) {
              if (!stations || !stations.length) {
                $log.log('[idb] No cached Stations found...');
                return Promise.reject();
              }

              $log.log('[idb] Serving cached Stations...');
              return Promise.resolve(stations);
            });

    		});
      },

      getDefaultStationFrom: function(){
        return _dbPromise.then(function(db) {
          if(!db) return Promise.reject();

          return db.transaction('default').objectStore('default')
      		  .get('from')
            .then(function(valueObj){
        			if(!valueObj) {
                $log.log('[idb] No Default From Station found...');
                return Promise.reject();
              };

              $log.log('[idb] Serving Default From Station...');
              return Promise.resolve(valueObj.value);

      		  });

        });
      },

      getDefaultStationTo: function(){
        return _dbPromise.then(function(db) {
          if(!db) return Promise.reject();

          return db.transaction('default').objectStore('default')
      		  .get('to')
            .then(function(valueObj){
        			if(!valueObj) {
                $log.log('[idb] No Default To Station found...');
                return Promise.reject();
              };

              $log.log('[idb] Serving Default To Station...');
              return Promise.resolve(valueObj.value);

      		  });

        });
      },

      getDefaultSchedule: function(origin, destination){
        return _dbPromise.then(function(db) {
          if(!db) return Promise.reject();

          var key = [origin, destination];
          return db.transaction('schedule').objectStore('schedule')
      		  .get(key)
            .then(function(trips){
        			if(!trips) {
                $log.log('[idb] No Default schedule found...');
                return Promise.reject();
              };

              $log.log('[idb] Serving Default Schedule...');
              return Promise.resolve(trips);

      		  });

        });
      }


    };
  });
