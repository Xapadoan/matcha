let mysql = require('mysql');
let bcrypt = require('bcrypt');
let mailer = require('nodemailer');
let uniqid = require('uniqid');
let data = require('./database.json');
let server = require('./server_settings.json');
let servermail = require('./mail_data.json');
let fs = require('fs');

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

function checkCompleteProfile(username) {
	return (new Promise((resolve, reject) => {
		connection.query('SELECT u.id, u.username, u.firstname, u.lastname, u.fruit, u.email, e.age, e.gender, e.orientation, e.bio, i.image1 FROM matcha.users u LEFT JOIN matcha.users_extended e ON u.id = e.user LEFT JOIN matcha.users_images i ON u.id = i.user WHERE u.username = ?', [
			username
		], (err, result) => {
			if (err) {
				console.log('Failed to checkCompleteProfile:\n' + err.stack);
				reject('Failed to check complete profile');
			} else if (result.length > 1) {
				console.log('Failed to checkCompleteProfile:\n\tSeveral accounts with same user name');
				reject('Several accounts with same username');
			} else {
				let missing = {};
				if (result[0].id == null) {
					missing.id = 1;
				}
				if (result[0].username == null) {
					missing.username = 1;
				}
				if (result[0].firstname == null) {
					missing.firstname = 1;
				}
				if (result[0].lastname == null) {
					missing.lastname = 1;
				}
				if (result[0].fruit == null) {
					missing.fruit = 1;
				}
				if (result[0].email == null) {
					missing.email = 1;
				}
				if (result[0].age == null) {
					missing.age = 1;
				}
				if (result[0].gender == null) {
					missing.gender = 1;
				}
				if (result[0].orientation == null) {
					missing.orientation = 1;
				}
				if (result[0].bio == null) {
					missing.bio = 1;
				}
				if (result[0].image1 == null) {
					missing.image1 = 1;
				}
				resolve(missing);
			}
		})
	}));
}

function update_user_extended(userid, age, gender, orientation, bio, interests) {
	return (new Promise((resolve, reject) => {
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
	connection.query("DELETE FROM matcha.users_interests WHERE user = ?", [
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
		connection.query("INSERT INTO matcha.users_interests (name, user) VALUES (?, ?);", [
			interest,
			userid
		], (err) => {
			{
				if (err) {
					console.log('Error : Failed to set new interest');
					console.log(err.stack);
					return (false);
				}
			}
		});
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

function getInterestsTab(interests) {
	var tab = [];
	let regex = new RegExp("#[A-Za-z0-9]+", "g");
	let match;
	while ((match = regex.exec(interests)) != null) {
		tab.push(match[0]);
	}
	return (tab);
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
								} else {
									console.log('User OK')
									resolve(true);
								}
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
					return;
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
					if (typeof mail != 'undefined' && mail != "" && mail != results.email) {
						if (validateMail(mail) !== true) {
							resolve('L\'adresse e-mail doit être valide : ' + mail);
							return;
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
							return;
						}
					});
				}
				checkCompleteProfile(username).then((results) => {
					if (typeof results == 'undefined') {
						//Profile is complete
						connection.query('UPDATE matcha.users SET status=\'Complete\' WHERE username = ?', [
							username
						], (err) => {
							if (err) {
								console.log('Failed to mark profile as complete:\n' + err.stack);
								reject('Failed to mark profile as complete');
							} else {
								resolve(true);
								return ;
							}
						})
					} else {
						resolve(true);
						return ;
					}
				}).catch((reason) => {
					console.log('Failed to checkCompleteProfile');
					reject('Error : Failed to markprofile as complete')
				})
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
					let interests;
					if (typeof gender == 'undefined' || gender == "") {
						gender = "Both";
					}
					if (typeof orientation == 'undefined' || orientation == "") {
						orientation = "Both"
					}
					if (typeof age == 'undefined' || age == "") {
						age = 18;
					}
					if (typeof bio == 'undefined' || bio == "") {
						bio = null;
						interests = null;
					} else {
						interests = getInterests(bio);
					}
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
							console.log('SQL Error:\n' + err.stack);
							reject('SQL Error');
						} else {
							checkCompleteProfile(username).then((result) => {
								if (typeof result == 'undefined' || Object.keys(result).length == 0) {
									connection.query('UPDATE matcha.users SET status=\'Complete\' WHERE username = ?', [
										username
									], (err) => {
										if (err) {
											console.log('Failed to mark profile as Complete');
											reject('Failed to mark profile as complete')
										} else {
											resolve(true);
										}
									})
								} else {
									resolve(true);
								}
							}).catch((reason) => {
								console.log('Failed to checkCompleteProfile');
								reject('Failed to checkCompleteProfile')
							})
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
						checkCompleteProfile(username).then((result) => {
							if (typeof result == 'undefined' || Object.keys(result).length == 0) {
								connection.query('UPDATE matcha.users SET status=\'Complete\' WHERE username = ?', [
									username
								], (err) => {
									if (err) {
										console.log('Failed to mark profile as complete:\n' + err.stack);
										reject('Failed to mark profile as complete')
									} else {
										resolve(true);
									}
								});
							} else {
								resolve(true);
							}
						}).catch((reason) => {
							console.log('Failed to checkCompleteProfile:\n' + reason)
							reject(reason);
						});
					}).catch((reason) => {
						console.log(reason);
						reject('Une erreur est survenue');
					});
				}
			}).catch((reason) => {
				console.log('Failed to get user extended:' + reason);
				reject('Failed to get user extended')
			})
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
	isLikedBy: function isLikedBy(liked, liker) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT COUNT(*) AS count FROM matcha.users_likes WHERE liker = ? AND liked = ?', [
				liker,
				liked
			], (err, result) => {
				if (err) {
					console.log('SQL Error : \n' + err.stack);
					reject('SQL Error');
				} else {
					if (result[0]['count'] == 1) {
						resolve(true);
					} else {
						resolve(false);
					}
				}
			})
		}))
	},
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
			connection.query('SELECT u.id, u.username, u.firstname, u.lastname, u.fruit, u.lat, u.lng, e.age, e.gender, e.orientation, e.bio, i.image1 FROM matcha.users u INNER JOIN matcha.users_extended e ON u.id = e.user INNER JOIN matcha.users_images i ON u.id = i.user WHERE username LIKE ? OR firstname LIKE ? OR lastname LIKE ?', [
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
	checkMatch(username, destid) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT u.id FROM matcha.users u INNER JOIN matcha.users_likes l ON u.id = l.liker WHERE u.id IN (SELECT l.liked FROM matcha.users_likes l INNER JOIN matcha.users u ON u.id = l.liker WHERE u.username = ?) AND l.liker = ?', [
				username,
				destid
			], (err, results) => {
				if (err) {
					console.log('Failed to get matches:\n' + err.stack);
					reject('Failed to getUserMatchs');
				} else if (results.length < 1) {
					resolve(false);
				} else {
					resolve(true);
				}
			})
		}));
	},
	checkAuthorization: function (username, status) {
		return (new Promise((resolve, reject) => {
			if (typeof username == 'undefined' || username == null) {
				resolve(false);
				return;
			}
			connection.query('SELECT status FROM matcha.users WHERE username = ?', [
				username
			], (err, result) => {
				if (err) {
					console.log('Failed to checkAuthorization:\n' + err.stack);
					reject('Failed to checkAuthorization');
				} else if (result.length > 1) {
					console.log('checkAuthorization: More than one user found for : ' + username);
					reject('Several accounts with same username');
				} else if (status.includes(result[0]['status'])) {
					resolve(true);
					return;
				} else {
					resolve(false);
					return;
				}
			})
		}))
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
	getUserName: function getUserName(userid) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT username FROM matcha.users WHERE id = ?', [
				userid
			], (err, result) => {
				if (err) {
					console.log('Failed to getUserName:\n' + err.stack);
					reject('Failed to getUserName');
				} else {
					resolve(result[0]['username']);
				}
			})
		}));
	},
	getUserFullProfile: function getUserFullProfile(userid, visitor) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT u.id, u.username, u.lastname, u.firstname, u.fruit, u.lat, u.lng, e.gender, e.orientation, e.age, e.bio, i.image1, i.image2, i.image3, i.image4, i.image5, (SELECT COUNT(*) FROM matcha.users_likes WHERE liked = ?) AS likes, (SELECT COUNT(*) FROM matcha.users_visits WHERE visited = ?) AS visits, (SELECT COUNT(*) FROM matcha.users_likes l INNER JOIN matcha.users u ON u.username = ? WHERE l.liked = ?) AS liked FROM matcha.users u INNER JOIN matcha.users_extended e ON u.id = e.user INNER JOIN matcha.users_images i ON u.id = i.user WHERE u.id = ?', [
				userid,
				userid,
				visitor,
				userid,
				userid
			], (err, results) => {
				if (err) {
					console.log('Failed to getUserFullProfile :\n' + err.stack);
					reject('Une erreur est survenue, nous enquêtons');
				} else if (results.length != 1) {
					resolve(false);
				} else {
					results[0].pop_score = results[0].visits + 5 * results[0].likes;
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
			connection.query('SELECT u.*, e.interests FROM matcha.users u LEFT JOIN matcha.users_extended e ON u.id = e.user WHERE u.username = ?', [
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
	getUserMatchs: function getUserMatchs(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT u.id, u.lastname, u.firstname, u.fruit, u.lat, u.lng, e.gender, e.bio, e.age, i.image1 FROM matcha.users u INNER JOIN matcha.users_extended e ON u.id = e.user INNER JOIN matcha.users_images i ON u.id = i.user INNER JOIN matcha.users_likes l ON u.id = l.liker WHERE u.id IN (SELECT l.liked FROM matcha.users_likes l INNER JOIN matcha.users u ON u.id = l.liker WHERE u.username = ?)', [
				username
			], (err, results) => {
				if (err) {
					console.log('Failed to get matches:\n' + err.stack);
					reject('Failed to getUserMatchs');
				} else {
					resolve(results)
				}
			})
		}))
	},
	getUserLikedProfiles: function getUserLikedProfiles(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT u.id, u.lastname, u.firstname, u.fruit, e.gender, e.age, u.lat, u.lng, e.bio, i.image1 FROM matcha.users_likes l INNER JOIN matcha.users u ON u.id = l.liked INNER JOIN matcha.users_extended e ON u.id = e.user INNER JOIN matcha.users_images i ON u.id = i.user WHERE l.liker = (SELECT id FROM matcha.users WHERE username = ?) ORDER BY u.id DESC LIMIT 10;', [
				username
			], (err, results) => {
				if (err) {
					console.log('Failed to getUserLikedProfiles:\n' + err.stack);
					reject('Failed to getUserLikedProfiles');
				} else {
					resolve(results);
				}
			})
		}))
	},
	getProfilesLikesUser: function getProfilesLikedUser(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT u.id, u.firstname, u.lastname, u.fruit, u.lat, u.lng, e.gender, e.age, e.bio, i.image1 FROM matcha.users_likes l INNER JOIN matcha.users u ON u.id = l.liker INNER JOIN matcha.users_extended e ON u.id = e.user INNER JOIN matcha.users_images i ON u.id = i.user WHERE l.liked = (SELECT id FROM matcha.users WHERE username = ?) ORDER BY u.id DESC LIMIT 10;', [
				username
			], (err, results) => {
				if (err) {
					console.log('Failed to getProfilesLikedUser:\n' + err.stack);
					reject('Failed to getProfilesLiekedUser');
				} else {
					resolve(results)
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
					connection.query('INSERT INTO matcha.users_images (user, image1) VALUES (?, ?);', [
						results.id,
						image_path
					], (err) => {
						if (err) {
							console.log(err.stack);
							reject('Quelque chose cloche, nous enquêtons');
						} else {
							checkCompleteProfile(username).then((result) => {
								if (typeof result == 'undefined' || Object.keys(result).length == 0) {
									connection.query('UPDATE matcha.users SET status=\'Complete\' WHERE username = ?', [
										username
									], (err) => {
										if (err) {
											console.log('Failed to mark profile as complete:\n' + err.stack);
											reject('Failed to mark profile as complete');
										} else {
											resolve(true);
										}
									})
								} else {
									resolve(true);
								}
							}).catch((reason) => {
								console.log('Failed to checkCompleteProfile: ' + reason);
								reject('Failed to checkCompleteProfile');
							})
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
								checkCompleteProfile(username).then((result) => {
									if (typeof result == 'undefined' || Object.keys(result).length == 0) {
										connection.query('UPDATE matcha.users SET status=\'Complete\' WHERE username = ?', [
											username
										], (err) => {
											if (err) {
												console.log('Failed to mark profile as complete:\n' + err.stack);
												reject('Failed to mark profile as complete');
											} else {
												resolve(true);
											}
										})
									} else {
										resolve(true);
									}
								}).catch((reason) => {
									console.log('Failed to checkCompleteProfile: ' + reason);
									reject('Failed to checkCompleteProfile');
								})
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
	countNotifications: function countNotifications(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT COUNT(*) AS count FROM matcha.users_notifications WHERE user = ? AND seen = \'0\'', [
				username
			], (err, result) => {
				if (err) {
					console.log('SQL Error:\n' + err.stack);
					reject('SQL Error');
				} else {
					resolve(result[0]);
				}
			})
		}))
	},
	countMessages: function countMessages(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT COUNT(*) AS count FROM matcha.users_messages WHERE dest = ? AND seen = \'0\'', [
				username
			], (err, result) => {
				if (err) {
					console.log('SQL Error:\n' + err.stack);
					reject('SQL Error');
				} else {
					resolve(result[0]);
				}
			})
		}))
	},
	getNotifications: function getNotifications(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT user, title, body FROM matcha.users_notifications WHERE user = ? AND seen = \'0\' ORDER BY time DESC LIMIT 10', [
				username
			], (err, results) => {
				if (err) {
					console.log('SQL Error:\n' + err.stack);
					reject('SQL Error');
				} else {
					connection.query('UPDATE matcha.users_notifications SET seen = \'1\' WHERE user = ?', [
						username
					], (err) => {
						if (err) {
							console.log('SQL Error:\n' + err.stack)
						}
					})
					resolve(results);
				}
			})
		}))
	},
	getMessages: function getMessages(username) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT u.id, m.author, m.body, m.time FROM matcha.users_messages m INNER JOIN matcha.users u ON m.author = u.username WHERE m.dest = ? AND m.seen = \'0\' ORDER BY m.time DESC LIMIT 10', [
				username
			], (err, results) => {
				if (err) {
					console.log('Failed to getMessages:\n' + err.stack);
					reject('Failed to get Messages');
				} else {
					connection.query('UPDATE matcha.users_messages SET seen = \'1\' WHERE dest = ?', [
						username
					], (err) => {
						if (err) {
							console.log('SQL Error:\n' + err.stack);
						}
					})
					resolve(results);
				}
			})
		}))
	},
	newNotification: function newNotification(notif) {
		return (new Promise((resolve, reject) => {
			connection.query('INSERT INTO matcha.users_notifications (user, title, body) VALUES (?, ?, ?);', [
				notif.dest,
				notif.title,
				notif.body
			], (err) => {
				if (err) {
					console.log('SQL Error:\n' + err.stack);
					reject('SQL Error');
				} else {
					resolve(true);
				}
			})
		}))
	},
	newMessage: function newMessage(message) {
		return (new Promise((resolve, reject) => {
			connection.query('INSERT INTO matcha.users_messages (dest, author, body) VALUES (?, ?, ?)', [
				message.dest,
				message.author,
				message.body
			], (err) => {
				if (err) {
					console.log('SQL Error:\n' + err.stack)
					reject('SQL Error');
				} else {
					resolve(true);
				}
			})
		}))
	},
	like: function like(liker, likedid) {
		return (new Promise((resolve, reject) => {
			//Ckeck if liker doesn't already liked
			this.getUserLikes(liker).then((results) => {
				if (results != false) {
					//Check in results
					for (let i = 0; i < results.length; i++) {
						if (results[i].liked == likedid) {
							resolve('already liked');
							return;
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
							return;
						}
					}
				}
				connection.query('INSERT INTO matcha.users_dislikes (disliker, disliked) SELECT matcha.users.id, ? FROM matcha.users WHERE matcha.users.username = ?', [
					dislikedid,
					disliker
				], (err) => {
					if (err) {
						console.log('Failed to register dislike:\n' + err.stack);
						reject('Failed to register dislike');
					} else {
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
	report: function report(reported, message) {
		return (new Promise((resolve, reject) => {
			connection.query('INSERT INTO matcha.users_reports (reported, message) VALUES (?, ?)', [
				reported,
				message
			], (err) => {
				if (err) {
					console.log('Failed to report user:\n' + err.stack);
					reject('Failed to report user');
				} else {
					resolve(true);
				}
			})
		}))
	},
	unlike: function unlike(unliker, unlikedid) {
		return (new Promise((resolve, reject) => {
			connection.query('DELETE FROM matcha.users_likes WHERE matcha.users_likes.liked = ? AND matcha.users_likes.liker = (SELECT id FROM matcha.users WHERE username = ?)', [
				unlikedid,
				unliker,
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
						if (results[i].blocked == blockedid) {
							resolve(true);
							return;
						}
					}
				}
				connection.query('INSERT INTO matcha.users_blocks (blocker, blocked) SELECT matcha.users.id, ? FROM matcha.users WHERE matcha.users.username = ?', [
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
							resolve('already visited');
							return;
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
	delete_image: function delete_image(username, image) {
		return (new Promise((resolve, reject) => {
			this.getUserImages(username).then((results) => {
				if (results.image1 == null) {
					resolve('Pas d\'image à supprimmer');
					return ;
				} else if (results['image' + image] == null) {
					resolve('Cette image n\'existe pas');
					return ;
				} else if (image == 1 && results.image2 == null && results.image3 == null && results.image4 == null && results.image5 == null) {
					resolve('Ne supprimez pas votre seule image !')
				} else if (image == 1) {
					let replace;
					if (results.image2 != null) {
						replace = [results.image2, 2];
					} else if (results.image3 != null) {
						replace = [results.image3, 3];
					} else if (results.image4 != null) {
						replace = [results.image4, 4];
					} else {
						replace = [results.image5, 5];
					}
					query = 'UPDATE matcha.users_images i INNER JOIN matcha.users u ON u.id = i.user SET image1=?, image' + replace[1] + '=null WHERE u.username = ?';
					connection.query(query, [
						replace[0],
						username
					], (err) => {
						if (err) {
							console.log('Failed to remove image from database:\n' + err.stack);
							reject('Failed to remove image from database')
						} else {
							fs.unlink('/resources/user_images/' + results['image' + image], (err) => {
								if (err) {
									console.log('Failed to delete image from server:\n' + err.stack);
									reject('Failed to delete image from server')
								} else {
									resolve(true);
								}
							})
						}
					})
				} else {
					query = 'UPDATE matcha.users_images i INNER JOIN matcha.users u ON u.id = i.user SET image' + image + '=null WHERE u.username = ?';
					connection.query(query, [username], (err) => {
						if (err) {
							console.log('Failed to remove image from database:\n' + err.stack);
							reject('Failed to remove image from database')
						} else {
							fs.unlink('resources/user_images/' + results['image' + image], (err) => {
								if (err) {
									console.log('Failed to delete image from server:\n' + err.stack);
									reject('Failed to delete image from server')
								} else {
									resolve(true);
								}
							})
						}
					})
				}
			}).catch((reason) => {
				console.log('Failed to getUserImages:' + reason);
				reject('Failed to getUserImages');
			})
		}));
	},
	delete_user: function delete_user(username, password) {
		return (new Promise((resolve, reject) => {
			if (username && password) {
				//Check that password and username match
				connection.query('SELECT username, password FROM matcha.users WHERE username = ?', [
					username,
				], (err, result) => {
					if (err) {
						console.log('Failed to check username and password:\n' + err.stack);
						reject('Quelque chose cloche, nous enquêtons');
					} else if (result.length <= 0) {
						resolve('Le pseudo et le mot de passe ne correspondent pas');
					} else {
						bcrypt.compare(password, result[0]['password'], (err, res) => {
							if (err) {
								console.log('Failed to compare passwords:\n' + err.stack);
								reject('Quelque chose cloche, nous enquêtons');
							} else if (res != true) {
								resolve('Le pseudo et le mot de pass de correspondent pas');
							} else {
								let query = 'DELETE matcha.users, matcha.users_extended, matcha.users_images, matcha.users_interests, matcha.users_likes, matcha.users_dislikes, matcha.users_blocks, matcha.users_visits, matcha.users_reports FROM matcha.users';
								query += ' LEFT JOIN matcha.users_extended ON matcha.users.id = matcha.users_extended.user';
								query += ' LEFT JOIN matcha.users_images ON matcha.users.id = matcha.users_images.user';
								query += ' LEFT JOIN matcha.users_interests ON matcha.users.id = matcha.users_interests.user';
								query += ' LEFT JOIN matcha.users_likes ON (matcha.users.id = matcha.users_likes.liked OR matcha.users.id = matcha.users_likes.liker)';
								query += ' LEFT JOIN matcha.users_dislikes ON (matcha.users.id = matcha.users_dislikes.disliker OR matcha.users.id = matcha.users_dislikes.disliked)'
								query += ' LEFT JOIN matcha.users_blocks ON (matcha.users.id = matcha.users_blocks.blocker OR matcha.users.id = matcha.users_blocks.blocked)'
								query += ' LEFT JOIN matcha.users_visits ON (matcha.users.id = matcha.users_visits.visitor OR matcha.users.id = matcha.users_visits.visited)'
								query += ' LEFT JOIN matcha.users_reports ON matcha.users.id = matcha.users_reports.reported';
								query += ' WHERE matcha.users.username = ?';
								connection.query(query, [
									username
								], (err) => {
									if (err) {
										console.log('Failed to delete user:\n' + err.stack);
										reject('Quelque chose cloche, nous enquêtons');
									} else {
										resolve(true);
									}
								})
							}
						})
					}
				})
			} else {
				resolve('Le pseudo et le mot de passe ne correspondent pas');
			}
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
						if (results[0].status != 'Confirmed' && results[0].status != 'Complete') {
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
					reject('Une erreur est survenue lors de la mise a jour de la geolocalisation');
				} else {
					resolve({
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
	//		popularity score: [min, max],
	//		allow_dislikes: bool
	//	},
	//	fetcher = {
	//		username: username (requiered)
	//		gender: string,
	//		location: [lat, lng],
	//		id: id,
	//		interests: [tag1, tag2, tag3, ...],
	//		sort: key to order by,
	//		order: sort order ('ASC' or 'DESC')
	//	}
	fetchMembers: function fetchMembers(options, fetcher) {
		return (new Promise((resolve, reject) => {
			query = 'SELECT u.id, u.firstname, u.lastname, u.fruit, e.age, e.gender, e.bio, i.image1, ((u.lat - ?) * (u.lat - ?) + (u.lng - ?) * (u.lng - ?)) AS distance, l.llikes AS likes';
			query_values = [fetcher.location[0], fetcher.location[0], fetcher.location[1], fetcher.location[1]];
			/*
			if (typeof fetcher.interests != 'undefined' && fetcher.interests.length != 0) {
				query += ', n.*';
			}
			*/
			query += ' FROM matcha.users u INNER JOIN matcha.users_extended e ON u.id = e.user INNER JOIN matcha.users_images i ON u.id = i.user INNER JOIN matcha.users_interests no ON u.id = no.user';
			/*
			if (typeof fetcher.interests != 'undefined' && fetcher.interests.length != 0) {
				query += ' LEFT JOIN (SELECT id, user, count(name) AS interests FROM matcha.users_interests WHERE name IN (?) GROUP BY user) n ON n.user = u.id';
				query_values.push(getInterestsTab(fetcher.interests));
			}
			*/
			query += ' LEFT JOIN (SELECT liked, count(*) AS llikes FROM matcha.users_likes GROUP BY liked) l ON u.id = l.liked WHERE u.username <> ?';
			query_values.push(fetcher.username)
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
				query += ' AND no.name IN (?)';
				query_values.push(options.interests);
			}
			//use fetcher's gender
			if (typeof fetcher.gender != 'undefined') {
				let orientation;
				switch (fetcher.gender) {
					case ('Man'):
						orientation = 'Men';
						break;
					case ('Women'):
						orientation = 'Women'
						break;
					default:
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
			if (typeof options.allow_dislikes != 'undefined' && options.allow_dislikes != true) {
				query += ' EXCEPT SELECT u.id, u.firstname, u.lastname, u.fruit, e.age, e.gender, e.bio, i.image1, ((u.lat - ?) * (u.lat - ?) + (u.lng - ?) * (u.lng - ?)) AS distance, COUNT(l.liked) AS likes';
				/*
				if (typeof fetcher.interests != 'undefined' && fetcher.interests.length != 0) {
					query += ', n.*';
				}
				*/
				query += ' FROM matcha.users u INNER JOIN matcha.users_extended e ON u.id = e.user INNER JOIN matcha.users_images i ON u.id = i.user INNER JOIN matcha.users_dislikes d ON u.id = d.disliked INNER JOIN matcha.users_likes l ON u.id = l.liked INNER JOIN matcha.users_interests n ON u.id = n.user WHERE d.disliker = (SELECT id FROM matcha.users WHERE username = ?)';
				query_values.push(fetcher.location[0], fetcher.location[0], fetcher.location[1], fetcher.location[1], fetcher.username);
			}
			query += ' EXCEPT SELECT u.id, u.firstname, u.lastname, u.fruit, e.age, e.gender, e.bio, i.image1, ((u.lat - ?) * (u.lat - ?) + (u.lng - ?) * (u.lng - ?)) AS distance, COUNT(l.liked) AS likes';
			/*
			if (typeof fetcher.interests != 'undefined' && fetcher.interests.length != 0) {
				query += ', n.*';
			}
			*/
			query += ' FROM matcha.users u INNER JOIN matcha.users_extended e ON u.id = e.user INNER JOIN matcha.users_images i ON u.id = i.user INNER JOIN matcha.users_interests n ON u.id = n.user INNER JOIN matcha.users_blocks b ON u.id = b.blocked INNER JOIN matcha.users_likes l ON u.id = l.liked WHERE b.blocker = (SELECT id FROM matcha.users WHERE username = ?)';
			query_values.push(fetcher.location[0], fetcher.location[0], fetcher.location[1], fetcher.location[1], fetcher.username);
			//add sort options
			if (typeof fetcher.sort != 'undefined' && fetcher.sort != 'none' && fetcher.sort != 'interests') {
				if (fetcher.order == 'ASC') {
					query += ' ORDER BY ' + connection.escapeId(fetcher.sort) + ' ASC';
				} else {
					query += ' ORDER BY ' + connection.escapeId(fetcher.sort) + ' DESC'
				}
			}
			query += ' LIMIT ?, 5';
			query_values.push(0);
			let ret = connection.query(query, query_values, (err, results) => {
				if (err) {
					console.log(ret.sql);
					console.log(err.stack);
					reject('Failed to fetch users');
				} else {
					console.log(results)
					resolve(results);
				}
			})
		}));
	}
};