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
			reject('Undefined username or mail');
			return ;
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
				resolve (count == 0);
			}
		});
	}));
}

function validateFruit(fruit) {
	if (fruit == '#JustHangingOut') {
		return (true);
	} else if (fruit == '#BootyCall') {
		return (true);
	} else if (fruit == '#SeriousRelationship') {
		return (true);
	} else if (fruit == '#SexFriends') {
		return (true);
	} else {
		return (false);
	}
}

function checkCompleteProfile(username) {
	return (new Promise((resolve, reject) => {
		connection.query('SELECT u.id, u.username, u.firstname, u.lastname, u.fruit, u.email, u.age, u.gender, u.orientation, u.bio, i.image1 FROM matcha.users u LEFT JOIN matcha.users_images i ON u.id = i.user WHERE u.username = ?', [
			username
		], (err, result) => {
			if (err) {
				console.log('Failed to checkCompleteProfile:\n' + err.stack);
				reject('Failed to check complete profile');
			} else if (result.length > 1) {
				console.log('Failed to checkCompleteProfile:\n\tSeveral accounts with same user name');
				reject('Several accounts with same username');
			} else {
				let missing = [];
				if (result[0].id == null) {
					missing.push('User was not found');
				}
				if (result[0].username == null) {
					missing.push('Please provide Username to complete your profile')
				}
				if (result[0].firstname == null) {
					missing.push('Please provide Firstname to complete your profile');
				}
				if (result[0].lastname == null) {
					missing.push('Please provide Lastname to complete your profile');
				}
				if (result[0].fruit == null) {
					missing.push('Please provide Fruit to complete your profile');
				}
				if (result[0].email == null) {
					missing.push('Please provide E-mail to complete your profile');
				}
				if (result[0].age == null) {
					missing.push('Please provide Age to complete your profile');
				}
				if (result[0].gender == null) {
					missing.push('Please provide Gender to complete your profile');
				}
				if (result[0].orientation == null) {
					missing.push('Please provide Orientation to complete your profile');
				}
				if (result[0].bio == null) {
					missing.push('Please provide Bio to complete your profile');
				}
				if (result[0].image1 == null) {
					missing.push('Please provide Image to complete your profile');
				}
				if (missing.length === 0) {
					resolve(true);
					return ;
				}
				missing.forEach(field => {
					field = 'Please provide ' + field + ' to complete your profile';
				})
				resolve(missing);
			}
		})
	}));
}

function updateUserDb(username, data) {
	//Expects data to be safe and checked
	//update db
	return (new Promise((resolve, reject) => {
		connection.query('UPDATE matcha.users SET firstname=?, lastname=?, email=?, status=?, fruit=?, age=?, gender=?, orientation=?, bio=? WHERE username=?', [
			data['Firstname'],
			data['Lastname'],
			data['Mail'],
			data['Status'],
			data['Fruit'],
			data['Age'],
			data['Gender'],
			data['Orientation'],
			data['Bio'],
			username
		], (err, results) => {
			if (err) {
				console.log('update user failed : ' + err.stack);
				reject('Error : Failed to update user informations');
			} else if (results.affectedRows != 1) {
				resolve(['We can\'t find this account']);
				return;
			}
			checkCompleteProfile(username).then((results) => {
				if (results == true) {
					//Profile is complete
					connection.query('UPDATE matcha.users SET status=\'Complete\' WHERE username = ?', [
						username
					], (err) => {
						if (err) {
							console.log('Failed to mark profile as complete:\n' + err.stack);
							reject('Failed to mark profile as complete');
						} else {
							if (data['Password'] != undefined && data['Password'] != "") {
								resolve(['You can\'t update both e-mail and password']);
								return ;
							}
							resolve(true);
							return ;
						}
					});
				} else {
					resolve(results);
					return ;
				}
			}).catch((reason) => {
				console.log('Failed to checkCompleteProfile');
				reject('Error : Failed to markprofile as complete')
			});
		});
	}));
}

function digestInterests(username, interests) {
	connection.query('SELECT id FROM matcha.users WHERE username = ?', [
		username
	], (err, result) => {
		if (err) {
			console.log('Failed to get user id');
			console.log(err.stack);
		}
		let userid = result[0].id;
		//remove all user's, interests
		connection.query("DELETE FROM matcha.users_interests WHERE user = ?", [
			userid
		], (err) => {
			if (err) {
				console.log('Error : Failed to erase user\'s interests');
				console.log(err.stack);
				return (false);
			}
			interests.forEach(interest => {
			//search if interest already exists
				connection.query("SELECT id FROM matcha.list_interests WHERE name=?;", [
					interest,
				], (err, result) => {
					if (err) {
						console.log('Error : Failed to search interest in list');
						console.log(err.stack);
						return ;;
					}
					if (result.length === 0) {
						//Insert new interest
						connection.query("INSERT INTO matcha.list_interests (name) VALUES (?)", [
							interest
						], (err, result) => {
							if (err) {
								console.log('Failed to insert new interest');
								console.log(err.stack);
								return ;
							}
							connection.query("INSERT INTO matcha.users_interests (interest, user) VALUES (?, ?)", [
								result.insertId,
								userid
							], (err) => {
								if (err) {
									console.log("Failed to insert new user for interest");
									console.log(err.stack);
									return ;
								}
							});
						});
					} else {
						connection.query("INSERT INTO matcha.users_interests (interest, user) VALUES (?, ?)", [
							result[0].id,
							userid
						], (err) => {
							if (err) {
								console.log("Failed to insert new user for interest");
								console.log(err.stack);
								return ;
							}
						});
					}
				})
			});
		});
	})
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

function sendAccountCreationMail (username, mail, id) {
	return (new Promise((resolve, reject) => {
		if (username == undefined || mail == undefined || id == undefined) {
			reject ('Missing data');
		}
		let mail_options = {
			from: '"Matcha users" ' + servermail.address,
			to: mail,
			subject: 'Welcome !',
			html: 'You just registered for a new account.<br />'
				+ 'Please <a href=\'http://' + server.name + ':' + server.port + '/signup?token=' + id + '&user=' + username + '\'>confirm</a> the creation of your account.'
		}
		transporter.sendMail(mail_options, (err) => {
			if (err) {
				console.log(err);
				reject('Failed to send registration mail');
			}
			resolve (true);
		});
	}));
}

function sendNewMailConfirmation (username, mail, id) {
	return (new Promise((resolve, reject) => {
		if (username == undefined || mail == undefined || id == undefined) {
			reject ('Missing data');
		}
		let mail_options = {
			from: '"Matcha users" ' + servermail.address,
			to: mail,
			subject: 'New mail',
			html: 'You just updated your mail address.<br />'
				+ 'Please <a href=\'http://' + server.name + ':' + server.port + '/signup?token=' + id + '&user=' + username + '\'>confirm</a> that change.'
		}
		transporter.sendMail(mail_options, (err) => {
			if (err) {
				console.log(err);
				reject('Failed to send new mail');
			}
			resolve (true);
		});
	}));
}

function endFetchMembersQuery(connection, query, query_values, fetcher) {
	return (new Promise((resolve, reject) => {
		query += ' GROUP BY u.id, i.image1';
		//add sort options
		if (typeof fetcher.sort != 'undefined' && fetcher.sort != 'none') {
			if (fetcher.order == 'ASC') {
				query += ' ORDER BY ' + connection.escapeId(fetcher.sort) + ' ASC';
			} else {
				query += ' ORDER BY ' + connection.escapeId(fetcher.sort) + ' DESC'
			}
		}
		console.log(fetcher.sort);
		query += ' LIMIT ?, 5';
		query_values.push(0);
		let ret = connection.query(query, query_values, (err, results) => {
			if (err) {
				console.log(ret.sql);
				console.log(err.stack);
				reject('Failed to fetch users');
			} else {
				resolve(results);
			}
		});
	}))
}

function endMatchAlgo(connection, query, query_values) {
	return (new Promise((resolve, reject) => {
		//sort by commun interests
		query += ' GROUP BY u.id, i.image1 ORDER BY common_interests LIMIT ?, 5';
		query_values.push(0);
		let ret = connection.query(query, query_values, (err, results) => {
			if (err) {
				console.log(ret.sql);
				console.log(err.stack);
				reject('Failed to fetch users');
			} else {
				resolve(results);
			}
		});
	}))
}

module.exports = {
	checkDataConsistency: function checkDataConsistency(data, strict = false) {
		let errors = [];
		if (typeof data !== 'object') {
			errors.push('No data');
			return (errors);
		}
		if (data['Username'] !== undefined && (!strict || data['Username'] != '')) {
			if (data['Username'] === null || data['Username'].length < 3 || data['Username'].length > 100) {
				errors.push('Username must contain between 3 and 100 characters');
			}
		}
		if (data['Firstname'] !== undefined && (!strict || data['Firstname'] != '')) {
			if (data['Firstname'] === null || data['Firstname'].length < 1 || data['Firstname'].length > 100) {
				errors.push('Firstname must contain between 1 and 100 characters');
			}
		}
		if (data['Lastname'] !== undefined && (!strict || data['Lastname'] != '')) {
			if (data['Lastname'] === null || data['Lastname'].length < 1 || data['Lastname'].length > 100) {
				errors.push('Lastname must contain between 1 and 100 characters');
			}
		}
		if (data['Password'] !== undefined && (!strict || data['Password'] != '')) {
			if (validatePassword(data['Password']) !== true) {
				errors.push('Password must contain at least 9 characters, lower and upper case characters, and digits');
			}
		}
		if (data['Mail'] !== undefined && (!strict || data['Mail'] != '')) {
			if (validateMail(data['Mail']) !== true) {
				errors.push('Mail must be a valid address');
			}
		}
		if (data['Fruit'] !== undefined && (!strict || data['Fruit'] != '')) {
			if (validateFruit(data['Fruit']) !== true) {
				errors.push('Choose a fruit !');
			}
		}
		// if (data['Age'] !== undefined && (!strict || data['Age'] != '')) {
		// 	if (parseInt(data['Age']) != data['Age'] || data['Age'] < 18 || data['Age'] > 77) {
		// 		errors.push('Age must be a number between 18 and 77');
		// 	}
		// }
		// if (data['Gender'] !== undefined && (!strict || data['Gender']))
		if (errors.length === 0) {
			return (true);
		}
		return (errors);
	},
	//	createUser returns :
	//		On error, a formated string <error_level> : <message>
	//		On succes : true
	//		On failure : An array of errors
	createUser: function createUser(username, lastname, firstname, mail, password, fruit) {
		return (new Promise((resolve, reject) => {
			//Check parameters consistancy
			let errors = this.checkDataConsistency({
				Username: username,
				Lastname: lastname,
				Firstname: firstname,
				Mail: mail,
				Password: password,
				Fruit: fruit
			});
			if (errors !== true) {
				resolve(errors);
			}
			//Check if Username and mail are not already used
			is_member_unique(username, mail).then((res) => {
				if (res == true) {
					//Hash password
					bcrypt.hash(password, 10, (err, hash) => {
						if (err) {
							console.log('Bcrypt failed to serve hash : ' + err.stack);
							reject(['Failed to serve Password']);
						} else {
							//Send mail
							id = uniqid();
							sendAccountCreationMail(username, mail, id).then(
								(res) => {
									if (res !== true) {
										reject([res]);
									}
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
											resolve(true);
										}
									});
								}
							).catch(
								(reason) => {
									console.log(reason);
									reject('Failed to send confirmation mail');
								}
							)
						}
					});
				} else {
					resolve(['Le pseudo et l\'adresse e-mail doivent être uniques.']);
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
	updateUser: function updateUser(username, data) {
		return (new Promise((resolve, reject) => {
			//Check parameters consistancy
			let errors = this.checkDataConsistency(data, true);
			if (errors !== true) {
				resolve(errors);
			}
			//Get user info
			this.getUserInfos(username).then((results) => {
				if (results === false) {
					resolve(["We can\'t find this account"]);
					return;
				} else {
					//Replace with new if existing
					if (typeof data['Firstname'] != 'undefined' && data['Firstname'] != "") {
						results.firstname = data['Firstname'];
					}
					if (typeof data['Lastname'] != 'undefined' && data['Lastname'] != "") {
						results.lastname = data['Lastname'];
					}
					if (typeof data['Fruit'] != 'undefined' && data['Fruit'] != "") {
						results.fruit = data['Fruit'];
					}
					if (typeof data['Age'] != 'undefined' && data['Age'] != "") {
						results.age = data['Age'];
					}
					if (data['Gender'] != undefined && data['Gender'] != "") {
						results.gender = data['Gender'];
					}
					if (data['Orientation'] != undefined && data['Orientation'] != "") {
						results.gender = data['Orientation'];
					}
					if (data['Bio'] != undefined && data['Bio'] != "") {
						results.gender = data['Bio'];
						digestInterests(username, getInterestsTab(data['Bio']));
					}
					if (typeof data['Mail'] != 'undefined' && data['Mail'] != "" && data['Mail'] != results.email) {
						if (validateMail(data['Mail']) !== true) {
							resolve(['This must be a valid e-ail address : ' + data['Mail']]);
							return;
						}
						//Send mail to new address
						id = uniqid();
						sendNewMailConfirmation(username, mail, id).then((result) => {
							updateUserDb(username, data).then((result) => {
								resolve(result);
							}).catch((reason) => {
								console.log('Failed to update User: ' + reason);
								reject('Failed to update user');
							});
						}).catch((reason) => {
							console.log(reason);
							reject('Failed to send new mail confirmation');
						});
					}
					else if (typeof data['Password'] != 'undefined' && data['Password'] != "") {
						bcrypt.hash(data['Password'], 10, (err, hash) => {
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
									updateUserDb(username, data).then((result) => {
										resolve(result);
									}).catch((reason) => {
										console.log('Failed to update User: ' + reason);
										reject('Failed to update user');
									});
								});
							}
						});
					} else {
						updateUserDb(username, data).then((result) => {
							resolve(result);
						}).catch((reason) => {
							console.log('Failed to update user: ' + reason);
							reject('Failed to update user');
						});
					}
				}
			}).catch((reason) => {
				console.log(reason);
				reject('Error : Failed to get User infos')
			});
		}));
	},
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
			connection.query('SELECT u.id, u.username, u.fruit, u.lat, u.lng, u.orientation, u.gender, u.age, u.lat, u.lng, n.interest FROM matcha.users u RIGHT JOIN matcha.users_interests n ON n.user = u.id WHERE u.username = ?', [
				username
			], (err, result) => {
				if (err) {
					console.log('Failed to getUserMatchProfile :\n' + err.stack);
					reject('An error occured while querying database');
				} else {
					let profile = result[0];
					profile.interests = [];
					result.forEach(entry => {
						profile.interests.push(entry.interest);
					})
					resolve(profile);
				}
			});
		}));
	},
	//searchInterest return an array of users having one interest in terms
	//	It expects terms to be a string with interests tags
	searchInterest: function searchInterest(terms) {
		return (new Promise((resolve, reject) => {
			//Parse string
			let interests = getInterestsTab(terms);
			//Search
			connection.query('SELECT u.id, u.username, u.firstname, u.lastname, u.fruit, u.lat, u.lng, u.age, u.gender, u.orientation, u.bio, i.image1 FROM matcha.users u INNER JOIN matcha.users_interests n ON u.id = n.user INNER JOIN matcha.list_interests l ON l.id = n.interest INNER JOIN matcha.users_images i ON u.id = i.user WHERE l.name IN (?) LIMIT 0, 5', [
				interests
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
			name = '%' + name + '%';
			connection.query('SELECT u.id, u.username, u.firstname, u.lastname, u.fruit, u.lat, u.lng, u.age, u.gender, u.orientation, u.bio, i.image1 FROM matcha.users u INNER JOIN matcha.users_images i ON u.id = i.user WHERE username LIKE ? OR firstname LIKE ? OR lastname LIKE ?', [
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
			connection.query('SELECT u.id, u.username, u.lastname, u.firstname, u.fruit, u.lat, u.lng, u.gender, u.orientation, u.age, u.bio, i.image1, i.image2, i.image3, i.image4, i.image5, (SELECT COUNT(*) FROM matcha.users_likes WHERE liked = ?) AS likes, (SELECT COUNT(*) FROM matcha.users_visits WHERE visited = ?) AS visits, (SELECT COUNT(*) FROM matcha.users_likes l INNER JOIN matcha.users u ON u.username = ? WHERE l.liked = ?) AS liked FROM matcha.users u INNER JOIN matcha.users_images i ON u.id = i.user WHERE u.id = ?', [
				userid,
				userid,
				visitor,
				userid,
				userid
			], (err, results) => {
				if (err) {
					console.log('Failed to getUserFullProfile :\n' + err.stack);
					reject('Something is wrong, we are trying to solve it');
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
	//On error : error message
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
			connection.query('SELECT DISTINCT u.id, u.lastname, u.firstname, u.fruit, u.lat, u.lng, u.gender, u.bio, u.age, i.image1 FROM matcha.users u INNER JOIN matcha.users_images i ON u.id = i.user INNER JOIN matcha.users_likes l ON u.id = l.liker WHERE u.id IN (SELECT l.liked FROM matcha.users_likes l INNER JOIN matcha.users u ON u.id = l.liker WHERE u.username = ?)', [
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
			connection.query('SELECT u.id, u.lastname, u.firstname, u.fruit, u.gender, u.age, u.lat, u.lng, u.bio, i.image1 FROM matcha.users_likes l INNER JOIN matcha.users u ON u.id = l.liked INNER JOIN matcha.users_images i ON u.id = i.user WHERE l.liker = (SELECT id FROM matcha.users WHERE username = ?) ORDER BY u.id DESC LIMIT 10;', [
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
			connection.query('SELECT u.id, u.firstname, u.lastname, u.fruit, u.lat, u.lng, u.gender, u.age, u.bio, i.image1 FROM matcha.users_likes l INNER JOIN matcha.users u ON u.id = l.liker INNER JOIN matcha.users_images i ON u.id = i.user WHERE l.liked = (SELECT id FROM matcha.users WHERE username = ?) ORDER BY u.id DESC LIMIT 10;', [
				username
			], (err, results) => {
				if (err) {
					console.log(err.stack);
					reject('Failed to getProfilesLiekedUser');
				} else {
					resolve(results);
				}
			})
		}))
	},
	addUserImage: function addUserImage(username, image_path) {
		return (new Promise((resolve, reject) => {
			this.getUserImages(username).then((results) => {
				if (typeof results == 'undefined' || typeof results.id == 'undefined') {
					reject('We can\'t fing this account');
				} else if (results.image1 == null) {
					//Insert new picture'
					connection.query('INSERT INTO matcha.users_images (user, image1) VALUES (?, ?);', [
						results.id,
						image_path
					], (err) => {
						if (err) {
							console.log(err.stack);
							reject('Something is wrong, we are trying to solve it');
						} else {
							checkCompleteProfile(username).then((result) => {
								if (result === true) {
									connection.query('UPDATE matcha.users SET status=\'Complete\' WHERE username = ?', [
										username
									], (err) => {
										if (err) {
											console.log('Failed to mark profile as complete:\n' + err.stack);
											reject('Failed to mark profile as complete');
										} else {
											resolve(true);
										}
									});
								} else {
									resolve(result);
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
						resolve(['Vous avez atteint le nombre maximun d\'images, veuillez en supprimer']);
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
									if (result === true) {
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
										resolve(result);
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
				resolve(['Password must contain at least 8 characters, lower and upper case characters, and digits']);
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
							reject('Something went wrong, we are trying to solve it');
						} else {
							resolve(true);
						}
					});
				}
			});
		}));
	},
	countNotifications: function countNotifications(userid) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT COUNT(*) AS count FROM matcha.users_notifications WHERE user = ? AND seen = \'0\'', [
				userid
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
	countMessages: function countMessages(userid) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT COUNT(*) AS count FROM matcha.users_messages WHERE dest = ? AND seen = \'0\'', [
				userid
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
	getNotifications: function getNotifications(userid) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT user, title, body FROM matcha.users_notifications WHERE user = ? AND seen = \'0\' ORDER BY time DESC LIMIT 10', [
				userid
			], (err, results) => {
				if (err) {
					console.log('SQL Error:\n' + err.stack);
					reject('SQL Error');
				} else {
					connection.query('UPDATE matcha.users_notifications SET seen = \'1\' WHERE user = ?', [
						userid
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
	getMessages: function getMessages(userid) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT m.id, u.username AS author, m.body, m.time FROM matcha.users_messages m INNER JOIN matcha.users u ON u.id = m.author WHERE m.dest = ? AND m.seen = \'0\' ORDER BY m.time DESC LIMIT 10', [
				userid
			], (err, results) => {
				if (err) {
					console.log('Failed to getMessages:\n' + err.stack);
					reject('Failed to get Messages');
				} else {
					connection.query('UPDATE matcha.users_messages SET seen = \'1\' WHERE dest = ?', [
						userid
					], (err) => {
						if (err) {
							console.log('SQL Error:\n' + err.stack);
						}
					});
					resolve(results);
				}
			})
		}))
	},
	getDiscution: function getDiscution(userid, author) {
		return (new Promise((resolve, reject) => {
			connection.query('SELECT id, author, body, time FROM matcha.users_messages WHERE (dest=? AND author=?) OR (dest=? AND author=?) ORDER BY time ASC LIMIT 30', [
				userid,
				author,
				author,
				userid
			], (err, results) => {
				if (err) {
					console.log('Failed to getMessages:\n' + err.stack);
					reject('Failed to get Messages');
				} else {
					connection.query('UPDATE matcha.users_messages SET seen = \'1\' WHERE dest = ? AND author=?', [
						userid,
						author
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
				resolve(['E-mail address a not valid']);
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
					resolve(['We can\'t find this account']);
				}
			});
			let mail_options = {
				from: '"Matcha users" ' + servermail.address,
				to: mail,
				subject: 'New Password ?',
				html: 'You asked to change your password.<br />'
					+ 'Click <a href=\'http://' + server.name + '/recover?token=' + id + '&user=' + username + '\'>here</a> to reset it'
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
						reject('Something is wrong, we are trying to solve it');
					} else if (result.length <= 0) {
						resolve('Username and Password don\'t match');
					} else {
						bcrypt.compare(password, result[0]['password'], (err, res) => {
							if (err) {
								console.log('Failed to compare passwords:\n' + err.stack);
								reject('Something is wrong, we are trying to solve it');
							} else if (res != true) {
								resolve('Username and Password don\'t match');
							} else {
								let query = 'DELETE matcha.users, matcha.users_images, matcha.users_interests, matcha.users_likes, matcha.users_dislikes, matcha.users_blocks, matcha.users_visits, matcha.users_reports FROM matcha.users';
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
										reject('Something is wrong, we are trying to solve it');
									} else {
										resolve(true);
									}
								})
							}
						})
					}
				})
			} else {
				resolve('Username and Password don\'t match');
			}
		}));
	},
	logg_user: function logg_user(username, password) {
		return (new Promise((resolve, reject) => {
			if (username && password) {
				connection.query('SELECT id, username, password, status, lat, lng FROM matcha.users WHERE username = ?', [
					username
				], function (error, results) {
					if (error) {
						console.log(error.stack);
						reject('Failed to connect member');
					}
					if (results != undefined && results.length > 0) {
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
			query = 'SELECT u.id, u.firstname, u.lastname, u.fruit, u.age, u.gender, u.bio, i.image1, ((u.lat - ?) * (u.lat - ?) + (u.lng - ?) * (u.lng - ?)) AS distance, l.llikes AS likes, COUNT(u.id) AS common_interests';
			query_values = [fetcher.location[0], fetcher.location[0], fetcher.location[1], fetcher.location[1]];
			if (fetcher.id !== undefined) {
				query += ' FROM matcha.users u INNER JOIN matcha.users_images i ON u.id = i.user INNER JOIN matcha.users_interests no ON u.id = no.user LEFT JOIN matcha.users_blocks b ON b.blocker <> ?';
				query_values.push(fetcher.id);
			}
			query += ' LEFT JOIN (SELECT liked, count(*) AS llikes FROM matcha.users_likes GROUP BY liked) l ON u.id = l.liked WHERE u.username <> ?';
			query_values.push(fetcher.username)
			//use age
			if (typeof options.age != 'undefined') {
				query += ' AND u.age BETWEEN ? and ?';
				query_values.push(options.age[0], options.age[1]);
			}
			//use gender
			if (typeof options.gender != 'undefined' && typeof fetcher.orientation == 'undefined') {
				if (typeof options.gender != 'undefined' && (options.gender == 'Man' || options.gender == 'Woman')) {
					query += ' AND gender = ?';
					query_values.push(options.gender);
				}
			}
			//use distance
			if (typeof options.distance != 'undefined' && typeof fetcher.location != 'undefined' && fetcher.location.length === 2 && typeof fetcher.location[0] !== undefined && fetcher.location[1] !== undefined) {
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
			if (typeof options.interests != 'undefined' && options.interests != [] && options.interests != "") {
				//Get array of ids
				connection.query('SELECT id FROM matcha.list_interests WHERE name IN (?)', [
					options.interests
				], (err, result) => {
					if (err) {
						console.log(err.stack);
						reject('Failed to get interests ids');
						return ;
					}
					result = result.map(x => x.id);
					query += ' AND no.interest IN (?)';
					query_values.push(result);
					endFetchMembersQuery(connection, query, query_values, fetcher).then((result) => {
						resolve(result);
					}).catch((reason) => {
						reject(reason);
					});
				})
			} else {
				endFetchMembersQuery(connection, query, query_values, fetcher).then((result) => {
					resolve(result);
				}).catch((reason) => {
					reject(reason);
				});
			}
		}));
	},
	// runAlgo will find profiles that may match with user.
	//		user is expected to be outputed from getUserMatchProfile
	runMatchAlgo: function runMatchAlgo (user) {
		return (new Promise((resolve, reject) => {
			//Data we need to fetch
			query = 'SELECT u.id, u.firstname, u.lastname, u.fruit, u.age, u.gender, u.bio, i.image1, ((u.lat - ?) * (u.lat - ?) + (u.lng - ?) * (u.lng - ?)) AS distance, l.llikes AS likes, COUNT(u.id) AS common_interests';
			query_values = [user.lat, user.lat, user.lng, user.lng];
			//Apply joins and remove liked, disliked and blocked users
			query += ' FROM matcha.users u INNER JOIN matcha.users_images i ON u.id = i.user LEFT JOIN matcha.users_interests no ON u.id = no.user LEFT JOIN matcha.users_blocks b ON b.blocked=u.id LEFT JOIN matcha.users_dislikes d ON d.disliked = u.id LEFT JOIN matcha.users_likes li ON li.liked = u.id';
			query += ' LEFT JOIN (SELECT liked, count(*) AS llikes FROM matcha.users_likes GROUP BY liked) l ON u.id = l.liked';
			query += ' WHERE u.id <> ?';
			query_values.push(user.id);
			query += ' AND (d.disliker IS NULL OR d.disliker <> ?) AND (b.blocker IS NULL OR b.blocker <> ?) AND (li.liker IS NULL OR li.liker <> ?)';
			query_values.push(user.id, user.id, user.id);
			//use age
			query += ' AND u.age BETWEEN ? and ?';
			query_values.push(user.age - 5, user.age + 5);
			//use distance
			let dpos = 1000 / (2 * 3.14 * 6400) * 360;
			query += ' AND u.lat BETWEEN ? AND ? AND u.lng BETWEEN ? AND ?';
			query_values.push(user.lat - dpos, user.lat + dpos, user.lng - dpos, user.lng + dpos);
			//use gender
			let orientation;
			switch (user.gender) {
				case ('Man'):
					orientation = 'Men';
					break;
				case ('Woman'):
					orientation = 'Women'
					break;
				case ('Both'):
					orientation = 'Trans';
					break;
				default:
					orientation = 'Both'
					break;
			}
			query += ' AND (orientation = ? OR orientation = \'Both\')';
			query_values.push(orientation);
			//use orientation
			if (user.orientation == 'Men') {
				query += ' AND gender = ?';
				query_values.push('Man');
			} else if (user.orientation == 'Women') {
				query += ' AND gender = ?';
				query_values.push('Woman');
			} else if (user.orientation == 'Trans') {
				query += ' AND gender = ?';
				query_values.push('Both');
			}
			//use interests
			query += ' AND no.interest IN (?)';
			query_values.push(user.interests);
			endMatchAlgo(connection, query, query_values).then((result) => {
				resolve(result);
			}).catch((reason) => {
				reject(reason);
			});
		}))
	}
};