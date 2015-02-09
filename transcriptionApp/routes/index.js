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


//save url to return
function saveReturnUrlIfNeed(req, res, next){
  if(req.query && req.query.next){
    debug('Save url to return %s', req.query.next);
    req.session.returnUrl = req.query.next || '/';
  }
  next();
}

//redirect to saved url to return
function redirectToReturnUrl(req, res, next){
  res.redirect(req.session.returnUrl || '/'); //validate this url in real apps!!!
}

//set user data by call id to req.user
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

//handle errors
function handleError(view){
  return function(err, req, res, next){
    debug('showing an error: %s', err.message);
    req.body.error = err.message;
    res.render(view, req.body);
  };
}

//allow anly authorized requests only
function authOnly(req, res, next){
  if(req.user){
    next();
  }
  else{
    res.redirect('/signIn?next=' + encodeURIComponent(req.url));
  }
}

//all routes /events/XXXX should return nothing. use this function for that
function sendEventResponse(req, res){
  res.send('');
}

//don't say to the bandwidth server about internal errors in /event/XXXX
function handleEventError(err, req, res, next){
  console.error('Error on handling event on %s: %s', req.url, err.message);
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
