var stratum = require('../lib');

var client = stratum.Client.create();

 //must be specified per EventEmitter requirements
client.on('error', function(socket){
  socket.close();
  console.log('Connection closed');
  process.exit(1);
});

// this happens when we are not authorized to send commands (the server didn't allow us)
client.on('mining.error', function(msg, socket){
  console.log('Error: ' + msg);
});

client.on('mining', function(data){
  console.log('Mining data: ' + data);
});

client.connect({
  host: 'localhost',
  port: 3333
}).then(function (socket){
    // defered, this can be chained if needed, no callback hell
    // "socket" refers to the current client, in this case, the 'client'
    // variable
    console.log('Connected! lets ask for subscribe');

    // After the first stratumSubscribe, the data will be handled internally
    // and returned deferreds to be resolved / rejected through the event 'mining'
    // above
    socket.stratumSubscribe('Node.js Stratum').then(
      // This isn't needed, it's handled automatically inside the Client class
      // but if you want to deal with anything special after subscribing and such.
      function(socket){
        console.log('Sent!');
      },
      function(socket, error){
        console.log('Error');
      }
    );
  })
  // this can be chained and is the last callback to execute
  //.done(function(){ });
;