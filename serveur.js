var express = require('express');
var session = require('express-session');
var fileUpload = require('express-fileupload');
var csrf = require('csurf');
var settings = require("./server_settings.json");
var memberManager = require("./memberManager.js");
var imageChecker = require("./imageChecker.js");
var locationFinder = require("./locationFinder");

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
app.use(function (err, req, res, next) {
	console.log('OK');
	if (err.code !== 'EBADCSRFTOKEN') {
		return next(err)
	}
	// handle CSRF token errors here
	res.redirect(403, '/');
	next();
});

app.get('/home', csrfProtection, (req, res) => {
	if (req.session.username) {
		memberManager.getUserImages(req.session.username).then((images) => {
			memberManager.getUserInfos(req.session.username).then((user_info) => {
				memberManager.getUserExtended(req.session.username).then((user_extended) => {
					res.render('home.ejs', {
						user: req.session.username,
						user_info: user_info,
						user_extended: user_extended,
						images: images,
						csrfToken: req.csrfToken()
					});
				}).catch((reason) => {
					console.log('Failed to load extended profile: ' + reason);
					res.render('home.ejs', {
						user: req.session.username,
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
					images: images,
					csrfToken: req.csrfToken()
				});
			});
		}).catch((reason) => {
			console.log(reason);
			res.render('home.ejs', {
				user: req.session.username,
				error: 'Vos photos sont introuvables',
				csrfToken: req.csrfToken()
			});
		});
	} else {
		res.render('index.ejs', {
			user: req.session.username
		});
	}
});

app.get('/', (res, req) => {
	if (typeof req.session != 'undefined') {
		res.render('index.ejs', {
			user: req.session.username
		});
	} else {
		res.render('index.ejs');
	}
})

app.get('/match', (req, res) => {
	//We have to check for a complete profile here
	memberManager.getUserMatchProfile(req.session.username).then((user_profile) => {
		locationFinder.getLatLngFromIp().then((result) => {
			let location = result;
			memberManager.fetchMembers({
				age: [user_profile.age - 5, user_profile.age + 5],
			}, {
				username: req.session.username,
				orientation: user_profile.orientation,
				gender: user_profile.gender,
				location: [result.lat, result.lng]
			}).then((results) => {
				res.render('match.ejs', {
					user: req.session.username,
					matchs: results,
					location: location,
				});
			}).catch ((reason) => {
				console.log('An error occurred while fething db: ' + reason);
			})
		}).catch((reason) => {
			console.log(reason);
			error = 'Impossible de savoir ou vous etes';
		});
	}).catch((reason) => {
		res.render('match.ejs', {
			user: req.session.username,
			error: 'Une erreur est survenue. Veuillez réessayer dans quelques instants'
		});
	})
});

app.get('/login', csrfProtection, (req, res) => {
	res.render('login.ejs', {
		user: req.session.username,
		csrfToken: req.csrfToken()
	});
});

app.post('/login', csrfProtection, (req, res) => {
	memberManager.logg_user(req.body.username, req.body.password).then((result) => {
		if (result !== false) {
			req.session.username = result.username;
			req.session.userid = result.id;
			res.redirect('/');
		} else {
			res.render('login.ejs', {
				error: 'Le nom d\'utilisateur et le mot de passe ne correspondent pas',
				csrfToken: req.csrfToken()
			});
		}
	}).catch((reason) => {
		res.render('login.ejs', {
			error: 'Une erreur est survenue, si cette erreur persiste, contactez nous.',
			csrfToken: req.csrfToken()
		});
	});
});

app.post('/new_photo', csrfProtection, (req, res) => {
	if (typeof req.files == 'undefined') {
		res.write('No file');
	}
	let image = req.files.image;
	let type = image.mimetype;
	if (type == 'image/png') {
		if (imageChecker.checkPNG(image.data) !== true) {
			console.log('FakeImage');
			res.redirect(301, '/');
			return ;
		}
	} else if (type == 'image/jpeg' || type == 'image/jpg') {
		if (imageChecker.checkJPG(image.data) !== true) {
			res.redirect(301, '/');
			return ;
		}
	}
	if (type != 'image/png' && type != 'image/jpg' && type != 'image/jpeg') {
		res.end(image.name + " : Format is not supported");
		return ;
	} else if (image.size == 0) {
		res.end("Can't upload empty file");
		return ;
	} else {
		image.mv(__dirname + '/resources/user_images/' + image.name, (err) => {
			if (err) {
				console.log(err.stack);
				res.end('Error');
			}
			memberManager.addUserImage(req.session.username, image.name).then((result) => {
				res.redirect(301, '/');
			}).catch((reason) => {
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
			res.redirect('/');
		} else {
			res.render('password_recovery_form.ejs', {
				error: res,
				user: req.session.username,
				username: username,
				token: token
			});
		}
	}).catch((err) => {
		console.log(err);
		res.end('Error');
	});
});

app.get('/recover', csrfProtection, (req, res) => {
	let token = req.query.token;
	let username = req.query.user;
	if (typeof token != 'undefined' && typeof username != 'undefined') {
		res.render('password_recovery_form.ejs', {
			user: req.session.username,
			username: username,
			token: token,
			csrfToken: req.csrfToken()
		});
	} else {
		res.render('recover.ejs', {
			user: req.session.username,
			csrfToken: req.csrfToken()
		});
	}
});

app.post('/recover', csrfProtection, (req, res) => {
	let username = req.body.username;
	let mail = req.body.mail;
	memberManager.sendpasswordRecoveryMail(username, mail).then((result) => {
		res.render('recover.ejs', {
			user: req.session.username,
			mail_sent: true
		});
	}).catch((err) => {
		console.log(err);
		res.render('recover.ejs', {
			user: req.session.username,
			error: 'Something went wrong, we are trying to solve it'
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
			});
		});
	} else {
		res.redirect('/');
	}
});

app.post('/search', csrfProtection, (req, res) => {
	res.end(req.body.terms);
})

app.post('/update_location', csrfProtection, (req, res) => {
	if (typeof req.body.lat != 'undefined' && req.body.lng != 'undefined') {
		memberManager.updateLatLng(lat, lng, req.session.username);
	} else if (typeof req.body.city != 'undefined' && req.body.street != 'undefined' && typeof req.body.country != 'undefined') {
		console.log('Form recieved');
		locationFinder.getLatLngFromLocation(req.body.street + ' ' + req.body.city, req.body.country).then((location) => {
			console.log(location.lat + ', ' + location.lng);
			memberManager.updateLatLng(req.session.username, location.lat, location.lng).then((res) => {
				console.log('OK')
			}).catch((reason) => {
				console.log(reason);
			});
			return ;
		}).catch((reason) => {
			console.log(reason);
			return ;
		})
	}
});

app.post('/complete', csrfProtection, (req, res) => {
	memberManager.create_user_extended(req.session.username, req.body.age, req.body.gender, req.body.orientation, req.body.bio).then((result) => {
		if (result === true) {
			res.redirect(301, '/');
		} else {
			res.end('WTF');
		}
	}).catch((err) => {
		console.log('Error while creating new extended profile : ' + err.stack);
		res.end('error');
	});
});

app.post('/update', csrfProtection, (req, res) => {
	memberManager.updateUser(req.session.username, req.body.Firstname, req.body.Lastname, req.body.Mail, req.body.Password, req.body.Fruit).then((results) => {
		if (results !== true) {
			res.render('home.ejs', {
				user: req.session.username,
				error: results,
				csrfToken: req.csrfToken()
			});
		} else {
			res.redirect(301, '/');
		}
	}).catch((reason) => {
		console.log(reason);
		res.render('home.ejs', {
			user: req.session.username,
			error: "Une erreur est survenue, si elle persiste, veuillez nous contacter.",
			csrfToken: req.csrfToken()
		});
	});
})

app.get('/signup', csrfProtection, (req, res) => {
	let token = req.query.token;
	let username = req.query.user;
	if (typeof token != 'undefined' && typeof username != 'undefined') {
		memberManager.validateUser(username, token).then((result) => {
			res.redirect('/login');
		}).catch((err) => {
			console.log(err);
			res.render('signup.ejs', {
				user: req.session.username,
				error: 'Something went wrong, we are trying to solve it',
				csrfToken: req.csrfToken()
			});
		});
	} else {
		res.render('signup.ejs', {
			user: req.session.username,
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
				csrfToken: req.csrfToken(),
			});
		} else {
			res.render('signup_step1.ejs', {
				user: req.session.username,
				username: req.body.Username,
				mail: req.body.Mail,
			});
		}
	}).catch((reason) => {
		console.log(reason);
		res.render('signup.ejs', {
			user: req.session.username,
			error: 'Something went wrong we are trying to solve it',
			csrfToken: req.csrfToken()
		});
	});
});

app.listen(settings['port']);
