var express = require("express");
var bandwidth = require("bandwidth");
var debug = require("debug");

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
  switch(req.body.eventType){
    case "answer":
      var call = new Call();
      call.id = req.body.callId;
      call.client = client;
      call.speakSentence(client, "Welcome to the conference", function(err){
        if(err){
          return next(err);
        }
        res.send({});
      });
      break;
    case "speak":
      break;
    default:
      break;
  }
});

app.post("/events/other_call_events", function(req, res){
  //TODO implement
});

app.post("/events/conference", function(req, res){
  //TODO implement
});

client = new bandwidth.Client(options);

debug("Starting the web app");
app.listen(process.env.PORT || 3000);

