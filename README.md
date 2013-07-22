_WORK IN PROGRESS_

[![Build Status](https://travis-ci.org/pocesar/node-stratum.png?branch=master)](https://travis-ci.org/pocesar/node-stratum)

[![NPM](https://nodei.co/npm/stratum.png?downloads=true)](https://nodei.co/npm/stratum/)

node-stratum
============

Exposes a server to enable Stratum mining protocol (server and client) usage on Node.js and subscribe for events using EventEmitter, and accept `blocknotify` from `*coind` daemons
This is not a ready-to-use miner pool, you may use this server to implement your favorite altcoins, all the pool logic is up to you (shares, passwords, sessions, etc).

## Highlights

* Defer and promise based code instead of callbacks (avoid callback hell)
* Simple but powerful API for managing both server and client
* Build-in support for forking a `bitcoind` (`litecoind`, etc) process and accept RPC calls
* Easy for you to add your own procedures do the RPC server (using expose)
* No need to worry about `.conf` files for the daemons, everything is passed through command line the best way possible (but you may override arguments)
* Optimized code reuse with class methods
* All classes based on `EventEmitter` by default
* The client part make it easy, along with an RPC server, to setup a farming rig for coins, and also make possible to create a proxy from it

## Install

```bash
npm install stratum
```

## Block notify (if you want to call it manually for testing purposes)

```bash
node node_modules/.bin/blocknotify --host localhost --port 1337 --password willbebase64encoded --hash abcdef...
```

This command is called automatically if you set the `coind` options.

## Usage

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
      user    : 'user',               // RPC username
      password: 'password',           // RPC password
      port    : 8332,                 // RPC port
      host    : '127.0.0.1',          // RPC host
      args    : []                    // extra args to pass to the daemon
    },
    'litecoin': {
      enable  : false,                 // enable this coind
      path    : '/usr/bin/litecoind',  // path to the coind daemon to spawn
      user    : 'user',                // RPC username
      password: 'password',            // RPC password
      port    : 9332,                  // RPC port
      host    : '127.0.0.1',           // RPC host
      args    : []                     // extra args to pass to the daemon
    },
    'ppcoin'  : {
      enable  : false,                 // enable this coind
      path    : '/usr/bin/ppcoind',    // path to the coind daemon to spawn
      user    : 'user',                // RPC username
      password: 'password',            // RPC password
      port    : 9902,                  // RPC port
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
     * RPC password
     *
     * @type {String}
     */
    pass: 'password'
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

server.on('mining', function(req, callback){
    switch (req.method){
        case 'mining.subscribe':
            // req.params[0] -> if filled, it's the User Agent, like CGMiner sends
            // Just fill the callback, the promise will be resolved and the data sent to the connected client
            callback([subscription, extranonce1, extranonce2_size]);
            break;
    }
});

server.start();
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

## Debugging

Export/set the environment variable `DEBUG=stratum` on your command line

## Do you like it? Wanna support the development?

```bash
npm star stratum
```

`BTC: 1PskTzQjmzqB2boz67AXsv4C5YNWN4xmhu` `LTC: LW2kXiquqDu3GfpfBX2xNTSgjVmBPu6g3z` `PPC: PNKZEkDf9eBSNebu2CcxHaGuma6wHuZEBh`
