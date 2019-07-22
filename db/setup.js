var mysql	= require('mysql');

var data = require('./database.json');

var connection = mysql.createConnection({
	host     : data['host'],
	user     : data['root'],
	password : data['root_password']
});

connection.connect();
connection.query('CREATE DATABASE IF NOT EXISTS ' + data['name']);
connection.query('USE ' + data['name']);
connection.query('CREATE TABLE IF NOT EXISTS users (id INT(9) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL, username VARCHAR(100) NOT NULL, lastname VARCHAR(100) NOT NULL, firstname VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL, password VARCHAR(255) NOT NULL)');
connection.end();
