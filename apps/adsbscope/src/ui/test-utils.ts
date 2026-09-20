/**
 * A stand-in for the browser's `EventSource`, which jsdom does not provide.
 * Specs install it with `vi.stubGlobal('EventSource', FakeEventSource)` and
 * drive it through the instance the code under test created.
 */
export class FakeEventSource extends EventTarget {
  /** Every instance created since the last {@link FakeEventSource.reset}. */
  static instances: FakeEventSource[] = [];

  /** The URL the instance was opened with. */
  readonly url: string;
  /** Whether `close()` has been called. */
  closed = false;

  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  /** Forgets every instance created so far. */
  static reset(): void {
    FakeEventSource.instances = [];
  }

  /** The most recently created instance. Throws if there is none, which means the code under test never subscribed. */
  static latest(): FakeEventSource {
    const instance = FakeEventSource.instances.at(-1);
    if (instance === undefined) {
      throw new Error('no EventSource has been created');
    }
    return instance;
  }

  /** Marks the instance closed, as the real `EventSource.close()` does. */
  close(): void {
    this.closed = true;
  }

  /** Dispatches a named server-sent event carrying `data`. */
  emit(type: string, data: string): void {
    this.dispatchEvent(new MessageEvent(type, { data }));
  }

  /** Dispatches the `open` event, as when the connection is established. */
  emitOpen(): void {
    this.dispatchEvent(new Event('open'));
  }

  /** Dispatches the `error` event, as when the connection drops. */
  emitError(): void {
    this.dispatchEvent(new Event('error'));
  }
}
