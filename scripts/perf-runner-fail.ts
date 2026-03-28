import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

interface ReplayEnvelope {
  version: number;
  seq: number;
  timestamp_ms: number;
  type: string;
  payload?: {
    jsonrpc: string;
    method: string;
    params: {
      update: {
        type: string;
        turnId: string;
        role?: string;
        content?: Array<{ type: string; text?: string }>;
        status?: string;
      };
    };
  };
  status?: string;
  total_envelopes?: number;
}

interface NormalizedMessage {
  turnId: string;
  role: string;
  content: string;
  chunks: number;
  isComplete: boolean;
  contentHash: string;
}

interface NormalizedState {
  messages: Map<string, NormalizedMessage>;
  totalCharacters: number;
  totalChunks: number;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function parseReplayFixture(fixturePath: string): ReplayEnvelope[] {
  const content = readFileSync(fixturePath, 'utf-8');
  const lines = content.trim().split('\n');
  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as ReplayEnvelope;
    } catch (e) {
      throw new Error(`Failed to parse line ${index + 1} in ${fixturePath}`);
    }
  });
}

function processEnvelope(envelope: ReplayEnvelope, state: NormalizedState): void {
  if (envelope.type !== 'acp_payload' || !envelope.payload) return;
  
  const update = envelope.payload.params?.update;
  if (!update) return;
  
  const { turnId, type, role, content, status } = update;
  
  if (type === 'user_message' || type === 'agent_message_chunk') {
    const existing = state.messages.get(turnId);
    const textContent = content?.map(c => c.text || '').join('') || '';
    
    if (existing) {
      existing.content += textContent;
      existing.chunks++;
      existing.isComplete = status === 'done';
      existing.contentHash = simpleHash(existing.content);
    } else {
      state.messages.set(turnId, {
        turnId,
        role: role || 'unknown',
        content: textContent,
        chunks: 1,
        isComplete: status === 'done',
        contentHash: simpleHash(textContent),
      });
    }
    
    state.totalCharacters += textContent.length;
    state.totalChunks++;
  }
}

const FAILING_BUDGETS = {
  streamingCadenceMs: 0.0001,
  firstInteractiveMs: 0.0001,
  maxHeapGrowthMB: 0.0001,
};

interface PerfResult {
  name: string;
  actual: number;
  budget: number;
  unit: string;
  passed: boolean;
  details?: string;
}

function runTestsWithFailingBudgets(envelopes: ReplayEnvelope[]): PerfResult[] {
  const state: NormalizedState = { messages: new Map(), totalCharacters: 0, totalChunks: 0 };
  const acpPayloads = envelopes.filter(e => e.type === 'acp_payload');
  
  const processingTimes: number[] = [];
  for (const envelope of acpPayloads) {
    const start = performance.now();
    processEnvelope(envelope, state);
    processingTimes.push(performance.now() - start);
  }
  
  const avgCadence = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
  
  const initialMemory = process.memoryUsage().heapUsed;
  const state2: NormalizedState = { messages: new Map(), totalCharacters: 0, totalChunks: 0 };
  for (const envelope of envelopes) {
    processEnvelope(envelope, state2);
  }
  const growthMB = (process.memoryUsage().heapUsed - initialMemory) / (1024 * 1024);
  
  const start = performance.now();
  for (let i = 0; i < 10 && i < envelopes.length; i++) {
    const envelope = envelopes[i];
    if (envelope) processEnvelope(envelope, state2);
  }
  const firstInteractive = performance.now() - start;
  
  return [
    {
      name: 'Streaming Cadence',
      actual: avgCadence,
      budget: FAILING_BUDGETS.streamingCadenceMs,
      unit: 'ms avg',
      passed: avgCadence <= FAILING_BUDGETS.streamingCadenceMs,
      details: `${acpPayloads.length} payloads processed`,
    },
    {
      name: 'First Interactive',
      actual: firstInteractive,
      budget: FAILING_BUDGETS.firstInteractiveMs,
      unit: 'ms',
      passed: firstInteractive <= FAILING_BUDGETS.firstInteractiveMs,
      details: 'measured on sample replay',
    },
    {
      name: 'Memory Growth',
      actual: growthMB,
      budget: FAILING_BUDGETS.maxHeapGrowthMB,
      unit: 'MB',
      passed: growthMB <= FAILING_BUDGETS.maxHeapGrowthMB,
      details: `${state2.messages.size} messages retained`,
    },
  ];
}

function runFailingTests(): boolean {
  console.log('Running performance tests with deliberately impossible budgets...\n');
  
  const fixtures = ['fixtures/sample-replay.jsonl'];
  let allFailed = false;
  
  for (const fixture of fixtures) {
    console.log(`\n=== Performance Report (FAILURE MODE) ===`);
    console.log(`Fixture: ${fixture}`);
    
    const envelopes = parseReplayFixture(fixture);
    const results = runTestsWithFailingBudgets(envelopes);
    
    console.log('\nBudget Results:');
    for (const result of results) {
      const status = result.passed ? 'PASS' : 'FAIL';
      console.log(`  ${status} ${result.name}: ${result.actual.toFixed(4)}${result.unit} (budget: ${result.budget}${result.unit})`);
    }
    
    const failedBudgets = results.filter(r => !r.passed);
    if (failedBudgets.length > 0) {
      allFailed = true;
      console.log('\nFailed budgets:');
      for (const f of failedBudgets) {
        console.log(`  - ${f.name}: ${f.actual.toFixed(4)}${f.unit} exceeds ${f.budget}${f.unit} budget`);
      }
    }
  }
  
  return !allFailed;
}

const passed = runFailingTests();
process.exit(passed ? 0 : 1);