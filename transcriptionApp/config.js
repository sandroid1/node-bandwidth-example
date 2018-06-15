var config = {
  development: {
    baseUrl: 'http://host', // base url for external access to this apps
    server: {
      secret: 'Demo',
      port: 3000,
    },
    database: {
      url: 'mongodb://localhost/transcriptionapp_dev' //url to mongodb database
    },
    catapult:{ //auth data for catapult api
      userId: 'u-pnqiie5nln4345ctns3fvqa',
      apiToken: 't-tchsegroh5ilfsxha454ily',
      apiSecret: 'gctkepcqwv6jfnpoysj3dnjqkbzkdcnomsip3cq'
    },
    email: {// email settings to send email
      from: 'postmaster@sandbox835fec6a329444c39e79880a16a415b7.mailgun.org', // field 'from' for outgoing messages
      service: 'Mailgun', // look at hete https://github.com/andris9/nodemailer-wellknown
      auth: {
        user: '',
        pass: ''
      }
    }
  },
  testing: {
    server: {
      secret: 'Demo',
      port: 3001
    },
    database: {
      url: 'mongodb://localhost/transcriptionapp_test'
    },
    catapult:{
      userId: '',
      apiToken: '',
      apiSecret: ''
    }
  },
  production: {
    server: {
      secret: ')n0s9dksljl;cwe)HM_Q%G',
      port: 8080
    },
    database: {
      url: 'mongodb://localhost/transcriptionapp'
    },
    catapult:{
      userId: '',
      apiToken: '',
      apiSecret: ''
    }
  }
};

module.exports = config[process.env.NODE_ENV || 'development'];
