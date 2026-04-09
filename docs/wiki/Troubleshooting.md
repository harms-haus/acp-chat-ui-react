# Troubleshooting

Common issues and solutions for ACP Chat UI.

## Connection Issues

### "WebSocket connection failed"

**Problem:** Cannot connect to bridge.

**Solutions:**
1. Verify bridge is running: `cargo run -p harms_haus_acp_ws_bridge`
2. Check WebSocket URL: should be `ws://localhost:8765`
3. Verify firewall allows port 8765
4. Check browser console for specific error

### "Connection keeps reconnecting"

**Problem:** Repeated reconnection attempts.

**Solutions:**
1. Check bridge server logs for errors
2. Verify network stability
3. Increase `reconnectInterval` in TransportConfig
4. Check for authentication/permission issues

## Event Handling Problems

### "Events not triggering UI updates"

**Problem:** Events received but UI doesn't update.

**Solutions:**
1. Verify store subscription is active
2. Check that `notify()` is called after state updates
3. Ensure components use hooks correctly
4. Verify event handlers are registered before events occur

### "Events arriving out of order"

**Problem:** Messages appear in wrong order.

**Solutions:**
1. Check `seq` field in BridgeEnvelope
2. Use timeline ordering based on timestamps
3. Verify batch processing maintains order
4. Check for duplicate event handling

## State Synchronization

### "UI shows stale data"

**Problem:** UI not reflecting current state.

**Solutions:**
1. Verify state snapshots are being created
2. Check subscription cleanup on unmount
3. Ensure `getState()` returns latest snapshot
4. Verify version-based invalidation working

### "State updates causing infinite loops"

**Problem:** Component re-renders trigger more updates.

**Solutions:**
1. Use `useCallback` for event handlers
2. Add dependencies to `useEffect` hooks
3. Verify state updates are immutable
4. Check for circular dependencies

## Permission Request Issues

### "Permission dialog not appearing"

**Problem:** Permission requests not shown to user.

**Solutions:**
1. Verify `permissionRequest` event handler registered
2. Check that `respondToPermission` is called
3. Ensure permission request state is tracked
4. Verify UI component mounted and listening

### "Permission response not sent"

**Problem:** Agent doesn't receive permission response.

**Solutions:**
1. Verify `respondToPermission` called with correct request ID
2. Check session is still active
3. Ensure transport connection is open
4. Check bridge logs for errors

## Replay Problems

### "Replay not starting"

**Problem:** Replay session fails to initialize.

**Solutions:**
1. Verify replay data file exists and is valid JSON
2. Check ReplayController initialization
3. Ensure replay mode is set correctly
4. Verify replay speed is positive number

### "Replay speed not changing"

**Problem:** Speed slider has no effect.

**Solutions:**
1. Verify speed value passed to ReplayController
2. Check that speed is used in timing logic
3. Ensure extraData mechanism working
4. Verify bridge preserves extraData field

## Performance Issues

### "UI lagging with many messages"

**Problem:** Slow rendering with large message history.

**Solutions:**
1. Use VirtualizedThread for virtualization
2. Implement windowing for message list
3. Optimize content rendering
4. Reduce re-renders with React.memo

### "High memory usage"

**Problem:** Memory consumption increasing over time.

**Solutions:**
1. Verify subscription cleanup on unmount
2. Check for event handler leaks
3. Limit replay buffer size
4. Implement message pruning for long conversations

## FAQ

### Q: How do I debug WebSocket messages?
A: Enable bridge logging with `RUST_LOG=trace` and check browser console for transport events.

### Q: Can I use this without React?
A: Yes, `@harms-haus/acp-chat-core` is framework-agnostic. Use SessionController directly.

### Q: How do I customize message styling?
A: Override CSS custom properties or provide custom renderers to Thread/MessageCard components.

### Q: Where are replay files stored?
A: By default in `fixtures/replay-data/captured/` directory.

### Q: How do I add custom tool calls?
A: Extend the ToolCallKind enum and implement handler in your application.

## Related Documentation

- [Architecture](./acp-chat-core-Architecture) - System overview
- [Events](./acp-chat-core-Events) - Event system
- [Session Management](./acp-chat-core-Session-Management) - Controller API
- [Implementation Guide](./acp-chat-core-Implementation-Guide) - Usage patterns
