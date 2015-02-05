var config = {
  development: {
    server: {
      secret: 'Demo',
      port: 3000,
    },
    database: {
      url: 'mongodb://localhost/transcriptionapp_dev'
    },
    catapult:{
      userId: '',
      apiToken: '',
      apiSecret: ''
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
