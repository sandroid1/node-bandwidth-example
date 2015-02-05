var mongoose = require('mongoose');

var Schema = mongoose.Schema,
    userSchema;

userSchema = new Schema({
  email: {type: String, index:{ unique: true }, required: true},
  password: String, //don't do that in real apps
  createdAt: {type: Date, default: Date.now},
  phoneNumber: {type: String, index:{ unique: true }, required: true}
});

module.exports = mongoose.model('User', userSchema);
