"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class StratumError extends Error {
    constructor(message, error) {
        super(message);
        this.error = error;
        Error["captureStackTrace"](this, this.constructor);
    }
    static fromError() {
    }
}
exports.StratumError = StratumError;
//# sourceMappingURL=stratumerror.js.map