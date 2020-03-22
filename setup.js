var mysql = require('mysql');
var fakeGenerator = require('./generateFakes');
var data = require('./database.json');
var server = require('./server_settings.json')
var data_loaded = false;
var fakes_generated = false;

let connection = mysql.createConnection({
	host: data['host'],
	user: data['root'],
	port: data['port'],
	password: data['root_password']
});

connection.connect((err) => {
	if (err) {
		console.error("Mysql : Connection failed: " + err.stack);
		console.error("This is most likely an error in settings : check 'database.json'");
		process.exit(1);
	}
	doSetup().then(() => {
		console.log('Setup Done');
	}).catch((reason) => {
		console.error('Error: ' + reason);
	})
});

function endConnection(data_loaded, fakes_generated) {
	if (data_loaded && fakes_generated) {
		console.log('Ending now');
		connection.end();
	}
}

function doSetup() {
	console.log('Connection OK, started setup:');
	return (new Promise((resolve, reject) => {
		connection.query('DROP DATABASE IF EXISTS ' + data['name'], [], (err) => {
			if (err) {
				reject('Failed to DROP database');
			}
			connection.query('CREATE DATABASE IF NOT EXISTS ' + data['name'], [], (err) => {
				if (err) {
					reject('Failed to create database')
				}
				console.log('Database created');
				connection.query('USE ' + data['name'], [], () => {
					createTables().then(()=> {
						console.log('Tables created, Starting to fill:');
						//generate and stroe fakes
						storeFake(1, 0);
						//Load ip2location table
						if (err) {
							console.log('Failed to create ip2location table: ' + err.stack);
						} else {
							console.log('Start loading data from ' + server.root);
							connection.query("LOAD DATA LOCAL INFILE '" + server.root + "/IP2LOCATION-LITE-DB5.CSV' INTO TABLE ip2location_db5 FIELDS TERMINATED BY ',' ENCLOSED BY '\"' LINES TERMINATED BY '\r\n' IGNORE 0 LINES;", [], (err) => {
								if (err) {
									console.log('Failed to load location data: ' + err.stack);
								} else {
									data_loaded = true;
									endConnection(data_loaded, fakes_generated);
									console.log('Loadind Data Over');
								}
							});
						}
					}).catch(() => {
						console.error('Failed to create tables');
					});
				});
			});
		});
	}))
}

function createTables () {
	return (new Promise ((resolve, reject) => {
		try {
			connection.query('CREATE TABLE IF NOT EXISTS users (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, username VARCHAR(100) NOT NULL, lastname VARCHAR(100) NOT NULL, firstname VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL, status VARCHAR(100) NOT NULL, fruit VARCHAR(20) NOT NULL, gender VARCHAR(50), orientation VARCHAR(50), age INT NOT NULL DEFAULT 18, bio TEXT(500), password VARCHAR(255) NOT NULL, lat VARCHAR(20), lng VARCHAR(20))');
			connection.query('CREATE TABLE IF NOT EXISTS users_images (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, user INT NOT NULL, image1 VARCHAR(100), image2 VARCHAR(100), image3 VARCHAR(100), image4 VARCHAR(100), image5 VARCHAR(100))');
			connection.query('CREATE TABLE IF NOT EXISTS users_likes (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, liker INT(9) UNSIGNED NOT NULL, liked INT(9) UNSIGNED NOT NULL)');
			connection.query('CREATE TABLE IF NOT EXISTS users_dislikes (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, disliker INT(9) UNSIGNED NOT NULL, disliked INT(9) UNSIGNED NOT NULL)');
			connection.query('CREATE TABLE IF NOT EXISTS users_blocks (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, blocker INT(9) UNSIGNED NOT NULL, blocked INT(9) UNSIGNED NOT NULL)');
			connection.query('CREATE TABLE IF NOT EXISTS users_visits (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, visitor INT(9) UNSIGNED NOT NULL, visited INT(9) UNSIGNED NOT NULL)');
			connection.query('CREATE TABLE IF NOT EXISTS users_reports (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, reported INT(9) UNSIGNED NOT NULL, message VARCHAR(200))');
			connection.query('CREATE TABLE IF NOT EXISTS users_interests (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, interest INT(9) UNSIGNED NOT NULL, user INT(9) UNSIGNED NOT NULL)');
			connection.query('CREATE TABLE IF NOT EXISTS list_interests (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, name VARCHAR (50) NOT NULL)');
			connection.query('CREATE TABLE IF NOT EXISTS users_messages (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, author INT(9) UNSIGNED NOT NULL, dest INT(9) UNSIGNED NOT NULL, time DATETIME DEFAULT CURRENT_TIMESTAMP, body VARCHAR (200), seen INT(1) UNSIGNED DEFAULT 0)')
			connection.query('CREATE TABLE IF NOT EXISTS users_notifications (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, user INT(9) UNSIGNED NOT NULL, time DATETIME DEFAULT CURRENT_TIMESTAMP, title VARCHAR(50), body VARCHAR(200), seen INT(1) UNSIGNED NOT NULL DEFAULT 0)')
			connection.query('CREATE TABLE IF NOT EXISTS ip2location_db5(ip_from INT(10) UNSIGNED, ip_to INT(10) UNSIGNED, country_code CHAR(2), country_name VARCHAR(64), region_name VARCHAR(128), city_name VARCHAR(128), latitude DOUBLE, longitude DOUBLE, INDEX idx_ip_from (`ip_from`), INDEX idx_ip_to (`ip_to`), INDEX idx_ip_from_to (`ip_from`, `ip_to`)) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_bin;');
			resolve(true);
		} catch (err) {
			reject (err.stack);
		}
	}))
}

function digestInterests(userid, interests) {
	return (new Promise((resolve, reject) => {
		//remove all user's, interests
		connection.query("DELETE FROM matcha.users_interests WHERE user = ?", [
			userid
		], (err) => {
			if (err) {
				console.log('Error : Failed to erase user\'s interests');
				console.log(err.stack);
				reject('Failed to delete old interests');
			}
		});
		interests.forEach(interest => {
			//search if interest already exists
			connection.query("SELECT id FROM list_interests WHERE name=?;", [
				interest,
			], (err, result) => {
				if (err) {
					console.log('Error : Failed to search');
					console.log(err.stack);
					reject('Failed to search interest in list');
				}
				if (result.length === 0) {
					//Insert new interest
					connection.query("INSERT INTO list_interests (name) VALUES (?)", [
						interest
					], (err, result) => {
						if (err) {
							console.log('Failed to insert new interest');
							console.log(err.stack);
							reject('Failed to insert new interest');
						}
						connection.query("INSERT INTO users_interests (interest, user) VALUES (?, ?)", [
							result.insertId,
							userid
						], (err) => {
							if (err) {
								console.log("Failed to insert new user for interest");
								console.log(err.stack);
								reject('Failed to insert new user for new interest');
							}
						});
					});
				} else {
					connection.query("INSERT INTO users_interests (interest, user) VALUES (?, ?)", [
						result[0].id,
						userid
					], (err) => {
						if (err) {
							console.log("Failed to insert new user for interest");
							console.log(err.stack);
							reject('Failed to insert interest');
						}
					});
				}
			});
		});
		resolve (true);
	}));
}

function getInterests(bio) {
	var interests = [];
	let regex = new RegExp("#[A-Za-z0-9]+", "g");
	let match;
	while ((match = regex.exec(bio)) != null) {
		interests.push(match[0]);
	}
	return (interests);
}

//gen fakes and store'em
function storeFake(id, prog) {
	if (id > 200) {
		fakes_generated = true;
		console.log('All profiles generated');
		endConnection(data_loaded, fakes_generated);
		return ;
	}
	if (id % 4 == 0) {
		console.log('Profiles generation: ' + prog + '%\r');
		prog += 2;
	}
	fakeGenerator.generateFake().then((result) => {
		//Insert in users
		connection.query('INSERT INTO users (username, firstname, lastname, email, status, fruit, gender, orientation, age, bio, password, lat, lng) VALUES (?, ?, ?, ?, "Confirmed", ?, ?, ?, ?, ?, "FakePassword", ?, ?);', [
			result.Username,
			result.Firstname,
			result.Lastname,
			result.Mail,
			result.Fruit,
			result.Gender,
			result.Orientation,
			result.Age,
			result.Bio,
			result.Latitude,
			result.Longitude
		], (err) => {
			if (err) {
				console.log('Failed to insert Fake user in database: ' + err.stack);
			} else {
				digestInterests(id, getInterests(result.Bio)).then(() => {
					connection.query('INSERT INTO users_images (user, image1) VALUES (?, ?);', [
						id,
						result.Image
					], (err) => {
						if (err) {
							console.log('Failed to store Fake user_image in database: ' + err.stack);
						} else {
							storeFake(id + 1, prog);
						}
					});
				}).catch((reason) => {
					console.log(reason);
				})
			}
		});
	}).catch((reason) => {
		console.log('Failed to generate fake: \n' + reason);
	});
}