// Minimal event emitter used by the combat engine for relic / power triggers.
export class Emitter {
  constructor() {
    this.handlers = new Map();
  }
  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) {
    const arr = this.handlers.get(event);
    if (arr) this.handlers.set(event, arr.filter((f) => f !== fn));
  }
  emit(event, payload) {
    const arr = this.handlers.get(event);
    if (arr) for (const fn of arr.slice()) fn(payload);
  }
}
