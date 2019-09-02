var request = require('request');
var mysql = require('mysql');
var data = require('./database.json');

let connection = mysql.createConnection({
	host: data['host'],
	user: data['root'],
	port: data['port'],
	password: data['root_password']
});

function ip2long(ip) {
	str = new String(ip);
	nbrs = str.split('.');
	console.log(nbrs[0] + ' . ' + nbrs[1] + ' . ' + nbrs[2] + ' . ' + nbrs[3])
	return (nbrs[0] * Math.pow(256, 3) + nbrs[1] * Math.pow(256, 2) + nbrs[2] * 256 + nbrs[3]);
}

module.exports = {
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
	getLocationFromIp: function getLocationFromIp(ip) {
		return (new Promise((resolve, reject) => {
			let longip = ip2long(ip)
			connection.query('SELECT * FROM matcha.ip2location_db5 WHERE ? BETWEEN ip_from and ip_to', [
				longip
			], (err, results) => {
				if (err) {
					console.log('Failed to getLocationFromIp : ' + err.stack);
					reject ('An error occurred while fetching geolocation');
				} else {
					console.log('Longip: ' + longip)
					console.log(results[0])
					resolve ({
						'country': results[0].country_name,
						'city': results[0].city_name
					});
				}
			})
		}));
	},
	getLatLngFromIp: function getLatLngFromIp(ip) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT latitude, longitude FROM matcha.ip2location_db5 WHERE ? BETWEEN ip_from and ip_to', [
				ip2long(ip)
			], (err, results) => {
				if (err) {
					console.log('Failed to getLocationFromIp : ' + err.stack);
					reject ('An error occurred while fetching geolocation');
				} else {
					resolve ({
						'lat': results[0].latitude,
						'lng': results[0].longitude
					});
				}
			})
		}));
	}
}