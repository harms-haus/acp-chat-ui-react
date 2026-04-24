/**
 * Filesystem events integration test
 * 
 * DEPRECATED - This test needs to be rewritten for the new architecture.
 * 
 * In the new architecture:
 * - Replay logic lives exclusively in the Rust controller
 * - WsTransport is a pure transport with no replay logic
 * - SessionController (acp-chat-core) handles ACP protocol and filesystem events
 * - Filesystem event subscription is handled by SessionController, not the transport
 * 
 * To test filesystem events in the new architecture:
 * 1. Use SessionController with WsTransport directly
 * 2. Register fs/read_text_file and fs/write_text_file handlers on SessionController
 * 3. The Rust controller handles replay; TypeScript handles protocol responses
 * 
 * @see acp-chat-core/src/filesystem/subscription-manager.ts
 * @see acp-chat-core/src/session/controller.ts
 */

import { describe, it, expect } from "vitest";

describe.skip("filesystem events - DEPRECATED", () => {
  it.skip("needs rewrite for new architecture", () => {
    // This test used ReplayController which has been removed.
    // The test needs to be rewritten to use:
    // 1. SessionController from @harms-haus/acp-chat-core
    // 2. WsTransport from @harms-haus/acp-ws-bridge
    // 3. FileSystemSubscriptionManager for handling fs events
    //
    // Example structure (not yet implemented):
    // ```typescript
    // import { SessionController } from "@harms-haus/acp-chat-core";
    // import { WsTransport } from "@harms-haus/acp-ws-bridge";
    // import { FileSystemSubscriptionManager } from "@harms-haus/acp-chat-core";
    //
    // const transport = new WsTransport(`ws://localhost:${port}`);
    // const controller = new SessionController(transport);
    // const fsManager = new FileSystemSubscriptionManager(controller);
    //
    // fsManager.onFileRead((request) => { ... });
    // fsManager.onFileWrite((request) => { ... });
    //
    // controller.connect();
    // await controller.initialize();
    // // Send command to Rust to start replay...
    // ```
    //
    // The key difference from the old ReplayController approach:
    // - Replay control (start/stop/speed) is done via commands to Rust
    // - Protocol handling (fs events, permissions, etc.) is done by SessionController
    // - Transport is purely for message transmission
    expect(true).toBe(true);
  });
});
