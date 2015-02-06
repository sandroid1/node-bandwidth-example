var debug = require('debug')('routes');
/**
 * Module dependencies
 */
var express = require('express'),
    controllers = require('../controllers');

/**
 * the new Router exposed in express 4
 */
var indexRouter = express.Router();


function saveReturnUrlIfNeed(req, res, next){
  if(req.query && req.query.next){
    debug('Save url to return %s', req.query.next);
    req.session.returnUrl = req.query.next || '/';
  }
  next();
}

function redirectToReturnUrl(req, res, next){
  res.redirect(req.session.returnUrl || '/'); //validate this url in real apps!!!
}

function getUserByCallId(req, res, next){
  if(req.body && req.body.callId){
    req.User.findOne({activeCallIds: req.body.callId}, function(err, user){
      if(err){
        return next(err);
      }
      req.user = user;
      next();
    });
  }
  else{
    next();
  }
}

function handleError(view){
  return function(err, req, res, next){
    debug('showing an error: %s', err.message);
    req.body.error = err.message;
    res.render(view, req.body);
  };
}

function authOnly(req, res, next){
  if(req.user){
    next();
  }
  else{
    res.redirect('/signIn?next=' + encodeURIComponent(req.url));
  }
}

function sendEventResponse(req, res){
  res.send('');
}

function handleEventError(err, req, res, next){
  console.error("Error on handling event on %s: %s", req.url, err.message);
  console.log(err.stack);
  res.send('');
}

indexRouter.route('/')
  .get(authOnly, controllers.index);

indexRouter.route('/signIn')
  .get(saveReturnUrlIfNeed, controllers.signInForm)
  .post(controllers.signIn, redirectToReturnUrl, handleError('signIn'));

indexRouter.route('/signUp')
  .get(saveReturnUrlIfNeed, controllers.signUpForm)
  .post(controllers.signUp, redirectToReturnUrl, handleError('signUp'));

indexRouter.route('/signOut')
  .get(controllers.signOut);

indexRouter.route('/call')
  .post(authOnly, controllers.call);

indexRouter.route('/events/admin')
  .post(getUserByCallId,  controllers.events.admin, sendEventResponse, handleEventError);

indexRouter.route('/events/externalCall')
  .post(getUserByCallId, controllers.events.externalCall, sendEventResponse, handleEventError);

exports.indexRouter = indexRouter;
