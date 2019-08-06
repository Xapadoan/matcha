	let mysql	= require('mysql');
	let data = require('./database.json');
	var eventEmitter = require('events').EventEmitter;
	let memberEvents = new eventEmitter();
	
	let connection = mysql.createConnection({
		host     : data['host'],
		user     : data['root'],
		port : data['port'],
		password : data['root_password']
	});
	
	connection.connect((err) => {
		if (err) {
			console.error("Mysql : Connection failed: " + err.stack);
			console.error("This is most likely an error in settings : check 'database.json'");
		}
	});

	function is_member_unique (username, mail) {
		connection.query("SELECT COUNT(*) FROM " + data['name'] + ".users WHERE username = ? OR email = ?;", [
			username,
			mail
		], (err, res) => {
			if (err) {
				console.error("Error while querying database : " + err.stack);
			} else if (res) {
				return (res[0]['COUNT(*)'] == 0);
			}
		});
	}

		module.exports = {
			createUser: function createUser (username, lastname, firstname, mail, password) {
				if (!is_member_unique(username, mail)) {
					return (false);
				}
				let bcrypt = require('bcrypt');
				bcrypt.hash(password, 10, (err, hash) => {
					if (err) {
						console.error('Failed to serve Password. User')
					} else {
					connection.query("INSERT INTO " + data['name'] + ".users (username, lastname, firstname, email, password) VALUES (?, ?, ?, ?, ?);", [
						username,
						lastname,
							firstname,
							mail,
							hash
						], (err) => {
							if (err) {
								console.log("User creation failed : " + err.stack);
							}
						});
				}
			});
		}
};