var debug = require('debug')('events');
var bandwidth = require('node-bandwidth');
var moment = require('moment');
var async = require('async');

//save call id to db (its allow to find user by call id in future)
function saveCallId(req, field, callback){
  req.User.findOne({phoneNumber: req.body[field]}, function(err, user){
    if(err){
      return callback(err);
    }
    if(!user){
      return callback();
    }
    req.user = user;
    req.User.update({_id: user.id}, {'$push': {'activeCallIds': req.body.callId}}, callback);
  });
}

//remove callId from user
function removeCallId(req, callback){
  if(!req.user){
    return callback();
  }
  req.User.update({_id: req.user.id},  {'$pull': {'activeCallIds': req.body.callId}}, callback);
}




// handler of POST /event/admin
// its used to make call back call from registered phone number to listen to voice mails and change greeting
module.exports.admin = function(req, res, next){
  debug('admin: %j', req.body);
  var call = new bandwidth.Call();
  call.client = req.client;
  call.id = req.body.callId;
  var menu = function (prompt, tag, callback){
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
  };

  var mainMenu = function(callback){
    menu('Press 1 to listen to your voicemail. Press 2 to record a new greeting.', 'main-menu', callback);
  };
  var voiceMailMenu = function(callback){
    menu('Press 1 to record a greeting.  Press 2 to listen to the greeting. Press 3 to use the default greeting. Press 0 to go back.', 'voice-mail-menu', callback);
  };

  var voiceMessageMenu = function(index, callback){
    menu('Press 1 to go to the next voice mail. Press 2 to delete this voice mail and go to the next one.' +
         'Press 3 to repeat this voice mail again. Press 0 to go back to main menu.', 'voice-message-menu:' + index, next);
  };
  var playVoiceMailMessage = function(index, callback){
    var message = req.user.voiceMessages[index];
    if(!message){
      return call.speakSentence('You have no voice messages', 'main-menu', callback);
    }
    call.speakSentence(moment(message.startTime).format('Do of MMMM YYYY h:mm:ss a'), 'voice-message-date:' + index, callback);
  };
  switch(req.body.eventType){
    case 'answer':
      saveCallId(req, 'from', function(err){
        if(err){
          return next(err);
        }
        if(!req.user){
          return call.hangUp(next);
        }
        setTimeout(function(){
          mainMenu(next); //play main menu on answer
        }, 2000);
      });
      break;
    case 'hangup':
      removeCallId(req, next);
      break;
    case 'gather':
      if(req.body.state !== 'completed'){
        return next();
      }
      var tag = (req.body.tag || '').split(':');
      switch(tag[0]){
        case 'recording':
          // stop recording
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
              voiceMailMenu(next);
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
              req.User.update({_id: req.user.id}, {'$pull': {'voiceMessages': {'url': req.user.voiceMessages[index].url}}}, function(err){
                if(err){
                  return next(err);
                }
                playVoiceMailMessage(index - 1, next);
              });
              break;
            case '3':
              playVoiceMailMessage(index, next);
              break;
            default:
             voiceMessageMenu(index, next);
             break;
          }
          break;
      }
      break;
    case 'playback':
    case 'speak':
      if(req.body.status !== 'done'){
        return next();
      }
      tag = (req.body.tag || '').split(':');
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
          req.user.playGreeting(call, function(err){
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
      bandwidth.Recording.get(req.client, req.body.recordingId, function(err, recording){
        if(err){
          return next(err);
        }
        req.user.greeting = recording.media;
        req.user.save(next);
      });
      break;
    default:
      next();
      break;
  }
};

// handler of POST /events/externalCall
// It handles all incoming calls to registered number, records voice mail and send transcription to user by email
module.exports.externalCall = function(req, res, next){
  debug('externalCall: %j', req.body);
  var call = new bandwidth.Call();
  call.client = req.client;
  call.id = req.body.callId;
  switch(req.body.eventType){
    case 'incomingcall':
      saveCallId(req, 'to', function(err){
        if(err){
          return next(err);
        }
        if(!req.user){
          return call.rejectIncoming(next); //reject all calls to not registered numbers
        }
        call.answerOnIncoming(next);
      });
      break;
    case 'answer':
      if(!req.user){
        return call.hangUp(next);
      }
      req.user.playGreeting(call, next); //play user's greeting
      break;
    case 'hangup':
      setTimeout(function(){
        debug('Removing call id');
        removeCallId(req, function(){}); //allow to 'transcription' event to find user by callId (it can be called after hangup)
      },900000);
      next();
      break;
    case 'playback':
    case 'speak':
      if(req.body.status !== 'done'){
        return next();
      }
      switch(req.body.tag){
        case 'greeting':
          call.playAudio({fileUrl: req.makeAbsoluteUrl('/beep.mp3'), tag: 'start-recording' }, next); //play 'beep' after greeting
          break;
        case 'start-recording':
          //start recording of call after 'beep' (with transcription of result)
          call.update({transcriptionEnabled: true, recordingEnabled: true}, function(err){
            if(err){
              return next(err);
            }
            //press any key to stop recording (and call too)
            call.createGather({
              tag: 'stop-recording',
              interDigitTimeout: 30,
              maxDigits: 1
            }, next);
          });
          break;
      }
      break;
    case 'gather':
      if(req.body.state !== 'completed'){
        return next();
      }
      //make hangup on press any key
      if(req.body.tag === 'stop-recording'){
        call.hangUp(next);
      }
      break;
    //case 'recording':
    //  var recording = new bandwidth.Recording();
    //  recording.id = req.body.recordingId;
    //  recording.client = req.client;
    //  debug('creating a transcription');
    //  recording.createTranscription(next);
    //  next()
    //  break;
    case 'transcription':
      if(req.body.state !== 'completed'){
        return next();
      }
      //call was recorded and transcription was completed here
      async.waterfall([
        function(callback){
          bandwidth.Recording.get(req.client, req.body.recordingId, callback);
        },
        function(recording, callback){
          var index = recording.call.lastIndexOf('/');
          var callId = recording.call.substr(index + 1);
          bandwidth.Call.get(req.client, callId, function(err, call){
            if(err){
              return callback(err);
            }
            callback(null, recording, call);
          });
        },
        function(recording, call, callback){
          req.User.findOne({activeCallIds: call.id}, function(err, user){
            if(err){
              return callback(err);
            }
            if(!user){
              return callback(new Error('Missing user for call ' + call.id));
            }
            callback(null, recording, call, user);
          });
        },
        function(recording, call, user, callback){
          var from = call.from;
          //add new voice message to user
          req.User.update({_id: user.id}, {
            '$push': {'voiceMessages': {url: recording.media, startTime: recording.startTime, endTime: recording.endTime}}
          }, function(err){
            if(err){
              return callback(err);
            }
            //and send email notification
            req.sendEmail(user.email, 'TranscriptionApp - new voice message from ' + from,
                '<p>You received a new voice message from <b>' + from +'</b> at ' + moment(recording.startTime).format('LLL') + ':</p>' +
                '<p><pre>' + req.body.text + '</pre></p>', callback);
          });
        }
      ], next);
      break;
    default:
      next();
      break;
  }
};
