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

//creating of new application on the bandwidth server if need
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
app.set('port', process.env.PORT || config.server.port);
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
    req.User = User; //allow to get access to User model from route handlers
    req.client = client; // access to client instance
    res.locals.error = req.flash('error')[0]; //to show flash error
    res.locals.info = req.flash('info')[0]; // and info alert
    //build abso;ute url by relative url
    req.makeAbsoluteUrl = function(path){
      return (config.baseUrl || ('http://localhost:' + app.get('port'))) + path;
    };
    //return application id (on bandwith server)
    req.getApplicationId = function(){
      return applicationId;
    };

    // send email
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
      //if user made sig in then request user info to req.user
      User.findById(req.session.userId, function(err, user){
        if(err){
          return next(err);
        }
        req.user = user;
        res.locals.user = user; // allow to use user's data from views
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
