	let mysql	= require('mysql');
	let bcrypt = require('bcrypt');
	let mailer = require('nodemailer');
	let data = require('./database.json');
	let servermail = require('./mail_data.json');
	
	let transporter = mailer.createTransport({
		service: servermail.service,
		port: servermail.port,
		secure: false,
		auth: {
			user: servermail.address,
			pass: servermail.pass
		}
	});
	
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
					console.log('Failed to query db : ' + err.stack)
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
	
	function validateMail (mail) {
		if (typeof mail == 'undefined') {
			return (false);
		}
		let mail_regex = new RegExp("[A-Za-z0-9!#$%&'*+-/=?^_`{|}~]+(\.?[A-Za-z0-9!#$%&'*+-/=?^_`{|}~]+)*@[a-zA-Z0-9-]+(\.?[a-zA-Z0-9-]+)*\.[a-z]+");
		if (mail_regex.test(mail) !== true) {
			return (false);
		}
		return (true);
	}
	
	function validatePassword (password) {
		if (typeof password == 'undefined') {
			return (false);
		}
		if (password.length > 7) {
			if (RegExp('[A-Z]+').test(password) && RegExp('[a-z]+').test(password) && RegExp('[0-9]+').test(password)) {
				return true;
			}
		}
		return (false);
	}
	
	module.exports = {
		//	createUser returns :
		//		On error, a formated string <error_level> : <message>
		//		On succes : true
		//		On failure : The error message to be displayed for user
		createUser: function createUser (username, lastname, firstname, mail, password) {
			return (new Promise((resolve, reject) => {
				//Check parameters consistancy
				if (typeof username != 'string' || username.length < 1 || typeof lastname != 'string' || lastname.length < 1 || typeof firstname != 'string' || firstname.length < 1 || typeof mail != 'string' || mail.length < 1 || typeof password != 'string' || password.length < 1) {
					resolve ('Tous les champs doivent être remplis')
				}
				if (validatePassword(password) !== true) {
					resolve('Le mot de passe doit contenir au moins 8 caractères dont une minuscule, une majuscule et un chiffre');
				}
				if (validateMail(mail) !== true) {
					resolve('L\'adresse e-mail doit être valide : ' + mail);
				}
				//Check if Username and mail are not already used
				is_member_unique(username, mail).then((res) => {
					if (res == true) {
						//Hash password
						bcrypt.hash(password, 10, (err, hash) => {
							if (err) {
								console.log('Bcrypt failed to serve hash : ' + err.stack);
								reject('Fatal Error : Failed to serve Password');
							} else {
								//Send mail
								let mail_options = {
									from: '"Matcha users" ' + servermail.address,
									to: mail,
									subject: 'Bienvenue !',
									html: 'Vous venez de vous enregistrer sur Matcha.<br />'
									+ 'veuillez <a href=\'/\'>confirmer</a>'
								}
								transporter.sendMail(mail_options, (err) => {
									if (err) {
										console.log(err);
										reject('Error : Failed to send registration mail');
									} else {
										resolve(true);
									}
								});
								//Save in db
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
						resolve('Le pseudo et l\'adresse e-mail doivent être uniques.');
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
					connection.query('SELECT username, password FROM matcha.users WHERE username = ?', [username], function(error, results) {
						if (error) {
							console.log(error.stack);
							reject ('Failed to connect member');
						}
						if (results.length > 0) {
							bcrypt.compare(password, results[0].password, function(err, res) {
								if (err) {
									console.log(err.stack);
									reject ('Somethimg went wrong, we are trying to solve it');
								}
								if (res == true) {
									resolve (results[0].username);
								} else {
									resolve (false);
								}
							});
						} else {
							resolve (false);
						}
					});
				} else {
					resolve(false);
				}
			}));
		}
};