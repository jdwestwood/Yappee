// EPO API info: app = patentvis; consumer key = 1AkwKESBGt6CrDDvjXMZtpbCteL0vyva; secret key =  zqXHPEuQCw5tyLGY
//
var express = require('express');                         // use 'npm install express' to install this nodejs package
var http = require('http');                               // part of nodejs
var https = require('https');
var fs = require('fs');
var request = require('request');                         // external package for http requests
var cheerio = request('cheerio');                         // external package like jQuery for manipulating HTML and XML docs (does not execute scripts)
var cache = request('node-cache');
var storage = request('node-persist');                    // external package to cache and store data
// var buf = require('buf');

EPO access:
var CONSUMER_KEY = '1AkwKESBGt6CrDDvjXMZtpbCteL0vyva';
var SECRET_KEY = 'zqXHPEuQCw5tyLGY';
loadAccessObj();                                          // check if EPO access object in storage is still valid and cache it if it is

function loadAccessObj() {
  var access_obj = storage.getItem('access_obj');
  if (access_obj) {
    var expires_in = 1000*parseInt(access_obj['expires_in']);  // original expiration time in msec
    cache.put('access_obj', acess_obj, expires_in);       // could be expired
  }
}

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

app.get('/*', function(clientReq, serverResp) {               // clientReq is an instance of express Request object, which inherits from
  switch (clientReq.url) {                                    // http.IncomingMessage and stream.Readable; serverResp is an instance of express
    case '/': case '/yappee':                                 // Response object, inherits from http.ServerResponse stream.Writable
      clientReqLogging(clientReq, 'GET');
      console.log('Homepage url: ' + clientReq.url);
      serverResp.send(introString);
      break;
    case '/epoapi/biblio':
      break;
    default:
      googlePath = clientReq.url;
      googleReqHeader = prepGoogleReqHeader(clientReq);
      // make all requests to Google as https: to port 443, but send responses and redirects back to client as http: on port 8080
      googleReqParam = HTTPRequestParameters(googleHost, googlePath, 'GET', 443, googleReqHeader);
      googleReq = https.request(googleReqParam, function(googleResp) {processRes(googleReqParam, googleResp, clientReq, serverResp);});
      googleReq.end();
      break;
  }
});

app.post('/*', function(clientReq, serverResp) {               // clientReq is an instance of express Request object, which inherits from
  switch (clientReq.url) {                                     // http.IncomingMessage and stream.Readable; serverResp is an instance of express
    case '/': case '/yappee':                                  // Response object, inherits from http.ServerResponse stream.Writable
      clientReqLogging(clientReq, 'POST');
      console.log('Homepage url: ' + clientReq.url);
      serverResp.send(introString);
      break;
    case '/epoapi/biblio':
      var nTries = 1;
      getAccessToken(getEPOBiblio);                                     // getEPOBiblio is the callback

      function getEPOBiblio(access_token, error_message) {
        if (access_token) {
          patent_list = clientReq.body['Request Body'];
          getEPOBiblioData(access_token, patent_list, sendEPOData);  // sendEPOData is the callback
          nTries += 1;
        else {
         sendEPOData(null, error_message);              // error_message from getAccessToken
        }
      }
      function sendEPOData(jsonStr, error_message) {
        if (jsonStr) {
          serverResp.send(jsonStr);
        else {
          if (error_message.message = "invalid_access_token" & nTries == 1) {
            nTries += 1;
            getAccessToken(getEPOBiblio);
          }
          else {
           serverResp.send(JSON.stringify(error_message));
          }
        }
      }
      // request an access token from EPO; successful requests return JSON, but errors such as an expired access token return XML!
                   });
      break;
    default:
      googlePath = clientReq.url;
      googleReqHeader = prepGoogleReqHeader(clientReq);
      googleReqParam = HTTPRequestParameters(googleHost, googlePath, 'POST', 80, googleReqHeader);
      googleReq = http.request(googleReqParam, function(googleResp) {processRes(googleReqParam, googleResp, clientReq, serverResp);});
      clientReq.on('data', function(chunk) {googleReq.write(chunk);} );  // 'data' and 'end' events inherited from nodejs Readable stream
      clientReq.on('end', function() { googleReq.end();} );
  }
});

function looksLikeJSON(jsonStr) {
  return (jsonStr[0] == '{' & jsonStr[-1] == '}');
}

function getEPOBiblioData(access_token, patent_list, callback) {
  // get the requested EPO bibliographic patent data using the access_token
  // the callback function arguments are jsonStr containing the data in json format and error_message (JSON object)
  request.post({url: "https://ops.epo.org/3.1/rest-services/published-data/publication/epodoc/biblio",
                headers: {"Authorization": "Bearer " + access_token,
                          "Accept": "application/json"},
                form: {"Request Body": patent_list}  // also sets header Content-Type: "application/x-www-form-urlencoded; charset=UTF-8")
                },
      function(error, response, body) {               // error is a request error object, not an HTTP error
        console.log("getNewAccessToken response statusCode: " + response.statusCode);
        if (!error & response.statusCode == 200) {
          if (looksLikeJSON(body)) {                // if it looks like JSON, cache it and call back
            callback(body, null);
          }
          else {                                     // it is an error message in XML
            var error_message = getEPOError(body);
            console.log(error_message);
            callback(null, error_message);
          }
        }
        else {
          var error_message = getHTTPError(response, "Error from request in getEPOBiblioData");
          callback(null, error_message);
        }
     }
}

function getAccessToken(callback) {
  // get the EPO access token; check cache, and if not there get one from EPO
  // the callback function arguments are access_token (string), error_message (JSON object)
  var access_obj = cache.get('access_obj');                  // cached access_obj can be expired if server if this is the first request
  if (access_obj) {                                          // after starting the server
    callback(access_obj['access_token'], null);
  }
  else {
    getNewAccessToken(callback);
  }
}

function getNewAccessToken(callback) {
  // POST request to EPO for new access token;
  // call the callback with arguments access_token and error_message when done.
  request.post({url: "https://ops.epo.org/3.1/auth/accesstoken",   //"https://ops.epo.org/3.1/rest-services/published-data/publication/epodoc/biblio",
                auth: {"user": CONSUMER_KEY,
                       "pass": SECRET_KEY},
                form: {"grant_type": "client_credentials"}   // also sets header Content-Type: "application/x-www-form-urlencoded; charset=UTF-8")
                },
     function(error, response, body) {             // error is a request error object, not an HTTP error
       console.log("getNewAccessToken response statusCode: " + response.statusCode);
       console.log("Body: " + body);
       if (!error & response.statusCode == 200) {
         if (looksLikeJSON(body)) {                // if it looks like JSON, cache it and call back
           var access_obj = JSON.parse(body);
           var access_token = access_obj["access_token"];
           var expires = 1000*parseInt(access_obj["expires_in"]);  // expiration time in msec
           cache.put('access_obj', access_obj, expires);           // cache it with an expiration time
           storage.setItem('access_token', access_obj);            // store it
           console.log("New access token from EPO: " + access_token);
           callback(access_token, null);
         }
         else {                                     // it is an error message in XML
           $ = cheerio.load(body, {xmlMode: true});
           var error_message = getEPOError(body);
           console.log(error_message);
           callback(null, error_message);
         }
       }
       else {
         var error_message = getHTTPError(response, "Error from request in getNewAccessToken");
         callback(null, error_message);
       }
     }
}

function getEPOError(xmlString) {
  // parse an EPO error response body
  $ = cheerio.load(xmlString, {xmlMode: true});
  return {"error_num": $("code").text(),
          "message": $("message").text(),
          "description": $("description").text()};
}

function getHTTPError(response, message) {
  // create an error object using response.statusCode and the message string
  return {"error_num": response.statusCode,
          "message": message,
          "description": ""};
}

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
    console.log('clientReq referer: ' + clientReq.headers['referer']);
    console.log('\nclientReq headers: ');
    console.log(clientReq.headers);
}

var port = process.env.PORT || 8080                       // 5000 was default setting; 8080 is conventional setting for website debug
app.listen(port, function() {
  console.log("Listening on " + port);
});

function processRes(extReq, extResp, clientReq, serverResp) {
// extReq is an object returned from HTTPRequestParameters - instance of http.ServerResponse; extResp is instance of http.IncomingMessage;
// clientReq is instance of express Request object and serverResp is instance of express Response object (as described above)

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
