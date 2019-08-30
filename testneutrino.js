var request = require('request');
var serv = require('./server_settings.json');

var params = {
    'user-id': serv.neutrino_id,
    'api-key': serv.neutrino,
    'latitude': 48.887398399999995,
    'longitude': 2.3126016,
    'language-code': 'fr',
    'zoom': 'city'
};

request.post(
    'https://neutrinoapi.com/geocode-reverse',
    {form: params},
    function (error, response, body) {
        console.log('Done');
      if (!error && response.statusCode == 200) {
          var result = JSON.parse(body);
          console.log(result['country']);
          console.log(result['country-code']);
          console.log(result['region']);
          console.log(result['city']);
      } else {
          console.log(error);
      }
    }
);