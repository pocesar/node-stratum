import {  Daemon } from '../lib';

var daemon = new Daemon({
  user: 'user',
  password: 'password',
  port: 9912,
  host: 'localhost',
  name: 'XPM'
});

daemon.call('getinfo').then(function(mininginfo){
  console.log(mininginfo);
});