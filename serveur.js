var express = require('express');
var bcrypt = require('bcrypt');
var settings = require("./server_settings.json");
var memberManager = require("./memberManager.js");


var app = express();

//required to retrieve x-www-form-encoded in req.body
app.use(express.urlencoded({extended: true}));
//required to serve static files (stylesheets, images, ...)
app.use(express.static('resources'));

app.get('/', (req, res) => {
	res.render('index.ejs');
});

app.get('/login', (req, res) => {
	res.render('login.ejs');
});

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
	else if (memberManager.createUser(req.body.Username, req.body.Lastname, req.body.Firstname, req.body.Mail, req.body.Password) === false) {
		res.render('signup.ejs', {
			error: 'Le pseudo et l\'addresse mail doivent être uniques',
		});
	} else {
		res.render('signup_step1.ejs', {
			username: req.body.Username,
			mail: req.body.Mail,
		});
	}
});

app.listen(settings['port']);