var mysql = require('mysql');
var fakeGenerator = require('./generateFakes');
var data = require('./database.json');

var connection = mysql.createConnection({
	host     : data['host'],
	user     : data['root'],
	password : data['root_password']
});

connection.connect((err) => {
	if (err) {
		console.error("Mysql : Connection failed: " + err.stack);
		console.error("This is most likely an error in settings : check 'database.json'");
	}
});

connection.query('CREATE DATABASE IF NOT EXISTS ' + data['name']);
connection.query('USE ' + data['name']);
connection.query('CREATE TABLE IF NOT EXISTS users (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, username VARCHAR(100) NOT NULL, lastname VARCHAR(100) NOT NULL, firstname VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL, status VARCHAR(100) NOT NULL, fruit VARCHAR(20) NOT NULL, password VARCHAR(255) NOT NULL)');
connection.query('CREATE TABLE IF NOT EXISTS users_extended (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, user INT NOT NULL, gender VARCHAR(50) NOT NULL, orientation VARCHAR(50) NOT NULL, age INT NOT NULL DEFAULT 18, bio TEXT(500), interests VARCHAR(255))');
connection.query('CREATE TABLE IF NOT EXISTS users_images (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, user INT NOT NULL, image1 VARCHAR(100), image2 VARCHAR(100), image3 VARCHAR(100), image4 VARCHAR(100), image5 VARCHAR(100))');
connection.query('CREATE TABLE IF NOT EXISTS users_interests (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, name VARCHAR(50) NOT NULL, user INT NOT NULL)');
connection.query('CREATE TABLE IF NOT EXISTS ip2location_db5(ip_from INT(10) UNSIGNED, ip_to INT(10) UNSIGNED, country_code CHAR(2), country_name VARCHAR(64), region_name VARCHAR(128), city_name VARCHAR(128), latitude DOUBLE, longitude DOUBLE, INDEX idx_ip_from (`ip_from`), INDEX idx_ip_to (`ip_to`), INDEX idx_ip_from_to (`ip_from`, `ip_to`)) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_bin;', (err) => {
	if (err) {
		console.log('Failed to create ip2location table: ' + err.stack);
	} else {
		console.log('Start loading data')
		connection.query("LOAD DATA LOCAL INFILE '/root/matcha/IP2LOCATION-LITE-DB5.CSV' INTO TABLE ip2location_db5 FIELDS TERMINATED BY ',' ENCLOSED BY '\"' LINES TERMINATED BY '\r\n' IGNORE 0 LINES;", [], (err) => {
			if (err) {
				console.log('Failed to load location data: ' + err.stack);
			}
		});
	}
});

//gen fakes and store'em
fakeGenerator.generateFake().then((result) => {
	console.log(result);
}).catch((reason) => {
	console.log('Failed to generate fake: \n' + reason);
});

connection.end();
