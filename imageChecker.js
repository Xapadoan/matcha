var fs = require ('fs');

function getBinary(filename) {
    return (new Promise((resolve, reject) => {
        fs.readFile(filename, (err, data) => {
            if (err) {
                console.log('getBinary : Failed to read binary file : ' + err.stack);
                reject (err);
            } else {
                resolve(data);
            }
        });
    }));
}

module.exports = {
    checkPNG: function checkPNG(filename) {
        getBinary(filename).then((data) => {
            console.log(data);
            if (data[1] == 89) {
                console.log('OK');
            }
        }).catch((err) => {
            console.log("Failed to checkPNG: " + err.stack);
        });
    }
}