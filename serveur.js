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
	})

	socket.on('message', (message) => {
		io.sockets.in(socket.room).emit('message', message);
	});

	socket.on('new_message', (message) => {
		memberManager.newMessage(message).then((result) => {
			io.sockets.in(message.dest).emit('new_message', message);
		}).catch((reason) => {
			console.log('Failed to store new message:\n\t' + reason);
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
//requiered to use csrf protection
var csrfProtection = csrf();
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

//Error handler
app.use((err, req, res, next) => {
	console.log('OK');
	if (err.code !== 'EBADCSRFTOKEN') {
		return next(err)
	}
	// handle CSRF token errors here
	res.redirect(403, '/');
	next();
});

//Session notfication and errors
var error = null;
var notification = null;
app.use((req, res, next) => {
	if (req.session.error) {
		error = req.session.error;
		req.session.error = null;
	} else {
		error = null;
	}
	if (req.session.notification) {
		notification = req.session.notification;
		req.session.notification = null;
	} else {
		notification = null;
	}
	next();
});

function getIntersetsTab(interests) {
	var tab = [];
	let regex = new RegExp("#[A-Za-z0-9]+", "g");
	let match;
	while ((match = regex.exec(interests)) != null) {
		tab.push(match[0]);
	}
	return (tab);
}

app.get('/home', csrfProtection, (req, res) => {
	if (req.session.username) {
		memberManager.getUserImages(req.session.username).then((images) => {
			memberManager.getUserInfos(req.session.username).then((user_info) => {
				memberManager.getUserExtended(req.session.username).then((user_extended) => {
					memberManager.getUserLikedProfiles(req.session.username).then((profiles) => {
						res.render('home.ejs', {
							user: req.session.username,
							error: error,
							notification: notification,
							user_info: user_info,
							user_extended: user_extended,
							images: images,
							profiles: profiles,
							just_logged: req.session.just_logged,
							csrfToken: req.csrfToken()
						});
						req.session.just_logged = false;
					}).catch((reason) => {
						res.render('home.ejs', {
							user: req.session.username,
							error: error,
							notfication: notification,
							user_info: user_info,
							user_extended: user_extended,
							images: images,
							just_logged: req.session.just_logged,
							csrfToken: req.csrfToken()
						});
						req.session.just_logged = false;
					}).catch((reason) => {
						console.log('Failed to load extended profile: ' + reason);
						res.render('home.ejs', {
							user: req.session.username,
							error: error,
							notfication: notification,
							user_info: user_info,
							error: 'Une erreur est survenue au chargement de votre profil',
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
						error: 'Votre profil est introuvable',
						notfication: notification,
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
					error: 'Vos photos sont introuvables',
					notfication: notification,
					just_logged: req.session.just_logged,
					csrfToken: req.csrfToken()
				});
				req.session.just_logged = false;
			});
		});
	} else {
		res.redirect(301, '/login');
	}
});

app.get('/', csrfProtection, (req, res) => {
	if (typeof req.session.username != 'undefined') {
		memberManager.getProfilesLikesUser(req.session.username).then((results) => {
			memberManager.getUserMatchs(req.session.username).then((matchs) => {
				res.render('index.ejs', {
					user: req.session.username,
					error: error,
					notification: notification,
					profiles: results,
					matchs: matchs,
					csrfToken: req.csrfToken()
				})
			}).catch((reason) => {
				console.log('Failed to getUserMatchs: ' + reason);
				res.render('index.ejs', {
					user: req.session.username,
					error: error,
					notification: notification,
					profiles: results,
					csrfToken: req.csrfToken()
				})
			})
		}).catch((reason) => {
			console.log('Failed to getProfilesLikedUser:\n' + reason);
			res.render('index.ejs', {
				user: req.session.username,
				error: 'Quelque chose cloche, nous enquetons',
				notification: notification,
				csrfToken: req.csrfToken()
			})
		})
	} else {
		res.render('index.ejs', {
			error: error,
			notfication: notification,
			user: req.session.username,
			csrfToken: req.csrfToken()
		});
	}
});

app.get('/chat/:id', (req, res) => {
	memberManager.checkAuthorization(req.session.username, ['Complete']).then((result) => {
		if (result == true) {
			memberManager.checkMatch(req.session.username, req.params.id).then((result) => {
				if (result == true) {
					memberManager.getUserName(req.params.id).then((result) => {
						if (req.params.id < req.session.userid) {
							var room = req.params.id + '-' + req.session.userid;
						} else {
							var room = req.session.userid + '-' + req.params.id;
						}
						res.render('chat.ejs', {
							user: req.session.username,
							error: error,
							notification: notification,
							room: room,
							dest: result
						});
					}).catch((reason) => {
						console.log('Failed to getUsername:\n\t' + reason);
						req.session.error = 'Quelque chose cloche, nous enquetons';
						res.redirect(301, '/');
					})
				} else {
					req.session.error = 'Vous n\'etes pas authorise a parler avec cette personne';
					res.redirect(301, '/');
					return ;
				}
			}).catch((reason) => {
						console.log('Failed to checkMatchs:\n' + reason);
						req.session.error = 'Quelque chose cloche, nous enquetons'
						res.redirect(301, '/');
						return ;
					})
		} else {
			req.session.notification = 'Vous devez etre connecte avec un compte valide';
			res.redirect(301, '/');
			return ;
		}
	}, (reason) => {
		console.log('Failed to checkAuthorization:\n' + reason)
		req.session.error = 'Quelque chose cloche, nous enquetons';
		res.redirect(301, req.referer);
		return ;
	});
})

app.get('/count_messages', (req, res) => {
	memberManager.countMessages(req.session.username).then((result) => {
		res.end(JSON.stringify(result));
	}).catch((reason) => {
		res.end(reason);
	})
})

app.get('/count_notifications', (req, res) => {
	memberManager.countNotifications(req.session.username).then((result) => {
		res.end(JSON.stringify(result));
	}).catch((reason) => {
		res.end(reason);
	})
})

app.get('/get_messages', (req, res) => {
 	memberManager.getMessages(req.session.username).then((results) => {
 		res.end(JSON.stringify(results)); //Des idees de genie !
 	}).catch((reason) => {
 		res.end(reason);
 	})
})

app.get('/get_notifications', (req, res) => {
	memberManager.getNotifications(req.session.username).then((results) => {
		res.end(JSON.stringify(results)); //Des idees de genie !
	}).catch((reason) => {
		res.end(reason);
	})
})

app.get('/get_address/:lat/:lng', (req, res) => {
	locationFinder.getLocationFromLatLng(req.params.lat, req.params.lng).then((results) => {
		if (results != false || results != 'Not found') {
			res.end(JSON.stringify(results));
		} else {
			res.end(JSON.stringify({
				found: 0
			}))
		}
	}).catch((reason) => {
		res.end(JSON.stringify({
			found: 0
		}));
	})
})

app.get('/match', (req, res) => {
	//We have to check for a complete profile here
	memberManager.checkAuthorization(req.session.username, ['Complete']).then((result) => {
		if (result == true) {
			memberManager.getUserMatchProfile(req.session.username).then((user_profile) => {
				locationFinder.getLatLngFromIp().then((result) => {
					let location = result;
					memberManager.fetchMembers({
						age: [user_profile.age - 5, user_profile.age + 5],
						distance: 200,
						allow_dislikes: false,
					}, {
						username: req.session.username,
						orientation: user_profile.orientation,
						gender: user_profile.gender,
						location: [req.session.lat, req.session.lng],
					}).then((results) => {
						res.render('match.ejs', {
							user: req.session.username,
							error: error,
							notfication: notification,
							matchs: results,
							location: location,
						});
					}).catch((reason) => {
						console.log('An error occurred while fething db: ' + reason);
					});
				}).catch((reason) => {
					console.log(reason);
					error = 'Impossible de savoir ou vous etes';
				});
			}).catch((reason) => {
				res.render('match.ejs', {
					user: req.session.username,
					notfication: notification,
					error: 'Une erreur est survenue. Veuillez réessayer dans quelques instants'
				});
			})	
		} else {
			req.session.notification = 'Vous devez être connecté avec un compte complet';
			res.redirect('/');
		}
	}).catch((reason) => {
		console.log('Failed to checkAuthorization: ' + reason);
		req.session.error = 'Quelque chose cloche, nous enquêtons'
		res.redirect(301, req.header.referer);
	})
});

app.get('/login', csrfProtection, (req, res) => {
	res.render('login.ejs', {
		user: req.session.username,
		error: error,
		notfication: notification,
		csrfToken: req.csrfToken()
	});
});

app.post('/login', csrfProtection, (req, res) => {
	memberManager.logg_user(req.body.username, req.body.password).then((result) => {
		if (result !== false) {
			req.session.username = result.username;
			req.session.lat = result.lat;
			req.session.lng = result.lng;
			req.session.userid = result.id;
			//User didn't give address
			if (req.session.lat == null || req.session.lng == null) {
				locationFinder.getLatLngFromIp().then((result) => {
					if (result != false) {
						req.session.lat = result.lat,
						req.session.lng = result.lng
						req.session.notification = 'Bienvenue ' + req.session.username + " !";
						res.redirect('/home');
					}
				}).catch((reason) => {
					console.log(reason);
					req.session.notification = 'Bienvenue ' + req.session.username + " !";
					res.redirect('/home');
				})
			} else {
				req.session.notification = 'Bienvenue ' + req.session.username + " !";
				res.redirect('/home');
			}
		} else {
			res.render('login.ejs', {
				error: 'Le nom d\'utilisateur et le mot de passe ne correspondent pas',
				notfication: notification,
				csrfToken: req.csrfToken()
			});
		}
	}).catch((reason) => {
		res.render('login.ejs', {
			error: 'Une erreur est survenue, si cette erreur persiste, contactez nous.',
			notfication: notification,
			csrfToken: req.csrfToken()
		});
	});
});

app.get('/delete_image/:id', (req, res) => {
	//Check parameter
	if (req.params.id > 5 || req.params.id < 1) {
		req.session.error = 'Cette image n\'existe pas';
		res.redirect('/home');
		return ;
	}
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result == true) {
			memberManager.delete_image(req.session.username, req.params.id).then((result) => {
				if (result == true) {
					req.session.notification = 'Votre image à bien été supprimée';
					res.redirect(301, '/home');
				} else {
					req.session.error = result;
					res.redirect(301, '/home');
				}
			}).catch((reason) => {
				req.session.error = 'Quelque chose cloche, nous enquêtons';
				res.redirect(301, '/home')
			})
		} else {
			req.session.notfication = 'Vous devez être connecté avec un compte valide';
			res.redirect(301, '/login');
		}
	}).catch((reason) => {
		console.log('Failed to check Authorisation :\n' + reason);
		req.session.error = 'Quelque chose cloche, nous enquêtons';
		res.redirect(301, '/home');
	})
})

app.get('/delete_user', csrfProtection, (req, res) => {
	//We need authorization
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result == true) {
			res.render('delete_user.ejs', {
				error: error,
				notification: notification,
				user: req.session.username,
				csrfToken: req.csrfToken()
			});
		} else {
			req.session.notfication = 'Vous devez être connecté avec un compte valide';
			res.redirect(301, '/login');
		}
	}).catch((reason) => {
		req.session.error = 'Nous n\'avonspas pu vérifier vos authorizations';
		res.redirect('/delete_user');
	})
});

app.post('/delete_user', csrfProtection, (req, res) => {
	//We need authorization
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result == true) {
			memberManager.delete_user(req.body.username, req.body.password).then((result) => {
				if (result == true) {
					res.redirect('/logout');
				} else {
					res.render('delete_user.ejs', {
						user: req.session.username,
						error: result,
						notfication: notification,
						csrfToken: req.csrfToken()
					});
				}
			}).catch((reason) => {
				res.render('delete_user.ejs', {
					error: reason,
					notfication: notification,
					csrfToken: req.csrfToken()
				});
			});
		} else {
			req.session.notification = 'Vous devez être connecté avec un compte valide'
			res.redirect(301, '/delete_user');
		}
	}).catch((reason) => {
		req.session.error = 'Nous n\'avonspas pu vérifier vos authorizations';
		res.redirect('/delete_user');
	});
});

app.post('/new_photo', csrfProtection, (req, res) => {
	//We need authorization
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result == true) {
			if (typeof req.files == 'undefined') {
				res.write('No file');
			}
			if (req.files == null) {
				req.session.error = 'Vous devez choisir une image à uploader'
				res.redirect('/home');
				return;
			}
			let image = req.files.image;
			let type = image.mimetype;
			if (type == 'image/png') {
				if (imageChecker.checkPNG(image.data) !== true) {
					console.log('FakeImage');
					req.session.error = 'Cette image n\'est pas valide';
					res.redirect(301, '/home');
					return;
				}
			} else if (type == 'image/jpeg' || type == 'image/jpg') {
				if (imageChecker.checkJPG(image.data) !== true) {
					req.session.error = 'Cette image n\'est pas valide';
					res.redirect(301, '/home');
					return;
				}
			}
			if (type != 'image/png' && type != 'image/jpg' && type != 'image/jpeg') {
				req.session.error = 'L\'image doit etre au format PNG ou JPEG';
				res.redirect(301, '/home');
				return;
			} else if (image.size == 0) {
				req.session.error = 'L\'image semble vide';
				res.redirect(301, '/home');
				return;
			} else {
				image.mv(__dirname + '/resources/user_images/' + image.name, (err) => {
					if (err) {
						console.log(err.stack);
						req.session.error = 'Une erreur exceptionnelle est survenue, si elle persiste, veuillez nous contacter';
						res.redirect(301, '/home');
						return ;
					}
					memberManager.addUserImage(req.session.username, image.name).then((result) => {
						req.session.notfication = 'L\'image à été uploadée avec succes';
						res.redirect(301, '/home');
						return ;
					}).catch((reason) => {
						req.session.error = reason;
						res.redirect(301, '/');
						return ;
					});
				});
			}
		} else {
			req.session.notification = 'Vous devez être connecté avec un compte valide';
			res.redirect('/home');
			return ;
		}
	}).catch((reason) => {
		console.log('Failed to checkAuthorization :\n' + reason);
		req.session.error = 'Quelque chose cloche, nous enquetons'
		res.redirect(301, '/');
		return ;
	})
});

app.post('/reset_password', csrfProtection, (req, res) => {
	let newpass = req.body.password;
	let username = req.body.username;
	let token = req.body.token;
	memberManager.changePasswordOf(username, newpass, token).then((result) => {
		if (result == true) {
			req.session.notification = 'Le mot de passe à bien été modifié'
			res.redirect('/');
		} else {
			res.render('password_recovery_form.ejs', {
				error: res,
				user: req.session.username,
				notfication: notification,
				username: username,
				token: token
			});
		}
	}).catch((err) => {
		console.log(err);
		req.session.error = 'Quelque chose cloche, nous enquêtons';
		res.redirect(301, '/');
	});
});

app.get('/recover', csrfProtection, (req, res) => {
	let token = req.query.token;
	let username = req.query.user;
	if (typeof token != 'undefined' && typeof username != 'undefined') {
		res.render('password_recovery_form.ejs', {
			user: req.session.username,
			error: error,
			notfication: notification,
			username: username,
			token: token,
			csrfToken: req.csrfToken()
		});
	} else {
		res.render('recover.ejs', {
			user: req.session.username,
			notfication: notification,
			error: error,
			csrfToken: req.csrfToken()
		});
	}
});

app.get('/profile/:id', (req, res) => {
	memberManager.getUserFullProfile(req.params.id, req.session.username).then((profile) => {
		if (profile == false) {
			req.session.error = 'Cet utilisateur ne semble pas exister'
			res.redirect(301, '/search');
		} else {
			memberManager.visit(req.session.username, req.params.id).then((result) => {
				if (result == true) {
					memberManager.getUserName(req.params.id).then((name) => {
						memberManager.newNotification({
							dest: name,
							title: 'Nouvelle Visite !',
							body: req.session.username + ' a vu votre profil'
						})
						io.sockets.emit('new_notification', {
							dest: name,
							type: 'Nouvelle Visite !',
							body: req.session.username + ' a vu votre profil'
						});
					}).catch((reason) => {
						console.log('Failed to getUserName:\n\t' + reason);
						req.session.error = 'Quelque chose cloche, nous enquetons';
						res.redirect(301, '/');
					})
				}
				res.render('profile.ejs', {
					user: req.session.username,
					notfication: notification,
					error: error,
					profile: profile
				});
			}).catch((reason) => {
				console.log('Failed to perform visit :\n' + reason);
				req.session.error = 'Quelque chose cloche, nous enquetons';
				res.redirect(301, '/');
			})
		}
	}).catch((reason) => {
		console.log(reason);
		req.session.error = 'Quelque chose cloche, nous enquêtons'
		res.redirect(301, '/search');
	})
})

app.post('/recover', csrfProtection, (req, res) => {
	let username = req.body.username;
	let mail = req.body.mail;
	memberManager.sendpasswordRecoveryMail(username, mail).then((result) => {
		res.render('recover.ejs', {
			user: req.session.username,
			error: error,
			notfication: notification,
			mail_sent: true
		});
	}).catch((err) => {
		console.log(err);
		res.render('recover.ejs', {
			user: req.session.username,
			notfication: notification,
			error: 'Quelque chose cloche, nous enquêtons'
		});
	});
});

app.get('/logout', (req, res) => {
	if (typeof req.session != 'undefined' && typeof req.session.username != 'undefined') {
		req.session.destroy((err) => {
			if (err) {
				console.log(err.stack);
			}
			res.render('index.ejs', {
				notification: 'Vous etes maintenant deconnecté',
				error: error,
			});
		});
	} else {
		res.redirect('/');
	}
});

app.get('/like/:id', (req, res) => {
	//We need authorization
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result == true) {
			memberManager.like(req.session.username, req.params.id).then((results) => {
				if (results == true) {
					memberManager.getUserName(req.params.id).then((name) => {
						memberManager.checkMatch(name, req.session.userid).then((result) => {
							if (result == true) {
								memberManager.newNotification({
									dest: name,
									title: 'Noubeau Match !',
									body: req.session.username + ' vous matche'
								}).catch((reason) => {
									console.log('Failed to store newNotification:\n\t' + reason);
								});
								req.session.notification = 'Nouveau Match !';
								io.sockets.emit('new_notification', {
									dest: name,
									type: 'Nouveau Match !',
									body: req.session.username + ' vous matche !'
								});
							} else {
								memberManager.newNotification({
									dest: name,
									title: 'Nouveau Like !',
									body: req.session.username + ' vous aime'
								}).catch((reason) => {
									console.log('Failed to store newNotification:\n\t' + reason);
								})
								req.session.notification = 'Vous aimez cette personne'
								io.sockets.emit('new_notification', {
									dest: name,
									type: 'Nouveau Like !',
									body: req.session.username + ' likes you !'
								})
							}
							res.redirect(301, '/profile/' + req.params.id);
						}).catch((reason) => {
							console.log('Failed to checkMatch:\n\t' + reason);
							req.session.error = 'Quelque chose cloche, nous enquetons';
							res.redirect(301, '/');
						})
					}).catch((reason) => {
						console.log('Failed to getUserName:\n\t' + reason)
						req.session.error = 'Quelque chose cloche, nous enquetons'
						res.redirect(301, '/');
					})
				} else if (results == 'already liked') {
					req.session.notification = 'Vous aimez deja cette personne'
					res.redirect(301, '/profile/' + req.params.id)
				} else {
					res.redirect(301, req.header.referer);
				}
			}).catch((err) => {
				console.log('Failed to like:\n\t' + err)
				req.session.error = 'Echec lors du like';
				res.redirect(301, req.header.referer);
			});
		} else {
			req.session.notification = 'Vous devez être connecté avec un compte valide';
			res.redirect(301, '/login');
		}
	}).catch((reason) => {
		req.session.error = 'Nous n\'avonspas pu vérifier vos authorizations';
		res.redirect(301, '/');
	})
});

app.get('/report/:id', csrfProtection, (req, res) => {
	//We need authorization
	memberManager.checkAuthorization(username, ['Confirmed', 'Complete']).then((result) => {
		if (result == true) {
			memberManager.getUserName(req.params.id).then((name) => {
				res.render('report.ejs', {
					user: req.session.username,
					error: error,
					notification: notification,
					csrfToken: req.csrfToken(),
					name: name
				})
			}).catch((reason) => {
				console.log('Failed to get name');
				res.redirect('/')
			})
		} else {
			req.session.notification = 'Vous devez être connecté avec un compte valide'
			res.redirect(301, '/login')
		}
	}).catch((reason) => {
		req.session.error = 'Nous n\'avonspas pu vérifier vos authorisations';
		res.redirect(301, '/');
	})
})

app.post('/report/:id', csrfProtection, (req, res) => {
	//We need authorization
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result == true) {
			memberManager.report(req.params.id, req.body.message.slice(0, 200)).then((result) => {
				if (result != true) {
					req.session.error = 'Impossible de signaler l\'utilisateur';
					res.redirect(301, '/');
				} else {
					req.session.notification = 'L\'utilisateur à bien été signalé';
					res.redirect(301, '/');
				}
			}).catch((reason) => {
				console.log('Failed to report user : ' + reason);
				req.session.error = 'Impossible de signaler l\'utilisateur';
				res.redirect('/');
			})
		} else {
			req.session.notification = 'Vous devez être connecté avec un compte valide';
			res.redirect(req.headers.referer);
		}
	}).catch((reason) => {
		req.session.error = 'Nous n\'avonspas pu vérifier vos authorizations';
		res.redirect(req.header.referer);
	})
})

app.get('/dislike/:id', (req, res) => {
	//We need authorization
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result == true) {
			memberManager.dislike(req.session.username, req.params.id).then((results) => {
				if (results != true) {
					req.session.error = 'Echec du non - amour';
					res.redirect(301, '/');
				} else {
					req.session.notification = 'Vous n\'aimez pas cette personne';
					res.redirect(301, '/')
				}
			}).catch((reason) => {
				req.session.error = 'Echec du non - amour';
				res.redirect(301, '/');
			})
		} else {
			req.session.notification = 'Vous devez être connecté avec un compte valide';
			res.redirect(301, req.header.referer);
		}
	}).catch((reason) => {
		req.session.error = 'Nous n\'avonspas pu vérifier vos authorizations';
		res.redirect(req.session.referer);
	})
})

app.get('/unlike/:id', (req, res) => {
	//We need authorization
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result == true) {
			memberManager.unlike(req.session.username, req.params.id).then((results) => {
				if (results != true) {
					req.session.error = 'Echec du non - amour';
					res.redirect(301, '/');
				} else {
					memberManager.getUserName(req.params.id).then((name) => {
						memberManager.isLikedBy(req.session.userid, req.params.id).then((result) => {
							if (result == true) {
								memberManager.newNotification({
									dest: name,
									title: 'Plus de Match',
									body: req.session.username + ' ne vous aime plus'
								}).catch((reason) => {
									console.log('Failed to store newNotification:\n\t' + reason)
								})
								io.sockets.emit('new_notification', {
									dest: name,
									type: 'non_match',
									body: req.session.username + ' ne vous aime plus'
								})
							}
							req.session.notification = 'Vous n\'aimez plus cette personne';
							res.redirect(301, '/')
						}).catch((reason) => {
							console.log('Failed to know ifLikedBy:\n\t' + reason);
							req.session.error = 'Quelque chose cloche, nous enquetons';
							res.redirect(301, '/');
						})
					})
				}
			}).catch((reason) => {
				req.session.error = 'Echec du non - amour';
				res.redirect(301, '/')
			})
		} else {
			req.session.notification = 'Vous devez être connecté avec un compte valide';
			res.redirect(req.header.referer);
		}
	}).catch((reason) => {
		req.session.error = 'Nous n\'avonspas pu vérifier vos authorizations';
		res.redirect(req.header.referer);
	})
})

app.get('/block/:id', (req, res) => {
	//We need authorization
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result == true) {
			memberManager.block(req.session.username, req.params.id).then((results) => {
				if (results != true) {
					req.session.error = 'Echec du bloquage de l\'utilisateur';
					res.redirect(301, req.header.referer)
				} else {
					req.session.notification = 'Utilisateur bloqué';
					res.redirect(301, '/')
				}
			}).catch((reason) => {
				req.session.error = 'Echec du blocage de l\'utilisateur';
				res.redirect(301, '/');
			})
		} else {
			req.session.notification = 'Vous devez être connecté avec un compte valide';
			res.redirect(301, req.session.referer);
		}
	}).catch((reason) => {
		req.session.error = 'Nous n\'avonspas pu vérifier vos authorizations';
		res.redirect(req.header.referer);
	})
});

app.get('/search', csrfProtection, (req, res) => {
	res.render('public_profile.ejs', {
		user: req.session.username,
		error: error,
		notification: notification,
		csrfToken: req.csrfToken()
	})
})

app.post('/search', csrfProtection, (req, res) => {
	console.log('POST OK')
	if (typeof req.body.terms != 'undefined') {
		let terms = req.body.terms;
		if (terms[0] == '#') {
			memberManager.searchInterest(terms).then((results) => {
				res.render('public_profile.ejs', {
					matchs: results,
					search: req.body,
					error: error,
					notfication: notification,
					user: req.session.username,
					csrfToken: req.csrfToken()
				});
			}).catch((reason) => {
				console.log(reason);
				req.session.error = 'Quelque chose cloche, nous enquêtons';
				res.redirect(301, '/');
				return;
			})
		} else {
			memberManager.searchName(terms).then((result) => {
				res.render('public_profile.ejs', {
					matchs: result,
					error: error,
					notfication: notification,
					user: req.session.username,
					csrfToken: req.csrfToken()
				});
			}).catch((reason) => {
				console.log(reason);
				req.session.error = 'Quelque chose cloche, nous enquêtons';
				res.redirect(301, '/');
				return;
			});
		}
	} else if (typeof req.body.min_age != 'undefined' && typeof req.body.max_age != 'undefined' && typeof req.body.gender != 'undefined' && typeof req.body.distance != 'undefined') {
		console.log('OK')
		console.log(req.body);
		memberManager.getUserInfos(req.body.username).then((result) => {
			memberManager.fetchMembers({
				age: [req.body.min_age, req.body.max_age],
				gender: req.body.gender,
				distance: req.body.distance,
				fruit: req.body.fruit,
				interests: getIntersetsTab(req.body.interests)
			}, {
				location: [req.session.lat, req.session.lng],
				username: req.session.username
			}).then((results) => {
				res.render('public_profile.ejs', {
					search: req.body,
					matchs: results,
					error: error,
					notfication: notification,
					user: req.session.username,
					csrfToken: req.csrfToken()
				});
			}).catch((reason) => {
				console.log(reason);
				req.session.error = 'Quelque chose cloche, nous enquêtons';
				res.redirect(301, '/');
				return;
			});
		});
	}
});

app.post('/update_location', csrfProtection, (req, res) => {
	//We need authorization
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result == true) {
			if (typeof req.body.lat != 'undefined' && req.body.lng != 'undefined') {
				memberManager.updateLatLng(lat, lng, req.session.username);
			} else if (typeof req.body.city != 'undefined' && req.body.street != 'undefined' && typeof req.body.country != 'undefined') {
				locationFinder.getLatLngFromLocation(req.body.street + ' ' + req.body.city, req.body.country).then((location) => {
					if (location == 'Not found') {
						req.session.notfication = 'Nous n\'avons pas trouve cet endroit';
						res.redirect('/home');
					}
					memberManager.updateLatLng(req.session.username, location.lat, location.lng).then((result) => {
						req.session.lat = result.lat;
						req.session.lng = result.lng;
						req.session.notification = 'Votre geolocalisation a ete mise a jour'
						res.redirect('/home');
					}).catch((reason) => {
						req.session.error = 'Quelque chose cloche, nous enquêtons';
						console.log('Failed to update lat lng:\n\t' + reason);
						res.redirect('/home');
					});
					return;
				}).catch((reason) => {
					req.session.error = 'Quelque chose cloche, nous enquêtons';
					console.log('Failed to getLatLngFrom Location:\n\t' + reason);
					res.redirect('/home');
					return;
				})
			}
		} else {
			req.session.notification = 'Vous devez être connecté avec un compte valide'
			res.redirect(301, '/login');
			return ;
		}
	}).catch((reason) => {
		console.log('Failed to checkAuthorizations:\n\t' + reason);
		req.session.error = 'Quelque chose cloche, nous enquetons';
		res.redirect('/home');
		return ;
	})
});

app.post('/complete', csrfProtection, (req, res) => {
	//We need authorization
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result == true) {
			memberManager.create_user_extended(req.session.username, req.body.age, req.body.gender, req.body.orientation, req.body.bio.slice(0, 500)).then((result) => {
				if (result === true) {
					req.session.notification = 'Votre profil à été mis à jour avec succès';
					res.redirect(301, '/home');
					return ;
				} else {
					console.log(result)
					req.session.error = 'Quelque chose cloche, nous enquêtons'
					res.redirect(301, '/home')
					return ;
				}
			}).catch((err) => {
				console.log('Error while creating new extended profile : ' + err);
				req.session.error = 'Quelque chose cloche, nous enquêtons';
				res.redirect(301, '/home');
				return ;
			});
		} else {
			req.session.notification = 'Vous devez étre connecté avec un compte valide';
			res.redirect(301, '/login');
			return ;
		}
	}).catch((reason) => {
		req.session.error = 'Nous n\'avonspas pu vérifier vos authorizations';
		res.redirect(301, '/');
		retunr ;
	})
});

app.post('/update', csrfProtection, (req, res) => {
	//We need authorization
	memberManager.checkAuthorization(req.session.username, ['Confirmed', 'Complete']).then((result) => {
		if (result == true) {
			memberManager.updateUser(req.session.username, req.body.Firstname.slice(0, 100), req.body.Lastname.slice(0, 100), req.body.Mail.slice(0, 255), req.body.Password, req.body.Fruit).then((results) => {
				if (results !== true) {
					res.render('home.ejs', {
						user: req.session.username,
						error: results,
						notfication: notification,
						csrfToken: req.csrfToken()
					});
				} else {
					req.session.notification = 'Votre profil à été mis à jour avec succès';
					res.redirect(301, '/home');
				}
			}).catch((reason) => {
				console.log(reason);
				req.session.error = 'Quelque chose cloche, nous enquêtons';
				res.redirect(301, '/home');
			});
		} else {
			req.session.notification = 'Vous devez étre connecté avec un compte valide';
			res.redirect(301, '/login');
		}
	}).catch((reason) => {
		req.session.error = 'Nous n\'avonspas pu vérifier vos authorizations';
		res.redirect(301, '/');
	})
})

app.get('/signup', csrfProtection, (req, res) => {
	let token = req.query.token;
	let username = req.query.user;
	if (typeof token != 'undefined' && typeof username != 'undefined') {
		memberManager.validateUser(username, token).then((result) => {
			req.session.notification = 'Votre compte à été validé avec succès, vous pouvez maintenant vous connecter'
			res.redirect('/login');
		}).catch((err) => {
			console.log(err);
			res.render('signup.ejs', {
				user: req.session.username,
				notfication: notification,
				error: 'Quelque chose cloche, nous enquêtons',
				csrfToken: req.csrfToken()
			});
		});
	} else {
		res.render('signup.ejs', {
			user: req.session.username,
			error: error,
			notfication: notification,
			csrfToken: req.csrfToken()
		});
	}
});

app.post('/signup', csrfProtection, (req, res) => {
	memberManager.createUser(req.body.Username.slice(0, 100), req.body.Lastname.slice(0, 100), req.body.Firstname.slice(0, 100), req.body.Mail.slice(0, 255), req.body.Password, req.body.Fruit).then((result) => {
		if (result !== true) {
			res.render('signup.ejs', {
				user: req.session.username,
				error: result,
				notfication: notification,
				csrfToken: req.csrfToken(),
			});
		} else {
			res.render('signup_step1.ejs', {
				user: req.session.username,
				error: error,
				notfication: notification,
				username: req.body.Username,
				mail: req.body.Mail,
			});
		}
	}).catch((reason) => {
		console.log('Failed to createUser:\n\t' + reason);
		res.render('signup.ejs', {
			user: req.session.username,
			error: 'Quelque chose cloche, nous enquêtons',
			notfication: notification,
			csrfToken: req.csrfToken()
		});
	});
});

server.listen(settings['port']);