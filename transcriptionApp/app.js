/**
 * Module dependencies.
 */

var express        = require('express'),
    session        = require('express-session'),
    flash          = require('connect-flash'),
    path           = require('path'),
    mongoose       = require('mongoose'),
    logger         = require('morgan'),
    bodyParser     = require('body-parser'),
    compress       = require('compression'),
    favicon        = require('static-favicon'),
    methodOverride = require('method-override'),
    errorHandler   = require('errorhandler'),
    nodemailer     = require('nodemailer'),
    debug          = require('debug')('app'),
    config         = require('./config'),
    routes         = require('./routes'),
    User           = require('./models/user'),
    bandwidth      = require('node-bandwidth');

var APPLICATION_NAME = 'TranscriptionApp';

var client = new bandwidth.Client(config.catapult);
mongoose.connect(config.database.url);
mongoose.connection.on('error', function () {
  console.log('mongodb connection error');
});

var app = express();
var emailTransport = nodemailer.createTransport(config.email);

var applicationId;
function getOrCreateApplication(callback){
  bandwidth.Application.list(client, function(err, apps){
    if(err){
      return callback(err);
    }
    var application = (apps || []).filter(function(a){return a.name === APPLICATION_NAME;})[0];
    if(!application){
      var callbackUrl = (config.baseUrl || ('http://localhost:' + app.get('port'))) + '/events/externalCall';
      bandwidth.Application.create(client, {name: APPLICATION_NAME , incomingCallUrl:  callbackUrl, autoAnswer: false}, function(err, a){
        if(err){
          return callback(err);
        }
        applicationId = a.id;
        callback();
      });
    }
    else{
      applicationId = application.id;
      callback();
    }
  });
}

/**
 * Express configuration.
 */
app.set('port', config.server.port);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app
  .use(compress())
  .use(favicon())
  .use(session({secret: config.server.secret, resave: false, saveUninitialized: false}))
  .use(logger('dev'))
  .use(bodyParser())
  .use(methodOverride())
  .use(express.static(path.join(__dirname, 'public')))
  .use(flash())
  .use(function(req, res, next){
    req.User = User;
    req.client = client;
    res.locals.error = req.flash('error')[0];
    res.locals.info = req.flash('info')[0];
    req.makeAbsoluteUrl = function(path){
      return (config.baseUrl || ('http://localhost:' + app.get('port'))) + path;
    };
    req.getApplicationId = function(){
      return applicationId;
    };
    req.sendEmail = function(email, subject, html, callback){
      var data = {
        from: config.email.from,
        to: email,
        subject: subject,
        html: html
      };
      emailTransport.sendMail(data, callback);
    };
    if(req.session.userId){
      User.findById(req.session.userId, function(err, user){
        if(err){
          return next(err);
        }
        req.user = user;
        res.locals.user = user;
        next();
      });
    }
    else{
      next();
    }
  })
  .use(routes.indexRouter)
  .use(function (req, res) {
    res.status(404).render('404', {title: 'Not Found :('});
  });

if (app.get('env') === 'development') {
  app.use(errorHandler());
}

app.listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
  getOrCreateApplication(function(err){
    if(err){
      console.error('Could not get application id from catapult');
      process.exit(1);
    }
  });
});
