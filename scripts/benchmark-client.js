import WebSocket from 'ws';

const [,, port, demoType, sessionId, expectedEvents] = process.argv;
const wsPort = port || '8080';

const parsedEvents = parseInt(expectedEvents, 10);
if (isNaN(parsedEvents) || parsedEvents <= 0) {
  console.error('Usage: node benchmark-client.js <port> <demoType> <sessionId> <totalEvents>');
  console.error('Error: totalEvents must be specified and greater than 0');
  process.exit(1);
}

const totalEvents = parsedEvents > 0 ? parsedEvents : Number.POSITIVE_INFINITY;
const demoTypeStr = demoType || 'tool-calling-thinking';
const sessionIdStr = sessionId || 'session-1';

let eventsReceived = 0;
let firstEventTime = 0;
let lastEventTime = 0;
let eventLatencies = [];
let streamingStarted = false;
let requestId = 1;
let initialized = false;
let sessionCreated = false;

const ws = new WebSocket(`ws://localhost:${wsPort}`);

function now() {
    return Date.now();
}

ws.on('open', () => {
    console.log(`Connected to ws://localhost:${wsPort}`);
    ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: requestId++,
        method: 'initialize',
    }));
});

ws.on('message', (data) => {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    console.error('Failed to parse message as JSON:', error);
    console.error('Raw data:', data.toString().slice(0, 200));
    return;
  }

  if (message.jsonrpc === '2.0' && message.id !== undefined) {
        if (message.result) {
            if (!initialized && message.result.protocolVersion) {
                initialized = true;
                console.log('Server initialized');
                ws.send(JSON.stringify({
                    jsonrpc: '2.0',
                    id: requestId++,
                    method: 'session/new',
                    params: { demoType: demoTypeStr, sessionId: sessionIdStr },
                }));
            } else if (initialized && !sessionCreated && message.result.sessionId) {
                sessionCreated = true;
                console.log(`Session created: ${message.result.sessionId}`);
                ws.send(JSON.stringify({
                    jsonrpc: '2.0',
                    id: requestId++,
                    method: 'session/prompt',
                }));
            } else if (sessionCreated && !streamingStarted && message.result.status === 'streaming') {
                streamingStarted = true;
                console.log('Streaming started');
            }
        } else if (message.error) {
            console.error('JSON-RPC error:', message.error);
        }
    }
    
    const isEvent = message.version !== undefined || message.type !== undefined;
    if (isEvent && streamingStarted) {
        const eventTime = now();
        eventsReceived++;
        
        if (eventsReceived === 1) {
            firstEventTime = eventTime;
            console.log('First event received');
        }
        lastEventTime = eventTime;
        
        const ts = message.timestamp_ms;
        if (ts) {
            eventLatencies.push(Math.abs(eventTime - ts));
        }
        
        if (eventsReceived % 5 === 0) {
            console.log(`  Received ${eventsReceived}/${totalEvents}`);
        }
        
        if (eventsReceived >= totalEvents) {
            console.log(`All events received, closing...`);
            setTimeout(() => ws.close(), 200);
        }
    }
});

ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    process.exit(1);
});

ws.on('close', () => {
    const totalTime = lastEventTime - firstEventTime;
    const tps = totalTime > 0 ? (eventsReceived / (totalTime / 1000)) : 0;
    
    let p99 = 0;
    if (eventLatencies.length > 0) {
        const sorted = eventLatencies.sort((a, b) => a - b);
        p99 = sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1];
    }
    
    console.log('\n=== Benchmark Results ===');
    console.log(`Events received: ${eventsReceived}`);
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`TPS: ${tps.toFixed(2)}`);
    console.log(`p99 latency: ${p99.toFixed(2)}ms`);
    process.exit(0);
});

setTimeout(() => {
    console.log(`\nTimeout (${eventsReceived}/${totalEvents} events)`);
    ws.close();
}, 30000);
