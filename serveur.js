var express = require('express');
var session = require('express-session');
var fileUpload = require('express-fileupload');
var csrf = require('csurf');
var settings = require("./server_settings.json");
var memberManager = require("./memberManager.js");
var imageChecker = require("./imageChecker.js");
var locationFinder = require("./locationFinder.js");

var app = express();

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
					res.render('home.ejs', {
						user: req.session.username,
						error: error,
						notfication: notification,
						user_info: user_info,
						user_extended: user_extended,
						images: images,
						csrfToken: req.csrfToken()
					});
				}).catch((reason) => {
					console.log('Failed to load extended profile: ' + reason);
					res.render('home.ejs', {
						user: req.session.username,
						error: error,
						notfication: notification,
						user_info: user_info,
						error: 'Une erreur est survenue au chargement de votre profil',
						images: images,
						csrfToken: req.csrfToken()
					});
				});
			}).catch((reason) => {
				console.log('Failed to load user infos: ' + reason);
				res.render('home.ejs', {
					user: req.session.username,
					error: 'Votre profil est introuvable',
					notfication: notification,
					images: images,
					csrfToken: req.csrfToken()
				});
			});
		}).catch((reason) => {
			console.log(reason);
			res.render('home.ejs', {
				user: req.session.username,
				error: 'Vos photos sont introuvables',
				notfication: notification,
				csrfToken: req.csrfToken()
			});
		});
	} else {
		res.render('index.ejs', {
			error: error,
			notfication: notification,
			user: req.session.username
		});
	}
});

app.get('/', csrfProtection, (req, res) => {
	res.render('index.ejs', {
		error: error,
		notfication: notification,
		user: req.session.username,
		csrfToken: req.csrfToken()
	});
});

app.get('/match', (req, res) => {
	//We have to check for a complete profile here
	memberManager.getUserMatchProfile(req.session.username).then((user_profile) => {
		locationFinder.getLatLngFromIp().then((result) => {
			let location = result;
			memberManager.fetchMembers({
				age: [user_profile.age - 5, user_profile.age + 5],
				distance: 200
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

app.post('/new_photo', csrfProtection, (req, res) => {
	if (typeof req.files == 'undefined') {
		res.write('No file');
	}
	if (req.files == null) {
		req.session.error = 'Vous devez choisir une image à uploader'
		res.redirect('/home');
		return ;
	}
	let image = req.files.image;
	let type = image.mimetype;
	if (type == 'image/png') {
		if (imageChecker.checkPNG(image.data) !== true) {
			console.log('FakeImage');
			req.session.error = 'Cette image n\'est ppas valide';
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
		req.session.error = 'Ce format n\'est pas supporté';
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
			}
			memberManager.addUserImage(req.session.username, image.name).then((result) => {
				req.session.notfication = 'L\'image à été uploadée avec succes';
				res.redirect(301, '/');
			}).catch((reason) => {
				req.session.error = reason;
				res.redirect(301, '/');
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
	memberManager.getUserFullProfile(req.params.id).then((profile) => {
		if (profile == false) {
			req.session.error = 'Cet utilisateur ne semble pas exister'
			res.redirect(301, '/search');
		} else {
			res.render('profile.ejs', {
				user: req.session.username,
				notfication: notification,
				error: error,
				profile: profile
			})
			memberManager.visit(req.session.username, req.params.id).then((result) => {
				if (result != true) {
					console.log('Failed to account visit');
				}
			}).catch((reason) => {
				console.log('Failed to perform visit :\n' + reason);
			})
		}
	}).catch((reason) => {
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
	memberManager.like(req.session.username, req.params.id).then((results) => {
		if (results != true) {
			res.redirect(301, req.header.referer)
		} else {
			req.session.notification = 'Vous aimez cette personne'
			res.redirect(301, '/profile/' + req.params.id);
		}
	}).catch((err) => {
		req.session.error = 'Echec lors du like';
		res.redirect(301, req.headers.referer);
	});
});

app.get('/report/:id', (req, res) => {
	res.end('Not ready yet !');
})

app.get('/dislike/:id', (req, res) => {
	memberManager.dislike(req.session.username, req.params.id).then((results) => {
		if (results != true) {
			req.session.error = 'Echec du non - amour';
			res.redirect(301, '/');
		} else {
			req.session.notification = 'Vous n\'aimez pas cette personne';
			res.redirect(301, req.header.referer)
		}
	})
})

app.get('/unlike/:id', (req, res) => {
	memberManager.unlike(req.session.username, req.params.id).then((results) => {
		if (results != true) {
			req.session.error = 'Echec du non - amour';
			res.redirect(301, '/');
		} else {
			req.session.notification = 'Vous n\'aimez plus cette personne';
			res.redirect(301, req.header.referer)
		}
	})
})

app.get('/block/:id', (req, res) => {
	memberManager.block(req.session.username, req.params.id).then((results) => {
		if (results != true) {
			req.session.error = 'Echec du bloquage de l\'utilisateur';
			res.redirect(301, req.header.referer)
		} else {
			req.session.notification = 'Utilisateur bloqué';
			res.redirect(301, '/')
		}
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
				return ;
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
				return ;
			});
		}
	} else if (typeof req.body.min_age != 'undefined' && typeof req.body.max_age != 'undefined' && typeof req.body.gender != 'undefined' && typeof req.body.distance != 'undefined') {
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
				return ;
			});
		});
	}
});

app.post('/update_location', csrfProtection, (req, res) => {
	if (typeof req.body.lat != 'undefined' && req.body.lng != 'undefined') {
		memberManager.updateLatLng(lat, lng, req.session.username);
	} else if (typeof req.body.city != 'undefined' && req.body.street != 'undefined' && typeof req.body.country != 'undefined') {
		console.log('Form recieved');
		locationFinder.getLatLngFromLocation(req.body.street + ' ' + req.body.city, req.body.country).then((location) => {
			console.log(location.lat + ', ' + location.lng);
			memberManager.updateLatLng(req.session.username, location.lat, location.lng).then((result) => {
				req.session.lat = result.lat;
				req.session.lng = result.lng;
				res.end();
			}).catch((reason) => {
				req.session.error = 'Quelque chose cloche, nous enquêtons';
				console.log(reason);
				res.end();
			});
			return;
		}).catch((reason) => {
			req.session.error = 'Quelque chose cloche, nous enquêtons';
			console.log(reason);
			res.end();
			return;
		})
	}
});

app.post('/complete', csrfProtection, (req, res) => {
	memberManager.create_user_extended(req.session.username, req.body.age, req.body.gender, req.body.orientation, req.body.bio).then((result) => {
		if (result === true) {
			req.session.notification = 'Votre profil à été mis à jour avec succès';
			res.redirect(301, '/home');
		} else {
			req.session.error = 'Quelque chose cloche, nous enquêtons'
			res.redirect(301, '/home')
		}
	}).catch((err) => {
		console.log('Error while creating new extended profile : ' + err.stack);
		req.session.error = 'Quelque chose cloche, nous enquêtons';
		res.redirect(301, '/home')
	});
});

app.post('/update', csrfProtection, (req, res) => {
	memberManager.updateUser(req.session.username, req.body.Firstname, req.body.Lastname, req.body.Mail, req.body.Password, req.body.Fruit).then((results) => {
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
	memberManager.createUser(req.body.Username, req.body.Lastname, req.body.Firstname, req.body.Mail, req.body.Password, req.body.Fruit).then((result) => {
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
		console.log(reason);
		res.render('signup.ejs', {
			user: req.session.username,
			error: 'Quelque chose cloche, nous enquêtons',
			notfication: notification,
			csrfToken: req.csrfToken()
		});
	});
});

app.listen(settings['port']);