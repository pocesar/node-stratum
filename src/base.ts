"use strict";

import * as Debug from "debug";
import { EventEmitter } from "eventemitter3";

const debug = Debug("stratum");

export default class Base extends EventEmitter {
  static debug(...msg: any[]) {
    debug(this.constructor.name + ": ", ...msg);

    return typeof msg === 'object' ? msg.join(', ') : msg;
  }
}
