/*	
 * Copyright IBM Corp. 2016
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @author Steven Atkin
 */


var express = require('express');
var router = express.Router();
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var request = require('request');
var watson = require('watson-developer-cloud');

var serviceRegex = /(text_to_speech).*/;

var options = optional('./text-to-speech-credentials.json') || {
    appEnv: appEnv
};

// parse vcap using cfenv if available
if (options.appEnv && !options.credentials) {
    options.credentials = cfEnvUtil.getServiceCredsByLabel(options.appEnv, serviceRegex);
}
// try again with name
else if (options.appEnv && !options.credentials) {
    options.credentials = options.appEnv.getServiceCreds(serviceRegex);
}

function ensureAuthenticated(req, res, next) {
  if (!req.isAuthenticated() && process.env.NODE_ENV == 'production') {
    req.session.originalUrl = req.originalUrl;
    res.redirect('/login');
  } else {
    return next();
  }
}


var authorization = new watson.AuthorizationV1({
  username: options.credentials.username,
  password: options.credentials.password,
  url: options.credentials.url
});

router.get('/speak', ensureAuthenticated, function(req, res) {
  // make the request to Watson to synthesize the audio file from the query text
  var transcript = authorization.synthesize(req.query.text);
 
  // set content-disposition header if downloading the
  // file instead of playing directly in the browser
  transcript.on('response', function(response) {
    console.log(response.headers);
    if (req.query.download) {
      response.headers['content-disposition'] = 'attachment; filename=transcript.ogg';
    }
  });
  // pipe results back to the browser as they come in from Watson
  transcript.pipe(res);
});


router.get('/token', ensureAuthenticated, function(req, res) {
  authorization.getToken(function(err, token) {
    if (err) {
      console.log('Error retrieving token: ', err);
      res.status(500).send('Error retrieving token');
      return;
    }
    res.send(token);
  });
});


module.exports = router;