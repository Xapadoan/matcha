var request = require('request');

function generateFruit() {
    fruits = ['#pasdecoupdunsoir', '#unsoir', '#serieux', '#pqr'];
    key = Math.floor(Math.random() * 4);
    return(fruits[key]);
}

function generateAge() {
    age = Math.floor(Math.random * 20);
    return (18 + age);
}

function generateMail(Firstname, Lastname) {
    sep = ['-', '_', '.', ''];
    hosts = ['gmail.com', 'hotmail.com', 'hotmail.fr', 'live.fr'];
    sep_key = Math.floor(Math.random() * 4);
    hosts_key = Math.floor(Math.random() * 4);
    return(Firstname + sep[sep_key] + Lastname + '@' + hosts[hosts_key]);
}

function generateOrientation () {
    i = Math.floor(Math.random(3));
    if (i == 1) {
        return ('Women');
    } else if (i == 2) {
        return ('Man');
    } else {
        return ('Both');
    }
}

function affectionSentence() {
    sentences = ['j\'adore', 'j\'aime', 'j\'aime beaucoup', 'j\'apprécie', 'je suis fan de'];
    return (sentences[Math.floor(Math.random() * sentences.length)]);
}

function generateBio () {
    sports = ['rugby', 'foot', 'football', 'danse', 'natation', 'equitation', 'athletisme', 'courseapied', 'slackline', 'escalade', 'gymnastique', 'velo', 'ski', 'snowboard', 'surf', 'tennis', 'skateboard'];
    sports_key = Math.floor(Math.random() * sports.length);
}

function generateFemales() {
    request.get('https://fr.fakenamegenerator.com/gen-female-fr-fr.php', null, (err, res, body) => {
        if (err) {
            console.log('An error occured while generating new identity');
        }
        //we need:  <div class='address'>
        //              <h3>Firstname Lastname</h3>
        //          </div>
        //          <a id='geo' href='...'>lat lng</a>
        i1 = body.indexOf('<div class="address">');
        i1 = body.indexOf('<h3>', i1) + 4;
        i2 = body.indexOf('</h3>', i1);
        names = body.substring(i1, i2);
        i1 = body.indexOf('<a id="geo" href="javascript:void(0)">');
        i1 = body.indexOf('>', i1);
        i2 = body.indexOf('</a>', i1);
        geo = body.substring(i1, i2);
        console.log('Name : ' + names);
        console.log('Geo : ' + geo);
    });
}

generateFemales();