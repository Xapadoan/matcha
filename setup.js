var mysql	= require('mysql');
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
connection.query('CREATE TABLE IF NOT EXISTS users (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, username VARCHAR(100) NOT NULL, lastname VARCHAR(100) NOT NULL, firstname VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL, password VARCHAR(255) NOT NULL)');
connection.query('CREATE TABLE IF NOT EXISTS users_extended (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, INT user NOT NULL, gender INT NOT NULL DEFAULT 0, orientation VARCHAR(50) NOT NULL DEFAULT Hetero, age INT NOT NULL DEFAULT 18, bio TEXT(500), interests VARCHAR(255)');
connection.end();
