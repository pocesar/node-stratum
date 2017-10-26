"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Debug = require("debug");
const eventemitter3_1 = require("eventemitter3");
const debug = Debug("stratum");
class Base extends eventemitter3_1.EventEmitter {
    static debug(...msg) {
        debug(this.constructor.name + ": ", ...msg);
        return typeof msg === 'object' ? msg.join(', ') : msg;
    }
}
exports.default = Base;
//# sourceMappingURL=base.js.map