var debug = require('debug')('events');
var bandwidth = require('node-bandwidth');
var moment = require('moment');

function saveCallId(req, field, callback){
  req.User.findOne({phoneNumber: req.body[field]}, function(err, user){
    if(err){
      return callback(err);
    }
    if(!user){
      return callback(new Error("Unknown phone number " + req.body[field]));
    }
    req.user = user;
    user.activeCallIds.push(req.body.callId);
    user.markModified('activeCallIds');
    user.save(callback);
  });
}

function removeCallId(req, callback){
  if(!req.user){
    return callback();
  }
  var index = req.user.activeCallIds.indexOf(req.body.callId);
  if(index < 0){
    return callback();
  }
  req.user.activeCallIds.splice(index, 1);
  req.user.markModified('activeCallIds');
  req.user.save(callback);
}

function playMenu(call, prompt, tag, callback){
  call.createGather({
    tag: tag,
    maxDigits: 1,
    prompt: {
      locale: 'en_US',
      gender: 'female',
      sentence: prompt,
      voice: 'kate',
      bargeable: true,
      loopEnabled: false
    }
  }, callback);
}

module.exports.admin = function(req, res){
  debug('admin: %j', req.body);
  var call = new bandwidth.Call();
  call.client = req.client;
  call.id = req.body.callId;
  var menu = playMenu.bind(null, call);
  var mainMenu = function(callback){
    menu('Press 1 to listen to your voicemail. Press 2 to record a new greeting.', 'main-menu', callback);
  };
  var voiceMailMenu = function(callback){
    menu('Press 1 to record a greeting.  Press 2 to listen to the greeting. Press 3 to use the default greeting. Press 0 to go back.', 'voice-mail-menu', callback);
  };

  var voiceMessageMenu = function(index, callback){
    menu('Press 1 to go to the next voice mail. Press 2 to delete this voice mail.' +
         'Press 3 to repeat this ivoice mail again. Press 0 to go back to main menu.', 'voice-message-menu:' + index, next);
  };
  var playVoiceMailMessage = function(index, callback){
    var message = req.user.voiceMessages[index];
    if(!message){
      return call.speakSentence('You have no voice messages', 'main-menu', callback);
    }
    call.speakSentence(moment(message.startTime).format('MMMM Do YYYY, h:mm:ss a'), 'voice-message-date:' + index, callback);
  }
  switch(req.body.eventType){
    case 'answer':
      saveCallId(req, 'from', function(err){
        if(err){
          return next(err);
        }
        mainMenu(next);
      });
      break;
    case 'hangup':
      removeCallId(next);
      break;
    case 'gather':
      if(req.body.state != 'completed'){
        return next();
      }
      var tag = (req.body.tag || '').split(':');
      switch(tag[0]){
        case 'recording':
          call.recordingOff(function(err){
            if(err){
              return next(err);
            }
            call.speakSentence('Your greeting has been recorded. Thank you.', 'stop-recording', next);
          });
          break;
        case 'main-menu':
          switch(req.body.digits){
            case '1':
              playVoiceMailMessage(req.user.voiceMessages.length - 1, next);
              break;
            case '2':
              voiceMailMenu();
              break;
            default:
              mainMenu(next);
              break;
          }
          break;
        case 'voice-mail-menu':
          switch(req.body.digits){
            case '0':
              mainMenu(next);
              break;
            case '1':
              call.speakSentence('Say your greeting now. Press # to stop recording.', 'start-recording', next);
              break;
            case '2':
              call.speakSentence('Your greating', 'listen-to-recording', next);
              break;
            case '3':
              call.speakSentence('Your greating will be set to default', 'remove-recording', next);
              break;
            default:
              voiceMailMenu(next);
              break;
          }
          break;
        case 'voice-message-menu':
          var index = Number(tag[1]);
          switch(req.body.digits){
            case '0':
              mainMenu(next);
              break;
            case '1':
              playVoiceMailMessage(index - 1, next);
              break;
            case '2':
              req.user.voiceMessages.splice(index, 1);
              req.user.markModified('voiceMessages');
              req.user.save(function(err){
                if(err){
                  return next(err);
                }
                playVoiceMailMessage(index - 1, next);
              });
              break;
            case '3':
              playVoiceMailMessage(index, next);
              break;
          }
          break;
      }
  case 'playback':
    if(req.body.status != 'done'){
      return next();
    }
    var tag = (req.body.tag || '').split(':');
    switch(tag[0]){
      case 'start-recording':
        call.recordingOn(function(err){
          if(err){
            return next(err);
          }
          call.createGather({
            tag: 'recording',
            interDigitTimeout: 30,
            maxDigits: 30,
            terminatingDigits: '#'
          }, next);
        });
        break;
      case 'listen-to-recording':
        req.user.playGreating(function(err){
          if(err){
            return next(err);
          }
          voiceMailMenu(next);
        });
        break;
      case 'remove-recording':
        req.user.greeting = null;
        req.user.save(function(err){
          if(err){
            return next(err);
          }
          voiceMailMenu(next);
        });
        break;
      case 'stop-recording':
        voiceMailMenu(next);
        break;
      case 'main-menu':
        mainMenu(next);
        break;
      case 'voice-message-date':
        index = Number(tag[1]);
        call.playAudio({
          fileUrl: req.user.voiceMessages[index].url,
          tag: 'voice-message-url:' + index
        }, next);
        break;
      case 'voice-message-url':
        index = Number(tag[1]);
        setTimeout(function(){
          voiceMessageMenu(index, next);
        }, 1500);
        break;
    }
    break;
  case 'recording':
    if(req.body.state !== 'complete') {
      return next();
    }
    req.user.greeting = req.body.recordingUri;
    req.user.save(next);
    break;
}


};

module.exports.externalCall = function(req, res){

};
