var express = require('express');                         // use 'npm install express' to install this nodejs package
var fs = require('fs');
// var buf = require('buf');

var app = express.createServer(express.logger());
var introBuf = fs.readFileSync('index.html');             // returns a buffer
var introString = introBuf.toString();                    // default is 'utf8' encoding, and converting the entire buffer

app.get('/', function(request, response) {
  response.send(introString);
});

var port = process.env.PORT || 8080                       // 5000 was default setting; 8080 is conventional setting for website debug
app.listen(port, function() {
  console.log("Listening on " + port);
});
