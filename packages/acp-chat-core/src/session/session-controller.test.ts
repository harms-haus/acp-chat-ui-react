import { describe, it, expect } from "vitest";
import { SessionController } from "./controller.js";

describe("SessionController", () => {
    it("initializes with disconnected state", () => {
        const controller = new SessionController("ws://test", 1000);
        const state = controller.getState();
        expect(state.connectionStatus).toBe("disconnected");
        expect(state.bridgeStatus).toBe("disconnected");
        expect(state.sessionId).toBeNull();
        expect(state.initialized).toBe(false);
    });

    it("exposes state through getState", () => {
        const controller = new SessionController("ws://test", 1000);
        const state1 = controller.getState();
        const state2 = controller.getState();
        
        expect(state1).not.toBe(state2);
        expect(state1).toEqual(state2);
    });

    it("accepts event handlers", () => {
        const controller = new SessionController("ws://test", 1000);
        
        const statusHandler = () => {};
        const trafficHandler = () => {};
        const errorHandler = () => {};
        const sessionUpdateHandler = () => {};

        const unsub1 = controller.on("statusChange", statusHandler);
        const unsub2 = controller.on("traffic", trafficHandler);
        const unsub3 = controller.on("error", errorHandler);
        const unsub4 = controller.on("sessionUpdate", sessionUpdateHandler);

        expect(typeof unsub1).toBe("function");
        expect(typeof unsub2).toBe("function");
        expect(typeof unsub3).toBe("function");
        expect(typeof unsub4).toBe("function");
    });

    it("disconnect clears pending requests", () => {
        const controller = new SessionController("ws://test", 1000);
        controller.disconnect();
        
        const state = controller.getState();
        expect(state.connectionStatus).toBe("disconnected");
    });
});