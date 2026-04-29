import { describe, it, expect } from "vitest";
import { TerminalSubscriptionManager } from "../terminals/subscription-manager.js";

describe("TerminalSubscriptionManager", () => {
  it("should subscribe single create handler", () => {
    const manager = new TerminalSubscriptionManager();
    const handler = async () => null;
    const subscription = manager.subscribeToCreate(handler);

    expect(subscription.unsubscribe).toBeDefined();
    expect(typeof subscription.unsubscribe).toBe("function");
  });

  it("should subscribe multiple handlers across different operations", () => {
    const manager = new TerminalSubscriptionManager();
    const createHandler = async () => null;
    const outputHandler = async () => null;
    const killHandler = async () => null;

    manager.subscribeToCreate(createHandler);
    manager.subscribeToCreate(createHandler);
    manager.subscribeToOutput(outputHandler);
    manager.subscribeToKill(killHandler);

    expect(manager.getCreateHandlers()).toHaveLength(2);
    expect(manager.getOutputHandlers()).toHaveLength(1);
    expect(manager.getKillHandlers()).toHaveLength(1);
    expect(manager.getWaitForExitHandlers()).toHaveLength(0);
    expect(manager.getReleaseHandlers()).toHaveLength(0);
  });

  it("should unsubscribe removes correct handler", () => {
    const manager = new TerminalSubscriptionManager();
    const handler1 = async () => null;
    const handler2 = async () => null;
    const handler3 = async () => null;

    manager.subscribeToCreate(handler1);
    const sub2 = manager.subscribeToCreate(handler2);
    manager.subscribeToCreate(handler3);

    sub2.unsubscribe();

    const handlers = manager.getCreateHandlers();
    expect(handlers).toHaveLength(2);
    expect(handlers).toContain(handler1);
    expect(handlers).not.toContain(handler2);
    expect(handlers).toContain(handler3);
  });

  it("should unsubscribe twice is no-op", () => {
    const manager = new TerminalSubscriptionManager();
    const handler1 = async () => null;
    const handler2 = async () => null;

    const sub1 = manager.subscribeToCreate(handler1);
    manager.subscribeToCreate(handler2);

    sub1.unsubscribe();
    sub1.unsubscribe();

    expect(manager.getCreateHandlers()).toHaveLength(1);
    expect(manager.getCreateHandlers()).not.toContain(handler1);
    expect(manager.getCreateHandlers()).toContain(handler2);
  });

  it("should getHandlers returns copy (not reference)", () => {
    const manager = new TerminalSubscriptionManager();
    const handler = async () => null;

    manager.subscribeToCreate(handler);

    const handlers1 = manager.getCreateHandlers();
    const handlers2 = manager.getCreateHandlers();

    expect(handlers1).not.toBe(handlers2);

    handlers1.push(async () => null);

    expect(handlers1).toHaveLength(2);
    expect(handlers2).toHaveLength(1);
  });

  it("should handle all five operation types independently", () => {
    const manager = new TerminalSubscriptionManager();
    const h1 = async () => null;
    const h2 = async () => null;
    const h3 = async () => null;
    const h4 = async () => null;
    const h5 = async () => null;

    manager.subscribeToCreate(h1);
    manager.subscribeToOutput(h2);
    manager.subscribeToWaitForExit(h3);
    manager.subscribeToKill(h4);
    manager.subscribeToRelease(h5);

    expect(manager.getCreateHandlers()).toContain(h1);
    expect(manager.getOutputHandlers()).toContain(h2);
    expect(manager.getWaitForExitHandlers()).toContain(h3);
    expect(manager.getKillHandlers()).toContain(h4);
    expect(manager.getReleaseHandlers()).toContain(h5);

    // Unsubscribe one should not affect others
    const sub = manager.subscribeToOutput(async () => null);
    sub.unsubscribe();
    expect(manager.getOutputHandlers()).toHaveLength(1);
    expect(manager.getCreateHandlers()).toHaveLength(1);
  });

  it("should support multiple instances independently", () => {
    const manager1 = new TerminalSubscriptionManager();
    const manager2 = new TerminalSubscriptionManager();
    const handler = async () => null;

    manager1.subscribeToCreate(handler);
    manager2.subscribeToCreate(handler);

    expect(manager1.getCreateHandlers()).toHaveLength(1);
    expect(manager2.getCreateHandlers()).toHaveLength(1);
  });
});
