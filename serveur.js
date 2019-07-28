var express = require('express');
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
		stylesheets: ['css/signup.css']
	});
});

app.post('/signup', (req, res) => {
	let token = req.body.Csrf;
	memberManager.createUser(req.body.Username, req.body.LastName, req.body.FirstName, req.body.Mail, req.body.Password);
	res.render('signup_step1.ejs', {
		stylesheets : ['css/signup_step1.css'],
		username: username,
		password: password,
		mail: mail,
		token: token
	});
});

app.listen(settings['port']);