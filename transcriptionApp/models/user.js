var mongoose = require('mongoose');
var bandwidth = require('node-bandwidth');
var Schema = mongoose.Schema;

var userSchema = new Schema({
  email: {type: String, index:{ unique: true }, required: true},
  password: String, //don't do that in real apps
  createdAt: {type: Date, default: Date.now},
  phoneNumber: {type: String, index:{ unique: true }, required: true},
  greeting: String,
  voiceMessages: [{url: String, startTime: Date, endTime: Date}],
  activeCallIds: {type: [String], index: true},
  activeTranscriptions: [{id: {type: [String], index: true}, from: String}]
});


userSchema.methods.playGreeting = function(call, callback){
  var data = {tag: 'greeting'};
  if(this.greeting){
    data.fileUrl = this.greeting;
  }
  else{
    data.gender = 'female';
    data.locale = 'en_US';
    data.voice = 'kate';
    data.sentence = 'You have reached the voice mailbox for ' + this.phoneNumber + '. Please leave a message at the beep';
  }
  call.playAudio(data, callback);
};

module.exports = mongoose.model('User', userSchema);
