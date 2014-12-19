"use strict";
var express = require("express");
var bandwidth = require("bandwidth");
var debug = require("debug")("chaosConference");

var Call = bandwidth.Call;
var Conference = bandwidth.Conference;

var conferenceId = null;
var client = null;
var app = express();

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
  var callbackUrl = "http://" + options.domain + "/events/" + (conferenceId  ? "first_member" : "other_call_events");
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
      call.speakSentence(client, "Welcome to the conference", done);
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
          callId: call.Id,
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
        call.speakSentence("You will be join to conference.", "conference:" +  conferenceId, done);
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
        conferenceId =  ev.ConferenceId;
      }
      else
      {
        conferenceId = null;
      }
      done();
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

