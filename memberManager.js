let mysql = require('mysql');
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
	host: data['host'],
	user: data['root'],
	port: data['port'],
	password: data['root_password']
});

connection.connect((err) => {
	if (err) {
		console.error("Mysql : Connection failed: " + err.stack);
		console.error("This is most likely an error in settings : check 'database.json'");
	}
});

function is_member_unique(username, mail) {
	return (new Promise((resolve, reject) => {
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
				reject('Error while querying the database');
			} else if (res) {
				let count = res[0]['COUNT(*)'];
				if (count == 0) {
					resolve(true);
				} else {
					resolve(false);
				}
			}
		});
	}));
}

function validateMail(mail) {
	if (typeof mail == 'undefined') {
		return (false);
	}
	let mail_regex = new RegExp("[A-Za-z0-9!#$%&'*+-/=?^_`{|}~]+(\.?[A-Za-z0-9!#$%&'*+-/=?^_`{|}~]+)*@[a-zA-Z0-9-]+(\.?[a-zA-Z0-9-]+)*\.[a-z]+");
	if (mail_regex.test(mail) !== true) {
		return (false);
	}
	return (true);
}

function validatePassword(password) {
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

function getFirstNullImgField(fields) {
	if (fields.image1 == null) {
		return ('image1');
	} else if (fields.image2 == null) {
		return ('image2');
	} else if (fields.image3 == null) {
		return ('image3');
	} else if (fields.image4 == null) {
		return ('image4');
	} else if (fields.image5 == null) {
		return ('image5');
	} else {
		return (false);
	}
}

module.exports = {
	//	createUser returns :
	//		On error, a formated string <error_level> : <message>
	//		On succes : true
	//		On failure : The error message to be displayed for user
	createUser: function createUser(username, lastname, firstname, mail, password) {
		return (new Promise((resolve, reject) => {
			//Check parameters consistancy
			if (typeof username != 'string' || username.length < 1 || typeof lastname != 'string' || lastname.length < 1 || typeof firstname != 'string' || firstname.length < 1 || typeof mail != 'string' || mail.length < 1 || typeof password != 'string' || password.length < 1) {
				resolve('Tous les champs doivent être remplis')
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
			}).catch((reason) => {
				console.log('Failed to check member validity : ' + err.stack);
				reject('createUser: ' + reason);
			});
		}))
	},
	//	updateUser returns :
	//		On error : a formated string <error_level> : <message>
	//		On succes : true
	//		On failure : The error message to be displayed for user
	updateUser: function updateUser(username, firstname, lastname, mail, password) {
		return (new Promise((resolve, reject) => {
			//Get user info
			this.getUserInfos(username).then((results) => {
				if (results === false) {
					resolve("L'utilisateur n'a pas été reconnu");
				} else {
					//Replace with new if existing
					if (typeof firstname != 'undefined' && firstname != "") {
						results.firstname = firstname;
					}
					if (typeof lastname != 'undefined' && lastname != "") {
						results.lastname = lastname;
					}
					if (typeof mail != 'undefined' && mail != "") {
						if (validateMail(mail) !== true) {
							resolve('L\'adresse e-mail doit être valide : ' + mail);
						}
						//Send mail to new address
						id = uniqid();
						let mail_options = {
							from: '"Matcha users" ' + servermail.address,
							to: mail,
							subject: 'Nouvelle addresse mail',
							html: 'Vous venez d\'enregistrer une nouvelle addresse mail.<br />'
								+ 'Veuillez <a href=\'http://' + server.name + '/signup?token=' + id + '&user=' + username + '\'>confirmer</a>'
								+ ' ce changement.'
						}
						transporter.sendMail(mail_options, (err) => {
							if (err) {
								console.log(err);
								reject('Error : Failed to send registration mail');
							} else {
								results.email = mail;
								results.status = id;
							}
						});
					}
					if (typeof password != 'undefined' && password != "") {
						if (validatePassword(password) !== true) {
							resolve('Le mot de passe doit contenir au moins 8 caractères dont une minuscule, une majuscule et un chiffre');
						}
						bcrypt.hash(password, 10, (err, hash) => {
							if (err) {
								console.log("Bcrypt failed to hash : " + err.stack);
								reject('Error : Failed to server hash');
							} else {
								connection.query('UPDATE matcha.users SET password=? WHERE username LIKE ?', [
									hash,
									username
								], (err) => {
									if (err) {
										console.log('Failed to store password: ' + err.stack);
										reject ('Error : Failed to update password');
									}
								})
							}
						});
					}
					//update db
					connection.query('UPDATE matcha.users SET firstname=?, lastname=?, email=? WHERE username LIKE ?', [
						results.firstname,
						results.lastname,
						results.email,
						username
					], (err, results) => {
						if (err) {
							console.log('update user failed : ' + err.stack);
							reject('Error : Failed to update user informations');
						} else if (results.affectedRows != 1) {
							resolve('L\'utilisateur n\'a pas été reconnu');
						} else {
							resolve(true);
						}
					});
				}
			}).catch((reason) => {
				console.log(reason);
				reject('Error : Failed to get User infos')
			});
		}));
	},
	create_user_extended: function create_user_extended(username, age, gender, orientation, bio) {
		return (new Promise((resolve, reject) => {
			//get member id
			let id;
			connection.query('SELECT id FROM matcha.users WHERE username = ?', [username], (err, results) => {
				console.log('First query');
				if (err) {
					console.log(err.stack);
					reject('Something went wrong, we are trying to solve it');
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
					], (err) => {
						console.log('second query');
						if (err) {
							console.log(err.stack);
							reject('Something went wrong, we are trying to solve it');
						} else {
							resolve(true);
						}
					});
				}
			});
		}));
	},
	//This function return :
	//On success : user object
	//On failre : false
	//On error : Formated error string : <level>:<message>
	getUserInfos: function getUserInfos(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT * FROM matcha.users WHERE username = ?', [
				username
			], (err, results) => {
				if (err) {
					console.log("getUserInfos Failed : " + err.stack);
					reject("Something went wrong, we are trying to solve it");
				} else if (results.length == 0) {
					resolve(false);
				} else {
					resolve(results[0]);
				}
			});
		}));
	},
	getUserImages: function getUserImages(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT u.id, image1, image2, image3, image4, image5 FROM matcha.users_images RIGHT JOIN matcha.users u ON u.id = matcha.users_images.user WHERE u.username = ?', [
				username
			], (err, results) => {
				if (err) {
					console.log(err.stack);
					reject("Something went wrong, we are trying to solve it");
				} else {
					resolve(results[0]);
				}
			});
		}))
	},
	addUserImage: function addUserImage(username, image_path) {
		return (new Promise((resolve, reject) => {
			this.getUserImages(username).then((results) => {
				console.log(results);
				if (typeof results == 'undefined' || typeof results.id == 'undefined') {
					reject('User is not recognized, please login and try again');
				} else if (results.image1 == null) {
					//Insert new picture
					connection.query('INSERT INTO matcha.users_images (user, image1) VALUES (?, ?);', [
						results.id,
						image_path
					], (err) => {
						if (err) {
							console.log(err.stack);
							reject('Something went wrong, we aretrying to solve it');
						} else {
							resolve(true);
						}
					});
				} else {
					//Select first empty field and store new path
					let field = getFirstNullImgField(results);
					if (field == false) {
						resolve('Vous avez atteint le nombre maximun d\'images, veuillez en supprimer');
					}
					connection.query('UPDATE matcha.users_images SET ??=? WHERE user=?', [
						field,
						image_path,
						results.id
					], (err) => {
						if (err) {
							console.log(err.stack);
							reject('Something went wrong, we are trying to solve it');
						} else {
							resolve(true);
						}
					});
				}
			}).catch((reason) => {
				reject(reason);
			});
		}));
	},
	update_user_extended: function update_user_extended(username, age, gender, orientation, bio) {
		return (new Promise((resolve, reject) => {
			//get member id
			let id;
			connection.query('SELECT id FROM matcha.users WHERE username = ?', [username], (err, results) => {
				if (err) {
					console.log(err.stack);
					reject('Something went wrong, we are trying to solve it');
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
							reject('Something went wrong, we are trying to solve it');
						} else {
							resolve(true);
						}
					});
				}
			});
		}));
	},
	validateUser: function validateUser(username, id) {
		return (new Promise((resolve, reject) => {
			connection.query('UPDATE matcha.users SET status = ? WHERE username = ? AND status = ?', [
				"Confirmed",
				username,
				id
			], (err) => {
				if (err) {
					console.log(err.stack);
					reject('Something went wrong, we are trying to solve it');
				} else {
					resolve(true);
				}
			});
		}))
	},
	changePasswordOf: function changePasswordOf(username, password, token) {
		return (new Promise((resolve, reject) => {
			if (validatePassword(password) !== true) {
				resolve('Le mot de passe doit contenir au moins 8 caractères dont une minuscule, une majuscule et un chiffre');
			}
			//Hash password
			bcrypt.hash(password, 10, (err, hash) => {
				if (err) {
					console.log('Bcrypt failed to serve hash : ' + err.stack);
					reject('Fatal Error : Failed to serve Password');
				} else {
					console.log(hash);
					connection.query('UPDATE matcha.users SET status = ?, password = ? WHERE username = ? AND status = ?', [
						"Confirmed",
						hash,
						username,
						token
					], (err) => {
						if (err) {
							console.log(err.stack);
							reject('Something went wrong, we are trying to solve');
						} else {
							resolve(true);
						}
					});
				}
			});
		}));
	},
	sendpasswordRecoveryMail: function sendpasswordRecoveryMail(username, mail) {
		return (new Promise((resolve, reject) => {
			if (validateMail(mail) !== true) {
				resolve('L\'adresse mail n\'est pas bien formatée');
			}
			id = uniqid();
			connection.query('UPDATE matcha.users SET status = ? WHERE username = ? AND email = ?', [
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
	logg_user: function logg_user(username, password) {
		return (new Promise((resolve, reject) => {
			if (username && password) {
				connection.query('SELECT id, username, password, status FROM matcha.users WHERE username = ?', [username], function (error, results) {
					if (error) {
						console.log(error.stack);
						reject('Failed to connect member');
					}
					if (results.length > 0) {
						if (results[0].status != 'Confirmed') {
							resolve(false);
						}
						bcrypt.compare(password, results[0].password, function (err, res) {
							if (err) {
								console.log(err.stack);
								reject('Somethimg went wrong, we are trying to solve it');
							}
							if (res == true) {
								resolve({
									username: results[0].username,
									id: results[0].id
								});
							} else {
								resolve(false);
							}
						});
					} else {
						resolve(false);
					}
				});
			} else {
				resolve(false);
			}
		}));
	}
};