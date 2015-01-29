"use strict";
var express = require("express");
var sync = require("async");
var bandwidth = require("node-bandwidth");
var debug = require("debug")("sipApp");
var bodyParser = require("body-parser");

var Call = bandwidth.Call;
var Bridge = bandwidth.Bridge;
var Application = bandwidth.Application;
var PhoneNumber = bandwidth.PhoneNumber;
var AvailableNumber = bandwidth.AvailableNumber;
var Domain = bandwidth.Domain;

var APPLICATION_NAME = "SipApp Demo";
var DOMAIN_NAME = "sip-app";
var USER_NAME = "test-user";

var client = null;
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

debug("Reading options");
var options = require("./options.json");


var application, phoneNumbers, domain, endpoint;
var caller, phoneNumberForIncomimgCalls;

function getOrCreateApplication(callback){
  Application.list(client, function(err, apps){
    if(err){
      return callback(err);
    }
    application = (apps || []).filter(function(a){return a.name === APPLICATION_NAME;})[0];
    if(!application){
      var callback = "http://" + options.domain + "/events/calls";
      Application.create(client, {name: APPLICATION_NAME , incomingCallUrl:  callbackUrl, autoAnswer: false}, function(err, app){
        if(err){
          return callback(err);
        }
        application = app;
        callback();
      });
    }
    else{
      callback();
    }
  });
}

function getOrCreateDomain(callback){
  Domain.list(client, function(err, domains){
    if(err){
      return callback(err);
    }
    domain = (domains || []).filter(function(d){ return d.name === DOMAIN_NAME;})[0];
    if(!domain){
      Domain.create(client, {name: DOMAIN_NAME, description: APPLICATION_NAME}, function(err, d){
        if(err){
          return callback(err);
        }
        domain = d;
        callback();
      });
    }
    else{
      callback();
    }
  });
}

function getOrCreateNumbers(callback){
  PhoneNumber.list(client, function(err, numbers){
    if(err){
      return callback(err);
    }
    var regExp = new RegExp("/" + application.id + "$");
    phoneNumbers = (numbers || []).filter(function(p){ return regExp.test(p.application); });
    if(phoneNumbers.length < 2){
      AvailableNumber.searchLocal(client, {city: "Cary", state: "NC", quantity: 2}, function(err, numbers){
        if(err){
          return callback(err);
        }
        async.map(numbers, function(n, cb){
          PhoneNumber.create(client, {number: n.number, applicationId: application.id}, cb);
        }, function(err, numbers){
          if(err){
            return callback(err);
          }
          phoneNumbers = numbers;
          callback();
        });
      });
    }
    else{
      callback();
    }
  });
}

function getOrCreateEndPoint(callback){
  domain.getEndPoints(function(err, endpoints){
    if(err){
      return callback(err);
    }
    endpoint = (endpoints || []).filter(function(p){ return p.name === USER_NAME && p.applicationId === application.id; })[0];
    if(endpoint){
      return callback();
    }
    domain.createEndPoint({
      name: USER_NAME,
      description: USER_NAME + " mobile client",
      enabled: true,
      domainId: domain.id,
      applicationId: application.id,
      credentials: {password: "1234567890"}
    }, function(err, point){
      if(err){
        return callback(err);
        endpoint = point;
        callback();
      }
    });
  });
}

function handleDemo(ev, callback){
  debug("/events/demo %j", ev);
  switch(ev.eventType){
    case "answer":
      var call = new Call();
      call.id = ev.callId;
      call.client = client;
      call.speakSentence("Hello SIP client", callback);
      break;
    case "speak":
      if (ev.status != "done") {
        return callback();
      }
      var call = new Call();
      call.id = ev.callId;
      call.client = client;
      call.hangup(callback);
      break;
    default:
      debug("Unhandled event of type %s in /events/demo", ev.eventType);
      break;
  }
}

function handleCalls(ev, callback){
  debug("/events/calls %j", ev);
  if(ev.eventType === "incomingcall"){
    var call = new Call();
    call.id = ev.callId;
    call.client = client;
    var callbackUrl = "http://" + options.domain + "/events/bridged";
    if (ev.from === entrypoint.sipUri)
    {
      return call.answerOnIncoming(function(){
        Call.create(client, {from: caller, to: ev.to, callbackUrl: callbackUrl, tag: ev.callId}, callback);
      });
    }
    if (ev.to === phoneNumberForIncomingCalls) {
      return call.answerOnIncoming(function(){
        Call.create(client, {from: caller, to: entrypoint.sipUri, callbackUrl: callbackUrl, tag: ev.callId}, callback);
      });
    }
  }
  else{
    debug("Unhandled event of type %s in /events/calls", ev.eventType);
  }
}

function handleBridged(ev, callback){
  debug("/events/bridged %j", ev);
  if(ev.eventType === "answer"){
    Bridge.create(client, {callIds: [ev.callId, ev.tag]}, callback);
  }
  else{
    debug("Unhandled event of type %s in /events/bridged", ev.eventType);
  }
}

debug("Configuring routes");
app.get("/", function(req, res){
  if(!options.apiToken || !options.apiSecret ||  !options.domain){
    res.send("Please fill options.json with right values")
  }
  else{
    async.series([getOrCreateApplication, getOrCreateNumbers, getOrCreateDomain, getOrCreateEndPoint], function(err){
      if(err){
        return res.send(err.message);
      }
      caller = phoneNumbers[0].number;
      phoneNumberForIncomimgCalls = phoneNumbers[1].number;
      res.send("This app is ready to use<br/>" +
       "Please configure your sip phone with account <b>" + endpoint.credentials.username + "</b>, server <b>" +
       endpoint.credentials.realm + "</b> and password <b>1234567890</b>." +
      " Please check if your sip client is online.<br/>" +
      "<ol>" +
      "<li>Press this button to check incoming call to sip client directly" +
      "<form action=\"/callToSip\" method=\"POST\"><input type=\"submit\" value=\"Call to sip client\"></input></form></li>" +
      "<li>Call from sip client to any number. Outgoing call will be maden from <b>" + caller + "</b></li>" +
      "<li>Call from any phone (except sip client) to <b>" + phoneNumberForIncomimgCalls + "</b>. Incoming call will be redirected to sip client.</li>" +
      "</ol>");
    });
  }
});

app.post("/callToSip", function(req, res){
  var callbackUrl = "http://" + options.domain + "/events/demo";
  Call.create(client, {from: caller, to: endpoint.sipUri, callbackUrl: callbackUrl}, function(err){
    if(err){
      return res.send(err.message);
    }
    res.send("Please receive a call from sip account");
  });
});


app.post("/events/demo", function(req,res){
  handleDemo(req.body, function(){
    res.send({});
  });
});

app.post("/events/calls", function(req, res){
  handleCalls(req.body, function(){
    res.send({});
  });
});


app.post("/events/bridged", function(req, res){
  handleBridged(req.body, function(){
    res.send({});
  });
});

client = new bandwidth.Client(options);

debug("Starting the web app");
app.listen(process.env.PORT || 3000, "0.0.0.0");

