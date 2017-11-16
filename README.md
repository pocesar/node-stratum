[![Build Status](https://travis-ci.org/pocesar/node-stratum.svg?branch=master)](https://travis-ci.org/pocesar/node-stratum)
[![Coverage Status](https://coveralls.io/repos/pocesar/node-stratum/badge.png)](https://coveralls.io/r/pocesar/node-stratum)
[![Dependency Status](https://gemnasium.com/pocesar/node-stratum.svg)](https://gemnasium.com/pocesar/node-stratum)

[![NPM](https://nodei.co/npm/stratum.png?downloads=true)](https://nodei.co/npm/stratum/)

# Node.js Stratum Server / Client / RPC Daemon

Exposes a server to enable Stratum mining protocol (server and client) usage on Node.js and subscribe for events using EventEmitter, and accept `stratum-notify` from `*coind` daemons

This is not a ready-to-use miner pool, you may use this server to implement your favorite altcoins, all the pool logic is up to you (shares, passwords, sessions, etc).

## Highlights

* Simple but powerful API for managing both server and client
* Build-in support for spawn coins daemons (`bitcoind`, `litecoind`, etc) process and accept RPC calls
* Easy for you to add your own procedures do the RPC server (using `expose`)
* No need to worry about `.conf` files for the daemons, everything is passed through command line the best way possible (but you may override arguments)
* All classes based on `EventEmitter` by default (through the `Base` class)
* The client part make it easy, along with an RPC server, to setup your own farming pool for coins
* You can create a proxy from it using the `Client` interface, mix up Stratum with your own RPC definition and commands

## Install

```bash
npm install stratum
```

Notice that you may install this globally using `-g`, `stratum-notify` will be available system wide

## Stratum notify

##### if you want to call it manually for testing purposes

```bash
node node_modules/.bin/stratum-notify --host localhost --port 1337 --password willbebase64encoded --type block --data "jsondata"
```

This command is called automatically if you set the `coind` options, they are forked when the server is started.

## Usage

```js
var Server = require('stratum').Server;

// these settings can be changed using Server.defaults as well, for every new server up
var server = new Server({
  /**
   * RPC to listen interface for this server
   */
  rpc     : {
    /**
     * Bind to address
     *
     * @type {String}
     */
    host: 'localhost',
    /**
     * RPC port
     *
     * @type {Number}
     */
    port: 1337,
    /**
     * RPC password, this needs to be a SHA256 hash, defaults to 'password'
     * To create a hash out of your password, launch node.js and write
     *
     * require('crypto').createHash('sha256').update('password').digest('hex');
     *
     * @type {String}
     */
    password: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    /**
     * Mode to listen. By default listen only on TCP, but you may use 'http' or 'both' (deal
     * with HTTP and TCP at same time)
     */
    mode: 'tcp'
  },
  /**
   * The server settings itself
   */
  settings: {
    /**
     * Address to set the X-Stratum header if someone connects using HTTP
     * @type {String}
     */
    hostname: 'localhost',
    /**
     * Max server lag before considering the server "too busy" and drop new connections
     * @type {Number}
     */
    toobusy : 70,
    /**
     * Bind to address, use 0.0.0.0 for external access
     * @type {string}
     */
    host    : 'localhost',
    /**
     * Port for the stratum TCP server to listen on
     * @type {Number}
     */
    port    : 3333
  }
});

server.on('mining', function(req, deferred){
    switch (req.method){
        case 'subscribe':
            // req.params[0] -> if filled, it's the User Agent, like CGMiner/CPUMiner sends
            // Just resolve the deferred, the promise will be resolved and the data sent to the connected client
            deferred.resolve([subscription, extranonce1, extranonce2_size]);
            break;
    }
});

server.listen();
```

You can connect to Stratum servers as well:

```js
var Client = require('stratum').Client;

client = new Client();

client.connect({
    host: 'localhost',
    port: 3333
}).then(function(){
    return ...;
}).then(function(value){
    if (value){
        //etc
    }
});

```

## Examples

Check the `examples` folder, each part (client and server) is completely explained, and how to proceed on each possible case.

## Documentation

The following documentation expects that:

```js
var stratum = require('stratum');
```

### Base

Available through `stratum.Base`

All the classes inherit from the base class, that inherits from `EventEmitter3`, and got an additional method:

#### debug(msg)

Show debug messages for the class only if `DEBUG=stratum` environment variable is set

```js
stratum.Base.debug('oops');
```

### Server

Available through `stratum.Server`

You can write your own defaults that applies to all new server instances through `stratum.Server.defaults`

```js
stratum.Server.defaults.settings.toobusy = 50;
```

You can also include your own stratum method calls through `stratum.Server.commands` object, the server will lookup them automatically and provide it in the event emitted callback.
The 'mining.' prefix is expected, so if you put 'hashes', it expects the command to be `mining.hashes`

```js
stratum.Server.commands.hashes = function(id, any, params, you, want, to, pass, to, the, client){
    // this function is actually the "resolved" function, that sends data back to the client
    // it's reached by using deferred.resolve([...params...]); in the emitted callback

    // "this" is the current socket
    // "id" is the current RPC call id and is non-optional, must be always the first parameter

    // you should always return something like this:
    return this.stratumSend({
        error: null,
        result: [any, params, you, want], // your result
        id: id
    });
};

// the event `mining.hashes` will be fired on the callback

server.on('mining', function(req, deferred) {
    if (req.method === 'hashes'){
        deferred.resolve([any, params, you, want, to, pass, to, the, client]);
        // or reject
        deferred.reject([any, params, you, want, to, pass, to, the, client]);
    }
});

// mining.error event is emitted when something is wrong, mining related

server.on('mining.error', function(){

});

// the stratum.Server also holds defaults for coins daemons
console.log(stratum.Server.daemons); // a list of pre-configured daemons in stratum.Server.daemons

// You can inject them into the server later on, using stratum.Daemon

//instantiates a bitcoin stratum.Daemon and places inside the server
server.addDaemon(stratum.Server.daemons.bitcoin);

// you can instantiate using your own instance as well
server.addDaemon(stratum.Daemon.create({
    'name': 'MyExampleCoin',
    /*...*/
}));
```

### RPCServer

Available through `stratum.RPCServer`.

Enables you to communicate from outside the Stratum module through an JSON RPC 2.0 interface. It's optional, and you don't need to enable it, you may communicate from inside out only.

It's mainly useful to receive notifications (wallet, block and alert), like the `stratum-notify` bin to receive json data from the outside, but you may extend the interface to accept any other commands that you deem necessary for your app.

It's advised to bind the `RPCServer` instance to either `localhost` or an internal IP range, and/or access through trusted proxies.

```js
const rpc = new stratum.RPCServer({
    'mode': 'tcp', // can be 'tcp', 'http', 'both' (can handle TCP and HTTP/Websockets on one port)
    'port': 9999,
    'host': 'localhost', // bind to localhost
    'password': 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3' // SHA256 hash of the password, no plain text!
});

rpc.listen(); // listens on port 9999, binding to localhost

rpc.expose('mymethod', function(args, connection, callback){
    // if you want to pass an error, use the first callback parameter
    callback(error);
    // otherwise, pass the result through the second parameter
    callback(null, result);
});

// RPC calls like {"method":"mymethod","params":[1,"2"],"id":1}, the args parameter will receive only the [1,"2"]
```

### Client

Available through `stratum.Client`

The client can connect to a stratum server and send and receive commands like if it was a miner.

The main reason for this part of the module is that you can setup a stratum proxy using it, to forward raw data (or even a command line call) to a stratum server.

You may also test your pool sending arbitrary test data to see if it's responding properly.

If your URL starts with 'stratum+tcp://', remove it!

```js
var client = new stratum.Client();

client.on('mining.error', function(message){
});

client.on('mining', function(req, deferred){
    // this
});

client.connect(8080, 'localhost').then(function(socket){
    socket.stratumSubscribe('NodeMiner');
    socket.stratumAuthorize('user','pass');
    socket.stratumSubmit('worker', 'job_id', 'extranonce2', 'ntime', 'nonce');
    socket.stratumSend(data, true); //send a stratum command other than the previous ones
    socket.send(data); // send raw data through the socket
});
```

### Daemon

Available through `stratum.Daemon`

Include or change the global configuration for daemons using the `stratum.Server.daemons` member. It's not set per instance, but rather globally.

The options `path`, `args`, `notifyPath`, `notify` are optional

```js
stratum.Server.daemons['sillycoin'] = {
    'path': '/usr/bin/sillycoind', // optional
    'args': ['debug'], // optional
    'rpcserver': { // this whole block is optional, this is the stratum server RPC (not the daemon one))
        'port': 8888,
        'host': 'localhost',
        'password': 'rpcpassword',
        'notifyPath': './node_modules/.bin/stratum-notify', // optional
        'notify': ['block', 'wallet', 'alert'], // optional, will build walletnotify, blocknotify and alertnotify parameters
    }
    'name': 'SillyCoin',
    'user': 'rpcuser',
    'password': 'rpcpassword',
    'port': 0xDEAD,
    'host': 'localhost'
};
```

You can start issuing commands to the daemon BEFORE calling `start()`, usually when you already have it running. `start()` will attempt to spawn the process.

```js
var daemon = new stratum.Daemon({
    'path': '/usr/bin/sillycoind',
    'name': 'SillyCoin',
    'user': 'rpcuser',
    'password': 'rpcpassword',
    'port': 0xDEAD,
    'host': 'localhost',
    'args': ['debug']
});

async function start() {
    daemon.start();

    try {
        const result = await daemon.call('getinfo', []);
        // daemon returned a result
        console.log(result.balance);
    } catch (result) {
        // daemon returned an error
        console.log(result); // usually "Command timed out" or "Unauthorized access"
    }
}

start();
```

## Debugging

Export/set the environment variable `DEBUG=stratum` on your command line before executing your code, that you'll be able to see everything behind the hood inside this module on the command line.

You can additionally set `DEBUG=stratum,jsonrpc` to also see the RPC part in-depth (for `stratum.Daemon` and `stratum.RPCServer`)

## Wanna support the development?

`BTC: 13nEfe1J8VTYSTu1c5nEkq9RPUM6eTj4d6`
`BCH: 17MzTvz7Ca8yFGPETzxfTwGmjEBnLjzgpq`

