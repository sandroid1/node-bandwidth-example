node-bandwidth-example
======================

2 demos of Catapult API

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

Use environment variable `PORT` to change default port (3000) which will be used by these apps.
