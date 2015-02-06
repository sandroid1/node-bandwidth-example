var async = require('async');
var bandwidth = require('node-bandwidth');
exports.index = function (req, res) {
  res.render('index');
};

exports.signInForm = function(req, res){
  res.render('signIn');
};


exports.signUpForm = function(req, res){
  res.render('signUp');
};

exports.signIn = function(req, res, next){
  if(!req.body.emailOrPhone){
    return next(new Error('Please enter email or phone number'));
  }
  if(!req.body.password){
    return next(new Error('Please enter password'));
  }

  req.User.findOne({'$or':
    [{email: req.body.emailOrPhone}, {phoneNumber: req.body.emailOrPhone}, {phoneNumber: '+' + req.body.emailOrPhone}],
    password: req.body.password}, function(err, user){
      if(err){
        return next(err);
      }
      if(!user){
        return next(new Error('Wrong email, phone or password'));
      }
      req.session.userId = user.id;
      next();
  });
};


exports.signUp = function(req, res, next){
  if(!req.body.email){
    return next(new Error('Please enter email'));
  }
  if(!req.body.password){
    return next(new Error('Please enter password'));
  }
  if(req.body.repeatPassword !== req.body.password){
    return next(new Error('Passwords are mismatched'));
  }
  async.waterfall([
    function(callback){
      req.User.findOne({email: req.body.email}, callback);
    },
    function(user, callback){
      if(user){
        return callback(new Error('User with such email exists already. Use another email.'));
      }
      bandwidth.AvailableNumber.searchLocal(req.client, {city: 'Cary', state: 'NC', quantity: 1}, callback);
    },
    function(numbers, callback){
      if(numbers.length === 0){
        return callback(new Error('Missing free phone numbers. Sorry.'));
      }
      bandwidth.PhoneNumber.create(req.client, {number: numbers[0].number}, callback);
    },
    function(reservedNumber, callback){
      var user = new req.User({email: req.body.email, phoneNumber: reservedNumber.number, password: req.body.password});
      user.save(function(err){
        if(err){
          return callback(err);
        }
        callback(null, user);
      });
    },
    function(createdUser, callback){
      req.session.userId = createdUser.id;
      callback();
    }
  ], function(err){
    next(err);
  });
};


exports.signOut = function(req, res){
  delete req.session.userId;
  res.redirect('/signIn');
};


exports.call = function(req, res){
  if(!req.body.phoneNumber){
    req.flash('error', 'Missing phone number');
    return res.redirect('/');
  }
  bandwidth.Call.create({
    from: req.user.phoneNumber,
    to: req.body.phoneNumber,
    callbackUrl: req.makeAbdoluteUrl('/events/admin')
  }, function(err){
    if(err){
      req.flash('error', err.message);
    }
    req.redirect('/');
  });
};

exports.events = require('./events');
