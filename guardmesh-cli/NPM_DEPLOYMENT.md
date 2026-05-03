# npm Deployment Guide for GuardMesh CLI

## Prerequisites

1. **npm account**: Create at [npmjs.com/signup](https://www.npmjs.com/signup)
2. **Email verified**: Check your email and verify
3. **2FA enabled** (recommended): Enable in account settings

## Step 1: Prepare Package

### Update package.json

Replace `yourusername` with your actual GitHub username:

```json
"repository": {
  "type": "git",
  "url": "https://github.com/YOURUSERNAME/guardmesh.git",
  "directory": "guardmesh-cli"
}
```

### Choose Package Name

**Option A: Scoped package** (recommended)
```json
"name": "@yourusername/guardmesh-cli"
```
Users install: `npm install -g @yourusername/guardmesh-cli`

**Option B: Unscoped package**
```json
"name": "guardmesh-cli"
```
Users install: `npm install -g guardmesh-cli`

**Note**: Check if name is available:
```bash
npm search guardmesh-cli
```

## Step 2: Build and Test

```bash
cd guardmesh-cli

# Install dependencies
npm install

# Build the project
npm run build

# Test locally
npm link

# Verify it works
guardmesh --version
guardmesh init test-project --template custom

# Clean up test
rm -rf test-project
```

## Step 3: Login to npm

```bash
npm login
```

Enter:
- **Username**: your npm username
- **Password**: your npm password
- **Email**: your email
- **OTP**: one-time password (if 2FA enabled)

Verify login:
```bash
npm whoami
```

## Step 4: Publish to npm

### First Time Publishing

```bash
# Dry run (see what will be published)
npm publish --dry-run

# Publish for real
npm publish --access public
```

**Note**: If using scoped package (@yourusername/...), you need `--access public` for free accounts.

### Expected Output

```
npm notice 
npm notice 📦  @guardmesh/cli@0.1.0
npm notice === Tarball Contents === 
npm notice 1.2kB  LICENSE
npm notice 15.3kB README.md
npm notice 234B   package.json
npm notice 45.2kB dist/cli.js
npm notice ...
npm notice === Tarball Details === 
npm notice name:          @guardmesh/cli
npm notice version:       0.1.0
npm notice package size:  125.4 kB
npm notice unpacked size: 456.7 kB
npm notice total files:   42
npm notice 
+ @guardmesh/cli@0.1.0
```

## Step 5: Verify Publication

```bash
# View on npm
npm view @guardmesh/cli

# Install globally to test
npm install -g @guardmesh/cli

# Test it works
guardmesh --version
```

Visit your package page:
```
https://www.npmjs.com/package/@guardmesh/cli
```

## Step 6: Update Documentation

Update installation instructions in:

**README.md**:
```markdown
## Installation

\`\`\`bash
npm install -g @guardmesh/cli
\`\`\`
```

**HACKATHON_SUBMISSION.md**:
```markdown
## Installation

\`\`\`bash
npm install -g @guardmesh/cli
guardmesh --version
\`\`\`
```

## Publishing Updates

### Version Bump

```bash
# Patch version (0.1.0 -> 0.1.1)
npm version patch

# Minor version (0.1.0 -> 0.2.0)
npm version minor

# Major version (0.1.0 -> 1.0.0)
npm version major
```

This automatically:
- Updates package.json version
- Creates a git commit
- Creates a git tag

### Publish Update

```bash
npm publish
```

### Push to GitHub

```bash
git push
git push --tags
```

## Troubleshooting

### Error: Package name already taken

**Solution**: Choose a different name or use scoped package:
```json
"name": "@yourusername/guardmesh-cli"
```

### Error: You must verify your email

**Solution**: 
1. Check your email
2. Click verification link
3. Try publishing again

### Error: You need a paid account for private packages

**Solution**: Add `--access public` flag:
```bash
npm publish --access public
```

### Error: 403 Forbidden

**Solution**: 
1. Check you're logged in: `npm whoami`
2. Check package name isn't taken
3. Check you have permission (for scoped packages)

### Error: ENEEDAUTH

**Solution**: Login again:
```bash
npm logout
npm login
```

## Best Practices

### 1. Use Semantic Versioning

- **Patch** (0.1.0 -> 0.1.1): Bug fixes
- **Minor** (0.1.0 -> 0.2.0): New features (backward compatible)
- **Major** (0.1.0 -> 1.0.0): Breaking changes

### 2. Test Before Publishing

```bash
# Always test locally first
npm run build
npm link
guardmesh --version

# Test in a fresh directory
cd /tmp
guardmesh init test-agent
cd test-agent
npm install
```

### 3. Use .npmignore

Create `.npmignore` to exclude files:
```
src/
tests/
*.test.ts
.env
.env.example
node_modules/
```

Or use `files` in package.json (already configured):
```json
"files": [
  "dist",
  "README.md",
  "LICENSE"
]
```

### 4. Add npm Badge

Add to README.md:
```markdown
[![npm version](https://badge.fury.io/js/%40guardmesh%2Fcli.svg)](https://www.npmjs.com/package/@guardmesh/cli)
[![npm downloads](https://img.shields.io/npm/dm/@guardmesh/cli.svg)](https://www.npmjs.com/package/@guardmesh/cli)
```

### 5. Automate with GitHub Actions

Create `.github/workflows/publish.yml`:
```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Quick Reference

```bash
# Login
npm login

# Check login
npm whoami

# Dry run
npm publish --dry-run

# Publish
npm publish --access public

# Update version
npm version patch

# View package
npm view @guardmesh/cli

# Install globally
npm install -g @guardmesh/cli

# Uninstall
npm uninstall -g @guardmesh/cli

# Unpublish (within 72 hours)
npm unpublish @guardmesh/cli@0.1.0
```

## After Publishing

1. ✅ Test installation: `npm install -g @guardmesh/cli`
2. ✅ Update README with npm install command
3. ✅ Share on Twitter/Discord
4. ✅ Add npm badge to README
5. ✅ Update hackathon submission with npm link

## Support

- **npm docs**: https://docs.npmjs.com/
- **npm support**: https://www.npmjs.com/support
- **Package page**: https://www.npmjs.com/package/@guardmesh/cli

---

**Congratulations on publishing to npm!** 🎉
