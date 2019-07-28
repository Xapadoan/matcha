	let mysql	= require('mysql');
	let data = require('./database.json');

	let connection = mysql.createConnection({
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

	let createUser = function (username, lastname, firstname, mail, password) {
		connection.query("INSERT INTO " + data['name'] + ".users (username, lastname, firstname, email, password) VALUES (?, ?, ?, ?, ?);", [
				username,
				lastname,
				firstname,
				mail,
				password
		], (err) => {
				if (err) {
					console.log("User creation failed : " + err.stack);
					console.log("Params: " + username, ", " + mail + ", " + password);
				}
			});
	}

module.exports = {
	createUser: createUser
};