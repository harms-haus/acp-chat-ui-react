# Integration Examples

Complete integration examples for `@harms-haus/acp-chat-react`.

## Basic Chat Interface

Minimal chat interface with all essential components.

```tsx
import { AcpStore, Thread, Composer, useAcpConnection } from '@harms-haus/acp-chat-react';

const store = new AcpStore({
  sessionController: new SessionController({
    url: 'ws://localhost:8765',
  }),
});

function BasicChat() {
  const { isConnected, connect, disconnect, error } = useAcpConnection(store);

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!isConnected) {
    return (
      <button onClick={connect}>
        Connect
      </button>
    );
  }

  return (
    <div>
      <Thread store={store} height="calc(100vh - 100px)" />
      <Composer store={store} />
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

## Custom Components

### Custom Message Card

```tsx
import { MessageCard, useAcpStore } from '@harms-haus/acp-chat-react';

function CustomMessageCard({ message }) {
  const store = useAcpStore();
  
  return (
    <div className="custom-message">
      <div className="message-role">{message.role}</div>
      <div className="message-content">
        {message.content.map((block, i) => (
          <ContentRenderer key={i} content={block} />
        ))}
      </div>
      <div className="message-status">{message.status}</div>
    </div>
  );
}
```

### Custom Composer

```tsx
import { Composer, useAcpStore } from '@harms-haus/acp-chat-react';

function CustomComposer() {
  const store = useAcpStore();
  const [value, setValue] = useState('');

  const handleSubmit = async () => {
    await store.sessionController.sendPrompt(value);
    setValue('');
  };

  return (
    <div className="custom-composer">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <button onClick={handleSubmit}>Send</button>
    </div>
  );
}
```

## Event Tracking

### Track All Events

```tsx
import { useChatEvent } from '@harms-haus/acp-chat-react';

function EventTracker() {
  const store = useAcpStore();
  const [events, setEvents] = useState([]);

  useChatEvent(store, 'sessionUpdate', (event) => {
    setEvents((prev) => [...prev, event]);
  });

  return (
    <div>
      <h3>Event Log</h3>
      <pre>{JSON.stringify(events, null, 2)}</pre>
    </div>
  );
}
```

### Track Specific Event Types

```tsx
import { useChatEvent } from '@harms-haus/acp-chat-react';

function ThoughtTracker() {
  const store = useAcpStore();
  const [thoughts, setThoughts] = useState([]);

  useChatEvent(store, 'agent_thought_chunk', (event) => {
    setThoughts((prev) => [...prev, event.data]);
  });

  return (
    <div>
      <h3>Thoughts</h3>
      {thoughts.map((thought, i) => (
        <div key={i}>{thought}</div>
      ))}
    </div>
  );
}
```

## Permission Handling

### Permission Dialog

```tsx
import { usePermissionResponse, useChatEvent } from '@harms-haus/acp-chat-react';

function PermissionHandler() {
  const store = useAcpStore();
  const [pendingRequest, setPendingRequest] = useState(null);

  useChatEvent(store, 'permissionRequest', (event) => {
    setPendingRequest(event.data);
  });

  const handleAccept = async () => {
    if (pendingRequest) {
      await store.sessionController.respondToPermission(
        pendingRequest.id,
        true
      );
      setPendingRequest(null);
    }
  };

  const handleReject = async () => {
    if (pendingRequest) {
      await store.sessionController.respondToPermission(
        pendingRequest.id,
        false
      );
      setPendingRequest(null);
    }
  };

  if (!pendingRequest) return null;

  return (
    <div className="permission-dialog">
      <h3>Permission Request</h3>
      <p>{pendingRequest.tool_name}</p>
      <pre>{JSON.stringify(pendingRequest.arguments, null, 2)}</pre>
      <button onClick={handleAccept}>Accept</button>
      <button onClick={handleReject}>Reject</button>
    </div>
  );
}
```

## Session Management

### Session List

```tsx
import { useSessionState, useAcpStore } from '@harms-haus/acp-chat-react';

function SessionList() {
  const store = useAcpStore();
  const [sessions, setSessions] = useState([]);

  const loadSessions = async () => {
    const sessionList = await store.sessionController.listSessions();
    setSessions(sessionList);
  };

  const selectSession = async (sessionId) => {
    await store.sessionController.loadSession(sessionId);
  };

  return (
    <div>
      <button onClick={loadSessions}>Load Sessions</button>
      <ul>
        {sessions.map((session) => (
          <li key={session.id} onClick={() => selectSession(session.id)}>
            {session.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Advanced Patterns

### Optimistic Updates

```tsx
import { useAcpStore } from '@harms-haus/acp-chat-react';

function OptimisticComposer() {
  const store = useAcpStore();
  const [value, setValue] = useState('');

  const handleSubmit = async () => {
    // Add optimistic message
    const optimisticMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: [{ type: 'text', text: value }],
      status: 'pending',
    };
    
    // Add to state optimistically
    store.optimisticallyAddMessage(optimisticMessage);
    
    try {
      await store.sessionController.sendPrompt(value);
    } catch (error) {
      // Rollback on error
      store.removeOptimisticMessage(optimisticMessage.id);
    }
    
    setValue('');
  };

  return (
    <div>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} />
      <button onClick={handleSubmit}>Send</button>
    </div>
  );
}
```

### Batch Multiple Prompts

```tsx
import { useAcpStore } from '@harms-haus/acp-chat-react';

function BatchPrompt() {
  const store = useAcpStore();

  const sendBatch = async (prompts) => {
    for (const prompt of prompts) {
      await store.sessionController.sendPrompt(prompt);
      // Wait for completion or batch differently
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  return null;
}
```

## Related Documentation

- [Components](./acp-chat-react-Components) - Component reference
- [Hooks](./acp-chat-react-Hooks) - Hooks reference
- [Store](./acp-chat-react-Store) - Store architecture
- [ACP Chat Core Home](./acp-chat-core-Home) - Core library docs
