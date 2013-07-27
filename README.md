_WORK IN PROGRESS_

[![Build Status](https://travis-ci.org/pocesar/node-stratum.png?branch=master)](https://travis-ci.org/pocesar/node-stratum)

[![NPM](https://nodei.co/npm/stratum.png?downloads=true)](https://nodei.co/npm/stratum/)

node-stratum
============

Exposes a server to enable Stratum mining protocol (server and client) usage on Node.js and subscribe for events using EventEmitter, and accept `blocknotify` from `*coind` daemons
This is not a ready-to-use miner pool, you may use this server to implement your favorite altcoins, all the pool logic is up to you (shares, passwords, sessions, etc).

# Highlights

* Defer and promise based code instead of callbacks (avoid callback hell)
* Simple but powerful API for managing both server and client
* Build-in support for forking a `bitcoind` (`litecoind`, etc) process and accept RPC calls
* Easy for you to add your own procedures do the RPC server (using expose)
* No need to worry about `.conf` files for the daemons, everything is passed through command line the best way possible (but you may override arguments)
* Optimized code reuse with class methods
* All classes based on `EventEmitter` by default
* The client part make it easy, along with an RPC server, to setup a farming rig for coins, and also make possible to create a proxy from it

# Install

```bash
npm install stratum
```

Notice that you may install this globally using `-g`, `blocknotify` will be available system wide

# Block notify (if you want to call it manually for testing purposes)

```bash
node node_modules/.bin/blocknotify --host localhost --port 1337 --password willbebase64encoded --hash abcdef...
```

This command is called automatically if you set the `coind` options, they are forked when the server is started.

# Usage

```js
var Server = require('stratum').server;

// these settings can be changed using Server.defaults as well, for every new server up
var server = Server.create({
  /**
   * Coin daemons, will spawn a process for each enabled process
   */
  coinds  : {
    'bitcoin' : {
      enable  : false,                // enable this coind
      path    : '/usr/bin/bitcoind',  // path to the coind daemon to spawn
      user    : 'user',               // RPC username, setting to true will generate a random 16 bytes username
      password: 'password',           // RPC password, setting to true will generate a random 32 bytes password
      port    : 8332,                 // RPC port
      host    : '127.0.0.1',          // RPC host
      args    : []                    // extra args to pass to the daemon
    },
    'litecoin': {
      enable  : false,                 // enable this coind
      path    : '/usr/bin/litecoind',  // path to the coind daemon to spawn
      user    : 'user',                // RPC username, setting to true will generate a random 16 bytes username
      password: 'password',            // RPC password, setting to true will generate a random 32 bytes password
      port    : 9332,                  // RPC port
      host    : '127.0.0.1',           // RPC host
      args    : []                     // extra args to pass to the daemon
    },
    'ppcoin'  : {
      enable  : false,                 // enable this coind
      path    : '/usr/bin/ppcoind',    // path to the coind daemon to spawn
      user    : 'user',                // RPC username, setting to true will generate a random 16 bytes username
      password: 'password',            // RPC password, setting to true will generate a random 32 bytes password
      port    : 9902,                  // RPC port
      host    : '127.0.0.1',           // RPC host
      args    : []                     // extra args to pass to the daemon
    },
    'primecoin'  : {
      enable  : false,                 // enable this coind
      path    : '/usr/bin/primecoind', // path to the coind daemon to spawn
      user    : 'user',                // RPC username, setting to true will generate a random 16 bytes username
      password: 'password',            // RPC password, setting to true will generate a random 32 bytes password
      port    : 9911,                  // RPC port
      host    : '127.0.0.1',           // RPC host
      args    : []                     // extra args to pass to the daemon
    }
  },
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
    pass: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
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
        case 'mining.subscribe':
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
var Client = require('stratum').client;

client = Client.create();

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

# Examples

Check the `examples` folder, each part (client and server) is completely explained, and how to proceed on each possible case.

# Documentation

The following documentation expects that:

```js
var stratum = require('stratum');
```

You may, at any time, extend, overload or override any classes methods and instance methods (becauase it uses ES5Class module):

```js
stratum.server.implement({
    myOwnClassMethodObject: {
    }
});

stratum.server.myOwnClassMethodObject;

stratum.server.include({
    niftyFunction: function(isit){
        this.nifty = isit;
    }
});

var server = stratum.server.create();
server.niftyFunction(true);
server.nifty // true
```

**WARNING**: This actually changes the original class. You may create your derived own class using:

```js
var MyNewServer = stratum.server.define('MyNewServer', {
    // Add your functions here
});
```

The `MyNewServer` class will inherit everything from `stratum.server`, but will retain all it's functionality.
Use `$super()` to call overloaded methods:

```js
var MyNewServer = stratum.server.define('MyNewServer', {
    sendToIt: function(){
        this.$super(); // call the original function sendToId
    }
});
```

Notice that most of the functions that would return a callback (Node style), it return a deferred promise. If you are
not sure about how to use promises, go read [q module page](http://github.com/kriskowal/q)

Basically, with promises, you can resolve or reject a "future" value to something. It's more or less a callback, but
it's centralized on one instance, that is the deferred.

```js
server.listen().then(
    // first parameter is the "resolved" or "success"
    function(){
    },
    // second parameter is the "rejected" or "fail",
    function(){
    },
    // third parameter is the "progress", and it's not used anywhere in this module at the moment
    function(){
    }
);
```

## Server

Available through `stratum.server`

You can write your own defaults that applies to all new server instances through `stratum.server.defaults`

```js
stratum.server.defaults.settings.toobusy = 50;
```

You can also include your own stratum method calls through `stratum.server.commands` object, the server will lookup them automatically and provide it in the event emitted callback.
The 'mining.' prefix is expected, so if you put 'hashes', it expects the command to be `mining.hashes`

```js
stratum.server.commands.hashes = function(id, any, params, you, want, to, pass, to, the, client){
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

server.on('mining', function(req, deferred){
    if (req.method === 'hashes'){
        deferred.resolve([any, params, you, want, to, pass, to, the, client]);
        // or reject
        deferred.reject([any, params, you, want, to, pass, to, the, client]);
    }
});
```

## RPC

Available through `stratum.rpcserver`

## Client

Available through `stratum.client`

The client can connect to a stratum server and send and receive commands like if it were a miner.

The main reason for this part of the module is that you can setup a stratum proxy using it, to forward raw data (or even a command line call) to a stratum server.

You may also test your pool sending arbitrary test data to see if it's responding properly.

```js
var client = stratum.client.create();

client.on('mining.error', function(message){
});

client.on('mining', function(req, deferred){
    // this
});

client.connect(8080, 'localhost');
```



## Coind

Available through `stratum.coind`

# Debugging

Export/set the environment variable `DEBUG=stratum` on your command line

# Do you like it? Wanna support the development?

```bash
npm star stratum
```

`BTC: 1PskTzQjmzqB2boz67AXsv4C5YNWN4xmhu`

`LTC: LW2kXiquqDu3GfpfBX2xNTSgjVmBPu6g3z`

`PPC: PNKZEkDf9eBSNebu2CcxHaGuma6wHuZEBh`
