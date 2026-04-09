import { describe, it, expect } from "vitest";
import { FileSystemSubscriptionManager } from "../filesystem/subscription-manager.js";

describe("FileSystemSubscriptionManager", () => {
  it("should subscribe single handler", () => {
    const manager = new FileSystemSubscriptionManager();
    const handler = async () => null;
    const subscription = manager.subscribeToFileReads(handler);

    expect(subscription.unsubscribe).toBeDefined();
    expect(typeof subscription.unsubscribe).toBe("function");
  });

  it("should subscribe multiple handlers", () => {
    const manager = new FileSystemSubscriptionManager();
    const handler1 = async () => null;
    const handler2 = async () => null;
    const handler3 = async () => null;

    manager.subscribeToFileReads(handler1);
    manager.subscribeToFileReads(handler2);
    manager.subscribeToFileWrites(handler3);

    const readHandlers = manager.getReadHandlers();
    const writeHandlers = manager.getWriteHandlers();

    expect(readHandlers).toHaveLength(2);
    expect(writeHandlers).toHaveLength(1);
    expect(readHandlers).toContain(handler1);
    expect(readHandlers).toContain(handler2);
    expect(writeHandlers).toContain(handler3);
  });

  it("should unsubscribe removes correct handler", () => {
    const manager = new FileSystemSubscriptionManager();
    const handler1 = async () => null;
    const handler2 = async () => null;
    const handler3 = async () => null;

    manager.subscribeToFileReads(handler1);
    const subscription2 = manager.subscribeToFileReads(handler2);
    manager.subscribeToFileReads(handler3);

    subscription2.unsubscribe();

    const readHandlers = manager.getReadHandlers();

    expect(readHandlers).toHaveLength(2);
    expect(readHandlers).toContain(handler1);
    expect(readHandlers).not.toContain(handler2);
    expect(readHandlers).toContain(handler3);
  });

  it("should unsubscribe with invalid ID is no-op", () => {
    const manager = new FileSystemSubscriptionManager();
    const handler1 = async () => null;
    const handler2 = async () => null;

    const subscription1 = manager.subscribeToFileReads(handler1);
    manager.subscribeToFileReads(handler2);

    // Unsubscribe twice (second call is a no-op)
    subscription1.unsubscribe();
    subscription1.unsubscribe();

    const readHandlers = manager.getReadHandlers();

    expect(readHandlers).toHaveLength(1);
    expect(readHandlers).not.toContain(handler1);
    expect(readHandlers).toContain(handler2);
  });

  it("should getHandlers returns copy (not reference)", () => {
    const manager = new FileSystemSubscriptionManager();
    const handler = async () => null;

    manager.subscribeToFileReads(handler);

    const handlers1 = manager.getReadHandlers();
    const handlers2 = manager.getReadHandlers();

    // Verify they are different arrays
    expect(handlers1).not.toBe(handlers2);

    // Modifying one should not affect the other
    handlers1.push(async () => null);

    expect(handlers1).toHaveLength(2);
    expect(handlers2).toHaveLength(1);
  });

  it("should generate unique subscription IDs", () => {
    const manager = new FileSystemSubscriptionManager();
    const handler = async () => null;

    const subscription1 = manager.subscribeToFileReads(handler);
    const subscription2 = manager.subscribeToFileReads(handler);
    const subscription3 = manager.subscribeToFileReads(handler);

    // All subscriptions should have different internal IDs
    subscription1.unsubscribe();
    subscription2.unsubscribe();
    subscription3.unsubscribe();

    const readHandlers = manager.getReadHandlers();
    expect(readHandlers).toHaveLength(0);
  });

  it("should handle read and write handlers separately", () => {
    const manager = new FileSystemSubscriptionManager();
    const readHandler = async () => null;
    const writeHandler = async () => null;

    const readSubscription = manager.subscribeToFileReads(readHandler);
    manager.subscribeToFileWrites(writeHandler);

    const readHandlers = manager.getReadHandlers();
    const writeHandlers = manager.getWriteHandlers();

    expect(readHandlers).toHaveLength(1);
    expect(writeHandlers).toHaveLength(1);
    expect(readHandlers).toContain(readHandler);
    expect(writeHandlers).toContain(writeHandler);

    // Unsubscribe read handler should not affect write handlers
    readSubscription.unsubscribe();

    const newReadHandlers = manager.getReadHandlers();
    const newWriteHandlers = manager.getWriteHandlers();

    expect(newReadHandlers).toHaveLength(0);
    expect(newWriteHandlers).toHaveLength(1);
  });

  it("should support multiple instances independently", () => {
    const manager1 = new FileSystemSubscriptionManager();
    const manager2 = new FileSystemSubscriptionManager();
    const handler = async () => null;

    manager1.subscribeToFileReads(handler);
    manager2.subscribeToFileReads(handler);

    expect(manager1.getReadHandlers()).toHaveLength(1);
    expect(manager2.getReadHandlers()).toHaveLength(1);

    manager1.getReadHandlers().forEach(async (h) => h({ path: "test" }));

    // manager2 should still have its handler
    expect(manager1.getReadHandlers()).toHaveLength(1);
    expect(manager2.getReadHandlers()).toHaveLength(1);
  });
});
