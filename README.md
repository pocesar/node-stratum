[![Build Status](https://travis-ci.org/pocesar/node-stratum.png?branch=master)](https://travis-ci.org/pocesar/node-stratum)
[![NPM](https://nodei.co/npm/stratum.png?downloads=true)](https://nodei.co/npm/stratum/)

_WORK IN PROGRESS_

node-stratum
============

Exposes a function to enable Stratum protocol usage on Node.js and subscribe for events using EventEmitter, and accept `blocknotify` from `*coind` daemons

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

var server = Server.create({
    coind: {
        enable: true, // enable the settings below
        path: '/usr/bin/bitcoind', // path to the coind daemon to spawn
        user: 'user', // RPC username
        password: 'password', // RPC password
        port: 8332, // RPC port
        host: '127.0.0.1' // RPC host
    },
    rpc: { // RPC interface for this server
        
    },
    host: 'localhost', // bind to address, use 0.0.0.0 for external access
    port: 8080, // port for the stratum server to listen on
    // or if you are on unix and will accept only local connections
    sock: '/tmp/stratum.sock',
    settings: {
        toobusy: 70 // max lag before considering the server "too busy" and drop new connections
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

`BTC: 1PskTzQjmzqB2boz67AXsv4C5YNWN4xmhu`
`LTC: LW2kXiquqDu3GfpfBX2xNTSgjVmBPu6g3z`
`PPC: PNKZEkDf9eBSNebu2CcxHaGuma6wHuZEBh`
