# @harms-haus/acp-chat-core

Core TypeScript library for ACP (Agent Communication Protocol) chat functionality.

## Features

- Session management for ACP conversations
- Event-driven architecture for real-time updates
- Framework-agnostic design
- Type-safe API

## Installation

```bash
npm install @harms-haus/acp-chat-core
```

## Usage

```typescript
import { SessionController } from '@harms-haus/acp-chat-core';

const controller = new SessionController();
const session = await controller.createSession('/path/to/workspace', []);
```

## API

See the full API documentation in the [Types Reference](../../docs/wiki/acp-chat-core-Types-Reference.md).

## License

MIT
