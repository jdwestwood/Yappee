var express = require('express');                         // use 'npm install express' to install this nodejs package
var http = require('http');                               // part of nodejs
var https = require('https');
var fs = require('fs');
// var buf = require('buf');

var pathGooglePatSearch = '/google_pat_search';
var pathGooglePatSearchSubmit = '/google_pat_search_submit';
var googleHost = 'www.google.com';
var googleURL = '';
var googlePath = '';
var googleReqParam = {};
var googleReq;

var app = express.createServer(); //express.logger());
app.use(express.logger('default'));
app.use(express.static(__dirname + '/lib'));              // give access to 'lib' directory tree so can serve .css and .js files referenced in index.html  
var introBuf = fs.readFileSync('index.html');             // returns a buffer
var introString = introBuf.toString();                    // default is 'utf8' encoding, and converting the entire buffer

app.get('/*', function(clientReq, serverResp) {               // clientReq is an instance of http.IncomingMessage; serverResp is an instance of http.ServerResponse
  clientReqLogging(clientReq, 'GET');
  if (clientReq.url == '/' || clientReq.url == '/yappee') {
    console.log('Homepage url: ' + clientReq.url);
    serverResp.send(introString);
  }
  else {
    googlePath = clientReq.url;
    googleReqHeader = prepGoogleReqHeader(clientReq);
      // make all requests to Google as https: to port 443, but send responses and redirects back to client as http: on port 8080
    googleReqParam = HTTPRequestParameters(googleHost, googlePath, 'GET', 443, googleReqHeader);
    googleReq = https.request(googleReqParam, function(googleResp) {processRes(googleReqParam, googleResp, clientReq, serverResp);});
    googleReq.end();
  };
});

app.post('/*', function(clientReq, serverResp) {               // clientReq is an instance of http.IncomingMessage; serverResp is an instance of http.ServerResponse
  clientReqLogging(clientReq, 'POST');
  if (clientReq.url == '/' || clientReq.url == '/yappee') {
    console.log('Homepage url: ' + clientReq.url);
    serverResp.send(introString);
  }
  else {
    googlePath = clientReq.url;
    googleReqHeader = prepGoogleReqHeader(clientReq);
    googleReqParam = HTTPRequestParameters(googleHost, googlePath, 'POST', 80, googleReqHeader);
    googleReq = http.request(googleReqParam, function(googleResp) {processRes(googleReqParam, googleResp, clientReq, serverResp);});
    clientReq.on('data', function(chunk) {googleReq.write(chunk);} );
    clientReq.on('end', function() { googleReq.end();} );
//    googleReq.end();
  };
});

function prepGoogleReqHeader(clientReq) {
    var googleReqHeader = JSON.parse(JSON.stringify(clientReq.headers));
    delete googleReqHeader.host;
    if (googleReqHeader['referer']) delete googleReqHeader.referer;
    console.log('\ngoogleReqHeader from ' + clientReq.headers['host'] + clientReq.url + ': ');
    console.log(googleReqHeader);
    return googleReqHeader;
}

function clientReqLogging(clientReq, type) {
    console.log('\nRequest type: ' + type);
    console.log('clientReq host: ' + clientReq.headers['host']);
    console.log('clientReq.url: ' + clientReq.url);
//    console.log('clientReq.url.indexOf: ' + clientReq.url.indexOf(pathGooglePatSearch));
    console.log('clientReq referer: ' + clientReq.headers['referer']);
    console.log('\nclientReq headers: ');
    console.log(clientReq.headers);
}

var port = process.env.PORT || 8080                       // 5000 was default setting; 8080 is conventional setting for website debug
app.listen(port, function() {
  console.log("Listening on " + port);
});

function processRes(extReq, extResp, clientReq, serverResp) {
// extReq is an object returned from HTTPRequestParameters, extResp and clientReq are instances of http.IncomingMessage;
// serverResp is instance of http.ServerResponse

  console.log('\nResponse statusCode: ' + extResp.statusCode);
  console.log(extResp.headers);
  console.log('Response content-type: ' + extResp.headers['content-type']);

  serverRespHeader = JSON.parse(JSON.stringify(extResp.headers)); // make copy of the extResp headers, so can modify them if needed before relaying to the client

  if (extResp.statusCode == '302') {             // clientReq has been redirected; need to substitute the server host for the external host in the redirected location url
    var extRedirectedLoc = extResp.headers['location'];
    var serverRedirectedLoc = extRedirectedLoc.replace(extReq['host'], clientReq.headers['host']);
      // make all requests to Google as https: to port 443, but send responses and redirects back to client as http: on port 8080
    serverRedirectedLoc = serverRedirectedLoc.replace('https', 'http');
    console.log('extRedirectedLoc: ' + extRedirectedLoc);
    console.log('serverRedirectedLoc: ' + serverRedirectedLoc);
    serverRespHeader['location'] = serverRedirectedLoc;
  }

  serverResp.writeHead(extResp.statusCode, serverRespHeader);

  extResp.on('data', function(chunk) {
      serverResp.write(chunk);
  });
  extResp.on('end', function() {
//    console.log('ServerResp length: ' + serverResp.getHeader['content-length']);
    serverResp.end();
  });
}

function HTTPRequestParameters(host, path, method, port, headers) {
  return {host: host,
          path: path,
          method: method,
          port: port,
          headers: headers
         };
}
