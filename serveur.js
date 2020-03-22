var express = require('express');
var session = require('express-session');
var fileUpload = require('express-fileupload');
var csrf = require('csurf');
var settings = require("./server_settings.json");
var memberManager = require("./memberManager.js");
var imageChecker = require("./imageChecker.js");
var locationFinder = require("./locationFinder.js");

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

io.on('connection', (socket) => {
	socket.on('disconnect', function () {
		io.sockets.emit('logged', {
			logged: false,
			user: socket.username
		});
		socket.leave(socket.username);
	});

	socket.on('message', (message) => {
		io.sockets.in(socket.room).emit('message', {
			author: message.author,
			dest: message.dest,
			title: message.title,
			body: escapeHtml(message.body).slice(0, 200)
		});
	});

	socket.on('new_message', (message) => {
		memberManager.newMessage(message).then((result) => {
			memberManager.getUserName(message.dest).then((result) => {
				io.sockets.in(result).emit('new_message', {
					author: message.author,
					dest: message.dest,
					title: message.title,
					body: escapeHtml(message.body).slice(0, 200)
				});
			}).catch((reason) => {
				console.error('Failed to get dest name: ' + reason);
			})
		}).catch((reason) => {
			console.error('Failed to store new message:\n\t' + reason);
		})
	})

	//User joined chat room
	socket.on('create', (user) => {
		socket.join(user.room);
		socket.room = user.room;
		io.sockets.in(user.room).emit('join', user.username + ' entered the room')
	});

	//User login on matcha
	socket.on('login', (userid) => {
		socket.join(userid);
		socket.username = userid;
		socket.notif_room = userid;
		io.sockets.emit('logged', {
			logged: true,
			user: userid
		})
	})

	socket.on('is_logged', (user) => {
		let i = Object.values(io.sockets.sockets);
		for (const temp of i) {
			if (temp.rooms[user] == user) {
				socket.emit('logged', {
					logged: true,
					user: user
				})
				return ;
			}
		}
	});
})

//requiered to retrieve x-www-form-encoded in req.body
app.use(express.urlencoded({ extended: true }));

//requiered to serve static files (stylesheets, images, ...)
app.use(express.static('resources'));

//requiered for session usage
app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));
//requiered for file upload
app.use(fileUpload());

//Session notfications and errors
var errors = [];
var notifs = [];
app.use((req, res, next) => {
	if (req.session.errors) {
		errors = req.session.errors;
		req.session.errors = [];
	} else {
		errors = null;
		req.session.errors = [];
	}
	if (req.session.notifs) {
		notifs = req.session.notifs;
		req.session.notifs = [];
	} else {
		notifs = [];
		req.session.notifs = [];
	}
	next();
});

//Response status handler
app.use((req, res, next) => {
	switch (req.status) {
		case (401):
			req.session.errors.push('You must sign in with a valid account');
			break;
		case (500):
			req.session.notifs.push('Something is wrong, we are trying to solve it');
			break;
		default:
			break;
	}
	next();
});

//requiered to use csrf protection
const csrfProtection = csrf();
//require authentication
const requireAuth = (req, res, next) => {
	//Check user has account
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result === true) {
			next();
		} else {
			res.redirect(401, '/login');
		}
	}).catch((reason) => {
		console.error('Failed to check user auth: ' + reason);
		res.redirect(500, '/');
	});
}

const requireAuthAJAX = (req, res, next) => {
	//Check user has account
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result === true) {
			next();
		} else {
			res.status(401).end();
		}
	}).catch((reason) => {
		console.log('Failed to check user auth: ' + reason);
		res.status(500).end();
	});
}

const requireCompleteAccount = (req, res, next) => {
	//Check user has full profile
	memberManager.checkAuthorization(req.session.username, ['Complete']).then((result) => {
		if (result === true) {
			next();
		} else {
			res.redirect(401, '/login');
		}
	}).catch((reason) => {
		console.log('Failed to check user auth: ' + reason);
		res.redirect(500, '/');
	});
}

const requireCompleteAccountAJAX = (req, res, next) => {
	//Check user has full profile
	memberManager.checkAuthorization(req.session.username, ['Complete']).then((result) => {
		if (result === true) {
			next();
		} else {
			res.status(401).end();
		}
	}).catch((reason) => {
		console.log('Failed to check user auth: ' + reason);
		res.status(500).end();
	});
}

const checkAuth = (auth, ajax = false) => {
	if (auth === 'Complete' && !ajax) {
		return (requireCompleteAccount);
	} else if (auth === 'Complete' && ajax) {
		return (requireCompleteAccountAJAX);
	} else if (ajax) {
		return (requireAuthAJAX);
	} else {
		return (requireAuth);
	}
}

function getIntersetsTab(interests) {
	var tab = [];
	let regex = new RegExp("#[A-Za-z0-9]+", "g");
	let match;
	while ((match = regex.exec(interests)) != null) {
		tab.push(match[0]);
	}
	return (tab);
}

function escapeHtml(text) {
	var map = {
	  '&': '&amp;',
	  '<': '&lt;',
	  '>': '&gt;',
	  '"': '&quot;',
	  "'": '&#039;'
	};
  
	return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

app.get('/home', [csrfProtection, checkAuth()], (req, res) => {
	memberManager.getUserImages(req.session.username).then((images) => {
		memberManager.getUserInfos(req.session.username).then((user_info) => {
			memberManager.getUserLikedProfiles(req.session.username).then((profiles) => {
				res.render('home.ejs', {
					user: req.session.username,
					userid: req.session.userid,
					errors: errors,
					notifs: notifs,
					user_info: user_info,
					images: images,
					profiles: profiles,
					just_logged: req.session.just_logged,
					csrfToken: req.csrfToken()
				});
				req.session.just_logged = false;
			}).catch((reason) => {
				res.render('home.ejs', {
					user: req.session.username,
					userid: req.session.userid,
					errors: errors,
					notifs: notifs,
					user_info: user_info,
					images: images,
					just_logged: req.session.just_logged,
					csrfToken: req.csrfToken()
				});
				req.session.just_logged = false;
			});
		}).catch((reason) => {
			console.log('Failed to load user infos: ' + reason);
			res.render('home.ejs', {
				user: req.session.username,
				userid: req.session.userid,
				errors: ['We can\'t find your profile'],
				notifs: notifs,
				images: images,
				just_logged: req.session.just_logged,
				csrfToken: req.csrfToken()
			});
			req.session.just_logged = false;
		});
	}).catch((reason) => {
		console.log(reason);
		res.render('home.ejs', {
			user: req.session.username,
			userid: req.session.userid,
			errors: ['Vos photos sont introuvables'],
			notifs: notifs,
			just_logged: req.session.just_logged,
			csrfToken: req.csrfToken()
		});
		req.session.just_logged = false;
	});
});

app.get('/', csrfProtection, (req, res) => {
	if (typeof req.session.username != 'undefined') {
		memberManager.getProfilesLikesUser(req.session.username).then((results) => {
			memberManager.getUserMatchs(req.session.username).then((matchs) => {
				results = results.filter((user) => {
					return (matchs.includes(user));
				})
				res.render('index.ejs', {
					user: req.session.username,
					userid: req.session.userid,
					errors: errors,
					notifs: notifs,
					profiles: results,
					matchs: matchs,
					csrfToken: req.csrfToken()
				})
			}).catch((reason) => {
				console.log('Failed to getUserMatchs: ' + reason);
				res.render('index.ejs', {
					user: req.session.username,
					userid: req.session.userid,
					errors: errors,
					notifs: notifs,
					profiles: results,
					csrfToken: req.csrfToken()
				})
			})
		}).catch((reason) => {
			console.log('Failed to getProfilesLikedUser:\n' + reason);
			res.render('index.ejs', {
				user: req.session.username,
				userid: req.session.userid,
				errors: ['Something is wrong, we are trying to solve it'],
				notifs: notifs,
				csrfToken: req.csrfToken()
			})
		})
	} else {
		res.render('index.ejs', {
			errors: errors,
			notifs: notifs,
			user: req.session.username,
			csrfToken: req.csrfToken()
		});
	}
});

app.get('/chat/:id', checkAuth('Complete'), (req, res) => {
	memberManager.checkMatch(req.session.username, req.params.id).then((result) => {
		if (result == true) {
			if (req.params.id < req.session.userid) {
				var room = req.params.id + '-' + req.session.userid;
			} else {
				var room = req.session.userid + '-' + req.params.id;
			}
			memberManager.getUserName(req.params.id).then((name) => {
				res.render('chat.ejs', {
					user: req.session.username,
					userid: req.session.userid,
					errors: errors,
					notifs: notifs,
					room: room,
					dest: req.params.id,
					destname: name
				});
			}).catch(() => {
				res.render('chat.ejs', {
					user: req.session.username,
					userid: req.session.userid,
					errors: ['We couldn\'t get Username of the reciever'],
					notifs: notifs,
					room: room,
					dest: req.params.id,
					destname: 'Reciever'
				});
			})
		} else {
			req.session.errors.push('You can\'t talk to that person');
			res.redirect(403, '/');
			return ;
		}
	}).catch((reason) => {
		console.log('Failed to checkMatchs:\n' + reason);
		res.redirect(500, '/');
		return ;
	});
});

//AJAX Call
app.get('/count_messages', checkAuth(null, true), (req, res) => {
	memberManager.countMessages(req.session.userid).then((result) => {
		res.status(200).json({
			Data: result['count']
		});
	}).catch(() => {
		res.status(500).end();
	})
})

//AJAX Call
app.get('/count_notifications', checkAuth(null, true), (req, res) => {
	memberManager.countNotifications(req.session.userid).then((result) => {
		res.status(200).json({
			'Data': result['count']
		});
	}).catch(() => {
		res.status(500).end();
	})
})

//AJAX Call
app.get('/get_messages', checkAuth(null, true), (req, res) => {
 	memberManager.getMessages(req.session.userid).then((results) => {
 		res.status(200).json({
			'Data': results
		});
 	}).catch(() => {
 		res.status(500).end();
 	})
});

//AJAX Call
app.get('/get_discution/:id', checkAuth(null, true), (req, res) => {
	memberManager.getDiscution(req.session.userid, req.params.id).then((result) => {
		res.status(200).json({
			'Data': result
		});
	}).catch(() => {
		res.status(500).end();
	})
})

//AJAX Call
app.get('/get_notifications', checkAuth(null, true), (req, res) => {
	memberManager.getNotifications(req.session.userid).then((results) => {
		res.status(200).json({
			'Data': results
		});
	}).catch(() => {
		res.status(500).end();
	})
})

//AJAX Call
app.get('/get_address/:lat/:lng', checkAuth(null, true), (req, res) => {
	locationFinder.getLocationFromLatLng(req.params.lat, req.params.lng).then((results) => {
		if (results != false && results != 'Not found') {
			res.status(200).json({
				'Data': results
			});
		} else {
			res.status(200).json({
				'Data': {found: 0}
			});
		}
	}).catch((reason) => {
		console.error(reason);
		res.json({
			'Data': {found: 0}
		});
	})
})

app.get('/match', checkAuth('Complete'), (req, res) => {
	memberManager.getUserMatchProfile(req.session.username).then((user_profile) => {
		if (user_profile.lat == null || user_profile.lng == null) {
			locationFinder.getLatLngFromIp().then((location) => {
				user_profile.lat = location.lat;
				user_profile.lng = location.lng;
				memberManager.runMatchAlgo(user_profile).then((results) => {
					res.render('match.ejs', {
						user: req.session.username,
						userid: req.session.userid,
						errors: errors,
						notifs: notifs,
						matchs: results,
						location: location
					});
				}).catch((reason) => {
					console.log('An error occurred while fething db: ' + reason);
					res.redirect(500, '/');
				});
			}).catch((reason) => {
				console.log(reason);
				req.session.errors.push('Please tell us where you are before looking for matches');
				res.redirect(200, '/home');
			});
		} else {
			memberManager.runMatchAlgo(user_profile).then((results) => {
				res.render('match.ejs', {
					user: req.session.username,
					userid: req.session.userid,
					errors: errors,
					notifs: notifs,
					matchs: results,
					location: {lat: user_profile.lat, lng: user_profile.lng},
				});
			}).catch((reason) => {
				console.log('An error occurred while fething db: ' + reason);
				res.redirect(500, '/');
			});
		}
	}).catch((reason) => {
		console.log('Failed to get User Match Profile: ' + reason);
		res.redirect(500, '/');
	});
});

app.get('/login', csrfProtection, (req, res) => {
	res.render('login.ejs', {
		user: req.session.username,
		userid: req.session.userid,
		errors: errors,
		notifs: notifs,
		csrfToken: req.csrfToken()
	});
});

app.post('/login', csrfProtection, (req, res) => {
	memberManager.logg_user(req.body.username, req.body.password).then((result) => {
		if (result !== false) {
			req.session.username = result.username;
			req.session.userid = result.id;
			req.session.lat = result.lat;
			req.session.lng = result.lng;
			//User didn't give address
			if (req.session.lat == null || req.session.lng == null) {
				locationFinder.getLatLngFromIp().then((result) => {
					if (result != false) {
						req.session.lat = result.lat;
						req.session.lng = result.lng;
						req.session.notifs.push('Welcome ' + req.session.username + " !");
						req.session.just_logged = true;
						res.redirect('/home');
					}
				}).catch((reason) => {
					console.log(reason);
					req.session.notifs.push('Welcome ' + req.session.username + " !");
					res.redirect('/home');
				})
			} else {
				req.session.notifs.push('Welcome ' + req.session.username + " !");
				req.session.just_logged = true;
				res.redirect('/home');
			}
		} else {
			res.render('login.ejs', {
				errors: ['Username and password don\'t match'],
				notifs: notifs,
				csrfToken: req.csrfToken()
			});
		}
	}).catch((reason) => {
		res.render('login.ejs', {
			errors: ['Something is wrong, we are tying to solve it'],
			notifs: notifs,
			csrfToken: req.csrfToken()
		});
	});
});

app.get('/delete_image/:id', checkAuth(null, true), (req, res) => {
	//Check parameter
	if (req.params.id > 5 || req.params.id < 1) {
		req.session.errors.push('This picture doesn\'t exists')
		res.redirect('/home');
		return ;
	}
	memberManager.delete_image(req.session.username, req.params.id).then((result) => {
		if (result == true) {
			req.session.notifs.push('Picture deleted')
			res.redirect('/home');
		} else {
			req.session.errors.push(result);
			res.redirect('/home');
		}
	}).catch((reason) => {
		console.error('Failed to delete image: ' + reason);
		req.session.errors.push('Something is wrong, we are trying to solve it');
		res.redirect(500, '/home');
	});
})

app.get('/delete_user', [csrfProtection, checkAuth()], (req, res) => {
	res.render('delete_user.ejs', {
		errors: errors,
		notifs: notifs,
		user: req.session.username,
		userid: req.session.userid,
		csrfToken: req.csrfToken()
	});
});

app.post('/delete_user', [csrfProtection, checkAuth()], (req, res) => {
	memberManager.delete_user(req.body.username, req.body.password).then((result) => {
		if (result == true) {
			req.session.notifs.push('Your account has been deleted');
			res.redirect('/logout');
		} else {
			res.render('delete_user.ejs', {
				user: req.session.username,
				userid: req.session.userid,
				error: result,
				notfication: notification,
				csrfToken: req.csrfToken()
			});
		}
	}).catch((reason) => {
		res.render('delete_user.ejs', {
			errors: [reason],
			notifs: notifs,
			csrfToken: req.csrfToken()
		});
	});
});

app.post('/new_photo', [csrfProtection, checkAuth()], (req, res) => {
	if (typeof req.files == 'undefined' || req.files == null) {
		req.session.errors.push('No file provided for upload');
		res.redirect('/home');
		return;
	}
	let image = req.files.image;
	let type = image.mimetype;
	if (type == 'image/png' && imageChecker.checkPNG(image.data) !== true) {
		console.log((req.ip || req.connection.remoteAddress) + ' tried to upload a FakeImage');
		req.session.errors.push('This is not a valid image');
		res.redirect(403, '/home');
		return;
	} else if ((type == 'image/jpeg' || type == 'image/jpg') && imageChecker.checkJPG(image.data) !== true) {
		console.log((req.ip || req.connection.remoteAddress) + ' tried to upload a FakeImage');
		req.session.errors.push('This is not a valid image');
		res.redirect(403, '/home');
		return;
	}
	if (type != 'image/png' && type != 'image/jpg' && type != 'image/jpeg') {
		req.session.errors.push('Picture must be in PNG or JPEG format');
		res.redirect(403, '/home');
		return;
	} else if (image.size == 0) {
		req.session.errors.push('This file is empty');
		res.redirect(403, '/home');
		return;
	} else {
		image.mv(__dirname + '/resources/user_images/' + image.name, (err) => {
			if (err) {
				console.error('Failed to store user image: ');
				console.error(err.stack);
				res.redirect(500, '/home');
				return ;
			}
			memberManager.addUserImage(req.session.username, image.name).then((result) => {
				if (result === true) {
					req.session.notifs.push('Picture uploaded !');
					res.redirect(200, '/home');
					return ;
				} else {
					req.session.notifs += result;
					res.redirect(200, '/home');
				}
			}).catch((reason) => {
				console.error('Failed to add user image: ' + reason);
				res.redirect(500, '/');
				return ;
			});
		});
	}
});

app.post('/reset_password', csrfProtection, (req, res) => {
	let newpass = req.body.password;
	let username = req.body.username;
	let token = req.body.token;
	memberManager.changePasswordOf(username, newpass, token).then((result) => {
		if (result == true) {
			req.session.notifs.push('Le mot de passe à bien été modifié');
			res.redirect('/');
		} else {
			res.render('password_recovery_form.ejs', {
				errors: res,
				user: req.session.username,
				userid: req.session.userid,
				notifs: notifs,
				username: username,
				token: token
			});
		}
	}).catch((err) => {
		console.error(err);
		res.redirect(500, '/');
	});
});

app.get('/recover', csrfProtection, (req, res) => {
	let token = req.query.token;
	let username = req.query.user;
	if (typeof token != 'undefined' && typeof username != 'undefined') {
		res.render('password_recovery_form.ejs', {
			user: req.session.username,
			userid: req.session.userid,
			errors: errors,
			notifs: notifs,
			username: username,
			token: token,
			csrfToken: req.csrfToken()
		});
	} else {
		res.render('recover.ejs', {
			user: req.session.username,
			userid: req.session.userid,
			notifs: notifs,
			errors: errors,
			csrfToken: req.csrfToken()
		});
	}
});

app.get('/profile/:id', checkAuth(), (req, res) => {
	memberManager.getUserFullProfile(req.params.id, req.session.username).then((profile) => {
		if (profile == false) {
			req.session.errors.push('We can\'t find this account');
			res.redirect(301, '/search');
		} else {
			memberManager.visit(req.session.username, req.params.id).then((result) => {
				if (result == true) {
					memberManager.getUserName(req.params.id).then((name) => {
						memberManager.newNotification({
							dest: req.params.id,
							title: 'New Visit !',
							body: req.session.username + ' visited your profile !'
						});
						io.sockets.emit('new_notification', {
							dest: name,
							type: 'Nouvelle Visite !',
							body: req.session.username + ' visited your profile !'
						});
					}).catch((reason) => {
						console.error('Failed to getUserName:\n\t' + reason);
						res.redirect(500, '/');
					})
				}
				res.render('profile.ejs', {
					user: req.session.username,
					userid: req.session.userid,
					notifs: notifs,
					errors: errors,
					profile: profile
				});
			}).catch((reason) => {
				console.error('Failed to perform visit :\n' + reason);
				res.redirect(500, '/');
			})
		}
	}).catch((reason) => {
		console.error(reason);
		res.redirect(500, '/search');
	})
});

app.post('/recover', csrfProtection, (req, res) => {
	let username = req.body.username;
	let mail = req.body.mail;
	memberManager.sendpasswordRecoveryMail(username, mail).then((result) => {
		if (result === true) {
			res.render('recover.ejs', {
				user: req.session.username,
				userid: req.session.userid,
				errors: errors,
				notifs: notifs,
				mail_sent: true
			});
		} else {
			res.render('recover.ejs', {
				user: req.session.username,
				userid: req.session.userid,
				errors: result,
				notifs: notifs,
			});
		}
	}).catch((err) => {
		console.log(err);
		res.render('recover.ejs', {
			user: req.session.username,
			userid: req.session.userid,
			notifs: notifs,
			errors: ['Something is wrong, we are trying to solve it']
		});
	});
});

app.get('/logout', (req, res) => {
	if (typeof req.session != 'undefined' && typeof req.session.username != 'undefined') {
		req.session.destroy((err) => {
			if (err) {
				console.log(err.stack);
			}
			res.redirect('/');
		});
	} else {
		res.redirect('/');
	}
});

//AJAX Call
app.get('/like/:id', checkAuth('Complete', true), (req, res) => {
	memberManager.like(req.session.username, req.params.id).then((results) => {
		if (results == true) {
			memberManager.getUserName(req.params.id).then((name) => {
				memberManager.checkMatch(name, req.session.userid).then((result) => {
					if (result == true) {
						memberManager.newNotification({
							dest: req.params.id,
							title: 'New Match !',
							body: req.session.username + ' matches you'
						}).catch((reason) => {
							console.error('Failed to store newNotification:\n\t' + reason);
						});
						io.sockets.emit('new_notification', {
							dest: name,
							type: 'New Match !',
							body: req.session.username + ' matches you !'
						});
					} else {
						memberManager.newNotification({
							dest: req.params.id,
							title: 'New Like !',
							body: req.session.username + ' likes you !'
						}).catch((reason) => {
							console.error('Failed to store newNotification:\n\t' + reason);
						});
						io.sockets.emit('new_notification', {
							dest: name,
							type: 'New Like !',
							body: req.session.username + ' likes you !'
						});
					}
					res.status(200).json({
						'Notif': 'You like ' + name
					});
				}).catch((reason) => {
					console.error('Failed to checkMatch:\n\t' + reason);
					res.status(500).end();
				})
			}).catch((reason) => {
				console.error('Failed to getUserName:\n\t' + reason)
				res.status(500).end();
			})
		} else if (results == 'already liked') {
			res.status(200).json({
				'Notif': 'You already like ' + name
			})
		} else {
			res.status(500).end();
		}
	}).catch((err) => {
		console.error('Failed to like:\n\t' + err)
		res.status(500).end();
	});
});

app.get('/report/:id', [csrfProtection, checkAuth('Complete')], (req, res) => {
	memberManager.getUserName(req.params.id).then((name) => {
		res.render('report.ejs', {
			user: req.session.username,
			userid: req.session.userid,
			errors: errors,
			notifs: notifs,
			csrfToken: req.csrfToken(),
			name: name
		})
	}).catch((reason) => {
		console.error('Failed to get name: ' + reason);
		res.redirect(500, '/')
	})
})

app.post('/report/:id', [csrfProtection, checkAuth('Complete')], (req, res) => {
	memberManager.report(req.params.id, req.body.message.slice(0, 200)).then((result) => {
		if (result != true) {
			res.redirect(500, '/');
		} else {
			req.session.notifs.push('You reported a user');
			res.redirect(301, '/');
		}
	}).catch((reason) => {
		console.error('Failed to report user : ' + reason);
		res.redirect(500, '/');
	})
})

//AJAX CAll
app.get('/dislike/:id', checkAuth('Complete', true), (req, res) => {
	memberManager.dislike(req.session.username, req.params.id).then((results) => {
		if (results != true) {
			res.status(500).end();
		} else {
			res.json({
				'Notif': 'User disliked'
			});
		}
	}).catch((reason) => {
		console.error('Failed to dislike user: ' + reason);
		res.status(500).end();
	})
})

//AJAX Call
app.get('/unlike/:id', checkAuth('Complete', true), (req, res) => {
	memberManager.unlike(req.session.username, req.params.id).then((results) => {
		if (results != true) {
			res.status(500).end();
		} else {
			memberManager.getUserName(req.params.id).then((name) => {
				memberManager.isLikedBy(req.session.userid, req.params.id).then((result) => {
					if (result == true) {
						memberManager.newNotification({
							dest: req.params.id,
							title: 'No more match',
							body: req.session.username + ' unliked you'
						}).catch((reason) => {
							console.error('Failed to store newNotification:\n\t' + reason)
						});
						io.sockets.emit('new_notification', {
							dest: name,
							type: 'non_match',
							body: req.session.username + ' unliked you'
						})
					}
					res.status(200).json({
						'Notif': 'You don\'t like ' + name + ' anymore'
					})
				}).catch((reason) => {
					console.error('Failed to know ifLikedBy:\n\t' + reason);
					res.status(500).end();
				})
			})
		}
	}).catch((reason) => {
		console.error('Failed to unlike user: ' + reason);
		res.status(500).end();
	})
})

//AJAX Call
app.get('/block/:id', checkAuth('Complete', true), (req, res) => {
	memberManager.block(req.session.username, req.params.id).then((results) => {
		if (results != true) {
			res.status(500).end();
		} else {
			res.status(200).json({
				'Notif': name + ' blocked'
			})
		}
	}).catch((reason) => {
		console.error('Failed to block user: ' + reason);
		res.status(500).end();
	});
});

app.get('/search', [csrfProtection, checkAuth('Complete')], (req, res) => {
	res.render('public_profile.ejs', {
		user: req.session.username,
		userid: req.session.userid,
		errors: errors,
		notifs: notifs,
		csrfToken: req.csrfToken()
	})
});

app.post('/search', [csrfProtection, checkAuth('Complete')], (req, res) => {
	if (typeof req.body.terms != 'undefined') {
		//Access from home
		let terms = req.body.terms;
		if (terms[0] == '#') {
			memberManager.searchInterest(terms).then((results) => {
				res.render('public_profile.ejs', {
					matchs: results,
					search: req.body,
					errors: errors,
					notifs: notifs,
					user: req.session.username,
					userid: req.session.userid,
					csrfToken: req.csrfToken()
				});
			}).catch((reason) => {
				console.log(reason);
				res.redirect(500, '/search');
				return;
			})
		} else {
			memberManager.searchName(terms).then((result) => {
				res.render('public_profile.ejs', {
					matchs: result,
					errors: errors,
					notifs: notifs,
					user: req.session.username,
					userid: req.session.userid,
					csrfToken: req.csrfToken()
				});
			}).catch((reason) => {
				console.log(reason);
				res.redirect(500, '/search');
				return;
			});
		}
	} else if (typeof req.body.min_age != 'undefined' && typeof req.body.max_age != 'undefined' && typeof req.body.gender != 'undefined' && typeof req.body.distance != 'undefined') {
		//Access from search form
		memberManager.getUserInfos(req.session.username).then((result) => {
			memberManager.fetchMembers({
				age: [req.body.min_age, req.body.max_age],
				gender: req.body.gender,
				distance: req.body.distance,
				fruit: req.body.fruit,
				interests: getIntersetsTab(req.body.interests)
			}, {
				location: [req.session.lat, req.session.lng],
				username: req.session.username,
				sort: req.body.sort,
				order: req.body.order,
				interests: getIntersetsTab(result.interests),
				id: req.session.userid
			}).then((results) => {
				res.render('public_profile.ejs', {
					search: req.body,
					matchs: results,
					errors: errors,
					notfis: notifs,
					user: req.session.username,
					userid: req.session.userid,
					csrfToken: req.csrfToken()
				});
			}).catch((reason) => {
				console.error(reason);
				res.redirect(500, '/search');
				return;
			});
		});
	}
});

app.post('/update_location', [csrfProtection, checkAuth()], (req, res) => {
	if (typeof req.body.lat != 'undefined' && req.body.lng != 'undefined') {
		//Ninja latlng
		memberManager.updateLatLng(req.body.lat, req.body.lng, req.session.username);
	} else if (typeof req.body.city != 'undefined' && req.body.street != 'undefined' && typeof req.body.country != 'undefined') {
		//Form latlng
		locationFinder.getLatLngFromLocation(req.body.street + ' ' + req.body.city, req.body.country).then((location) => {
			if (location == 'Not found') {
				req.session.errors.push('We couldn\'t find this place');
				res.redirect('/home');
			}
			memberManager.updateLatLng(req.session.username, location.lat, location.lng).then((result) => {
				req.session.lat = result.lat;
				req.session.lng = result.lng;
				req.session.notifs.push('Location updated');
				res.redirect('/home');
			}).catch((reason) => {
				console.log('Failed to update lat lng:\n\t' + reason);
				res.redirect(500, '/home');
			});
			return;
		}).catch((reason) => {
			console.log('Failed to getLatLngFrom Location:\n\t' + reason);
			res.redirect(500,'/home');
			return;
		})
	}
});

app.post('/update', [csrfProtection, checkAuth()], (req, res) => {
	req.body.Status = 'Confirmed';
	memberManager.updateUser(req.session.username, req.body).then((results) => {
		if (results !== true) {
			req.session.notifs.push(results);
			res.redirect(200, '/home');
		} else {
			req.session.notifs.push('Your profile is up to date');
			res.redirect(301, '/home');
		}
	}).catch((reason) => {
		console.log(reason);
		res.redirect(500, '/home');
	});
})

app.get('/signup', csrfProtection, (req, res) => {
	let token = req.query.token;
	let username = req.query.user;
	if (typeof token != 'undefined' && typeof username != 'undefined') {
		memberManager.validateUser(username, token).then((result) => {
			req.session.notifs.push('Your account is now confirmed, you can log in');
			res.redirect('/login');
		}).catch((err) => {
			console.error(err);
			res.render('signup.ejs', {
				user: req.session.username,
				userid: req.session.userid,
				notifs: notifs,
				errors: ['Something is wrong, we are trying to solve it'],
				csrfToken: req.csrfToken()
			});
		});
	} else {
		res.render('signup.ejs', {
			user: req.session.username,
			userid: req.session.userid,
			errors: errors,
			notifs: notifs,
			csrfToken: req.csrfToken()
		});
	}
});

app.post('/signup', csrfProtection, (req, res) => {
	memberManager.createUser(req.body.Username, req.body.Lastname, req.body.Firstname, req.body.Mail, req.body.Password, req.body.Fruit).then((result) => {
		if (result !== true) {
			res.render('signup.ejs', {
				user: req.session.username,
				userid: req.session.userid,
				errors: result,
				notifs: notifs,
				csrfToken: req.csrfToken(),
			});
		} else {
			res.render('signup_step1.ejs', {
				user: req.session.username,
				userid: req.session.userid,
				errors: errors,
				notfis: notifs,
				username: req.body.Username,
				mail: req.body.Mail,
			});
		}
	}).catch((reason) => {
		console.log('Failed to createUser:\n\t' + reason);
		res.render('signup.ejs', {
			user: req.session.username,
			userid: req.session.userid,
			errors: ['Something is wrong, we are trying to solve it'],
			notifs: notifs,
			csrfToken: req.csrfToken()
		});
	});
});

server.listen(settings['port']);