/**
 * Test utilities for acp-ws-bridge tests.
 *
 * Provides mock WebSocket, test data builders, and helper functions
 * for async test patterns.
 */

import type {
  BridgeEnvelope,
  BridgeMessage,
  BridgeStatus
} from "@harms-haus/acp-chat-core";

// JsonValue is defined in generated types but not exported from main index
// Define locally for test code to match the generated type signature
type JsonValue = number | string | boolean | Array<JsonValue> | { [key in string]?: JsonValue } | null;

/**
 * Mock WebSocket implementation for testing.
 *
 * Simulates WebSocket behavior without actual network connections.
 * Allows controlling connection state, message delivery, and error simulation.
 */
export class MockWebSocket extends EventTarget {
  /** Current ready state of the WebSocket */
  public static readonly CONNECTING = 0 as const;
  public static readonly OPEN = 1 as const;
  public static readonly CLOSING = 2 as const;
  public static readonly CLOSED = 3 as const;

  /** URL the WebSocket was constructed with */
  public readonly url: string;

  /** Current ready state (CONNECTING, OPEN, CLOSING, CLOSED) */
  public readyState: number;

  /** Extensions negotiated with the server (always empty string for mock) */
  public readonly extensions: string = "";

  /** Protocol selected by the server (always empty string for mock) */
  public readonly protocol: string = "";

  /** Optional handler for 'open' events */
  public onopen: ((event: Event) => void) | null = null;

  /** Optional handler for 'message' events */
  public onmessage: ((event: MessageEvent) => void) | null = null;

  /** Optional handler for 'error' events */
  public onerror: ((event: Event) => void) | null = null;

  /** Optional handler for 'close' events */
  public onclose: ((event: CloseEvent) => void) | null = null;

  /** Binary type for received data (always 'blob' for mock) */
  public binaryType: BinaryType = "blob";

  /** Buffer size for bufferedAmount (always 0 for mock) */
  public readonly bufferedAmount: number = 0;

  /** Messages queued to send (simulated) */
  private sentMessages: Array<string> = [];

  /** Whether connection should succeed on next open */
  private shouldFailOnOpen = false;

  constructor(url: string) {
    super();
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
  }

  /**
   * Simulate WebSocket opening (normally automatic after construction).
   * Call this in tests to trigger the 'open' event.
   */
  public simulateOpen(): void {
    if (this.shouldFailOnOpen) {
      this.simulateError();
      this.simulateClose(1006, "Connection failed");
      return;
    }

    this.readyState = MockWebSocket.OPEN;
    this._dispatchEvent(new Event("open"));
  }

  /**
   * Simulate receiving a message from the server.
   * @param data - Message data to receive
   */
  public simulateMessage(data: string): void {
    const event = new MessageEvent("message", { data });
    this._dispatchEvent(event);
  }

  /**
   * Simulate receiving an object as JSON.
   * @param obj - Object to stringify and send
   */
  public simulateMessageJson(obj: unknown): void {
    this.simulateMessage(JSON.stringify(obj));
  }

  /**
   * Simulate a WebSocket error.
   */
  public simulateError(): void {
    this._dispatchEvent(new Event("error"));
  }

  /**
   * Simulate WebSocket closing.
   * @param code - Close code (default: 1000)
   * @param reason - Close reason (default: "")
   * @param wasClean - Whether close was clean (default: true)
   */
  public simulateClose(code: number = 1000, reason: string = "", wasClean: boolean = true): void {
    this.readyState = MockWebSocket.CLOSED;
    const event = new CloseEvent("close", { code, reason, wasClean });
    this._dispatchEvent(event);
  }

  /**
   * Send data through the WebSocket.
   * Stores messages in sentMessages array for inspection in tests.
   * @param data - Data to send
   */
  public send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    this.sentMessages.push(data);
  }

  /**
   * Close the WebSocket connection.
   * @param code - Close code (default: 1000)
   * @param reason - Close reason (default: "")
   */
  public close(code: number = 1000, reason: string = ""): void {
    if (this.readyState === MockWebSocket.CLOSED) {
      return;
    }
    this.readyState = MockWebSocket.CLOSING;
    this.simulateClose(code, reason);
  }

  /**
   * Get all messages sent through this WebSocket.
   */
  public getSentMessages(): Array<string> {
    return [...this.sentMessages];
  }

  /**
   * Clear the sent messages buffer.
   */
  public clearSentMessages(): void {
    this.sentMessages = [];
  }

  /**
   * Configure whether connection should fail on open.
   */
  public failOnOpen(shouldFail: boolean): void {
    this.shouldFailOnOpen = shouldFail;
  }

  /** Dispatch event and call appropriate handler if set */
  private _dispatchEvent(event: Event): void {
     
    super.dispatchEvent(event);

    switch (event.type) {
      case "open":
        if (this.onopen) this.onopen(event);
        break;
      case "message":
        if (this.onmessage) this.onmessage(event as MessageEvent);
        break;
      case "error":
        if (this.onerror) this.onerror(event);
        break;
      case "close":
        if (this.onclose) this.onclose(event as CloseEvent);
        break;
    }
  }

  /**
   * Restore global WebSocket to original implementation.
   * Call this in afterEach hooks to clean up.
   */
  public static restore(): void {
    // Note: This is a placeholder - actual implementation depends on test environment
    // For Node.js with 'ws' package, you'd need to restore the original WebSocket
  }
}

/**
 * Builder for creating test BridgeEnvelope instances.
 */
export class EnvelopeBuilder {
  private _version: number = 1;
  private _seq: number = 0;
  private _timestamp_ms: number = 1234567890;
  private _extraData?: Record<string, unknown>;
  private _message?: BridgeMessage;

  /** Creates a new builder with default values */
  public static new(): EnvelopeBuilder {
    return new EnvelopeBuilder();
  }

  /** Sets the envelope version */
  public version(version: number): this {
    this._version = version;
    return this;
  }

  /** Sets the sequence number */
  public seq(seq: number): this {
    this._seq = seq;
    return this;
  }

  /** Sets the timestamp in milliseconds */
  public timestampMs(timestampMs: number): this {
    this._timestamp_ms = timestampMs;
    return this;
  }

  /** Sets extra data metadata */
  public extraData(extraData: Record<string, unknown>): this {
    this._extraData = extraData;
    return this;
  }

  /** Sets the message payload */
  public message(message: BridgeMessage): this {
    this._message = message;
    return this;
  }

  /** Builds the BridgeEnvelope */
  public build(): BridgeEnvelope {
    if (!this._message) {
      throw new Error("message must be set");
    }
    return {
      ...this._message,
      version: this._version,
      seq: this._seq,
      timestamp_ms: this._timestamp_ms,
      ...(this._extraData && { extraData: this._extraData }),
    };
  }
}

/**
 * Helper functions for creating test messages.
 */
export class MessageBuilder {
  /** Creates an ACP payload message */
  public static acpPayload(payload: JsonValue): BridgeMessage {
    return {
      type: "acp_payload",
      payload,
    };
  }

  /** Creates an ACP payload message with a JSON-RPC request */
  public static acpRequest(method: string, params: JsonValue): BridgeMessage {
    return {
      type: "acp_payload",
      payload: {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      },
    };
  }

  /** Creates a bridge status message */
  public static bridgeStatus(status: BridgeStatus): BridgeMessage {
    return {
      type: "bridge_status",
      status,
    };
  }

  /** Creates a stderr message */
  public static stderr(line: string): BridgeMessage {
    return {
      type: "stderr",
      line,
    };
  }

  /** Creates a process exit message */
  public static processExit(code: number | null, signal: string | null): BridgeMessage {
    return {
      type: "process_exit",
      code,
      signal,
    };
  }

  /** Creates a replay metadata message */
  public static replayMetadata(
    capturedAtMs: number,
    totalEnvelopes: number,
    description: string | null = null
  ): BridgeMessage {
    return {
      type: "replay_metadata",
      captured_at_ms: capturedAtMs,
      total_envelopes: totalEnvelopes,
      description,
    };
  }

  /** Creates a start agent message */
  public static startAgent(
    command: string,
    args: Array<string>,
    cwd: string | null = null,
    env: Array<[string, string]> = []
  ): BridgeMessage {
    return {
      type: "start_agent",
      command,
      args,
      cwd,
      env,
    };
  }
}

/**
 * Common test data constants.
 */
export const TestConstants = {
  /** Default test timestamp */
  DEFAULT_TIMESTAMP_MS: 1234567890,

  /** Default test sequence number */
  DEFAULT_SEQ: 0,

  /** Sample ACP payload for testing */
  sampleAcpPayload(): JsonValue {
    return {
      jsonrpc: "2.0",
      id: 1,
      method: "test/method",
      params: { test: "value" },
    };
  },

  /** Sample stderr line for testing */
  SAMPLE_STDERR_LINE: "Error: Something went wrong",

  /** Sample envelope with ACP payload */
  sampleEnvelopeAcpPayload(): BridgeEnvelope {
    return EnvelopeBuilder.new()
      .message(MessageBuilder.acpPayload(this.sampleAcpPayload()))
      .build();
  },

  /** Sample envelope with bridge status */
  sampleEnvelopeBridgeStatus(status: BridgeStatus = "connected"): BridgeEnvelope {
    return EnvelopeBuilder.new().message(MessageBuilder.bridgeStatus(status)).build();
  },

  /** Sample envelope with stderr */
  sampleEnvelopeStderr(line: string = "Error: Something went wrong"): BridgeEnvelope {
    return EnvelopeBuilder.new().message(MessageBuilder.stderr(line)).build();
  },

  /** Sample envelope with process exit */
  sampleEnvelopeProcessExit(
    code: number | null = 1,
    signal: string | null = "SIGTERM"
  ): BridgeEnvelope {
    return EnvelopeBuilder.new()
      .message(MessageBuilder.processExit(code, signal))
      .build();
  },

  /** Sample replay metadata envelope */
  sampleEnvelopeReplayMetadata(): BridgeEnvelope {
    return EnvelopeBuilder.new()
      .message(MessageBuilder.replayMetadata(1234567890, 100, "Test session"))
      .build();
  },

  /** Sample start agent envelope */
  sampleEnvelopeStartAgent(): BridgeEnvelope {
    return EnvelopeBuilder.new()
      .message(MessageBuilder.startAgent("node", ["script.js"], "/workspace", [["NODE_ENV", "test"]]))
      .build();
  },
};

/**
 * Helper functions for async test patterns.
 */
export class AsyncTestHelpers {
  /**
   * Wait for a specified number of milliseconds.
   * @param ms - Milliseconds to wait
   */
  public static async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wait for a condition to become true.
   * @param condition - Function that returns true when condition is met
   * @param timeout - Maximum time to wait in milliseconds (default: 5000)
   * @param interval - Check interval in milliseconds (default: 100)
   */
  public static async waitForCondition(
    condition: () => boolean,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (condition()) {
        return;
      }
      await this.wait(interval);
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Capture events dispatched from an EventTarget.
   * @param target - EventTarget to listen to
   * @param eventType - Type of events to capture
   * @param count - Number of events to capture (default: 1)
   */
  public static captureEvents<T extends Event>(
    target: EventTarget,
    eventType: string,
    count: number = 1
  ): Promise<T[]> {
    return new Promise((resolve) => {
      const captured: T[] = [];
      let resolved = false;

      const handler = (event: Event) => {
        if (resolved) return;

        captured.push(event as T);

        if (captured.length >= count) {
          resolved = true;
          target.removeEventListener(eventType, handler);
          resolve(captured);
        }
      };

      target.addEventListener(eventType, handler);
    });
  }

  /**
   * Create a promise that can be resolved or rejected externally.
   */
  public static createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
  } {
    let resolveFn: ((value: T) => void) | null = null;
    let rejectFn: ((error: Error) => void) | null = null;

    const promise = new Promise<T>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    return {
      promise,
      resolve: resolveFn!,
      reject: rejectFn!,
    };
  }
}
