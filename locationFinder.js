var request = require('request');
var mysql = require('mysql');
var data = require('./database.json');
var serv = require('./server_settings.json');

let connection = mysql.createConnection({
	host: data['host'],
	user: data['root'],
	port: data['port'],
	password: data['root_password']
});

function ip2long(ip) {
	str = new String(ip);
	nbrs = str.split('.');
	return ((nbrs[0] * Math.pow(256, 3)) + (nbrs[1] * Math.pow(256, 2)) + (nbrs[2] * Math.pow(256, 1)) + (nbrs[3] * Math.pow(256, 0)));
}

module.exports = {
	getLatLngFromLocation: function getLatLngFromLocation(address, country) {
		return (new Promise((resolve, reject) => {
			let params = {
				'user-id': serv.neutrino_id,
				'api-key': serv.neutrino_api,
				'address': address,
				'country-code': country,
			};
			request.post(
				'https://neutrinoapi.com/geocode-address', {
					form: params
				}, (error, response, body) => {
					if (!error && response.statusCode == 200) {
						let result = JSON.parse(body);
						console.log(result);
						resolve({
							lat: result['locations'][0]['latitude'],
							lng: result['locations'][0]['longitude']
						});
					} else {
						reject('Failed to get Latitude and Longitude');
					}
				}
			)
		}))
	},
	getLocationFromLatLng: function getLocationFromLatLng(lat, lng) {
		return (new Promise((resolve, reject) => {
			let params = {
				'user-id': serv.neutrino_id,
				'api-key': serv.neutrino_api,
				'latitude': lat,
				'longitude': lng,
				'language-code': 'fr',
				'zoom': 'city'
			};
			request.post(
				'https://neutrinoapi.com/geocode-reverse',
				{ form: params },
				function (error, response, body) {
					if (!error && response.statusCode == 200) {
						var result = JSON.parse(body);
						resolve({
							country: result['country'],
							city: result['city']
						});
					} else {
						reject('Failed to get Geo-locaion from Latitude and Longitude');
					}
				}
			);
		}));
	},
	getLocationFromIp: function getLocationFromIp() {
		return (new Promise((resolve, reject) => {
			request.get('http://ip4.me/api/', null, (err, res, body) => {
				if (err) {
					console.log(err.stack);
					reject('Failed to get ip');
				}
				ip = new String(body).split(',')[1];
				connection.query('SELECT * FROM matcha.ip2location_db5 WHERE ? BETWEEN ip_from and ip_to', [
					ip2long(ip)
				], (err, results) => {
					if (err) {
						console.log('Failed to getLocationFromIp : ' + err.stack);
						reject('An error occurred while fetching geolocation');
					} else if (results.length == 0) {
						console.log('Not found');
						resolve('Localisation non trouvée');
					} else {
						resolve({
							'country': results[0].country_name,
							'city': results[0].city_name
						});
					}
				})
			});
		}));
	},
	getLatLngFromIp: function getLatLngFromIp() {
		return (new Promise((resolve, reject) => {
			request.get('http://ip4.me/api/', null, (err, res, body) => {
				if (err) {
					console.log(err.stack);
					reject('Failed to get ip');
				}
				ip = new String(body).split(',')[1];
				connection.query('SELECT latitude, longitude FROM matcha.ip2location_db5 WHERE ? BETWEEN ip_from and ip_to', [
					ip2long(ip)
				], (err, results) => {
					if (err) {
						console.log('Failed to getLocationFromIp : ' + err.stack);
						reject('An error occurred while fetching geolocation');
					} else {
						resolve({
							'lat': results[0].latitude,
							'lng': results[0].longitude
						});
					}
				})
			})
		}));
	}
}