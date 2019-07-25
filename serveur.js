var express = require('express');
var app = express();
var settings = require("./server_settings.json");

app.use(express.urlencoded({extended: true}));

app.get('/', (req, res) => {
    res.render('index.ejs');
});

app.get('/login', (req, res) => {
    res.render('login.ejs');
});

app.get('/signup', (req, res) => {
    res.render('signup.ejs');
});

app.post('/signup', (req, res) => {
    let username = req.body.Username;
    let password = req.body.Password;
    let mail = req.body.Mail;
    let token = req.body.Csrf;
    res.render('signup_step1.ejs', {
        username: username,
        password: password,
        mail: mail,
        token: token
    });
});

app.listen(settings['port']);