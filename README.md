node-bandwidth-example
======================

3 demos of Catapult API

Dolphin app demonstrates how to play audio, speak text to callers, and gather DTMF from the caller.

Chaos Conference is a very simple conferencing app that joins users to a conference by making outbound calls to each attendee

Sip App is simple application which allows to make calls directly to sip account, redirect outgoing calls from sip account to another number, redirect incoming calls from specific number to sip account. Also this application demonstrate how to receive/create an application, domain, endpoint, buy phone numbers.

Before run them fill config file `options.json` with right values.
Option `conferenceNumber` is required for chaosConfernce only.
Options `caller` and `bridgeCallee` are used by dolphinApp only.
Option `domain` should contains host name (and port) which will be used to access to the server from external network.

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

Use environment variable `PORT` to change default port (3000) which will be used by these apps.

For Dolphin app  and Chaos conference start incoming call from command line:

```console
curl -d '{"to": "+YOUR-NUMBER"}' http://YOUR-DOMAIN/start/demo --header "Content-Type:application/json"
```

For Chaos conference run this command again with another number to it to the conference (first member is owner)

Fo Sip app open home page in browser first (http://<domain>)  and follow instructions on it

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

Run `heroku open` to see home page of the app in the browser
