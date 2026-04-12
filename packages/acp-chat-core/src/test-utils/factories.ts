/**
 * Factory functions for creating test data.
 *
 * This module provides helper functions to create ACP payloads, bridge envelopes,
 * and session update structures for testing purposes.
 */

import type { BridgeEnvelope } from '../generated/index.js';

/**
 * A JSON-RPC 2.0 request.
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

/**
 * A JSON-RPC 2.0 response with result.
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result: unknown;
}

/**
 * A JSON-RPC 2.0 error response.
 */
export interface JsonRpcError {
  jsonrpc: '2.0';
  id: number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * A JSON-RPC 2.0 notification (no id).
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

/**
 * Session update parameters.
 */
export interface SessionUpdate {
  sessionId: string;
  update: {
    type: string;
    id?: string;
    content?: string;
    mode?: string;
    model?: string;
    [key: string]: unknown;
  };
}

/**
 * Create a JSON-RPC 2.0 request.
 */
export function createACPPayload(params: {
  id: number;
  method: string;
  params?: unknown;
}): JsonRpcRequest {
  const result: { jsonrpc: '2.0'; id: number; method: string; params?: unknown } = {
    jsonrpc: '2.0',
    id: params.id,
    method: params.method,
  };
  if (params.params !== undefined) {
    result.params = params.params;
  }
  return result;
}

/**
 * Create a JSON-RPC 2.0 response with result.
 */
export function createACPPayloadResult(params: {
  id: number;
  result: unknown;
}): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: params.id,
    result: params.result,
  };
}

/**
 * Create a JSON-RPC 2.0 error response.
 */
export function createACPPayloadError(params: {
  id: number | null;
  code: number;
  message: string;
  data?: unknown;
}): JsonRpcError {
  const errorObj: {
    code: number;
    message: string;
    data?: unknown;
  } = {
    code: params.code,
    message: params.message,
  };
  if (params.data !== undefined) {
    errorObj.data = params.data;
  }

  return {
    jsonrpc: '2.0',
    id: params.id,
    error: errorObj,
  };
}

/**
 * Create a JSON-RPC 2.0 notification.
 */
export function createACPPayloadNotification(params: {
  method: string;
  params?: unknown;
}): JsonRpcNotification {
  const result: { jsonrpc: '2.0'; method: string; params?: unknown } = {
    jsonrpc: '2.0',
    method: params.method,
  };
  if (params.params !== undefined) {
    result.params = params.params;
  }
  return result;
}

/**
 * Create a bridge envelope with ACP payload.
 */
export function createBridgeEnvelope(params: {
  seq?: number;
  timestamp_ms?: number;
  payload: JsonRpcRequest | JsonRpcResponse | JsonRpcError | JsonRpcNotification;
}): BridgeEnvelope {
  return {
    version: 1,
    seq: params.seq ?? 0,
    timestamp_ms: params.timestamp_ms ?? Date.now(),
    type: 'acp_payload',
    payload: params.payload as any,
  };
}

/**
 * Create a bridge status envelope.
 */
export function createBridgeStatusEnvelope(params: {
  status: string;
  seq?: number;
  timestamp_ms?: number;
}): BridgeEnvelope {
  return {
    version: 1,
    seq: params.seq ?? 0,
    timestamp_ms: params.timestamp_ms ?? Date.now(),
    type: 'bridge_status',
    status: params.status as any,
  };
}

/**
 * Create a session update notification.
 */
export function createSessionUpdate(params: {
  sessionId: string;
  update: {
    type: string;
    id?: string;
    content?: string;
    mode?: string;
    model?: string;
    [key: string]: unknown;
  };
}): SessionUpdate {
  return {
    sessionId: params.sessionId,
    update: params.update,
  };
}

/**
 * Create a bridge envelope containing a session update notification.
 */
export function createSessionUpdateEnvelope(params: {
  sessionId: string;
  update: {
    type: string;
    id?: string;
    content?: string;
    mode?: string;
    model?: string;
    [key: string]: unknown;
  };
  seq?: number;
  timestamp_ms?: number;
}): BridgeEnvelope {
  const notification = createACPPayloadNotification({
    method: 'session/update',
    params: createSessionUpdate(params),
  });

  const envelopeParams: {
    seq?: number;
    timestamp_ms?: number;
    payload: JsonRpcNotification;
  } = {
    payload: notification,
  };
  if (params.seq !== undefined) {
    envelopeParams.seq = params.seq;
  }
  if (params.timestamp_ms !== undefined) {
    envelopeParams.timestamp_ms = params.timestamp_ms;
  }

  return createBridgeEnvelope(envelopeParams);
}

/**
 * Create an initialize response payload.
 */
export function createInitializeResult(params: {
  capabilities?: Record<string, unknown>;
  sessionId?: string;
}): unknown {
  return {
    capabilities: params.capabilities ?? { maxTokens: 4096 },
    sessionId: params.sessionId ?? 'test-session',
  };
}

/**
 * Create a createSession response payload.
 */
export function createCreateSessionResult(params: {
  sessionId?: string;
}): unknown {
  return {
    sessionId: params.sessionId ?? 'session-123',
  };
}

/**
 * Create a permission request notification payload.
 */
export function createPermissionRequestParams(params: {
  requestId: number;
  sessionId: string;
  toolName: string;
  prompt?: string;
  options?: Array<{ id: string; title: string }>;
}): unknown {
  return {
    requestId: params.requestId,
    sessionId: params.sessionId,
    toolCall: {
      toolCallId: `tool-${params.requestId}`,
    },
    prompt: params.prompt ?? `Allow ${params.toolName}?`,
    options: params.options ?? [
      { id: 'allow', title: 'Allow' },
      { id: 'deny', title: 'Deny' },
    ],
  };
}

/**
 * Create a permission request envelope.
 */
export function createPermissionRequestEnvelope(params: {
  requestId: number;
  sessionId: string;
  toolName: string;
  prompt?: string;
  options?: Array<{ id: string; title: string }>;
  seq?: number;
  timestamp_ms?: number;
}): BridgeEnvelope {
  const notification = createACPPayloadNotification({
    method: 'session/request_permission',
    params: createPermissionRequestParams(params),
  });

  const envelopeParams: {
    seq?: number;
    timestamp_ms?: number;
    payload: JsonRpcNotification;
  } = {
    payload: notification,
  };
  if (params.seq !== undefined) {
    envelopeParams.seq = params.seq;
  }
  if (params.timestamp_ms !== undefined) {
    envelopeParams.timestamp_ms = params.timestamp_ms;
  }

  return createBridgeEnvelope(envelopeParams);
}

/**
 * Create a listSessions response payload.
 */
export function createListSessionsResult(params: {
  sessions?: Array<{
    sessionId: string;
    cwd: string;
    title: string;
    updatedAt: string;
  }>;
  nextCursor?: string | null;
}): unknown {
  return {
    sessions: params.sessions ?? [],
    nextCursor: params.nextCursor ?? null,
  };
}

/**
 * Create a loadSession response payload.
 */
export function createLoadSessionResult(params: {
  sessionId?: string;
}): unknown {
  return {
    sessionId: params.sessionId ?? 'loaded-session',
  };
}

/**
 * Create a batched session updates notification.
 */
export function createBatchedSessionUpdatesEnvelope(params: {
  updates: Array<{
    sessionId: string;
    update: {
      type: string;
      id?: string;
      content?: string;
      [key: string]: unknown;
    };
  }>;
  seq?: number;
  timestamp_ms?: number;
}): BridgeEnvelope {
  const notification = createACPPayloadNotification({
    method: 'session/update',
    params: {
      batched: true,
      updates: params.updates.map((u) => ({
        sessionId: u.sessionId,
        params: {
          sessionId: u.sessionId,
          update: u.update,
        },
      })),
    },
  });

  const envelopeParams: {
    seq?: number;
    timestamp_ms?: number;
    payload: JsonRpcNotification;
  } = {
    payload: notification,
  };
  if (params.seq !== undefined) {
    envelopeParams.seq = params.seq;
  }
  if (params.timestamp_ms !== undefined) {
    envelopeParams.timestamp_ms = params.timestamp_ms;
  }

  return createBridgeEnvelope(envelopeParams);
}
