[![Build Status](https://travis-ci.org/pocesar/node-stratum.png?branch=master)](https://travis-ci.org/pocesar/node-stratum)

node-stratum
============

Exposes a function to enable Stratum protocol usage on Node.js and subscribe for events using EventEmitter

## Install

```bash
npm install stratum
```

## Usage

```js
var
    Stratum = require('stratum'),
    server = Stratum.create();

server.on('subscribe', function(){
});

server.listen(3333);
```

## Do you like it? Wanna support the development?

```bash
npm star stratum
```

`BTC: 1PskTzQjmzqB2boz67AXsv4C5YNWN4xmhu`
`LTC: LW2kXiquqDu3GfpfBX2xNTSgjVmBPu6g3z`
`PPC: PNKZEkDf9eBSNebu2CcxHaGuma6wHuZEBh`
