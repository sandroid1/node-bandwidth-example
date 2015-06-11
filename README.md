node-bandwidth-example
======================

4 demos of Catapult API

Dolphin app demonstrates how to play audio, speak text to callers, and gather DTMF from the caller.

Chaos Conference is a very simple conferencing app that joins users to a conference by making outbound calls to each attendee

Sip App is simple application which allows to make calls directly to sip account, redirect outgoing calls from sip account to another number, redirect incoming calls from specific number to sip account. Also this application demonstrate how to receive/create an application, domain, endpoint, buy phone numbers.

Transcription App is simple voice mail app which sends email notifications to user with transcripted message text. It demonstrates how to make calls, handle incoming calls to registered number, handle events, tune on call recording, create a transcription for recording. Also it shows how to register an application on catapult and buy new phone number.


Before run them fill config file `options.json` with right values.

Option `domain` should contain host name (and port) which will be used to access to the server from external network.
Option `conferenceNumber` is required for chaosConfernce only.
Options `caller` and `bridgeCallee` are used by dolphinApp only.
Option `spiDomain` is required for sipApp only. It should be a domain name with at most 16 characters.
`transcriptionApp` stores settings in own config.js. Please edit this file before run this demo.

### How to run

Install required node modules

```
npm install
```

Run chaosConference demo as

```
node chaosConference.js
```

Run dolphinApp demo as

```
node dolphinApp.js
```

Run sipApp demo as

```
node sipApp.js
```

Run transcriptionApp demo as

```
cd transcriptionApp
npm install (first time only)
node app.js
```

Use environment variable `PORT` to change default port (3000) which will be used by these apps.

For Dolphin app  and Chaos conference start incoming call from command line:

```console
curl -d '{"to": "+YOUR-NUMBER"}' http://YOUR-DOMAIN/start/demo --header "Content-Type:application/json"
```

For Chaos conference run this command again with another number to it to the conference (first member is owner)

For Sip app open home page in browser first (http://domain) and follow instructions on it. There is one caveat as when this app create its domain, this will take around 10 minutes to be available for use in your SIP client.

### Deploy on heroku

Create account on [Heroku](https://www.heroku.com/) and install [Heroku Toolbel](https://devcenter.heroku.com/articles/getting-started-with-ruby#set-up) if need.

Open `package.json` in text editor and select which demo you would like to deploy on line 7.

```
// for Chaos Conference
"start": "node ./chaosConference.js"

// for Dolpin App
"start": "node ./dolphinApp.js"

// for Sip App
"start": "node ./sipApp.js"

// for Transcription  App
"start": "node ./app.js"
```

Then open `options.json` and fill it with valid values (except `domain`).

Commit your changes.

```
git add .
git commit -a -m "Deployment"
```

Run `heroku create` to create new app on Heroku and link it with current project.

Change option `domain` in options.json by assigned by Heroku value (something like XXXX-XXXXXX-XXXX.heroku.com). Commit your changes by `git commit -a`. 

Run `git push heroku master` to deploy this project.

Run `heroku open` to see home page of the app in the browser.

Run `heroku logs --tail` for debugging.

### Open external access via ngrock

As alternative to deployment to external hosting you can open external access to local web server via [ngrock](https://ngrok.com/).

First instal ngrock on your computer. Run ngrock by


```
ngrok http 3000 #you can use another free port if need 
```

You will see url like http://XXXXXXX.ngrok.io on console output. Open `options.json` and fill value `domain` by value from console (i.e. like XXXXXXX.ngrock.io). Save changes and run demo app by


```
# for Chaos Conference
PORT=3000 node ./chaos_conference.js

# for Dolpin App
PORT=3000 node ./dolphin_app.js

# for Sip App
PORT=3000 node ./sip_app.js

# for transcription app
PORT=3000 node ./app.js
```

