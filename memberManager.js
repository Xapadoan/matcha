	let mysql	= require('mysql');
	let bcrypt = require('bcrypt');
	let mailer = require('nodemailer');
	let uniqid = require('uniqid');
	let data = require('./database.json');
	let server = require('./server_settings.json');
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
								id = uniqid();
								let mail_options = {
									from: '"Matcha users" ' + servermail.address,
									to: mail,
									subject: 'Bienvenue !',
									html: 'Vous venez de vous enregistrer sur Matcha.<br />'
									+ 'veuillez <a href=\'http://' + server.name + '/signup?token=' + id + '&user=' + username + '\'>confirmer</a> la creation de votre compte'
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
								connection.query("INSERT INTO " + data['name'] + ".users (username, lastname, firstname, email, status, password) VALUES (?, ?, ?, ?, ?, ?);", [
									username,
									lastname,
									firstname,
									mail,
									id,
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
		create_user_extended: function create_user_extended (username, age, gender, orientation, bio) {
			return (new Promise ((resolve, reject) => {
				//get member id
				let id;
				connection.query('SELECT id FROM matcha.users WHERE username = ?', [username], (err, results) => {
					console.log('First query');
					if (err) {
						console.log(err.stack);
						reject ('Something went wrong, we are trying to solve it');
					} else {
						console.log(username);
						console.log(results[0]);
						id = results[0].id;
						connection.query('INSERT INTO matcha.users_extended (user, age, gender, orientation, bio) VALUES (?, ?, ?, ?, ?)', [
							id,
							age,
							gender,
							orientation,
							bio
						], (err, results) => {
							console.log('second query');
							if (err) {
								console.log(err.stack);
								reject ('Something went wrong, we are trying to solve it');
							} else {
								resolve (true);
							}
						});
					}
				});
			}));
		},
		update_user_extended: function update_user_extended (username, age, gender, orientation, bio) {
			return (new Promise ((resolve, reject) => {
				//get member id
				let id;
				connection.query('SELECT id FROM matcha.users WHERE username = ?', [username], (err, results) => {
					if (err) {
						console.log(err.stack);
						reject ('Something went wrong, we are trying to solve it');
					} else {
						id = results[0].id;
						connection.query('UPDATE matcha.users_extended SET age = ?, gender = ?, orientation = ?, bio = ? WHERE user = ?', [
							age,
							gender,
							orientation,
							bio,
							id
						], (err, results) => {
							if (err) {
								console.log(err.stack);
								reject ('Something went wrong, we are trying to solve it');
							} else {
								resolve (true);
							}
						});
					}
				});
			}));
		},
		validateUser: function validateUser (username, id) {
			return (new Promise ((resolve, reject) => {
				connection.query('UPDATE matcha.users SET status = ? WHERE username = ? AND status = ?', [
					"Confirmed",
					username,
					id
				], (err) => {
					if (err) {
						console.log(err.stack);
						reject ('Something went wrong, we are trying to solve it');
					} else {
						resolve (true);
					}
				});
			}))
		},
		changePasswordOf: function changePasswordOf (username, password, token) {
			return (new Promise ((resolve, reject) => {
				if (validatePassword(password) !== true) {
					resolve('Le mot de passe doit contenir au moins 8 caractères dont une minuscule, une majuscule et un chiffre');
				}
				//Hash password
				bcrypt.hash(password, 10, (err, hash) => {
					if (err) {
						console.log('Bcrypt failed to serve hash : ' + err.stack);
						reject('Fatal Error : Failed to serve Password');
					} else {
						connection.query('UPDATE matcha.users SET status = ?, password = ? WHERE username = ? AND status = ?',[
							"Confirmed",
							hash,
							username,
							token
						], (err) => {
							if (err) {
								console.log(err.stack);
								reject('Something went wrong, we are trying to solve');
							} else {
								resolve (true);
							}
						});
					}
				});
			}));
		},
		sendpasswordRecoveryMail: function sendpasswordRecoveryMail (username, mail) {
			return (new Promise ((resolve, reject) => {
				if (validateMail(mail) !== true) {
					resolve('L\'adresse mail n\'est pas bien formatée');
				}
				id = uniqid();
				connection.query('UPDATE matcha.users SET status = ? WHERE username = ? AND email = ?',[
					id,
					username,
					mail
				], (err, results) => {
					if (err) {
						console.log(err.stack);
						reject('Something went wrong, we are trying to solve it');
					} else if (results.affectedRows != 1) {
						resolve('L\'adresse mail et le nom d\'utilisateur ne correspondent pas');
					}
				});
				console.log('|' + mail + '|');
				let mail_options = {
					from: '"Matcha users" ' + servermail.address,
					to: mail,
					subject: 'Recupération du mot de passe',
					html: 'Vous avez fait une demande de récupération de mot de passe.<br />'
					+ 'veuillez <a href=\'http://' + server.name + '/recover?token=' + id + '&user=' + username + '\'>confirmer</a> la creation de votre compte'
				}
				transporter.sendMail(mail_options, (err) => {
					if (err) {
						console.log(err.stack);
						reject('Something went wrong, we are trying to solve it');
					} else {
						resolve(true);
					}
				});
			}));
		},
		logg_user: function logg_user (username, password) {
			return (new Promise ((resolve, reject) => {
				if (username && password) {
					connection.query('SELECT username, password, status FROM matcha.users WHERE username = ?', [username], function(error, results) {
						if (error) {
							console.log(error.stack);
							reject ('Failed to connect member');
						}
						if (results.length > 0) {
							if (results[0].status != 'Confirmed') {
								resolve (false);
							}
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