var express = require('express');
var session = require('express-session');
var bcrypt = require('bcrypt');
var settings = require("./server_settings.json");
var memberManager = require("./memberManager.js");

var app = express();

//required to retrieve x-www-form-encoded in req.body
app.use(express.urlencoded({extended: true}));
//required to serve static files (stylesheets, images, ...)
app.use(express.static('resources'));
//required for session usage
app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));

app.get('/', (req, res) => {
	if (req.session.username) {
		res.render('home.ejs', {
			user: req.session.username
		});
	} else {
		res.render('index.ejs', {
			user: req.session.username
		});
	}
});

app.get('/login', (req, res) => {
	res.render('login.ejs', {
		user: req.session.username
	});
});

app.get('/recover', (req, res) => {
	res.render('recover.ejs', {
		user: req.session.username
	});
});

app.post('/recover', (req, res) => {
	res.end('Not available yet !');
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

app.post('/complete', (req, res) => {
	memberManager.create_user_extended(req.session.username, req.body.age, req.body.gender, req.body.orientation, req.body.bio).then((result) => {
		if (result === true) {
			res.end ('Age : ' + req.body.age + '<br>Genre : ' + req.body.gender + '<br />Orientation : ' + req.body.orientation + '<br />Bio : ' + req.body.bio);
		} else {
			res.end('WTF');
		}
	}).catch((err) => {
		res.end('error');
	});
});

app.post('/login', (req, res) => {
	memberManager.logg_user(req.body.username, req.body.password).then((result) => {
		if (result !== false) {
			req.session.username = result;
			res.redirect('/');
		} else {
			res.end('auth failed')
		}
	}).catch ((reason) => {
		res.end('Error : ' + reason);
	});
});

app.get('/signup', (req, res) => {
	let token = req.query.token;
	let username = req.query.user;
	if (typeof token != 'undefined' && typeof username != 'undefined') {
		memberManager.validateUser(username).then((res) => {
			res.redirect('/login');
		}).catch((err) => {
			console.log(err);
			res.render('signup.ejs', {
				user: req.session.username,
				error: 'Something went wrong, we are trying to solve it'
			});
		});
	} else {
		res.render('signup.ejs', {
			user: req.session.username
		});
	}
});

app.post('/signup', (req, res) => {
	memberManager.createUser(req.body.Username, req.body.Lastname, req.body.Firstname, req.body.Mail, req.body.Password).then((result) => {
		if (result !== true) {
			res.render('signup.ejs', {
				user: req.session.username,
				error: result,
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
			error: 'Something went wrong we are trying to solve it'
		});
	});
});	

app.listen(settings['port']);
