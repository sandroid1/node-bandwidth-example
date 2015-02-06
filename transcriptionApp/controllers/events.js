var debug = require('debug')('events');
var bandwidth = require('node-bandwidth');
var moment = require('moment');
var async = require('async');

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

function removeCallId(req, callback){
  if(!req.user){
    return callback();
  }
  req.User.update({_id: req.user.id},  {'$pull': {'activeCallIds': req.body.callId}}, callback);
}


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
        if(!req.user){
          return call.hangUp(next);
        }
        setTimeout(function(){
          mainMenu(next);
        }, 2000);
      });
      break;
    case 'hangup':
      removeCallId(req, next);
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
          }
          break;
      }
    case 'playback':
    case 'speak':
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
  }
};

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
          return call.rejectIncoming(next);
        }
        call.answerOnIncoming(next);
      });
      break;
    case 'answer':
      if(!req.user){
        return call.hangUp(next);
      }
      req.user.playGreeting(call, next);
      break;
    case 'hangup':
      removeCallId(req, function(err){
        if(err){
          return next(err);
        }
        if(req.user){
          call.recordingOff(next);
        }
        else{
          next();
        }
      });
      break;
    case 'playback':
    case 'speak':
      if(req.body.status != 'done'){
        return next();
      }
      switch(req.body.tag){
        case 'greeting':
          call.playAudio({fileUrl: req.makeAbsoluteUrl('/beep.mp3'), tag: 'start-recording' }, next);
          break;
        case 'start-recording':
          call.recordingOn(function(err){
            if(err){
              return next(err);
            }
            call.createGather({
              tag: 'stop-recording',
              interDigitTimeout: 30,
              maxDigits: 1
            }, next);
          });
          break;
      }
      break
    case 'gather':
      if(req.body.state != 'completed'){
        return next(err);
      }
      if(req.body.tag == 'stop-recording'){
        call.hangUp(next);
      }
      break;
    case 'recording':
      if(req.body.state !== 'complete') {
        return next();
      }
      var recording = new bandwidth.Recording();
      recording.client = req.client;
      recording.id = req.body.recordingId;
      recording.createTranscription(function(err, transcription){
        if(err){
          return next(err);
        }
        bandwidth.Call.get(req.body.callId, function(err, call){
          if(err){
            return next(err);
          }
          req.User.update({_id: req.user.id}, {'$push': {'activeTranscriptions': {id: transcription.id, from: call.from}}}, next);
        });
      });
      break;
    case 'transcription':
      if(req.body.state !== 'completed'){
        return next();
      }
      async.waterfall([
        function(callback){
          req.User.findOne({'activeTranscriptions.id': req.body.transcriptionId}, callback);
        },
        function(user, callback){
          if(!user){
            return callback(new Error('Unknown transcription'));
          }
          bandwidth.Recording.get(req.client, req.body.recordingId, function(err, recording){
            if(err){
              return callback(err);
            }
            callback(null, user, recording);
          });
        },
        function(user, recording, callback){
          var from = user.activeTranscriptions.filter(function(t){ return t.id === req.body.transcriptionId; })[0].from;
          req.User.update({_id: user.id}, {
            '$pull': {'activeTranscriptions': {id: req.body.transcriptionId}},
            '$push': {'voiceMessages': {url: recording.media, startTime: recording.startTime, endTime: recording.endTime}}
          }, function(err){
            if(err){
              return callback(err);
            }
            req.sendEmail(user.email, 'TranscriptionApp - new voice message from ' + from,
                '<p>You received a new voice message from <b>' + from +'</b> at ' + moment(recording.startTime).format('LLL') + ':</p>' +
                '<p><pre>' + req.body.text + '</pre></p>' +
                '<p>Click this link to read full text</p>' +
                '<p><a href="' + req.body.textUrl + '">' + req.body.textUrl + '</a></p>' +
                '<p>Click this link to listen to this message</p>' +
                '<p><a href="' + recording.media + '">' + recording.media + '</a></p>', callback);
          });
        }
      ], next);
      break;
  }
};
