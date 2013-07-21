[![Build Status](https://travis-ci.org/pocesar/node-stratum.png?branch=master)](https://travis-ci.org/pocesar/node-stratum)

[![NPM](https://nodei.co/npm/stratum.png?downloads=true)](https://nodei.co/npm/stratum/)

_WORK IN PROGRESS_

node-stratum
============

Exposes a server to enable Stratum protocol usage on Node.js and subscribe for events using EventEmitter, and accept `blocknotify` from `*coind` daemons
This is not a ready-to-use miner pool, you may use this server to implement your favorite altcoins

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
    pass: 'password',
    /**
     * Set the UNIX socket if you are on unix and will accept only local connections
     * like '/tmp/stratum.sock'
     *
     * @type {String}
     */
    sock: null
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

server.listen(function(err, res){
    if (err){
        throw Error(err);
    }

});
```

On unix, you may listen on a socket for even less overhead for local transport:

```js
var server = require('stratum').server;

server.create({
    sock: '/tmp/stratum.sock'
});
```

You can connect to Stratum servers as well:

```js
var client = require('stratum').client;
```

## Debugging

Export/set the environment variable `DEBUG=stratum` on your command line

## Do you like it? Wanna support the development?

```bash
npm star stratum
```

`BTC: 1PskTzQjmzqB2boz67AXsv4C5YNWN4xmhu` `LTC: LW2kXiquqDu3GfpfBX2xNTSgjVmBPu6g3z` `PPC: PNKZEkDf9eBSNebu2CcxHaGuma6wHuZEBh`
