#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

/**
 * Canonical 10,000-message replay fixture for performance testing.
 * 
 * Counting model (documented):
 * - "10,000 messages" = total content items in thread (5000 user + 5000 agent final messages)
 * - Each turn produces: 1 user_message + 2 agent_message_chunk (in_progress + done)
 * - Total ACP payloads: 5000 turns * 3 payloads = 15000
 * - Total envelopes: 15003 (metadata + start/end + 15000 payloads)
 */

const NUM_TURNS = 5000;
const TIMESTAMP_BASE = 1700000000000;

function generateCanonicalReplay(): void {
  const lines: string[] = [];
  const totalEnvelopes = NUM_TURNS * 3 + 4;
  
  lines.push(JSON.stringify({
    version: 1,
    seq: 0,
    timestamp_ms: TIMESTAMP_BASE,
    type: 'replay_metadata',
    captured_at_ms: TIMESTAMP_BASE,
    total_envelopes: totalEnvelopes,
    description: `Canonical 10,000-message replay fixture: ${NUM_TURNS} user messages + ${NUM_TURNS} agent messages = 10000 total thread messages`
  }));
  
  lines.push(JSON.stringify({
    version: 1,
    seq: 1,
    timestamp_ms: TIMESTAMP_BASE + 1,
    type: 'bridge_status',
    status: 'starting'
  }));
  
  lines.push(JSON.stringify({
    version: 1,
    seq: 2,
    timestamp_ms: TIMESTAMP_BASE + 2,
    type: 'bridge_status',
    status: 'connected'
  }));
  
  let seq = 3;
  let timestamp = TIMESTAMP_BASE + 3;
  
  for (let turn = 0; turn < NUM_TURNS; turn++) {
    const userTurnId = `user-turn-${turn}`;
    const agentTurnId = `agent-turn-${turn}`;
    
    const userText = `User message ${turn}: Question about topic ${turn % 100}. ` +
      `This message contains meaningful content for normalization testing including ` +
      `various text patterns and word counts to simulate realistic chat payloads.`;
    
    lines.push(JSON.stringify({
      version: 1,
      seq: seq++,
      timestamp_ms: timestamp++,
      type: 'acp_payload',
      payload: {
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          update: {
            type: 'user_message',
            turnId: userTurnId,
            role: 'user',
            content: [{ type: 'text', text: userText }]
          }
        }
      }
    }));
    
    const agentChunk1 = `Agent response ${turn} chunk 1: Analyzing your question... ` +
      `Processing the request with thoughtful consideration. ` +
      `Building the response incrementally to test streaming normalization.`;
    
    lines.push(JSON.stringify({
      version: 1,
      seq: seq++,
      timestamp_ms: timestamp++,
      type: 'acp_payload',
      payload: {
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          update: {
            type: 'agent_message_chunk',
            turnId: agentTurnId,
            role: 'assistant',
            content: [{ type: 'text', text: agentChunk1 }],
            status: 'in_progress'
          }
        }
      }
    }));
    
    const agentChunk2 = `Agent response ${turn} chunk 2: ` +
      `Final answer with detailed analysis and comprehensive findings. ` +
      `This concludes the response for question ${turn}. ` +
      `The solution addresses all aspects of the original query.`;
    
    lines.push(JSON.stringify({
      version: 1,
      seq: seq++,
      timestamp_ms: timestamp++,
      type: 'acp_payload',
      payload: {
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          update: {
            type: 'agent_message_chunk',
            turnId: agentTurnId,
            role: 'assistant',
            content: [{ type: 'text', text: agentChunk2 }],
            status: 'done'
          }
        }
      }
    }));
  }
  
  lines.push(JSON.stringify({
    version: 1,
    seq: seq++,
    timestamp_ms: timestamp++,
    type: 'bridge_status',
    status: 'disconnected'
  }));
  
  const outputPath = 'fixtures/canonical-10k-replay.jsonl';
  writeFileSync(outputPath, lines.join('\n') + '\n');
  
  console.log(`Generated canonical fixture to ${outputPath}`);
  console.log(`  Total envelopes: ${lines.length}`);
  console.log(`  Metadata claims: ${totalEnvelopes}`);
  console.log(`  User messages: ${NUM_TURNS}`);
  console.log(`  Agent messages (final done): ${NUM_TURNS}`);
  console.log(`  Total thread messages: ${NUM_TURNS * 2}`);
  console.log(`  Match: ${lines.length === totalEnvelopes ? 'YES' : 'NO'}`);
}

generateCanonicalReplay();