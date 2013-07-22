var stratum = require('../lib');

var client = stratum.client.create();

 //must be specified per EventEmitter requirements
client.on('error', function(socket){
  socket.close();
  console.log('Connection closed');
  process.exit(1);
});

// this happens when we are not authorized to send commands (the server didn't allow us)
client.on('mining.error', function(data){
  console.log(data);
});

client.on('mining', function(data){
  console.log(data);
});

client.connect({
  host: 'localhost',
  port: 3333
}).then(function (){ // defered, this can be chained if needed, no callback hell
    // "this" refers to the current client
    console.log('connected! lets ask for subscribe');
    this.stratumSubscribe('Node.js Stratum');
  })
  // this can be chained and is the last callback to execute
  //.done(function(){ });
;