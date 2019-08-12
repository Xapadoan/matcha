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
	res.render('index.ejs');
});

app.get('/login', (req, res) => {
	res.render('login.ejs');
});

app.post('/login', (req, res) => {
	memberManager.logg_user(req.body.username, req.body.password);
})

app.get('/signup', (req, res) => {
	res.render('signup.ejs', {
	});
});

app.post('/signup', (req, res) => {
	let token = req.body.Csrf;
	if (memberManager.checkPassword(req.body.Password) !== true) {
		res.render('signup.ejs', {
			error: 'Le mot de passe doit contenir au moins 8 caractères dont une majuscule, une minuscule et un chiffre.',
		});
	}
	memberManager.createUser(req.body.Username, req.body.Lastname, req.body.Firstname, req.body.Mail, req.body.Password).then((res) => {
		if (res.indexOf("Error : ") >= 0) {
			res.render('signup.ejs', {
				error: 'Le pseudo et l\'addresse mail doivent être uniques',
			});
		} else {
			res.render('signup_step1.ejs', {
				username: req.body.Username,
				mail: req.body.Mail,
			});
		}
	}).catch((reason) => {
		res.render('signup.ejs', {
			error: 'Something went wrong we are trying to solve it'
		});
	});
});	

app.listen(settings['port']);