var stratum = require('../lib');

var client = stratum.Client.$create();

 //must be specified per EventEmitter requirements
client.on('error', function(socket, err){
  socket.destroy();
  console.log('Connection closed with error: ', err);
  process.exit(1);
});

// this usually happens when we are not authorized to send commands (the server didn't allow us)
// or share was rejected
// Stratum errors are usually an array with 3 items [int, string, null]
client.on('mining.error', function(msg, socket){
  console.log(msg);
});

var submitted = false;

// the client is a one-way communication, it receives data from the server after issuing commands
client.on('mining', function(data, socket, type){
  // type will be either 'broadcast' or 'result'
  console.log('Mining data: ' + type + ' = ', data);
  // you can issue more commands to the socket, it's the exact same socket as "client" variable
  // in this example

  // the socket (client) got some fields like:
  // client.name = name of the worker
  // client.authorized = if the current connection is authorized or not
  // client.id = an UUID ([U]niversal [U]nique [ID]entifier) that you can safely rely on it's uniqueness
  // client.subscription = the subscription data from the server
  switch (data.method) {
    case 'set_difficulty':
      // server sent the new difficulty
      break;
    case 'notify':
      // server sent a new block
      break;
    default:
      if (!socket.authorized){
        console.log('Asking for authorization');
        socket.stratumAuthorize('user','pass');
      } else {
        console.log('We are authorized');
        if (!submitted) {
          console.log('Lets submit fake data once for test purposes, then close');
          socket.stratumSubmit('', '' ,'' ,' ', '').done(function(){
            client.destroy(); // after call to destroy, "client" doesnt exist anymore
          });
          submitted = true;
        }
      }
  }
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
      function(error){
        console.log('Error');
      }
    );
  })
  // this can be chained and is the last callback to execute
  //.done(function(){ });
;
