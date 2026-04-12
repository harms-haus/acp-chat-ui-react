import type {
  FileReadHandler,
  FileWriteHandler,
  FileSystemSubscription,
} from "./types.js";

export class FileSystemSubscriptionManager {
  private readHandlers: Map<string, FileReadHandler> = new Map();
  private writeHandlers: Map<string, FileWriteHandler> = new Map();
  private subscriptionCounter = 0;

  subscribeToFileReads(handler: FileReadHandler): FileSystemSubscription {
    const id = `read-${this.subscriptionCounter++}`;
    this.readHandlers.set(id, handler);

    return {
      unsubscribe: () => {
        this.readHandlers.delete(id);
      },
    };
  }

  subscribeToFileWrites(handler: FileWriteHandler): FileSystemSubscription {
    const id = `write-${this.subscriptionCounter++}`;
    this.writeHandlers.set(id, handler);

    return {
      unsubscribe: () => {
        this.writeHandlers.delete(id);
      },
    };
  }

  getReadHandlers(): FileReadHandler[] {
    return Array.from(this.readHandlers.values());
  }

  getWriteHandlers(): FileWriteHandler[] {
    return Array.from(this.writeHandlers.values());
  }
}
