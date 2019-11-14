var express = require('express');
var app = express();

app.get('/', (req, res) => {
	res.render('log.ejs');
});

app.listen(8080);
