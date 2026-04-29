import type {
  TerminalCreateHandler,
  TerminalOutputHandler,
  TerminalWaitForExitHandler,
  TerminalKillHandler,
  TerminalReleaseHandler,
  TerminalSubscription,
} from "./types.js";

export class TerminalSubscriptionManager {
  private createHandlers: Map<string, TerminalCreateHandler> = new Map();
  private outputHandlers: Map<string, TerminalOutputHandler> = new Map();
  private waitForExitHandlers: Map<string, TerminalWaitForExitHandler> = new Map();
  private killHandlers: Map<string, TerminalKillHandler> = new Map();
  private releaseHandlers: Map<string, TerminalReleaseHandler> = new Map();
  private subscriptionCounter = 0;

  subscribeToCreate(handler: TerminalCreateHandler): TerminalSubscription {
    const id = `create-${this.subscriptionCounter++}`;
    this.createHandlers.set(id, handler);
    return {
      unsubscribe: () => {
        this.createHandlers.delete(id);
      },
    };
  }

  subscribeToOutput(handler: TerminalOutputHandler): TerminalSubscription {
    const id = `output-${this.subscriptionCounter++}`;
    this.outputHandlers.set(id, handler);
    return {
      unsubscribe: () => {
        this.outputHandlers.delete(id);
      },
    };
  }

  subscribeToWaitForExit(
    handler: TerminalWaitForExitHandler,
  ): TerminalSubscription {
    const id = `waitForExit-${this.subscriptionCounter++}`;
    this.waitForExitHandlers.set(id, handler);
    return {
      unsubscribe: () => {
        this.waitForExitHandlers.delete(id);
      },
    };
  }

  subscribeToKill(handler: TerminalKillHandler): TerminalSubscription {
    const id = `kill-${this.subscriptionCounter++}`;
    this.killHandlers.set(id, handler);
    return {
      unsubscribe: () => {
        this.killHandlers.delete(id);
      },
    };
  }

  subscribeToRelease(handler: TerminalReleaseHandler): TerminalSubscription {
    const id = `release-${this.subscriptionCounter++}`;
    this.releaseHandlers.set(id, handler);
    return {
      unsubscribe: () => {
        this.releaseHandlers.delete(id);
      },
    };
  }

  getCreateHandlers(): TerminalCreateHandler[] {
    return Array.from(this.createHandlers.values());
  }

  getOutputHandlers(): TerminalOutputHandler[] {
    return Array.from(this.outputHandlers.values());
  }

  getWaitForExitHandlers(): TerminalWaitForExitHandler[] {
    return Array.from(this.waitForExitHandlers.values());
  }

  getKillHandlers(): TerminalKillHandler[] {
    return Array.from(this.killHandlers.values());
  }

  getReleaseHandlers(): TerminalReleaseHandler[] {
    return Array.from(this.releaseHandlers.values());
  }
}
