# Contributing to Asystent

Thank you for your interest in contributing to Asystent! This document provides guidelines and instructions for contributing to the project.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Testing](#testing)
6. [Submitting Changes](#submitting-changes)
7. [Reporting Issues](#reporting-issues)
8. [Feature Requests](#feature-requests)

---

## Code of Conduct

### Our Pledge

We pledge to make participation in this project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Examples of behavior that contributes to creating a positive environment:**

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Examples of unacceptable behavior:**

- The use of sexualized language or imagery
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** or **yarn** or **bun**
- **Git**
- **Telegram account** (for testing)
- **Obsidian** (optional, but recommended for testing)

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork:**

```bash
git clone https://github.com/YOUR_USERNAME/asystent.git
cd asystent
```

3. **Add upstream remote:**

```bash
git remote add upstream https://github.com/ORIGINAL_OWNER/asystent.git
```

4. **Install dependencies:**

```bash
cd code
npm install
```

5. **Set up environment:**

```bash
# Copy example files
cp ../.env.example .env
cp .mcp.json.example .mcp.json

# Edit with your configuration
# Recommended: Use setup wizard
npx tsx ../setup.ts
```

---

## Development Workflow

### Branch Strategy

- **`main`** - Stable releases only
- **`develop`** - Development branch (default for PRs)
- **`feature/feature-name`** - New features
- **`fix/bug-description`** - Bug fixes
- **`docs/what-changed`** - Documentation updates

### Creating a Feature Branch

```bash
# Make sure you're on develop and up-to-date
git checkout develop
git pull upstream develop

# Create feature branch
git checkout -b feature/my-awesome-feature
```

### Making Changes

1. **Write code** following our [coding standards](#coding-standards)
2. **Test thoroughly** (see [Testing](#testing))
3. **Commit regularly** with clear messages:

```bash
git add .
git commit -m "feat: add screenshot compression"
```

4. **Keep branch updated:**

```bash
git fetch upstream
git rebase upstream/develop
```

### Commit Message Format

We follow **Conventional Commits**:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style (formatting, no logic change)
- `refactor:` - Code restructuring (no behavior change)
- `perf:` - Performance improvement
- `test:` - Adding/updating tests
- `chore:` - Build process, dependencies, etc.

**Examples:**

```bash
feat(bot): add support for video messages

- Implement video download and processing
- Add video transcription via Whisper
- Update handlers to support video mime types

Closes #123
```

```bash
fix(claude): handle subprocess spawn errors gracefully

Previously, if claude-code CLI was not found, the bot would crash.
Now we catch the error and reply with a helpful message.

Fixes #456
```

---

## Coding Standards

### TypeScript

- **Strict mode enabled** - No `any` types without good reason
- **Explicit return types** on public functions
- **Async/await** preferred over promises chains
- **Error handling** - Always catch and handle errors

**Example:**

```typescript
// ✅ Good
async function transcribe(filePath: string): Promise<string> {
  try {
    const result = await whisperClient.transcribe(filePath);
    return result.text;
  } catch (error) {
    logger.error('transcribe', 'Transcription failed', error);
    throw new Error('Failed to transcribe audio');
  }
}

// ❌ Bad
async function transcribe(filePath) {
  const result = await whisperClient.transcribe(filePath);
  return result.text;  // No error handling
}
```

### Naming Conventions

- **Variables/Functions**: `camelCase`
- **Classes/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Private members**: `_prefixUnderscore` (if using classes)

```typescript
const MAX_RETRIES = 3;

interface SessionData {
  id: string;
  timestamp: Date;
}

class ClaudeClient {
  private _sessionId?: string;

  async askStream(prompt: string): Promise<ClaudeResponse> {
    // ...
  }
}
```

### File Organization

```
code/src/
├── index.ts           # Entry point
├── bot.ts             # Grammy bot logic
├── claude.ts          # Claude subprocess wrapper
├── config.ts          # Configuration & env vars
├── logger.ts          # Logging utility
├── transcribe.ts      # Whisper client
├── trigger.ts         # Scheduled task entry
└── types.ts           # Shared TypeScript types
```

### Comments

- **Why, not what** - Code should be self-documenting
- **Complex logic** - Add explanatory comments
- **TODOs** - Use `// TODO: description` format

```typescript
// ✅ Good
// Debounce edits to avoid Telegram rate limits (max ~20/min)
const EDIT_DEBOUNCE_MS = 800;

// ❌ Bad
// Set variable to 800
const EDIT_DEBOUNCE_MS = 800;
```

### Logging

Use the centralized logger:

```typescript
import { logger } from './logger';

// Log levels: debug, info, warn, error
logger.debug('module-name', 'Detailed debug info', { data });
logger.info('module-name', 'General information');
logger.warn('module-name', 'Warning message');
logger.error('module-name', 'Error occurred', error);
```

**When to log:**

- **INFO**: Important state changes (session created, task scheduled)
- **DEBUG**: Detailed flow (tool calls, stream events)
- **WARN**: Recoverable errors (retry logic)
- **ERROR**: Failures (exceptions, unrecoverable errors)

---

## Testing

### Manual Testing

**Required before submitting PR:**

1. **Basic flow:**
   - Send text message → verify response
   - Send voice message → verify transcription
   - Send photo → verify recognition

2. **Commands:**
   - `/start` → authentication works
   - `/notatka <text>` → note created in vault
   - `/szukaj <query>` → search returns results
   - `/new` → new session starts
   - `/rewind` → session history shown

3. **Edge cases:**
   - Very long messages (>4096 chars) → split correctly
   - Rapid-fire messages → queued properly
   - Session resume after timeout → fallback to new

4. **Optional features** (if enabled):
   - Voice transcription (Whisper)
   - Screenshots
   - Scheduled tasks

### Testing Checklist

```markdown
- [ ] Code runs without errors
- [ ] No TypeScript compilation errors
- [ ] Logging output is clear and useful
- [ ] Error handling gracefully degrades
- [ ] Memory leaks checked (for long-running changes)
- [ ] Works on Windows (if applicable)
- [ ] Works on macOS/Linux (if applicable)
- [ ] Documentation updated (if behavior changed)
```

### Test Environment

**Recommended setup:**

- Separate test Telegram bot (don't use production bot)
- Test Obsidian vault (not your personal vault)
- Set `LOG_LEVEL=0` (DEBUG) for detailed logs

```bash
# Test bot in dev mode
cd code
LOG_LEVEL=0 npm run dev
```

---

## Submitting Changes

### Pull Request Process

1. **Update documentation** if you changed behavior
2. **Test thoroughly** (see [Testing](#testing))
3. **Update CHANGELOG** (if applicable)
4. **Push your branch:**

```bash
git push origin feature/my-awesome-feature
```

5. **Open Pull Request** on GitHub:
   - Base: `develop` (not `main`!)
   - Title: Clear, descriptive (use conventional commit format)
   - Description: What, why, how (see template below)

### PR Template

```markdown
## Description

Brief description of what this PR does.

## Motivation

Why is this change needed? What problem does it solve?

## Changes

- List of changes
- Another change
- etc.

## Testing

How did you test this? What scenarios did you cover?

## Screenshots (if applicable)

Add screenshots for UI/UX changes.

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Manual testing completed
- [ ] No new warnings or errors
```

### Review Process

1. **Automated checks** - GitHub Actions (if configured)
2. **Code review** - Maintainer will review your code
3. **Feedback** - Address comments, make changes if needed
4. **Approval** - Once approved, maintainer will merge

**Be patient!** Maintainers may take a few days to review. Feel free to ping after 7 days.

---

## Reporting Issues

### Before Reporting

1. **Search existing issues** - Maybe it's already reported
2. **Check documentation** - Maybe it's expected behavior
3. **Try latest version** - Maybe it's already fixed

### Issue Template

```markdown
## Bug Description

Clear description of the bug.

## Steps to Reproduce

1. Do this
2. Then do that
3. See error

## Expected Behavior

What should happen.

## Actual Behavior

What actually happens.

## Environment

- OS: Windows 11 / macOS 14 / Ubuntu 22.04
- Node.js version: `node --version`
- Asystent version: (commit hash or tag)
- Telegram client: Mobile / Desktop / Web

## Logs

```
Paste relevant logs from bot.log
Use LOG_LEVEL=0 for detailed logs
```

## Additional Context

Any other information (screenshots, config, etc.)
```

### Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to docs
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `question` - Further information requested

---

## Feature Requests

### Suggesting Features

We welcome feature ideas! When suggesting:

1. **Check existing issues** - Maybe it's already proposed
2. **Describe the problem** - What pain point does this solve?
3. **Propose solution** - How would you implement it?
4. **Consider alternatives** - Are there other ways to solve this?

### Feature Request Template

```markdown
## Feature Description

What feature do you want added?

## Problem It Solves

What problem or pain point does this address?

## Proposed Solution

How would you implement this? (pseudocode, mockups, etc.)

## Alternatives Considered

What other approaches could work?

## Additional Context

Any other information (examples from other projects, etc.)
```

---

## Community

### Communication Channels

- **GitHub Issues** - Bug reports, feature requests
- **GitHub Discussions** - General questions, ideas
- **Pull Requests** - Code contributions

### Getting Help

**Stuck? Need help?**

1. Read the docs: [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md)
2. Search existing issues/discussions
3. Ask in GitHub Discussions
4. Open an issue with `question` label

**We're here to help!** Don't hesitate to ask.

---

## Recognition

Contributors will be:

- Listed in CONTRIBUTORS.md (if we add one)
- Credited in release notes
- Mentioned in project README (for significant contributions)

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for contributing to Asystent! 🎉

