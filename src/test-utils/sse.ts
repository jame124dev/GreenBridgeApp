// Reusable fake react-native-sse EventSource for streaming transport tests
// (PR-0). Mirrors the proven pattern in
// `services/scanner/__tests__/smartDetectStream.test.ts` so `labStream` tests
// share one injectable fake instead of re-deriving it.
type Listener = (ev: unknown) => void;

export class FakeEventSource {
  url: string;
  options: Record<string, unknown>;
  closeCount = 0;
  removeAllCount = 0;
  private listeners: Record<string, Listener[]> = {};

  constructor(url: string, options: Record<string, unknown>) {
    this.url = url;
    this.options = options;
  }

  addEventListener(type: string, cb: Listener) {
    (this.listeners[type] ??= []).push(cb);
  }

  removeAllEventListeners() {
    this.removeAllCount += 1;
    this.listeners = {};
  }

  close() {
    this.closeCount += 1;
  }

  emit(type: string, ev: unknown) {
    (this.listeners[type] ?? []).forEach((cb) => cb(ev));
  }

  get listenerCount() {
    return Object.values(this.listeners).reduce((n, l) => n + l.length, 0);
  }
}

/** Flush the microtask/timer queue so the transport's async open resolves. */
export const flush = () => new Promise((r) => setTimeout(r, 0));

/** Emit one SSE frame in the shape react-native-sse delivers to listeners. */
export function emitFrame(es: FakeEventSource, f: { event: string; data: string }) {
  es.emit(f.event, { type: f.event, data: f.data, lastEventId: null, url: es.url });
}
