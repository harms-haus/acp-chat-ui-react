# ACP Chat Wiki Structure

## Wiki Organization

This document outlines the complete structure for the GitHub wiki covering `acp-chat-core` and `acp-chat-react`.

---

## Home Page

**File:** `Home.md`

**Purpose:** Main landing page with navigation and overview

**Sections:**
- Welcome message
- Quick links to main sections
- Package overview (acp-chat-core vs acp-chat-react)
- Getting started links
- Architecture diagram (text-based)

---

## ACP Chat Core Documentation

### 1. Architecture Overview

**File:** `Architecture.md`

**Purpose:** High-level architecture of acp-chat-core

**Sections:**
- Purpose and goals
- Layered architecture diagram
- Core modules overview
- Data flow visualization
- Key design patterns
- Generated types warning

**Subsections:**
- Generated Types Layer (src/generated/)
- Transport Layer (src/transport/)
- Bridge Layer (src/bridge/)
- Session Layer (src/session/)
- Normalization Layer (src/normalization/)
- Configuration Layer (src/presets/)
- Replay Data Layer (src/replay/)
- UI Helpers Layer (src/helpers/)

---

### 2. Types Reference

**File:** `Types-Reference.md`

**Purpose:** Complete catalog of all exported types

**Sections organized by category:**

#### Transport/Bridge Types (Core)
- ConnectionStatus
- TransportConfig
- TransportEvents
- InitSuccess
- InitError
- DisconnectSuccess
- BridgeEnvelope
- BridgeMessage
- BridgeStatus
- UnsupportedVersionError
- JsonValue

#### Session/Controller Types (Core)
- SessionControllerState
- StartAgentConfig
- PermissionOption
- PermissionRequestParams

#### Replay Types (Core)
- ReplayMode
- ReplayModel
- ReplayControllerOptions
- ReplayControllerState
- ReplaySessionMetadata
- ReplaySessionData
- ReplayEvent
- ReplayManifest

#### Capture Types (Core)
- CapturedSession
- CapturedEvent
- SessionCaptureInterceptor

#### State/Normalization Types (Core)
- NormalizedState
- NormalizedMessage
- NormalizedThought
- NormalizedToolCall
- NormalizedPermissionRequest
- TimelineItem
- TimelineItemType
- SessionUpdateParams
- MessageRole
- MessageStatus
- ContentBlockType
- TextContentBlock
- ResourceContentBlock
- ResourceLinkContentBlock
- ContentBlock
- ToolCallKind
- ToolCallStatus
- PermissionRequestStatus

#### Helper Types
- ComposerState
- PromptPhase
- PromptLifecycleState
- ThoughtItem
- ThoughtGroup
- GroupedTimelineItem
- LaunchPreset

**Each type includes:**
- Full TypeScript definition
- File location
- Purpose description
- Relationships to other types
- Usage examples

---

### 3. Events Documentation

**File:** `Events.md`

**Purpose:** Complete event system documentation

**Sections:**

#### Event Flow Architecture
- Three-layer event system overview
- Event flow diagram (text-based)
- Processing pipeline

#### Transport Layer Events (BridgeEnvelope)
- acp_payload
- bridge_status
- stderr
- process_exit
- replay_metadata
- start_agent

#### SessionController Events
- statusChange
- sessionUpdate
- traffic
- error
- sessionClearing
- permissionRequest

#### ACP Session Update Types
- user_message / user_message_chunk
- agent_message_chunk
- agent_thought_chunk
- tool_call
- tool_call_update
- permission_request

#### JSON-RPC Methods (ACP Protocol)
- session/update
- session/request_permission
- session/new
- session/load
- session/prompt
- session/cancel
- initialize

#### Status Values
- Message status mappings
- Tool call status mappings
- Permission request status mappings
- Connection status values

#### Event Processing Flow
- Complete request/response flow
- Event batching and ordering
- Timeline ordering
- Thought groups
- Notification batching

---

### 4. Session Management

**File:** `Session-Management.md`

**Purpose:** Session controller architecture and usage

**Sections:**

#### SessionController Class Structure
- Class fields and properties
- State management approach
- Event system architecture
- Request/response pattern

#### Public APIs
- Lifecycle methods (connect, disconnect, initialize)
- Session operations (createSession, loadSession, listSessions, sendPrompt, cancelPrompt)
- Permission management (respondToPermission, cancelPermission)
- Agent control (startAgent, initLive)

#### Data Flow
- Complete request/response flow diagram
- Event processing pipeline
- State mutation patterns
- Defensive programming patterns

#### Related Components
- ReplayController (drop-in replacement for replay mode)
- CaptureInterceptor (session recording)
- NormalizedState (UI layer consumption)
- TransportClient (WebSocket layer)

#### Key Design Patterns
- Subscriber pattern with cleanup
- Immutable state snapshots
- Promise-based RPC
- Event-driven architecture
- Defensive programming

#### Error Handling
- Transport errors
- Request errors
- Disconnect cleanup

#### Usage Examples
- Basic initialization
- Session lifecycle
- Event subscription
- Permission handling
- Cleanup patterns

#### Bridge Envelope Format
- Versioned envelope structure
- Message type variants
- Wire format specification

#### Integration with UI Libraries
- Framework-agnostic design
- React integration example
- State synchronization

---

### 5. ACP Protocol Reference

**File:** `ACP-Protocol.md`

**Purpose:** Official ACP protocol specification reference

**Sections:**

#### Protocol Overview
- What is ACP
- Key concepts (sessions, prompt turns, notifications, capabilities)
- Transport mechanisms (JSON-RPC 2.0 over stdio/HTTP/WebSocket)

#### Protocol Initialization
- Initialization flow
- ClientCapabilities
- AgentCapabilities
- InitializeRequest/Response

#### Session Management
- Session states
- Core session methods:
  - newSession
  - loadSession
  - listSessions
  - forkSession (experimental)
  - resumeSession (experimental)
  - closeSession (experimental)
- Session configuration:
  - setSessionMode
  - setSessionModel
  - setSessionConfigOption

#### Prompt Turn Processing
- Prompt lifecycle
- PromptRequest/PromptResponse
- ContentBlock types
- SessionNotification
- StopReason enum

#### Session Update Events
- Complete table of SessionUpdate variants
- When each is sent
- Purpose and payload structure

#### Content Blocks
- TextContent
- ImageContent
- AudioContent
- ResourceLink
- EmbeddedResource

#### File System
- FileSystemCapabilities
- File operations

#### Tool Calls
- ToolCall type
- ToolCallUpdate
- Permission requests

#### Session Modes
- Common modes (ask, architect, code)
- Mode behavior

#### Event Lifecycle & Ordering
- Connection → Initialization
- Session Creation → Prompt Turn
- Processing → Session Updates
- Interaction → Tool Calls & Permissions
- Completion → Final Update
- Cancellation flow

#### Protocol Versioning
- Semantic versioning
- Capability negotiation
- Extensibility

#### Message Structure
- JSON-RPC 2.0 format
- Request structure
- Response structure
- Notification structure

#### Error Handling
- Standard JSON-RPC error codes
- ACP-specific errors
- Error object structure

#### Semantic Mappings for acp-chat-core
- ACP Event → acp-chat-core State mapping table
- State transitions
- Content handling
- Permission flow
- Tool types

---

### 6. Implementation Guide

**File:** `Implementation-Guide.md`

**Purpose:** Framework-agnostic guide for building ACP chat UIs

**Sections:**

#### Core Patterns

##### State Subscription Pattern
- AcpStore architecture
- Immediate state updates
- Batched notifications
- Snapshot-based state retrieval
- Framework adaptation guide

##### Event Handling Pattern
- SessionController events
- Event subscription manager
- Event history tracking
- Active item tracking
- Framework adaptation

##### Timeline-Based Rendering Pattern
- Timeline order processing
- Thought grouping algorithm
- Permission request filtering
- Framework-agnostic implementation

#### Component Patterns

##### Message List Rendering
- MessageCard structure
- ContentRenderer pattern
- Status indicator pattern
- Type-based rendering

##### Input/Composer Components
- Pure logic functions (framework-agnostic)
- Composer component structure
- Keydown handling
- Lifecycle tracking

##### Status/Loading States
- Session state hooks
- Derived state patterns
- Status-based UI

##### Error Handling
- Multiple layers of error handling
- Try-catch patterns
- Error display patterns

#### Advanced Patterns

##### Permission Request Handling
- Dual-update pattern (store + controller)
- Optimistic updates
- Permission request card structure

##### Thought Stack with Event-Based Lifecycle
- Event tracking for auto-expand/collapse
- User interaction respect
- Lifecycle management

##### Connection Management
- Connection lifecycle
- Auto-connect patterns
- Cleanup patterns

#### Framework-Agnostic Abstractions

##### Pure Logic Functions
- Input validation
- Keydown handling
- Lifecycle tracking
- Button state logic

##### Type-Based Rendering
- Switch pattern
- Component selection
- Unknown type handling

##### Event Subscription Pattern
- Universal subscription manager
- Framework-specific adaptations

##### Snapshot-Based State Management
- Immutable snapshots
- Version-based invalidation
- Deep cloning

#### Implementation Checklist
- Complete task list for implementing ACP chat UI
- Framework adaptation guide
- Testing utilities

#### Framework Translation Table
- React → Vanilla JS
- React → Svelte
- React → Vue
- React → Angular

---

### 7. Replay System

**File:** `Replay-System.md`

**Purpose:** Documentation of replay functionality

**Sections:**
- ReplayController overview
- Replay vs live mode
- Replay modes and models
- Session capture
- Export format
- Replay events structure
- Usage examples

---

### 8. Capture System

**File:** `Capture-System.md`

**Purpose:** Session capture for replay

**Sections:**
- CaptureInterceptor overview
- Capture lifecycle
- Event recording
- Metadata extraction
- Export format
- File structure
- Usage examples

---

### 9. Bridge Protocol

**File:** `Bridge-Protocol.md`

**Purpose:** Rust bridge communication protocol

**Sections:**
- BridgeEnvelope format
- Version validation
- Supported versions
- Message types
- Wire format
- Error handling
- Parser utilities

---

## ACP Chat React Documentation (Skeleton)

### Home Page

**File:** `acp-chat-react-Home.md`

**Purpose:** Overview of React implementation

**Sections:**
- Package overview
- Relationship to acp-chat-core
- Quick start
- Component catalog
- Hooks catalog

---

### Components Reference

**File:** `acp-chat-react-Components.md`

**Purpose:** Complete component reference

**Sections:**
- Thread
- MessageList
- MessageCard
- Composer
- ContentRenderer
- ThoughtStack
- PermissionRequestCard
- VirtualizedThread
- SettingsPanel
- SessionList

**Each component includes:**
- Props interface
- Usage example
- Customization options
- Related components

---

### Hooks Reference

**File:** `acp-chat-react-Hooks.md`

**Purpose:** Complete hooks reference

**Sections:**
- useAcpStore
- useAcpStoreSnapshot
- useSessionState
- useIsConnected
- useIsInitialized
- useActiveStreamingMessage
- useChatEvent
- useThoughtEvents
- usePermissionResponse
- useSettings
- useAcpConnection

**Each hook includes:**
- Signature
- Return type
- Usage example
- Dependencies

---

### Store Architecture

**File:** `acp-chat-react-Store.md`

**Purpose:** AcpStore implementation details

**Sections:**
- AcpStore class
- Subscription API
- Batched notifications
- Snapshot management
- Event integration
- Configuration

---

### Integration Examples

**File:** `acp-chat-react-Examples.md`

**Purpose:** Complete integration examples

**Sections:**
- Basic chat interface
- Custom components
- Event tracking
- Permission handling
- Session management
- Advanced patterns

---

## Additional Pages

### Glossary

**File:** `Glossary.md`

**Purpose:** Terminology reference

**Terms:**
- ACP (Agent Client Protocol)
- Session
- Prompt Turn
- Bridge
- Envelope
- Normalization
- Timeline
- Thought
- Tool Call
- Permission Request
- Replay
- Capture

---

### Troubleshooting

**File:** `Troubleshooting.md`

**Purpose:** Common issues and solutions

**Sections:**
- Connection issues
- Event handling problems
- State synchronization
- Permission request issues
- Replay problems
- Performance issues
- FAQ

---

### Contributing

**File:** `Contributing.md`

**Purpose:** Contribution guidelines

**Sections:**
- Development setup
- Code style
- Testing
- Documentation
- Pull request process

---

## Navigation Structure

```
Home
├── ACP Chat Core
│   ├── Architecture
│   ├── Types Reference
│   ├── Events
│   ├── Session Management
│   ├── ACP Protocol
│   ├── Implementation Guide
│   ├── Replay System
│   ├── Capture System
│   └── Bridge Protocol
├── ACP Chat React
│   ├── Home
│   ├── Components
│   ├── Hooks
│   ├── Store
│   └── Examples
├── Glossary
├── Troubleshooting
└── Contributing
```

---

## Writing Guidelines

### Type Documentation
- Include full TypeScript definition
- Provide file location
- Explain purpose clearly (avoid technobabble)
- Describe relationships to other types
- Include usage examples where helpful
- Note if type is core or helper

### Event Documentation
- Explain what triggers the event
- Show payload structure
- Describe what state changes it causes
- Identify handler location
- Include flow diagrams

### Architecture Documentation
- Use layered diagrams
- Explain data flow
- Show relationships between components
- Include code examples
- Document design patterns

### Implementation Guide
- Focus on framework-agnostic patterns
- Extract pure logic functions
- Provide translation guide for multiple frameworks
- Include complete examples
- Checklist for implementation

### General
- Explain the "why" not just the "how"
- Avoid technobabble - use clear language
- Include real-world examples
- Link related pages
- Keep documentation synchronized with code

---

## File Locations

All wiki files should be created in the GitHub wiki repository:
```
acp-chat-core.wiki/
├── Home.md
├── Architecture.md
├── Types-Reference.md
├── Events.md
├── Session-Management.md
├── ACP-Protocol.md
├── Implementation-Guide.md
├── Replay-System.md
├── Capture-System.md
├── Bridge-Protocol.md
├── acp-chat-react-Home.md
├── acp-chat-react-Components.md
├── acp-chat-react-Hooks.md
├── acp-chat-react-Store.md
├── acp-chat-react-Examples.md
├── Glossary.md
├── Troubleshooting.md
└── Contributing.md
```

---

## Next Steps

1. Create wiki structure in GitHub
2. Write Home.md (main landing page)
3. Write core documentation pages (Architecture, Types, Events, Session Management)
4. Write ACP Protocol reference
5. Write Implementation Guide
6. Create acp-chat-react skeleton pages
7. Add troubleshooting and glossary
8. Review for completeness and accuracy
9. Final review for hallucinations

---

**Note:** This structure is designed to be comprehensive while remaining maintainable. Each page should be self-contained but linked to related pages for easy navigation.
