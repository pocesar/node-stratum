var stratum = require('../lib'),
    Server = stratum.Server,
    server = Server.create();

server.on('mining', function(req, deferred, socket){
  // req is {method:"", id:0, params: []}

  // this may seem counter intuitive to some people
  // but working with deferred is the most powerful
  // way to create maintainable code (tied with decoupling
  // using events)

  // The deferred parameter must be resolve'd if the data
  // is correct, and reject'ed if anything went wrong.

  // Always resolve or reject using an array instead of
  // parameters

  // the socket parameter is the Client class, if you need
  // anything with it (closing, sending raw data, etc),
  // you can authorize, change the currentId, fetch socket id,
  // etc

  switch (req.method) {
    case 'subscribe':
      console.log('Client is asking for subscription!');
      // returns a mining.notify command to the client
      //
      // Resolve the deferred, so the command is sent to the socket

      deferred  // subscription_id, extranonce1, extranonce2_size
        .resolve(['ae6812eb4cd7735a302a8a9dd95cf71f', '08000002', 4]);

      // you may send an error to the client by rejecting the deferred
      // deferred.reject(stratum.server.errors.UNKNOWN);
      break;
    case 'authorize':
      console.log('Authorizing worker ' + req.params[0]);

      // true = authorized or false = not authorized
      deferred.resolve([true]);

      // If you need to call other methods on the current socket

      // notice that these two functions (set_difficulty and notify)
      // are called before the deferred, make sure a racing condition won't happen
      socket.set_difficulty([1]).then(function(){
        console.log('Sent difficulty');
      }, function(){
        console.log('Failed to send difficulty');
      });

      // job_id, previous_hash, coinbase1, coinbase2, branches, block_version, nbit, ntime, clean
      // SHA256
      /*socket.notify([
        'bf',
        '00000000d48a84c146910cfff0c9fd37052ec4c220e083a37ec9a09964e77d2d',
        '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff20020862062f503253482f04b8864e5008',
        '072f736c7573682f000000000100f2052a010000001976a914d23fcdf86f7e756a64a7a9688ef9903327048ed988ac00000000',
         [
          '61e90d4998b4a30d5a939e7e8b9a77d0b6abae6d30e827d00a45b57052cc6812'
         ],
        '00000002',
        'ffff001d',
        'e8dc3c50',
        false
      ]).then(function(){
        console.log('Sent work');
      }, function(){
        console.log('Failed to send work');
      });*/

      //SCRYPT
      socket.notify([
        'bf',
        'b61b385ce17b7f9e4d1586ee0cfa7bc0778fe63bffe0240bd9d228f2829b7f0b',
        '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff2303700706062f503253482f042a91f15108',
        '092f7374726174756d2f00000000018091db2a010000001976a914e63c288f379eea1a32305932d957d70b69e21dff88ac00000000',
        ['4d31368c61b556105d936a0bf2f7d772e19375d2997fbf8d9eae5c5e089b2910', '012b5c89cff28de2400d192a3d8ed55b5d19f026f77d95838b3af2aefd0304a4'],
        '00000001', '1b494a04', '51f1912a', true
      ]).then(function(){
          console.log('Sent work');
        }, function(){
          console.log('Failed to send work');
        });


      break;
    case 'submit':
      deferred.resolve([true]); // accept any share, just for example purposes
      break;
    case 'get_transactions':
      // transparency to the masses (BFGMiner asks for this), you can return an error using reject
      deferred.reject(Server.errors.METHOD_NOT_FOUND);
      break;
    default:
      // reject is the Deferred reject function, sends an error to the socket

      // this will never be reached, since the server checks if the method
      // is valid before emitting the 'mining' event.

      // This error will go directly to mining.error
      deferred.reject(Server.errors.METHOD_NOT_FOUND);
  }
});

// This event is emitted when an error directly related to mining is raised
server.on('mining.error', function(error, socket){
  console.log('Mining error: ' + error);
});

// Server emits rpc events when it receives communication from outside (usually from blocknotify)
server.on('rpc', function(name, args, connection, deferred){
  // these two come out of the box, but you may add your own functions as well
  // using server.rpc.expose('name', function(){}, context);
  switch (name) {
    case 'mining.connections':
      // "someone" is asking for the connections on this app, let's return the ids
      deferred.resolve([
        stratum.lodash.map(server.clients, function(client){
          return {id: client.id, ip: client.address().address };
        })
      ]); // always resolve using array

      // or we can deny it
      deferred.reject(['Im not showing it to you']);

      break;
    case 'mining.update_block':
      // bitcoind is sending us a new block, there's no need to answer with
      // real data, unless the other end if doing some log

      deferred.resolve(['Block updated']); // always resolve using array
      break;
  }
});

// broadcast can be either set_difficulty or notify
// (other commands need an ID, so depends on method requests from server),
// and they are silently rejected

/*
setTimeout(function broadcast(){
  server.broadcast('notify', [
    'bf',
    '00000000d48a84c146910cfff0c9fd37052ec4c220e083a37ec9a09964e77d2d',
    '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff20020862062f503253482f04b8864e5008',
    '072f736c7573682f000000000100f2052a010000001976a914d23fcdf86f7e756a64a7a9688ef9903327048ed988ac00000000',
     [
      '61e90d4998b4a30d5a939e7e8b9a77d0b6abae6d30e827d00a45b57052cc6812'
     ],
    '00000002',
    'ffff001d',
    'e8dc3c50',
    false
  ]).then(
    function(total){
      console.log('Broadcasted new work ' + total + ' clients');
    }, function(err){
      console.log('Cant broadcast: ' + err);
    }
  );
}, 150000); */

server.listen().then(function(msg){
  console.log(msg);
});