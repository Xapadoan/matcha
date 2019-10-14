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

function validateFruit(fruit) {
	if (fruit == '#pasdecoupdunsoir') {
		return (true);
	} else if (fruit == '#unsoir') {
		return (true);
	} else if (fruit == '#serieux') {
		return (true);
	} else if (fruit == '#pqr') {
		return (true);
	} else {
		return (false);
	}
}

function update_user_extended(userid, age, gender, orientation, bio, interests) {
	return (new Promise((resolve, reject) => {
		console.log(userid + '|' + age);
		connection.query('UPDATE matcha.users_extended SET age = ?, gender = ?, orientation = ?, bio = ?, interests = ? WHERE user = ?', [
			age,
			gender,
			orientation,
			bio,
			interests,
			userid
		], (err) => {
			if (err) {
				console.log(err.stack);
				reject('Something went wrong, we are trying to solve it');
			} else {
				resolve(true);
			}
		});
	}));
}

function digestInterests(userid, interests) {
	let regex = RegExp("#[A-Za-z0-9]+", "g");
	let interest;
	//remove all user's, interests
	connection.query("DELETE FROM matcha.users_interests WHERE user = ?",[
		userid
	], (err) => {
		if (err) {
			console.log('Error : Failed to erase user\'s interests');
			console.log(err.stack);
			return (false);
		}
	});
	while ((interest = regex.exec(interests)) != null) {
		//add interest
		connection.query("INSERT INTO matcha.users_interests (name, user) VALUES (?, ?);",[
			interest,
			userid
		], (err) => {{
			if (err) {
				console.log('Error : Failed to set new interest');
				console.log(err.stack);
				return (false);
			}
		}});
	}
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

function getInterests(bio) {
	var interests = new String();
	let regex = new RegExp("#[A-Za-z0-9]+", "g");
	let match;
	while ((match = regex.exec(bio)) != null) {
		interests += match[0];
	}
	return (interests);
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
	createUser: function createUser(username, lastname, firstname, mail, password, fruit) {
		return (new Promise((resolve, reject) => {
			//Check parameters consistancy
			if (typeof username != 'string' || username.length < 1 || typeof lastname != 'string' || lastname.length < 1 || typeof firstname != 'string' || firstname.length < 1 || typeof mail != 'string' || mail.length < 1 || typeof password != 'string' || password.length < 1) {
				resolve('Tous les champs doivent être remplis');
				return;
			}
			if (validateFruit(fruit) != true) {
				resolve('Veuillez choisir un des champs ci dessous');
				return;
			}
			if (validatePassword(password) !== true) {
				resolve('Le mot de passe doit contenir au moins 8 caractères dont une minuscule, une majuscule et un chiffre');
				return;
			}
			if (validateMail(mail) !== true) {
				resolve('L\'adresse e-mail doit être valide : ' + mail);
				return;
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
							connection.query("INSERT INTO " + data['name'] + ".users (username, lastname, firstname, email, status, fruit, password) VALUES (?, ?, ?, ?, ?, ?, ?);", [
								username,
								lastname,
								firstname,
								mail,
								id,
								fruit,
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
	updateUser: function updateUser(username, firstname, lastname, mail, password, fruit) {
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
					if (typeof fruit != 'undefined' && fruit != "") {
						results.fruit = fruit;
					}
					if (typeof lastname != 'undefined' && lastname != "") {
						results.lastname = lastname;
					}
					if (typeof mail != 'undefined' && mail != "") {
						console.log(mail);
						console.log(results.email);
						if (validateMail(mail) !== true) {
							resolve('L\'adresse e-mail doit être valide : ' + mail);
						}
						//Send mail to new address
						id = uniqid();
						results.email = mail;
						results.status = id;
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
										reject('Error : Failed to update password');
									}
								})
							}
						});
					}
					//update db
					connection.query('UPDATE matcha.users SET firstname=?, lastname=?, email=?, status=?, fruit=? WHERE username LIKE ?', [
						results.firstname,
						results.lastname,
						results.email,
						results.status,
						results.fruit,
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
	//create_user_extended creates a new extended profile for a user. if it already exists, it will update it with
	//provided values
	create_user_extended: function create_user_extended(username, age, gender, orientation, bio) {
		return (new Promise((resolve, reject) => {
			//get user extended profile
			this.getUserExtended(username).then((result) => {
				if (result.gender == null && result.orientation == null && result.age == null && result.bio == null && result.interests == null) {
					//extended profile doesn't exists, we have to create it
					let interests = getInterests(bio);
					digestInterests(result.id, interests);
					connection.query('INSERT INTO matcha.users_extended (user, age, gender, orientation, bio, interests) VALUES (?, ?, ?, ?, ?, ?)', [
						result.id,
						age,
						gender,
						orientation,
						bio,
						interests
					], (err) => {
						if (err) {
							console.log(err.stack);
							reject('Something went wrong, we are trying to solve it');
						} else {
							resolve(true);
						}
					});
				} else {
					//extended profile exists, we will udate it
					if (typeof age != 'undefined' && age != "") {
						result.age = age;
					}
					if (typeof gender != 'undefined' && gender != "") {
						result.gender = gender;
					}
					if (typeof orientation != 'undefined' && orientation != "") {
						result.orientation = orientation;
					}
					if (typeof bio != 'undefined' && bio != "") {
						result.bio = bio;
						result.interests = getInterests(bio);
						digestInterests(result.id, result.interests);
					}
					update_user_extended(result.id, result.age, result.gender, result.orientation, result.bio, result.interests).then((result) => {
						resolve(result);
					}).catch((reason) => {
						reject(reason);
					});
				}
			}).catch((reason) => {
				console.log(reason);
				reject('Une erreur est survenue');
			});
		}));
	},
	//Pour les matchs auto, il faut:
	//	fruit
	//	lat
	//	lng
	//	orientation
	//	genre
	//	age
	//	interests
	getUserMatchProfile: function getUserMatchProfile(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT u.username, u.fruit, u.lat, u.lng, e.orientation, e.gender, e.age, e.interests FROM matcha.users u INNER JOIN matcha.users_extended e ON u.id = e.user WHERE u.username = ?', [
				username
			], (err, result) => {
				if (err) {
					console.log('Failed to getUserMatchProfile :\n' + err.stack);
					reject('An error occured while querying database');
				} else {
					resolve(result[0]);
				}
			});
		}));
	},
	searchInterest: function searchInterest(interest) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT u.id, u.username, u.firstname, u.lastname, u.fruit, u.lat, u.lng, e.age, e.gender, e.orientation, e.bio, i.image1 FROM matcha.users u INNER JOIN matcha.users_interests n ON u.id = n.user INNER JOIN matcha.users_extended e ON u.id = e.user INNER JOIN matcha.users_images i ON u.id = i.user WHERE n.name LIKE ? LIMIT 0, 5', [
				interest
			], (err, result) => {
				if (err) {
					console.log('Failed to searchInterests:\n' + err.stack);
					reject('Failed to searchInterests');
				} else {
					resolve(result);
				}
			})
		}))
	},
	searchName: function searchName(name) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT u.id, u.username, u.firstname, u.lastname, u.fruit, u.lat, u.lng, e.age, e.gender, e.orientation, e.bio, i.image1 FROM matcha.users u INNER JOIN matcha.users_extended e ON u.id = e.user INNER JOIN matcha.users_images i ON u.id = i.user WHERE username LIKE ? OR firstname LIKE ? OR lastname LIKE ?',[
				name,
				name,
				name
			], (err, results) => {
				if (err) {
					console.log("Failed to searchName :\n" + err.stack);
					reject('Failed to search for user');
				} else {
					resolve(results);
				}
			})
		}));
	},
	getUserPopScore: function getUserPopScore(userid) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT COUNT(DISTINCT v.visitor) AS visits, COUNT(DISTINCT l.liker) AS likes FROM matcha.users_visits v INNER JOIN matcha.users_likes l ON l.liked = v.visited WHERE v.visited = ?', [
				userid
			], (err, results) => {
				if (err) {
					console.log('Failed to get counts for pop score:\n' + err.stack);
					reject(false);
				} else {
					resolve(results[0]['visits'] + 5 * results[0]['likes']);
				}
			})
		}))
	},
	getUserFullProfile: function getUserFullProfile(userid) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT u.id, u.username, u.lastname, u.firstname, u.fruit, u.lat, u.lng, e.gender, e.orientation, e.age, e.bio, i.image1, i.image2, i.image3, i.image4, i.image5 FROM matcha.users u INNER JOIN matcha.users_extended e ON u.id = e.user INNER JOIN matcha.users_images i ON u.id = i.user WHERE u.id = ?', [
				userid
			], (err, results) => {
				if (err) {
					console.log('Failed to getUserFullProfile :\n' + err.stack);
					reject('Une erreur est survenue, nous enquêtons');
				} else if (results.length != 1) {
					resolve(false);
				} else {
					resolve(results[0]);
				}
			})
		}));
	},
	//This function return :
	//On success : user object
	//On failure : false
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
	getUserExtended: function getUserExtended(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT u.id, u.username, e.gender, e.orientation, e.age, e.bio, e.interests FROM matcha.users_extended e RIGHT JOIN matcha.users u ON u.id = e.user WHERE u.username = ?', [
				username
			], (err, results) => {
				if (err) {
					console.log('Failed to getUserExtended : ' + err.stack);
					reject('Echec lors de la recuperation du profils étendu');
				} else {
					resolve(results[0]);
				}
			})
		}))
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
	getUserDislikes: function getUserDislikes(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT d.disliked FROM matcha.users u INNER JOIN matcha.users_dislikes d ON u.id = d.disliker WHERE u.username = ?', [
				username
			], (err, results) => {
				if (err) {
					console.log('Failed to getUserDislikes ' + err.stack);
					reject('Failed to getDislikes');
				} else {
					if (results.length > 0) {
						resolve(results);
					} else {
						resolve(false);
					}
				}
			})
		}))
	},
	getUserLikes: function getUserLikes(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT l.liked FROM matcha.users u INNER JOIN matcha.users_likes l ON u.id = l.liker WHERE u.username = ?', [
				username
			], (err, results) => {
				if (err) {
					console.log('Failed to getUserLikes ' + err.stack);
					reject('Failed to get likes');
				} else {
					if (results.length > 0) {
						resolve(results);
					} else {
						resolve(false);
					}
				}
			})
		}))
	},
	getUserBlocks: function getUserBlocks(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT b.blocked FROM matcha.users u INNER JOIN matcha.users_blocks b ON u.id = b.blocker WHERE u.username = ?', [
				username
			], (err, results) => {
				if (err) {
					console.log('Failed to getUserBlocks ' + err.stack);
					reject('Failed to get blocks');
				} else {
					if (results.length > 0) {
						resolve(results);
					} else {
						resolve(false);
					}
				}
			})
		}))
	},
	getUserVisits: function getUserVisits(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT v.visited FROM matcha.users u INNER JOIN matcha.users_visits v ON u.id = v.visitor WHERE u.username = ?', [
				username
			], (err, results) => {
				if (err) {
					console.log('Failed to getUserVisits ' + err.stack);
					reject('Failed to get visits');
				} else {
					if (results.length > 0) {
						resolve(results);
					} else {
						resolve(false);
					}
				}
			})
		}))
	},
	addUserImage: function addUserImage(username, image_path) {
		return (new Promise((resolve, reject) => {
			this.getUserImages(username).then((results) => {
				if (typeof results == 'undefined' || typeof results.id == 'undefined') {
					reject('Vous n\'avez pas été reconnu');
				} else if (results.image1 == null) {
					//Insert new picture'
					console.log('Create new');
					connection.query('INSERT INTO matcha.users_images (user, image1) VALUES (?, ?);', [
						results.id,
						image_path
					], (err) => {
						if (err) {
							console.log(err.stack);
							reject('Quelque chose cloche, nous enquêtons');
						} else {
							resolve(true);
						}
					});
				} else {
					//Select first empty field and store new path
					let field = getFirstNullImgField(results);
					if (field == false) {
						resolve('Vous avez atteint le nombre maximun d\'images, veuillez en supprimer');
					} else {
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
				}
			}).catch((reason) => {
				reject(reason);
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
	like: function like(liker, likedid) {
		return (new Promise((resolve, reject) => {
			//Ckeck if liker doesn't already liked
			this.getUserLikes(liker).then((results) => {
				if (results != false) {
					//Check in results
					for (let i = 0; i < results.length; i++) {
						if (results[i].liked == likedid) {
							resolve(true);
							return ;
						}
					}
				}
				connection.query('INSERT INTO matcha.users_likes (liker, liked) SELECT matcha.users.id, ? FROM matcha.users WHERE matcha.users.username = ?', [
					likedid,
					liker
				], (err) => {
					if (err) {
						console.log('Failed to register like:\n' + err.stack);
						reject('Failed to register like');
					} else {
						resolve(true);
					}
				})
			}).catch((err) => {
				console.log(err);
				reject('Failed to check likes');
			});
		}));
	},
	dislike: function dislike(disliker, dislikedid) {
		return (new Promise((resolve, reject) => {
			//Ckeck if disliker doesn't already disliked
			this.getUserDislikes(disliker).then((results) => {
				if (results != false) {
					//Check in results
					for (let i = 0; i < results.length; i++) {
						if (results[i].disliked == dislikedid) {
							resolve(true);
							return ;
						}
					}
				}
				console.log(disliker + '/' + dislikedid)
				connection.query('INSERT INTO matcha.users_dislikes (disliker, disliked) SELECT matcha.users.id, ? FROM matcha.users WHERE matcha.users.username = ?', [
					dislikedid,
					disliker
				], (err) => {
					if (err) {
						console.log('Failed to register dislike:\n' + err.stack);
						reject('Failed to register dislike');
					} else {
						console.log('unlike')
						this.unlike(disliker, dislikedid).then((result) => {
							resolve(result)
						}).catch((reason) => {
							console.log('Failed to unlike after dislike:\n' + reason)
							reject('Failed to unlike');
						})
					}
				})
			}).catch((err) => {
				console.log(err);
				reject('Failed to check dislikes');
			});
		}));
	},
	unlike: function unlike(unliker, unlikedid) {
		return (new Promise((resolve, reject) => {
			console.log(unliker + ' / ' + unlikedid)
			connection.query('DELETE FROM matcha.users_likes INNER JOIN matcha.users u ON u.id = matcha.users_likes.liker WHERE u.username = ? AND matcha.users_likes.likedid = ?', [
				unliker,
				unlikedid
			], (err) => {
				if (err) {
					console.log('Failed to unlike user :\n' + err.stack);
					reject('Failed to unlike user')
				} else {
					resolve(true);
				}
			})
		}))
	},
	block: function block(blocker, blockedid) {
		return (new Promise((resolve, reject) => {
			//Ckeck if blocker doesn't already blocked
			this.getUserBlocks(blocker).then((results) => {
				if (results != false) {
					//Check in results
					for (let i = 0; i < results.length; i++) {
						if (results[i].liked == likedid) {
							resolve(true);
							return ;
						}
					}
				}
				connection.query('INSERT INTO matcha.users_blocks (blocker, blockedid) SELECT matcha.users.id, ? FROM matcha.users WHERE matcha.users.username = ?', [
					blockedid,
					blocker
				], (err) => {
					if (err) {
						console.log('Failed to register block:\n' + err.stack);
						reject('Failed to register block');
					} else {
						this.unlike(blocker, blockedid).then((result) => {
							if (result == true) {
								resolve(true);
							} else {
								reject('Failed to unlike after blocked');
							}
						})
					}
				})
			}).catch((err) => {
				console.log(err);
				reject('Failed to check blocks');
			});

			//Insert new raw
		}));
	},
	//This function expects 2 parameters:
	//	- visitor (the username of the visitor)
	//	- visitedid (the id of the user being watched)
	visit: function visit(visitor, visitedid) {
		return (new Promise((resolve, reject) => {
			//Ckeck if liker doesn't already liked
			this.getUserVisits(visitor).then((results) => {
				if (results != false) {
					//Check in results
					for (let i = 0; i < results.length; i++) {
						if (results[i].visited == visitedid) {
							resolve(true);
							return ;
						}
					}
				}
				connection.query('INSERT INTO matcha.users_visits (visitor, visited) SELECT matcha.users.id, ? FROM matcha.users WHERE matcha.users.username = ?', [
					visitedid,
					visitor
				], (err) => {
					if (err) {
						console.log('Failed to register visit:\n' + err.stack);
						reject('Failed to register visit');
					} else {
						resolve(true);
					}
				})
			}).catch((err) => {
				console.log(err);
				reject('Failed to check visits');
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
				connection.query('SELECT id, username, password, status, lat, lng FROM matcha.users WHERE username = ?', [username], function (error, results) {
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
									lat: results[0].lat,
									lng: results[0].lng,
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
	},
	updateLatLng: function updateLatLng(username, lat, lng) {
		return (new Promise((resolve, reject) => {
			connection.query('UPDATE matcha.users SET lat = ?, lng = ? WHERE username = ?', [
				lat,
				lng,
				username
			], (err) => {
				if (err) {
					console.log("Failed to update lat lng for " + username + " :\n" + err.stack);
					reject ('Une erreur est survenue lors de la mise a jour de la geolocalisation');
				} else {
					resolve ({
						lat: lat,
						lng: lng
					});
				}
			});
		}));
	},
	//fetch Members expects options to be like:
	//	options = {
	//		age: [min, max],
	//		distance: max_distance(km),
	//		orientation: fetcher's gender,
	//		fruit: [fruit1, fruit2],
	//		interests: [tag1, tag2, tag3, ...],
	//		popularity score: [min, max]
	//	},
	//	fetcher = {
	//		username: username (requiered)
	//		gender: string,
	//		location: [lat, lng]
	//	}
	fetchMembers: function fetchMembers(options, fetcher) {
		return (new Promise((resolve, reject) => {
			query = 'SELECT u.id, u.firstname, u.lastname, u.fruit, e.age, e.gender, e.bio, i.image1 FROM matcha.users u INNER JOIN matcha.users_extended e ON u.id = e.user INNER JOIN matcha.users_images i ON u.id = i.user INNER JOIN matcha.users_interests n ON u.id = n.user WHERE u.username <> ?';
			query_values = [fetcher.username];
			//use age
			if (typeof options.age != 'undefined') {
				query += ' AND e.age BETWEEN ? and ?';
				query_values.push(options.age[0], options.age[1]);
			}
			//use gender
			if (typeof options.gender != 'undefined' && typeof fetcher.orientation == 'undefined') {
				if (typeof options.gender != 'undefined') {
					if (options.gender == 'Man') {
						query += ' AND gender = ?';
						query_values.push('Man');
					} else if (options.gender == 'Woman') {
						query += ' AND gender = ?';
						query_values.push('Woman');
					}
				}
			}
			//use distance
			if (typeof options.distance != 'undefined' && typeof fetcher.location != 'undefined') {
				let dpos = options.distance / (2 * 3.14 * 6400) * 360;
				query += ' AND u.lat BETWEEN ? AND ? AND u.lng BETWEEN ? AND ?';
				query_values.push(fetcher.location[0] - dpos, fetcher.location[0] + dpos, fetcher.location[1] - dpos, fetcher.location[1] + dpos);
			}
			//use fruit
			if (typeof options.fruit != 'undefined') {
				query += ' AND u.fruit IN (?)';
				query_values.push(options.fruit);
			}
			//use interests
			if (typeof options.interests != 'undefined' && options.interests != [] && options.interests.length) {
				query += ' AND n.name IN (?)';
				query_values.push(options.interests);
			}
			//use fetcher's gender
			if (typeof fetcher.gender != 'undefined') {
				let orientation;
				switch (fetcher.gender) {
					case ('Man') :
						orientation = 'Men';
						break;
					case ('Women') :
						orientation = 'Women'
						break;
					default :
						orientation = 'Both'
						break;
				}
				query += ' AND (orientation = ? OR orientation = \'Both\')';
				query_values.push(orientation);
			}
			//use fetcher's orientation
			if (typeof fetcher.orientation != 'undefined') {
				if (fetcher.orientation == 'Men') {
					query += ' AND gender = ?';
					query_values.push('Man');
				} else if (fetcher.orientation == 'Women') {
					query += ' AND gender = ?';
					query_values.push('Woman');
				}
			}
			query += ' LIMIT ?, 5';
			query_values.push(0);
			connection.query(query, query_values, (err, results) => {
				if (err) {
					console.log(err.stack);
					reject('Failed to fetch users');
				} else {
					resolve(results);
				}
			})
		}));
	}
};