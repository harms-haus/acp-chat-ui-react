#!/usr/bin/env node
import fs from 'fs';

const BASE_TIMESTAMP = 1701000000000;

function createEnvelope(seq, offset, base, tokenCount = 4) {
  const envelope = {
    version: 1,
    seq,
    timestamp_ms: BASE_TIMESTAMP + offset,
    ...base,
  };
  return JSON.stringify({ ...envelope, tokenCount, timestamp: BASE_TIMESTAMP + offset, direction: 'in' });
}

function createAcpEnvelope(seq, offset, method, params, tokenCount = 4) {
  return createEnvelope(seq, offset, {
    type: 'acp_payload',
    payload: { jsonrpc: '2.0', method, params },
  }, tokenCount);
}

function createStatusEnvelope(seq, offset, status, tokenCount = 4) {
  return createEnvelope(seq, offset, { type: 'bridge_status', status }, tokenCount);
}

function createMetadataEnvelope(seq, offset, description, total, tokenCount = 4) {
  return createEnvelope(seq, offset, {
    type: 'replay_metadata',
    captured_at_ms: BASE_TIMESTAMP,
    total_envelopes: total,
    description,
  }, tokenCount);
}

function generateWordLevelSession1() {
  const lines = [];
  let seq = 0, offset = 0;

  lines.push(createMetadataEnvelope(seq++, offset, 'Word-level streaming session', 500));
  offset += 100;
  lines.push(createStatusEnvelope(seq++, offset, 'starting'));
  offset += 100;
  lines.push(createStatusEnvelope(seq++, offset, 'connected'));
  offset += 800;

  offset += 1000;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'user_message',
      turnId: 'turn-0',
      role: 'user',
      content: [{ type: 'text', text: 'Analyze the architecture.' }],
    },
  }));

  const thoughtText = 'This is a substantial analysis request. I need to systematically examine the entire codebase structure.';
  const words = thoughtText.split(/\s+/).filter(w => w.length > 0);
  
  let accumulatedText = '';
  for (let i = 0; i < words.length; i++) {
    accumulatedText = (accumulatedText ? accumulatedText + ' ' : '') + words[i];
    offset += 15;
    
    lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
      sessionId: 'lc-analysis-001',
      update: {
        type: 'agent_thought_chunk',
        turnId: 'turn-1',
        role: 'assistant',
        content: [{ type: 'text', text: accumulatedText }],
        status: 'in_progress',
      },
    }, 4));
  }

  offset += 2000;
  lines.push(createStatusEnvelope(seq++, offset, 'disconnected'));

  return lines;
}

const session1 = generateWordLevelSession1();
fs.writeFileSync('fixtures/replay-data/long-context/session-1/replay-events.jsonl', session1.join('\n') + '\n');
console.log('Generated session-1 with', session1.length, 'events');

const session2 = [];
session2.push(createMetadataEnvelope(0, 0, 'Session 2', 10));
session2.push(createStatusEnvelope(1, 100, 'starting'));
session2.push(createStatusEnvelope(2, 200, 'connected'));
session2.push(createStatusEnvelope(3, 300, 'disconnected'));
fs.writeFileSync('fixtures/replay-data/long-context/session-2/replay-events.jsonl', session2.join('\n') + '\n');
console.log('Generated session-2 with', session2.length, 'events');
