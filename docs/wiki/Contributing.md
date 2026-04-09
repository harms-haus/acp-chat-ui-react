# Contributing

Guidelines for contributing to ACP Chat UI.

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Rust (for bridge development)
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/acp-react-chat-ui.git
cd acp-react-chat-ui

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Development

```bash
# Start development server
pnpm dev:harness

# Start bridge server
pnpm dev:bridge

# Run both in parallel
pnpm debug
```

## Code Style

### TypeScript

- Use strict mode
- Prefer interfaces over type aliases for objects
- Use explicit return types for functions
- Follow existing naming conventions

```typescript
// Good
interface MessageProps {
  message: NormalizedMessage;
  className?: string;
}

// Avoid
type MessageProps = {
  message: NormalizedMessage;
  className?: string;
};
```

### Rust

- Follow Rust naming conventions
- Use descriptive variable names
- Add documentation comments
- Handle errors explicitly

```rust
/// Process incoming WebSocket message
/// 
/// # Arguments
/// * `message` - WebSocket message to process
/// * `state` - Current connection state
/// 
/// # Returns
/// Result containing processed message or error
fn process_message(message: Message, state: &State) -> Result<ProcessedMessage> {
    // Implementation
}
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm test --filter @harms-haus/acp-chat-core

# Run visual regression tests
pnpm test:visual

# Update visual snapshots
pnpm test:visual:update
```

### Writing Tests

```typescript
// Test file naming: *.test.ts or *.spec.ts
describe('MessageCard', () => {
  it('should render message content', () => {
    // Test implementation
  });
});
```

### Test Coverage

- Maintain >80% coverage for new code
- Test edge cases and error conditions
- Include both unit and integration tests

## Documentation

### Code Documentation

- Add JSDoc comments for public APIs
- Document complex logic
- Include usage examples

```typescript
/**
 * Create normalized state from raw events
 * 
 * @param events - Array of session events
 * @returns Normalized state ready for UI consumption
 */
export function createNormalizedState(events: Event[]): NormalizedState {
  // Implementation
}
```

### Wiki Documentation

- Keep wiki synchronized with code changes
- Update type references when types change
- Include examples for all public APIs
- Link related pages

## Pull Request Process

### Before Submitting

1. Run all tests: `pnpm test`
2. Build all packages: `pnpm build`
3. Check linting: `pnpm lint`
4. Update documentation
5. Add tests for new features

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests added/updated
- [ ] Manual testing completed

## Documentation
- [ ] Wiki updated
- [ ] README updated
- [ ] JSDoc comments added
```

### Review Process

1. Automated checks (CI)
2. Code review by maintainer
3. Documentation review
4. Final approval and merge

## Release Process

### Version Numbering

Follow semantic versioning:
- MAJOR.MINOR.PATCH (e.g., 1.2.3)

### Release Steps

1. Update version in package.json
2. Update CHANGELOG.md
3. Create git tag
4. Publish to npm
5. Create GitHub release

## Getting Help

- Open issue for bugs
- Discussion for questions
- Discord channel for real-time help

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow

## Related Documentation

- [Architecture](./acp-chat-core-Architecture) - System overview
- [Glossary](./Glossary) - Terminology reference
- [Troubleshooting](./Troubleshooting) - Common issues
- [Home](./Home) - Main documentation index
