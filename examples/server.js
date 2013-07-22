var stratum = require('../lib');

var server = stratum.server.create();

server.on('mining', function(req, callback){
  switch (req.method) {
    case 'mining.subscribe':
      console.log('Client is asking for subscription!');
      callback(['ab']);
      break;
    default:
      callback(stratum.server.errors.unknown);
  }
});

server.start();