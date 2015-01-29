"use strict";
var express = require("express");
var bandwidth = require("node-bandwidth");
var debug = require("debug")("dolphinApp");
var bodyParser = require("body-parser");

var Call = bandwidth.Call;
var Bridge = bandwidth.Bridge;

var client = null;
var app = express();
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

debug("Reading options");
var options = require("./options.json");

debug("Configuring routes");
app.get("/", function(req, res){
  if(!options.apiToken || !options.apiSecret || !options.caller || !options.bridgeCallee || !options.domain){
    res.send("Please fill options.json with right values")
  }
  else{
    res.send("This app is ready to use");
  }
});

app.post("/start/demo", function(req, res, next){
  if(!req.body.to){
    return res.send(400, "number is required");
  }
  var callbackUrl = "http://" + options.domain + "/events/demo";
  Call.create(client, {
      from: options.caller,
      to: req.body.to,
      callbackUrl: callbackUrl,
      recordingEnabled: false
  }, function(err){
    if(err){
      return next(err);
    }
    res.send(201, "");
  });
});

app.post("/events/demo", function(req, res, next){
  var ev = req.body;
  debug("demo: got event %s", ev.eventType);
  var call = new Call();
  call.id = ev.callId;
  call.client = client;
  var done = function(err){
    if(err){
      return next(err);
    }
    res.send({});
  };
  switch(ev.eventType){
    case "answer":
      setTimeout(function(){
        call.speakSentence("hello flipper", "hello-state", done);
      }, 1000);
      break;
    case "speak":
      if (ev.status != "done"){
        return done(null);
      }
      switch (ev.tag) {
        case "gather_complete":
          Call.create(client, {
            from: options.caller,
            to: options.bridgeCallee,
            callbackUrl: "http://" + options.domain + "/events/bridged",
            tag: "other-leg:" + call.id
          }, done);
          break;
        case "terminating":
          call.hangUp(done);
          break;
        case "hello-state":
          call.playAudio({
            fileUrl: "http://" + options.domain + "/dolphin.mp3",
            tag: "dolphin-state"
          }, done);
          break;
        default:
          done(null);
          break;
      }
      break;
    case "dtmf":
      if(ev.dtmfDigit[0] == "1"){
        call.speakSentence("Please stay on the line. Your call is being connected.", "gather_complete", done);
      }
      else{
        call.speakSentence("This call will be terminated", "terminating", done);
      }
      break;
    case "playback":
      if(ev.status != "done") {
        return done(null);
      }
      if(ev.tag == "dolphin-state")
      {
        call.createGather({
          maxDigits: 2,
          terminatingDigits:  "*",
          interDigitTimeout: "3",
          prompt: {
            sentence: "Press 1 to speak with the fish, press 2 to let it go",
            loopEnabled: false,
            voice: "Kate"
          },
          tag: "gather_started"
        }, done);
      }
      break;
    default:
      debug("Unhandled event type %s for %s", ev.eventType, req.url)
      done(null);
      break;
  }
});

app.post("/events/bridged", function(req, res, next){
  var ev = req.body;
  debug("bridged: got event %s", ev.eventType);
  var call = new Call();
  call.id = ev.callId;
  call.client = client;
  var done = function(err){
    if(err){
      return next(err);
    }
    res.send({});
  };
  var values = (ev.tag || "").split(":");
  var otherCallId = values[1];
  switch(ev.eventType){
    case "answer":
      setTimeout(function(){
        call.speakSentence("You have a dolphin on line 1. Watch out, he's hungry!",  "warning:" +  otherCallId, done);
      }, 3000);
      break;
    case "speak":
      if (ev.status != "done"){
        return done(null);
      }
      if(values[0] == "warning"){
        Bridge.create(client, {
          callIds: [otherCallId]
        }, done);
      }
      else{
        done(null);
      }
      break;
    case "hangup":
      call.id = otherCallId;
      if(ev.cause == "CALL_REJECTED"){
         call.speakSentence("We are sorry, the user is reject your call", "terminating", done);
      }
      else{
         call.hangUp(done);
      }
      break;
    default:
      debug("Unhandled event type %s for %s", ev.eventType, req.url);
      done(null);
      break;
  }
});

client = new bandwidth.Client(options);

debug("Starting the web app");
app.listen(process.env.PORT || 3000, "0.0.0.0");

