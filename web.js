// EPO API info: app = patentvis; consumer key = 1AkwKESBGt6CrDDvjXMZtpbCteL0vyva; secret key =  zqXHPEuQCw5tyLGY
//
var express = require('express');                         // use 'npm install express' to install this nodejs package
var http = require('http');                               // part of nodejs
var https = require('https');
var fs = require('fs');
var request = require('request');                         // external package for http requests
var cheerio = require('cheerio');                         // external package like jQuery for manipulating HTML and XML docs (does not execute scripts)
var cache = require('memory-cache');                      // external package for in-memory cache; no initialization needed
var storage = require('node-persist');                    // external package to cache and store data; need to initialize before using
// var buf = require('buf');

// EPO access:
var CONSUMER_KEY = '1AkwKESBGt6CrDDvjXMZtpbCteL0vyva';
var SECRET_KEY = 'zqXHPEuQCw5tyLGY';
var QUERYING_FOR_ACCESS_KEY = false;                      // do not persist an access key; it just causes problems!
var QUERYING_FOR_BIBLIO_DATA = false;

function loadCacheObj(key) {
// load value of key from cache; if not in cache, load from storage; if
// not in storage, return undefined.
  var value = cache.get(key);
  if (!value) {
    console.log(key + " not in cache");
    value = storage.getItem(key);
    if (value) {
      console.log(key + " in storage");
      cache.put(key);
    }
  }
  return value;
}

function storeCacheObj(key, value) {
// store key, value with no expiration in both cache and persistent storage
  cache.put(key, value);
  storage.setItem(key, value);
  console.log("Cached and stored " + key);
}

function purgeStorage() {
// purge files in the persist subdirectory after 1 week
  var timeNow = (new Date()).getTime();
  var expTime = timeNow - 7*24*60*60*1000;                // 1 week
  var fileList = fs.readdirSync('persist');
  for (var iF = 0; iF < fileList.length; iF++) {
    var path = 'persist/' + fileList[iF];
    var stats = fs.statSync(path);                        // get the file information
    // check if the creation time is too long ago or file is empty due to server crash
    if (stats.ctime.getTime() < expTime || stats.size == 0) {
      fs.unlinkSync(path);                                // delete the file
    }
  }
}

// persistent storage
purgeStorage();                                           // purge old persisted data
// required initialization - use Synchronous version! persisted objects in /persist by default;
// initSync() crashes if file is empty!
storage.initSync();


var googleHost = 'www.google.com';
var googleURL = '';
var googlePath = '';
var googleReqParam = {};
var googleReq;0

var app = express();                                      // create the server
// express.logger is the same as connect.logger - documentation is at www.senchalabs.org/connect/logger.html
app.use(express.logger('default'));
// give access to 'lib' directory tree so can serve .css and .js files referenced in index.html  
app.use(express.static(__dirname + '/lib'));
app.use('/epoapi/biblio/', express.bodyParser());         // bodyParser is used by express request.body to parse the body of a POST request

var introBuf = fs.readFileSync('index.html');             // returns a buffer
var introString = introBuf.toString();                    // default is 'utf8' encoding, and converting the entire buffer

app.get('/*', function(clientReq, serverResp) {               // clientReq is an instance of express Request object, which inherits from
  var url = clientReq.url;
  switch (true) {                                         // http.IncomingMessage and stream.Readable; serverResp is an instance of express
    case url == '/' || url == '/yappee/':                 // Response object, inherits from http.ServerResponse stream.Writable
      clientReqLogging(clientReq, 'GET');
      console.log('Homepage url: ' + clientReq.url);
      serverResp.send(introString);
      break;
    case url == '/epoapi/biblio/':
      break;
    case /^\/manager\//.test(url) || /^http:\/\//.test(url): // weed out these requests from Chinese IP's and internet mapping bots
      console.log("\nReceived request for /manager/ page and will not respond.  Request details are: ");
      clientReqLogging(clientReq, 'GET');              // and prevent them from being sent to Google
      break;
    default:
      googleReqHeader = prepGoogleReqHeader(clientReq);
      // make all requests to Google as https: to port 443, but send responses and redirects back to client as http: on port 8080
      googleReqParam = HTTPRequestParameters(googleHost, url, 'GET', 443, googleReqHeader);
      googleReq = https.request(googleReqParam, function(googleResp) {processRes(googleReqParam, googleResp, clientReq, serverResp);});
      googleReq.end();
      break;
  }
});

app.head('/*', function(clientReq, serverResp) {
  var url = clientReq.url;
  console.log("\nHEAD request received for " + url);
  switch (true) {
    case /^\/patents\//.test(url):
      googlePath = clientReq.url;
      googleReqHeader = prepGoogleReqHeader(clientReq);
      googleReqParam = HTTPRequestParameters(googleHost, googlePath, 'HEAD', 443, googleReqHeader);
      googleReq = https.request(googleReqParam, function(googleResp) {processRes(googleReqParam, googleResp, clientReq, serverResp);});
      googleReq.end();
      break;
  }
});

app.post('/*', function(clientReq, serverResp) {           // clientReq is an instance of express Request object, which inherits from
  var url = clientReq.url;
  switch (true) {                                          // http.IncomingMessage and stream.Readable; serverResp is an instance of express
    case url == '/' || url == '/yappee/':                             // Response object, inherits from http.ServerResponse stream.Writable
      clientReqLogging(clientReq, 'POST');
      console.log('Homepage url: ' + url);
      serverResp.send(introString);
      break;
    case url == '/epoapi/biblio/':
      express.bodyParser(clientReq);                       // make body of POST request available via clientReq.body
      var cacheKey = clientReq.body['CacheKey'];
      console.log("CacheKey from clientReq: " + cacheKey);

      if (cacheKey) {                                      // requesting the results to be pulled from cache; if not
        cachedResp = loadCacheObj(cacheKey);
        if (cachedResp) {
          console.log("Sending biblio data for " + cacheKey + " from cache or storage");
          serverResp.send(cachedResp);
          return;
        }
      }

      var nTries = 0;
      // request an access token from EPO and call back getEPOBiblio when done;
      getAccessToken(getEPOBiblio);                                // getEPOBiblio is the callback

      function getEPOBiblio(access_token, error_message) {              // callback function for getAccessToken
        QUERYING_FOR_BIBLIO_DATA = true;
        setTimeout(function() {QUERYING_FOR_BIBLIO_DATA = false;}, 100);            // space EPO API queries at least 100 msec apart
        if (access_token) {
          patent_list = clientReq.body['Request Body'];
          getEPOBiblioData(access_token, patent_list, sendEPOData);     // sendEPOData is the callback
          nTries += 1;
        }
        else {
         sendEPOData(null, error_message);                              // send error_message from getAccessToken
        }
      }

      function sendEPOData(jsonStr, error_message) {                    // callback function for getEPOBiblioData
        if (jsonStr) {
          console.log("In sendEPODdata, cacheKey is: " + cacheKey);
          serverResp.send(jsonStr);
          if (cacheKey) {
            storeCacheObj(cacheKey, jsonStr);
          }            
        }
        else {
console.log("nTries: ", nTries);
          if (error_message.message == "invalid_access_token" && nTries == 1) {
            nTries += 1;
            console.log("In sendEPOData, access token was invalid (probably expired); get a fresh one");
            cache.del("access_obj");
            getAccessToken(getEPOBiblio);                               // getEPOBiblio is the callback
          }
          else {
           console.log("In sendEPOData, error in getting access token or querying EPO API: " + JSON.stringify(error_message));
           serverResp.send(JSON.stringify(error_message));
          }
        }
      }
      break;
    default:
      googleReqHeader = prepGoogleReqHeader(clientReq);
      googleReqParam = HTTPRequestParameters(googleHost, url, 'POST', 80, googleReqHeader);
      googleReq = http.request(googleReqParam, function(googleResp) {processRes(googleReqParam, googleResp, clientReq, serverResp);});
      clientReq.on('data', function(chunk) {googleReq.write(chunk);} );  // 'data' and 'end' events inherited from nodejs Readable stream
      clientReq.on('end', function() { googleReq.end();} );
  }
});

function looksLikeJSON(jsonStr) {
  return (jsonStr[0] == '{' && jsonStr.slice(-1) == '}');
}

function getEPOBiblioData(access_token, patent_list, callback) {
  // get the requested EPO bibliographic patent data using the access_token;
  // the callback function is sendEPOData with arguments jsonStr containing the data
  // in json format and error_message (JSON object)
  console.log("Querying EPO API for patent biblio data at " + Date.now()); 
  request.post({url: "https://ops.epo.org/3.1/rest-services/published-data/publication/epodoc/biblio",
                headers: {"Authorization": "Bearer " + access_token,
                          "Accept": "application/json"},
                form: {"Request Body": patent_list}   // also sets header Content-Type: "application/x-www-form-urlencoded; charset=UTF-8")
                },
      function(error, response, body) {               // error is a request error object, not an HTTP error
        console.log("getEPOBiblioData response statusCode: " + response.statusCode);
        if (!error) {
          switch (response.statusCode) {
            case 200:
              if (looksLikeJSON(body)) {              // if it looks like JSON, call back with patent data
                console.log("In getEPOBiblioData, sending patent data");
                callback(body, null);
              }
              else {                                  // it is an error message in XML - should never happen with statusCode 200???
                var error_message = getEPOError(response, body);
                console.log("In getEPOBiblioData, error from EPO server: " + JSON.stringify(error_message));
                callback(null, error_message);
              }
              break;
            case 400: case 401: case 403: case 404: case 405: case 413: case 500: case 503: case 504: default:
              var error_message = getEPOError(response, body);
              console.log("In getEPOBiblioData, error from EPO server: " + JSON.stringify(error_message));
              callback(null, error_message);
              break;
          }
        }
        else {
          var error_message = getHTTPError(response, "", body, "", "Error from request in getEPOBiblioData");
          console.log("In getEPOBiblioData, HTTP error: " + JSON.stringify(error_message));
          console.log("Error object from request: ");
          console.log(error);
          callback(null, error_message);
        }
     });
}

function getAccessToken(callback) {
  // get the EPO access token; check cache, and if not there get one from EPO
  // the callback function arguments are access_token (string), error_message (JSON object)
  if (!QUERYING_FOR_ACCESS_KEY && !QUERYING_FOR_BIBLIO_DATA) {
    var access_obj = cache.get('access_obj');                  // cached access_obj can be expired if server if this is the first request
    if (access_obj) {                                          // after starting the server
      callback(access_obj['access_token'], null);
      console.log("Got access key from cache");
    }
    else {
      getNewAccessToken(callback);
    }
  }
  else {
    console.log("Waiting for previous query for access token or patent data to complete...");
    setTimeout(getAccessToken, 15, callback);
  }
}

function getNewAccessToken(callback) {
  // POST request to EPO for new access token;
  // call the callback with arguments access_token and error_message when done.
  QUERYING_FOR_ACCESS_KEY = true;
  request.post({url: "https://ops.epo.org/3.1/auth/accesstoken",
                auth: {"user": CONSUMER_KEY,
                       "pass": SECRET_KEY},
                // also sets header Content-Type: "application/x-www-form-urlencoded; charset=UTF-8")
                form: {"grant_type": "client_credentials"}
                },
     function(error, response, body) {             // error is a request error object, not an HTTP error
       console.log("getNewAccessToken response statusCode: " + response.statusCode);
       console.log("In getNewAccessToken, response is: " + body);
       if (!error) {
         switch (response.statusCode) {
           case 200:
             if (looksLikeJSON(body)) {                // if it looks like JSON, cache it and call back
               var access_obj = JSON.parse(body);
               var access_token = access_obj["access_token"];
               var expires = 1000*parseInt(access_obj["expires_in"]);  // expiration time in msec
               cache.put('access_obj', access_obj, expires);           // cache it with an expiration time
               QUERYING_FOR_ACCESS_KEY = false;
               console.log("New access token from EPO: " + access_token);
               callback(access_token, null);
             }
             else {                                     // it is an error message in XML
               var error_message = getEPOError(response, body);
               console.log("In getNewAccessToken, error from EPO server: ", JSON.stringify(error_message));
               callback(null, error_message);
             }
             break;
           case 400: case 401: case 403: case 404: case 405: case 413: case 500: case 503: case 504: default:
             var error_message = getEPOError(response, body);
             console.log("In getNewAccessToken, error from EPO server: " + JSON.stringify(error_message));
             callback(null, error_message);
             break;
         }
       }
       else {
         var error_message = getHTTPError(response, "", body, "", "Error from request in getNewAccessToken");
         console.log("In getNewAccessToken, HTTP error: " + JSON.stringify(error_message));
         console.log("Error object from request: ");
         console.log(error);
         callback(null, error_message);
       }
     });
}

function getEPOError(response, body) {
  // parse an EPO error response body, which is in XML
  var $ = cheerio.load(body, {xmlMode: true});
  var EPO_error_code = $("code").text();
  var EPO_error_message = $("message").text();
  var EPO_error_description = $("description").text();
   // XML starts with <error> tag
   // 400 message could be invalid_request, invalid_client, unsupported_grant_type, invalid_access_token
   // 401 (Unauthorized) status code to indicate which HTTP authentication schemes are supported
   // 403 description could be "This request has been rejected due to the violation of Fair Use policy" (usage rate exceeded)
   //     (no message)         "This request has been rejected" if resource is blacklisted (due to too busy or other cause, see my EPO notes)
   //                          "Developer account is blocked" (uh-oh).
  if ($("error").length > 0) {                             // an <error> tag encloses the error message
    var error_message = getHTTPError(response, EPO_error_code, EPO_error_message, EPO_error_description, "EPO request layer 2 error");
  }
   // XML starts with <fault> tag
   // 400 code could be CLIENT.InvalidQuery or CLIENT.CQL
   // 403 code CLIENT.RobotDetected
   // 404 code could be CLIENT.InvalidReference, CLIENT.WrongReferenceFormatting, CLIENT.NotFound, SERVER.EntityNotFound
   // 405 code CLIENT.MethodNotAllowed
   // 413 code CLIENT.Ambiguous Request
   // 500 code SERVER.DomainAccess (request could not be processed; try again later)
   // 503 code SERVER.LimitedServerResources (Temporarily unavailable)
   // 504 code SERVER.????                   (Please reduce query size)
  else {                                                   // a <fault> tag encloses the error message
    var error_message = getHTTPError(response, EPO_error_code, EPO_error_message, EPO_error_description, "EPO request layer 1 error");
  }
  return error_message;
}

function getHTTPError(response, code, message, description, source) {
  // create an error object using response.statusCode and the message string
  return {"Response status code": response.statusCode,
          "EPO error code": code,
          "message": message,
          "description": description,
          "source": source};
}

function prepGoogleReqHeader(clientReq) {
    var googleReqHeader = JSON.parse(JSON.stringify(clientReq.headers));
    delete googleReqHeader.host;
    if (googleReqHeader['referer']) delete googleReqHeader.referer;
    console.log('\In prepGoogleReqHeader, received clientReq from ' + clientReq.ip + ' for ' + clientReq.headers['host'] + clientReq.url + ': ');
    console.log('Sending request header to Google: ', googleReqHeader);
    return googleReqHeader;
}

function clientReqLogging(clientReq, type) {
    console.log('\nIn clientReqLogging, received ' + type + ' request from ' + clientReq.ip + 
                '\nfor ' + clientReq.headers['host'] + clientReq.url + 
                '\nwith referer ' + clientReq.headers['referer'] + "." +
                '\nRequest headers are: ');
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
