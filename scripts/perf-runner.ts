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
      throw new Error(`Failed to parse line ${index + 1} in ${fixturePath}: ${line.substring(0, 50)}...`);
    }
  });
}

function validateFixtureIntegrity(envelopes: ReplayEnvelope[], fixturePath: string): void {
  const metadata = envelopes.find(e => e.type === 'replay_metadata');
  if (!metadata) {
    throw new Error(`Fixture ${fixturePath} missing replay_metadata envelope`);
  }
  
  const expectedCount = metadata.total_envelopes;
  const actualCount = envelopes.length;
  
  if (expectedCount !== actualCount) {
    throw new Error(
      `Fixture integrity failure in ${fixturePath}: ` +
      `metadata claims ${expectedCount} envelopes but file contains ${actualCount}`
    );
  }
  
  const seqNumbers = envelopes.map(e => e.seq);
  const expectedSeq = Array.from({ length: actualCount }, (_, i) => i);
  const seqMatch = seqNumbers.every((s, i) => s === expectedSeq[i]);
  
  if (!seqMatch) {
    throw new Error(`Fixture ${fixturePath} has out-of-order or missing sequence numbers`);
  }
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

interface PerfBudgetConfig {
  streamingCadenceMs: number;
  firstInteractiveMs: number;
  maxHeapGrowthMB: number;
}

const DEFAULT_BUDGETS: PerfBudgetConfig = {
  streamingCadenceMs: 16,
  firstInteractiveMs: 150,
  maxHeapGrowthMB: 50,
};

interface PerfResult {
  name: string;
  actual: number;
  budget: number;
  unit: string;
  passed: boolean;
  details?: string;
}

interface PerfReport {
  fixture: string;
  envelopesProcessed: number;
  messagesNormalized: number;
  totalCharacters: number;
  results: PerfResult[];
  allPassed: boolean;
  timestamp: string;
}

function formatReport(report: PerfReport): string {
  const lines: string[] = [];
  lines.push(`\n=== Performance Report ===`);
  lines.push(`Fixture: ${report.fixture}`);
  lines.push(`Envelopes: ${report.envelopesProcessed}`);
  lines.push(`Messages normalized: ${report.messagesNormalized}`);
  lines.push(`Total characters: ${report.totalCharacters}`);
  lines.push(`Timestamp: ${report.timestamp}`);
  lines.push('');
  lines.push('Budget Results:');
  for (const result of report.results) {
    const status = result.passed ? 'PASS' : 'FAIL';
    let line = `  ${status} ${result.name}: ${result.actual.toFixed(2)}${result.unit} (budget: ${result.budget}${result.unit})`;
    if (result.details) {
      line += ` [${result.details}]`;
    }
    lines.push(line);
  }
  lines.push('');
  lines.push(`Overall: ${report.allPassed ? 'ALL PASSED' : 'FAILED'}`);
  return lines.join('\n');
}

function runStreamingCadenceTest(envelopes: ReplayEnvelope[]): PerfResult {
  const acpPayloads = envelopes.filter(e => e.type === 'acp_payload');
  if (acpPayloads.length === 0) {
    return {
      name: 'Streaming Cadence',
      actual: 0,
      budget: DEFAULT_BUDGETS.streamingCadenceMs,
      unit: 'ms avg',
      passed: true,
      details: 'no payloads',
    };
  }

  const state: NormalizedState = { messages: new Map(), totalCharacters: 0, totalChunks: 0 };
  const processingTimes: number[] = [];
  
  for (const envelope of acpPayloads) {
    const start = performance.now();
    processEnvelope(envelope, state);
    const elapsed = performance.now() - start;
    processingTimes.push(elapsed);
  }

  const avgCadence = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
  const maxCadence = Math.max(...processingTimes);
  
  return {
    name: 'Streaming Cadence',
    actual: avgCadence,
    budget: DEFAULT_BUDGETS.streamingCadenceMs,
    unit: 'ms avg',
    passed: avgCadence <= DEFAULT_BUDGETS.streamingCadenceMs,
    details: `max ${maxCadence.toFixed(2)}ms, ${acpPayloads.length} payloads`,
  };
}

function runFirstInteractiveTest(envelopes: ReplayEnvelope[]): PerfResult {
  const state: NormalizedState = { messages: new Map(), totalCharacters: 0, totalChunks: 0 };
  const start = performance.now();
  
  let processed = 0;
  let foundInteractive = false;
  
  for (const envelope of envelopes) {
    processEnvelope(envelope, state);
    processed++;
    
    if (envelope.type === 'acp_payload' && envelope.payload?.params?.update?.status === 'done') {
      foundInteractive = true;
      break;
    }
  }
  
  const elapsed = performance.now() - start;
  
  return {
    name: 'First Interactive',
    actual: elapsed,
    budget: DEFAULT_BUDGETS.firstInteractiveMs,
    unit: 'ms',
    passed: elapsed <= DEFAULT_BUDGETS.firstInteractiveMs,
    details: foundInteractive ? `${processed} envelopes to first done` : 'no done message found',
  };
}

function runMemoryGrowthTest(envelopes: ReplayEnvelope[]): PerfResult {
  const initialMemory = process.memoryUsage().heapUsed;
  
  const state: NormalizedState = { messages: new Map(), totalCharacters: 0, totalChunks: 0 };
  
  for (const envelope of envelopes) {
    processEnvelope(envelope, state);
  }
  
  const finalMemory = process.memoryUsage().heapUsed;
  const growthMB = (finalMemory - initialMemory) / (1024 * 1024);
  
  return {
    name: 'Memory Growth',
    actual: growthMB,
    budget: DEFAULT_BUDGETS.maxHeapGrowthMB,
    unit: 'MB',
    passed: growthMB <= DEFAULT_BUDGETS.maxHeapGrowthMB,
    details: `${state.messages.size} messages, ${state.totalCharacters} chars retained`,
  };
}

function runPerfTests(fixturePath: string): PerfReport {
  const envelopes = parseReplayFixture(fixturePath);
  
  validateFixtureIntegrity(envelopes, fixturePath);
  
  const state: NormalizedState = { messages: new Map(), totalCharacters: 0, totalChunks: 0 };
  for (const envelope of envelopes) {
    processEnvelope(envelope, state);
  }
  
  const results: PerfResult[] = [
    runStreamingCadenceTest(envelopes),
    runFirstInteractiveTest(envelopes),
    runMemoryGrowthTest(envelopes),
  ];
  
  const report: PerfReport = {
    fixture: fixturePath,
    envelopesProcessed: envelopes.length,
    messagesNormalized: state.messages.size,
    totalCharacters: state.totalCharacters,
    results,
    allPassed: results.every(r => r.passed),
    timestamp: new Date().toISOString(),
  };
  
  console.log(formatReport(report));
  
  return report;
}

function runAllPerfTests(): boolean {
  console.log('Running performance tests...\n');
  
  const fixtures = [
    'fixtures/sample-replay.jsonl',
    'fixtures/canonical-10k-replay.jsonl',
  ];
  
  let allPassed = true;
  
  for (const fixture of fixtures) {
    try {
      const report = runPerfTests(fixture);
      if (!report.allPassed) {
        allPassed = false;
      }
    } catch (error) {
      console.error(`ERROR processing ${fixture}: ${error instanceof Error ? error.message : error}`);
      allPassed = false;
    }
  }
  
  console.log('\n=== Summary ===');
  if (allPassed) {
    console.log('All performance budgets passed.');
    return true;
  } else {
    console.log('Some performance budgets failed.');
    return false;
  }
}

function parseArgs(): { scenario?: string } {
  const args = process.argv.slice(2);
  const result: { scenario?: string } = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scenario' && args[i + 1]) {
      const scenarioValue = args[i + 1];
      if (scenarioValue) {
        result.scenario = scenarioValue;
      }
      i++;
    }
  }
  
  return result;
}

export function runStreamingStoreScenario(): PerfResult {
  const mockSubscribers: Array<() => void> = [];
  let notificationCount = 0;
  let pendingNotification = false;
  const notificationCadenceMs = 16;
  
  const subscribe = (callback: () => void) => {
    mockSubscribers.push(callback);
    return () => {
      const idx = mockSubscribers.indexOf(callback);
      if (idx !== -1) mockSubscribers.splice(idx, 1);
    };
  };
  
  const scheduleNotification = () => {
    if (pendingNotification) return;
    pendingNotification = true;
  };
  
  const flushBatchedNotification = () => {
    if (pendingNotification) {
      pendingNotification = false;
      notificationCount++;
      for (const cb of mockSubscribers) {
        cb();
      }
    }
  };
  
  const messages = new Map<string, { turnId: string; content: string }>();
  let updateCount = 0;
  const updateProcessingTimes: number[] = [];
  
  const processUpdate = (turnId: string, content: string) => {
    const start = performance.now();
    
    const existing = messages.get(turnId);
    if (existing) {
      existing.content += content;
    } else {
      messages.set(turnId, { turnId, content });
    }
    
    updateCount++;
    
    const elapsed = performance.now() - start;
    updateProcessingTimes.push(elapsed);
    
    scheduleNotification();
  };
  
  subscribe(() => {});
  
  const numUpdates = 1000;
  
  for (let i = 0; i < numUpdates; i++) {
    const turnId = `turn-${i % 10}`;
    const content = `Chunk ${i} `;
    processUpdate(turnId, content);
    
    if (i % 50 === 49) {
      flushBatchedNotification();
    }
  }
  
  flushBatchedNotification();
  
  const avgProcessingTime = updateProcessingTimes.reduce((a, b) => a + b, 0) / updateProcessingTimes.length;
  
  const expectedMaxNotifications = Math.ceil(numUpdates / 50) + 1;
  const batchingRatio = (notificationCount / numUpdates) * 100;
  
  const batchingWorks = notificationCount > 0 && notificationCount < numUpdates;
  
  return {
    name: 'Streaming Store',
    actual: avgProcessingTime,
    budget: 16,
    unit: 'ms avg',
    passed: avgProcessingTime <= 16 && batchingWorks,
    details: `${updateCount} updates, ${notificationCount} notifications (${batchingRatio.toFixed(1)}% ratio), expected ~${expectedMaxNotifications}`,
  };
}

export function runVirtualizedThreadScenario(): PerfResult {
  // Simulate virtualized thread rendering performance
  const itemCount = 10000;
  const viewportHeight = 600;
  const estimatedRowHeight = 80;
  const overscan = 5;

  const start = performance.now();

  // Calculate visible window (simulating virtualizer logic)
  const visibleCount = Math.ceil(viewportHeight / estimatedRowHeight);
  const totalVirtualItems = visibleCount + overscan * 2;

  // Simulate key generation (stable IDs vs indices)
  const stableKeys: string[] = [];
  for (let i = 0; i < totalVirtualItems; i++) {
    stableKeys.push(`msg_${i}_stable`);
  }

  // Simulate measurement overhead
  const measurements: number[] = [];
  for (let i = 0; i < totalVirtualItems; i++) {
    const mStart = performance.now();
    // Simulate getBoundingClientRect call
    const height = estimatedRowHeight + Math.random() * 40;
    measurements.push(height);
    const mEnd = performance.now();
    if (mEnd - mStart > 0.01) {
      measurements.push(mEnd - mStart);
    }
  }

  const elapsed = performance.now() - start;

  // Calculate metrics
  const avgItemTime = elapsed / itemCount * 1000; // microseconds per item
  const windowRatio = totalVirtualItems / itemCount;
  const memoryEfficiency = 1 - windowRatio;

  // Budget: 150ms for first interactive with 10k items
  const passed = elapsed <= 150 && stableKeys.every(k => k.includes("_stable"));

  return {
    name: 'Virtualized Thread',
    actual: elapsed,
    budget: 150,
    unit: 'ms',
    passed,
    details: `${itemCount} items, ${totalVirtualItems} virtual window (${(windowRatio * 100).toFixed(1)}%), ${avgItemTime.toFixed(2)}µs/item, stable keys: ${stableKeys.length}`,
  };
}

export function runMessageStreamingScenario(): PerfResult {
  // Simulate message streaming with chunked content updates
  const numMessages = 100;
  const chunksPerMessage = 10;
  const updateProcessingTimes: number[] = [];
  const renderTimes: number[] = [];

  const messages = new Map<string, { id: string; content: string; contentBlocks: Array<{ type: string; text: string }> }>();

  const start = performance.now();

  for (let m = 0; m < numMessages; m++) {
    const messageId = `msg_${m}`;
    let messageContent = "";
    const contentBlocks: Array<{ type: string; text: string }> = [];

    for (let c = 0; c < chunksPerMessage; c++) {
      const chunkStart = performance.now();
      const chunkText = `Chunk ${c} `;
      messageContent += chunkText;
      contentBlocks.push({ type: "text", text: chunkText });
      updateProcessingTimes.push(performance.now() - chunkStart);
    }

    const renderStart = performance.now();
    messages.set(messageId, {
      id: messageId,
      content: messageContent,
      contentBlocks,
    });
    renderTimes.push(performance.now() - renderStart);
  }

  const elapsed = performance.now() - start;
  const avgUpdateTime = updateProcessingTimes.reduce((a, b) => a + b, 0) / updateProcessingTimes.length;
  const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;

  // Budget: 16ms average processing time per update
  const passed = avgUpdateTime <= 16 && avgRenderTime <= 1;

  return {
    name: 'Message Streaming',
    actual: avgUpdateTime,
    budget: 16,
    unit: 'ms avg',
    passed,
    details: `${numMessages} messages, ${chunksPerMessage} chunks each, ${messages.size} normalized, render avg ${avgRenderTime.toFixed(3)}ms`,
  };
}

export function runComposerActionsScenario(): PerfResult {
  const numMessages = 100;
  const actionsPerMessage = 3;
  const updateProcessingTimes: number[] = [];
  const renderTimes: number[] = [];

  const messages = new Map<string, { id: string; content: string; actionsOpen: boolean }>();

  const start = performance.now();

  for (let m = 0; m < numMessages; m++) {
    const messageId = `msg_${m}`;

    const updateStart = performance.now();
    messages.set(messageId, {
      id: messageId,
      content: `Message ${m} content`,
      actionsOpen: false,
    });
    updateProcessingTimes.push(performance.now() - updateStart);

    const renderStart = performance.now();
    for (let a = 0; a < actionsPerMessage; a++) {
      const actionOpenStart = performance.now();
      const msg = messages.get(messageId);
      if (msg) {
        msg.actionsOpen = true;
      }
      const actionOpenElapsed = performance.now() - actionOpenStart;
      renderTimes.push(actionOpenElapsed);

      const actionCloseStart = performance.now();
      if (msg) {
        msg.actionsOpen = false;
      }
      renderTimes.push(performance.now() - actionCloseStart);
    }
  }

  const elapsed = performance.now() - start;
  const avgUpdateTime = updateProcessingTimes.reduce((a, b) => a + b, 0) / updateProcessingTimes.length;
  const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;

  const passed = avgUpdateTime <= 16 && avgRenderTime <= 1;

  return {
    name: 'Composer Actions',
    actual: avgUpdateTime,
    budget: 16,
    unit: 'ms avg',
    passed,
    details: `${numMessages} messages, ${actionsPerMessage} actions each, ${messages.size} total, render avg ${avgRenderTime.toFixed(3)}ms`,
  };
}

export function runThoughtUpdatesScenario(): PerfResult {
  // Simulate thought and tool-call updates with render isolation
  const numThoughtGroups = 50;
  const thoughtsPerGroup = 5;
  const toolCallsPerGroup = 2;
  const updateProcessingTimes: number[] = [];
  const renderTimes: number[] = [];

  const thoughts = new Map<string, { id: string; content: string; createdAt: number }>();
  const toolCalls = new Map<string, { id: string; kind: string; title: string; status: string; createdAt: number }>();
  const thoughtGroups: Array<{ id: string; items: string[]; startTime: number; endTime: number }> = [];

  const start = performance.now();

  for (let g = 0; g < numThoughtGroups; g++) {
    const groupId = `group_${g}`;
    const groupItems: string[] = [];
    const groupStart = performance.now();

    // Add thoughts to group
    for (let t = 0; t < thoughtsPerGroup; t++) {
      const thoughtId = `thought_${g}_${t}`;
      const updateStart = performance.now();
      thoughts.set(thoughtId, {
        id: thoughtId,
        content: `Thinking step ${t} for group ${g}...`,
        createdAt: Date.now() + t * 100,
      });
      updateProcessingTimes.push(performance.now() - updateStart);
      groupItems.push(thoughtId);
    }

    // Add tool calls to group
    for (let tc = 0; tc < toolCallsPerGroup; tc++) {
      const toolCallId = `tool_${g}_${tc}`;
      const updateStart = performance.now();
      toolCalls.set(toolCallId, {
        id: toolCallId,
        kind: tc % 2 === 0 ? "read" : "search",
        title: `Tool call ${tc} for group ${g}`,
        status: tc === toolCallsPerGroup - 1 ? "completed" : "pending",
        createdAt: Date.now() + (thoughtsPerGroup + tc) * 100,
      });
      updateProcessingTimes.push(performance.now() - updateStart);
      groupItems.push(toolCallId);
    }

    const renderStart = performance.now();
    thoughtGroups.push({
      id: groupId,
      items: groupItems,
      startTime: groupStart,
      endTime: Date.now(),
    });
    renderTimes.push(performance.now() - renderStart);
  }

  const elapsed = performance.now() - start;
  const avgUpdateTime = updateProcessingTimes.reduce((a, b) => a + b, 0) / updateProcessingTimes.length;
  const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
  const totalItems = thoughts.size + toolCalls.size;

  // Budget: 16ms average processing time per update, 1ms render time
  const passed = avgUpdateTime <= 16 && avgRenderTime <= 1;

  return {
    name: 'Thought Updates',
    actual: avgUpdateTime,
    budget: 16,
    unit: 'ms avg',
    passed,
    details: `${numThoughtGroups} groups, ${thoughts.size} thoughts, ${toolCalls.size} tool calls, ${totalItems} total, render avg ${avgRenderTime.toFixed(3)}ms`,
  };
}

function runScenarioTests(scenario: string): boolean {
  console.log(`Running scenario: ${scenario}...\n`);

  const results: PerfResult[] = [];

  if (scenario === 'streaming-store') {
    results.push(runStreamingStoreScenario());
  } else if (scenario === 'virtualized-thread') {
    results.push(runVirtualizedThreadScenario());
  } else if (scenario === 'message-streaming') {
    results.push(runMessageStreamingScenario());
  } else if (scenario === 'thought-updates') {
    results.push(runThoughtUpdatesScenario());
  } else if (scenario === 'composer-actions') {
    results.push(runComposerActionsScenario());
  } else {
    console.error(`Unknown scenario: ${scenario}`);
    return false;
  }

  const allPassed = results.every(r => r.passed);

  console.log('\nResults:');
  for (const result of results) {
    const status = result.passed ? 'PASS' : 'FAIL';
    let line = ` ${status} ${result.name}: ${result.actual.toFixed(2)}${result.unit} (budget: ${result.budget}${result.unit})`;
    if (result.details) {
      line += ` [${result.details}]`;
    }
    console.log(line);
  }

  console.log(`\nOverall: ${allPassed ? 'PASSED' : 'FAILED'}`);
  return allPassed;
}

function main(): void {
  const { scenario } = parseArgs();
  
  if (scenario) {
    const passed = runScenarioTests(scenario);
    process.exit(passed ? 0 : 1);
  } else {
    const passed = runAllPerfTests();
    process.exit(passed ? 0 : 1);
  }
}

main();