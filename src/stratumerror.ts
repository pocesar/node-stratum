export type Tuple = [number, string, string];

export class StratumError extends Error {
  constructor(message: string, public error: Tuple) {
    super(message);

    Error["captureStackTrace"](this, this.constructor);
  }

  toString() {
    return `${this.name}: ${this.message}\n\n${this.error[1]}`
  }
}
