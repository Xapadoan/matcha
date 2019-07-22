var express = require('express');
var app = express();
var settings = require("./server_settings.json");

app.get('/', (req, res) => {
    res.render('index.ejs');
});

app.get('/login', (req, res) => {
    res.render('login.ejs');
});

app.get('/signup', (req, res) => {
    res.render('signup.ejs');
})

app.listen(settings['port']);