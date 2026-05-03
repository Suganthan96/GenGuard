# Contributing to GuardMesh CLI

Thank you for your interest in contributing to GuardMesh! This document provides guidelines for contributing to the CLI framework.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/guardmesh-cli`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Link for local testing
npm link

# Run in development mode
npm run dev -- init test-agent
```

## Project Structure

```
guardmesh-cli/
├── src/
│   ├── cli.ts              # Main CLI entry point
│   ├── commands/           # Command implementations
│   │   ├── init.ts        # Project initialization
│   │   ├── agent.ts       # Agent management
│   │   ├── test.ts        # Testing commands
│   │   ├── deploy.ts      # Deployment
│   │   ├── audit.ts       # Audit queries
│   │   ├── guardians.ts   # Guardian management
│   │   └── config.ts      # Configuration
│   ├── lib/               # Core libraries
│   │   ├── config.ts      # Config management
│   │   └── contract.ts    # Contract interactions
│   └── templates/         # Agent templates
│       └── index.ts       # Template definitions
├── examples/              # Example projects
├── tests/                 # Test files
└── docs/                  # Documentation
```

## Adding a New Command

1. Create a new file in `src/commands/`:

```typescript
// src/commands/mycommand.ts
import chalk from 'chalk';
import ora from 'ora';

export async function myCommand(options: any) {
  const spinner = ora('Processing...').start();

  try {
    // Your command logic here
    
    spinner.succeed(chalk.green('✓ Success'));
  } catch (error: any) {
    spinner.fail(chalk.red('Failed'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}
```

2. Register it in `src/cli.ts`:

```typescript
program
  .command('mycommand')
  .description('Description of my command')
  .option('-o, --option <value>', 'Option description')
  .action(myCommand);
```

3. Add tests in `tests/mycommand.test.ts`

## Adding a New Template

1. Define the template in `src/templates/index.ts`:

```typescript
const myTemplate: AgentTemplate = {
  agentConfig: `
agentId: my-template-01
roleScope: my_role
allowedActions:
  - action1
  - action2
`,
  agentCode: `
// Your template code here
`,
  policyConfig: `
# Policy configuration
`,
  packageJson: (name: string) => `{
  "name": "${name}",
  "version": "1.0.0"
}`,
  envExample: `
# Environment variables
`,
  readme: (name: string) => `
# ${name}
Template description
`,
};
```

2. Add it to the template selector:

```typescript
export function getTemplate(type: string): AgentTemplate {
  switch (type) {
    case 'my-template':
      return myTemplate;
    // ... other templates
  }
}
```

## Code Style

- Use TypeScript
- Follow existing code style
- Use meaningful variable names
- Add comments for complex logic
- Use async/await over promises

### Formatting

```bash
# Format code (if prettier is configured)
npm run format

# Lint code (if eslint is configured)
npm run lint
```

## Testing

```bash
# Run tests
npm test

# Run specific test
npm test -- mycommand.test.ts

# Watch mode
npm test -- --watch
```

### Writing Tests

```typescript
import { myCommand } from '../src/commands/mycommand';

describe('myCommand', () => {
  it('should do something', async () => {
    // Test implementation
    expect(result).toBe(expected);
  });

  it('should handle errors', async () => {
    // Error handling test
  });
});
```

## Documentation

- Update README.md for new features
- Add examples to examples/
- Update FRAMEWORK_GUIDE.md for architectural changes
- Add JSDoc comments to functions

### Documentation Style

```typescript
/**
 * Brief description of the function
 * 
 * @param options - Command options
 * @param options.agentId - The agent identifier
 * @returns Promise that resolves when complete
 * 
 * @example
 * ```typescript
 * await myCommand({ agentId: 'test-01' });
 * ```
 */
export async function myCommand(options: any): Promise<void> {
  // Implementation
}
```

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes**
   - Write code
   - Add tests
   - Update documentation

3. **Test your changes**
   ```bash
   npm run build
   npm test
   ```

4. **Commit with clear messages**
   ```bash
   git commit -m "feat: add new command for X"
   ```

   Use conventional commits:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation
   - `test:` Tests
   - `refactor:` Code refactoring
   - `chore:` Maintenance

5. **Push and create PR**
   ```bash
   git push origin feature/my-feature
   ```

6. **PR Description**
   - Describe what changed
   - Why the change was needed
   - How to test it
   - Screenshots (if UI changes)

## Areas for Contribution

### High Priority

- [ ] Additional agent templates
- [ ] Improved error messages
- [ ] Better test coverage
- [ ] Performance optimizations
- [ ] Windows compatibility improvements

### Medium Priority

- [ ] Interactive mode for commands
- [ ] Configuration wizard
- [ ] Plugin system
- [ ] Shell completions
- [ ] Progress bars for long operations

### Documentation

- [ ] Video tutorials
- [ ] More examples
- [ ] API reference
- [ ] Troubleshooting guide
- [ ] Best practices guide

### Testing

- [ ] Integration tests
- [ ] E2E tests
- [ ] Performance tests
- [ ] Mock guardian nodes for testing

## Code Review Guidelines

When reviewing PRs:

- ✅ Code follows project style
- ✅ Tests are included
- ✅ Documentation is updated
- ✅ No breaking changes (or clearly documented)
- ✅ Error handling is proper
- ✅ Performance is acceptable

## Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Create git tag: `git tag v0.2.0`
4. Push tag: `git push --tags`
5. Publish to npm: `npm publish`

## Community

- **Discord**: [Join our community](https://discord.gg/guardmesh)
- **GitHub Discussions**: Ask questions, share ideas
- **Twitter**: [@guardmesh](https://twitter.com/guardmesh)

## Questions?

- Open an issue for bugs
- Use discussions for questions
- Join Discord for real-time help

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to GuardMesh! 🎉
