	let mysql	= require('mysql');
	let bcrypt = require('bcrypt');
	let data = require('./database.json');
	
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
		return (new Promise ((resolve, reject) => {
			if (typeof username == 'undefined' || typeof mail == 'undefined') {
				console.log('Unique : undefined username or mail');
				return reject('Undefined username or mail');
			}
			connection.query("SELECT COUNT(*) FROM " + data['name'] + ".users WHERE username = ? OR email = ?;", [
				username,
				mail
			], (err, res) => {
				if (err) {
					reject ('Error while querying the database');
				} else if (res) {
					let count = res[0]['COUNT(*)'];
					if (count == 0) {
						resolve (true);
					} else {
						resolve (false);
					}
				}
			});
		}));
	}

	module.exports = {
		checkPassword: function checkPassword (password) {
			if (typeof password == 'undefined') {
				return (false);
			}
			if (password.length > 7) {
				if (RegExp('[A-Z]+').test(password) && RegExp('[a-z]+').test(password) && RegExp('[0-9]+').test(password)) {
					return true;
				}
			}
			return (false);
		},
		createUser: function createUser (username, lastname, firstname, mail, password) {
			return (new Promise((resolve, reject) => {
				//Check parameters consistancy
				if (typeof username != 'string' || username.length < 1 || typeof lastname != 'string' || lastname.length < 1 || typeof firstname != 'string' || firstname.length < 1 || typeof mail != 'string' || mail.length < 1 || typeof password != 'string' || password.length < 1) {
					console.log('Not consistant partern');
					resolve ('Error : All fields must be filled')
				}		
				is_member_unique(username, mail).then((result) => {
					if (result == true) {
						bcrypt.hash(password, 10, (err, hash) => {
							if (err) {
								console.log('Bcrypt failed to serve hash : ' + err.stack);
								reject('Fatal Error : Failed to serve Password');
							} else {
								connection.query("INSERT INTO " + data['name'] + ".users (username, lastname, firstname, email, password) VALUES (?, ?, ?, ?, ?);", [
									username,
									lastname,
									firstname,
									mail,
									hash
								], (err) => {
									if (err) {
										console.log('Mysql : query failed : ' + err.stack);
										reject("Fatal Error : User creation failed");
									}
									resolve(true);
								});
							}
						});
					} else {
						resolve('Error : Not Unique');
					}
				}).catch ((reason) => {
					console.log('Failed to check member validity : ' + err.stack);
					reject('createUser: ' + reason);
				});

			}))
		},
		logg_user: function logg_user (username, password) {
			return (new Promise ((resolve, reject) => {
				if (username && password) {
					connection.query('SELECT * FROM matcha.users WHERE username = ? AND password = ?', [username, password], function(error, results, fields) {
						if (error) {
							console.log(error.stack);
							reject ('Failed to connect member');
						}
						if (results.length > 0) {
							request.session.loggedin = true;
							request.session.username = username;
							response.redirect('/');
							resolve(true);
						} else {
							response.send('Incorrect Username and/or Password!');
							resolve (false);
						}
						response.end();
					});
				} else {
					response.send('Please enter Username and Password!');
					response.end();
				}
			}));
		}
};