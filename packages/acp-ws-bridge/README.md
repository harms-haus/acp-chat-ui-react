# @harms-haus/acp-ws-bridge

WebSocket bridge for ACP (Agent Communication Protocol) communication.

## Features

- WebSocket client for ACP server communication
- Real-time message streaming
- Automatic reconnection
- Type-safe event handling

## Installation

```bash
npm install @harms-haus/acp-ws-bridge
```

## Usage

```typescript
import { WSBridge } from '@harms-haus/acp-ws-bridge';

const bridge = new WSBridge('ws://localhost:8080');
await bridge.connect();
```

## Testing

See [TESTING.md](./TESTING.md) for detailed testing instructions.

## License

MIT
