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
    debug          = require('debug')('app'),
    config         = require('./config'),
    routes         = require('./routes'),
    User           = require('./models/user'),
    bandwidth      = require('node-bandwidth');

var client = new bandwidth.Client(config.catapult);
mongoose.connect(config.database.url);
mongoose.connection.on('error', function () {
  console.log('mongodb connection error');
});

var app = express();



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
    debug('Locals: %j', res.locals);
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
});
