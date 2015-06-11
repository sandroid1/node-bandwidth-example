"use strict";
var express = require("express");
var bandwidth = require("node-bandwidth");
var debug = require("debug")("chaosConference");
var bodyParser = require("body-parser");

var Call = bandwidth.Call;
var Conference = bandwidth.Conference;

var conferenceId = null;
var client = null;
var app = express();

var ordinals = ["", "first", "second", "third", "fourth", "fifth"];
var toOrdinalNumber = function(count){
  if (count >= ordinals.length)
  {
    return count + "th";
  }
  return ordinals[count];
};

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
debug("Reading options");
var options = require("./options.json");

debug("Configuring routes");
app.get("/", function(req, res){
  if(!options.apiToken || !options.apiSecret || !options.conferenceNumber || !options.domain){
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
  var callbackUrl = "http://" + options.domain + "/events/" + (conferenceId  ? "other_call_events" :  "first_member" );
  Call.create(client, {
      from: options.conferenceNumber,
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

app.post("/events/first_member", function(req, res, next){
  var ev = req.body;
  debug("first_member: got event %s", ev.eventType);
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
        call.speakSentence("Welcome to the conference", done);
      }, 3000);
      break;
    case "speak":
      if (ev.status != "done" || ev.tag == "notification"){
        return done(null);
      }
      var conferenceUrl = "http://" + options.domain + "/events/conference";
      Conference.create(client, {
        from: options.conferenceNumber,
        callbackUrl: conferenceUrl
      }, function(err, conference){
        if(err){
          return next(err);
        }
        conference.createMember({
          callId: call.id,
          joinTone: true,
          leavingTone: true
        }, done);
      });
      break;
    default:
      debug("Unhandled event type %s for %s", ev.eventType, req.url)
      done(null);
      break;
  }
});

app.post("/events/other_call_events", function(req, res, next){
  var ev = req.body;
  debug("other_call_event: got event %s", ev.eventType);
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
      if(conferenceId){
        call.speakSentence("You will join the conference.", "conference:" +  conferenceId, done);
      }
      else{
        call.speakSentence("We are sorry, the conference is not active.", "terminating", done);
      }
      break;
    case "speak":
      if (ev.status != "done"){
        return done(null);
      }
      if (ev.tag == "terminating"){
        call.hangUp(done);
      }
      else{
        if (ev.tag == "notification"){
          return done(null);
        }
        var values = ev.tag.split(":");
        var id = values[values.length - 1];
        var conference = new Conference();
        conference.id = id;
        conference.client = client;
        conference.createMember({
          callId: call.id,
          joinTone: true
        }, done);
      }
      break;
    default:
      debug("Unhandled event type %s for %s", ev.eventType, req.url);
      done(null);
      break;
  }
});

app.post("/events/conference", function(req, res, next){
  var ev = req.body;
  debug("conference: got event %s", ev.eventType);
  var conference = new Conference();
  conference.id = ev.conferenceId;
  conference.client = client;
  var done = function(){
    res.send({});
  };
  switch(ev.eventType){
    case "conference":
      if (ev.status == "created")
      {
        conferenceId =  ev.conferenceId;
      }
      else
      {
        conferenceId = null;
      }
      done();
      break;
    case "conference-member":
      if (ev.state != "active" || ev.activeMembers < 2) {
        return done(null); //don't speak anything to conference owner (first member)
      }
      conference.getMember(ev.memberId, function(err, member){
        if(err){
          return next(err);
        }
        member.playAudio({
          gender: "female",
          locale: "en_US",
          voice: "kate",
          sentence: "You are the " + toOrdinalNumber(ev.activeMembers) + " caller to join the conference",
          tag: "notification"
        }, done);
      });
      break;
    default:
      debug("Unhandled event type %s for %s", ev.eventType, req.url);
      done();
      break;
  }
});

client = new bandwidth.Client(options);

debug("Starting the web app");
app.listen(process.env.PORT || 3000);

