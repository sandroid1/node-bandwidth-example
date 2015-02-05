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
  if(req.query.next){
    debug('Save url to return %s', req.query.next);
    res.session.returnUrl = req.query.next || '/';
  }
  next();
}

function redirectToReturnUrl(req, res, next){
  res.redirect(req.session.returnUrl || '/'); //validate this url in real apps!!!
}

function handleError(view){
  return function(err, req, res, next){
    debug('showing an error: %s', err.message);
    req.body.error = err.message;
    res.render(view, req.body);
  };
}


indexRouter.route('/')
  .get(controllers.index);

indexRouter.route('/signIn')
  .get(saveReturnUrlIfNeed, controllers.signInForm)
  .post(controllers.signIn, redirectToReturnUrl, handleError('signIn'));

indexRouter.route('/signUp')
  .get(saveReturnUrlIfNeed, controllers.signUpForm)
  .post(controllers.signUp, redirectToReturnUrl, handleError('signUp'));

indexRouter.route('/signOut')
  .get(controllers.signOut);
exports.indexRouter = indexRouter;
