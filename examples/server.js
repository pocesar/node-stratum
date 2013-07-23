var stratum = require('../lib');

var server = stratum.server.create();

server.on('mining', function(req, callback, err){
  switch (req.method) {
    case 'mining.subscribe':
      console.log('Client is asking for subscription!');
      callback(['uniqueid', '08000400', 4]); // subscription_id, extranonce1, extranonce2_size
      break;
    case 'mining.authorize':
      console.log('Authorizing worker');
      callback([true]); // true or false

      // let's broadcast a random dificulty after 10 seconds

      setTimeout(function(){
        server.broadcast('set_difficulty', [0x00000000FFFF0000000000000000000000000000000000000000000000000000 / Math.ceil((Math.random() * 32) + 16)]).then(function(){
          console.log('Broadcasted difficulty');
        });
      }, 10000);

      break;
    default:
      err(stratum.server.errors.unknown);
  }
});

var job_id = 1;

function hextime(){
  return (new Date()).getTime().toString(16);
}

server.start();