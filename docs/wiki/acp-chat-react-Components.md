# Components Reference

Complete component reference for `@harms-haus/acp-chat-react`.

## Thread Components

### `Thread`
Main message list component with virtualization.

**Props:**
```typescript
interface ThreadProps {
  store: AcpStore;
  height?: number | string;
  className?: string;
  renderers?: ComponentRenderers;
}
```

**Usage:**
```tsx
import { Thread, AcpStore } from '@harms-haus/acp-chat-react';

const store = new AcpStore();

<Thread store={store} height="100vh" />
```

---

### `VirtualizedThread`
Optimized thread rendering for large message lists.

**Props:**
```typescript
interface VirtualizedThreadProps {
  messages: NormalizedMessage[];
  height: number | string;
  className?: string;
}
```

---

## Message Components

### `MessageCard`
Individual message display with status and content.

**Props:**
```typescript
interface MessageCardProps {
  message: NormalizedMessage;
  className?: string;
  renderers?: ContentRenderers;
}
```

**Usage:**
```tsx
import { MessageCard } from '@harms-haus/acp-chat-react';

<MessageCard message={message} />
```

---

### `ContentRenderer`
R不同类型的 content blocks.

**Props:**
```typescript
interface ContentRendererProps {
  content: ContentBlock[];
  className?: string;
}
```

---

## Input Components

### `Composer`
User input component with lifecycle management.

**Props:**
```typescript
interface ComposerProps {
  store: AcpStore;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}
```

**Usage:**
```tsx
import { Composer, AcpStore } from '@harms-haus/acp-chat-react';

const store = new AcpStore();

<Composer store={store} placeholder="Type a message..." />
```

---

## Thought Components

### `ThoughtStack`
Displays agent thought process with expand/collapse.

**Props:**
```typescript
interface ThoughtStackProps {
  thoughts: NormalizedThought[];
  className?: string;
  defaultExpanded?: boolean;
}
```

**Usage:**
```tsx
import { ThoughtStack } from '@harms-haus/acp-chat-react';

<ThoughtStack thoughts={thoughts} defaultExpanded={false} />
```

---

## Permission Components

### `PermissionRequestCard`
Displays permission request UI.

**Props:**
```typescript
interface PermissionRequestCardProps {
  request: NormalizedPermissionRequest;
  onAccept: () => void;
  onReject: () => void;
  className?: string;
}
```

**Usage:**
```tsx
import { PermissionRequestCard } from '@harms-haus/acp-chat-react';

<PermissionRequestCard 
  request={request}
  onAccept={() => handleAccept(request.id)}
  onReject={() => handleReject(request.id)}
/>
```

---

## Layout Components

### `SettingsPanel`
Settings UI component.

**Props:**
```typescript
interface SettingsPanelProps {
  store: AcpStore;
  className?: string;
}
```

---

### `SessionList`
Session management UI.

**Props:**
```typescript
interface SessionListProps {
  store: AcpStore;
  onSelect: (sessionId: string) => void;
  className?: string;
}
```

---

## Related Documentation

- [Hooks](./acp-chat-react-Hooks) - Hooks reference
- [Store](./acp-chat-react-Store) - Store architecture
- [Examples](./acp-chat-react-Examples) - Usage examples
- [CSS Variables](./acp-chat-react-Home#css-customization) - Styling guide
