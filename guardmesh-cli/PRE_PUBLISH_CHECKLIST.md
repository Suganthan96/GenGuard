# Pre-Publish Checklist

Complete this checklist before publishing to npm.

## Account Setup
- [ ] npm account created at [npmjs.com](https://www.npmjs.com/signup)
- [ ] Email verified
- [ ] 2FA enabled (recommended)
- [ ] Logged in via CLI: `npm login`

## Package Configuration
- [ ] Package name chosen and available
- [ ] GitHub repository URL updated in package.json
- [ ] Author information updated
- [ ] Keywords added
- [ ] License file present (LICENSE)
- [ ] README.md is complete

## Code Quality
- [ ] All dependencies installed: `npm install`
- [ ] TypeScript compiles: `npm run build`
- [ ] No TypeScript errors
- [ ] Shebang present in cli.ts: `#!/usr/bin/env node`
- [ ] dist/ folder created successfully

## Testing
- [ ] CLI links locally: `npm link`
- [ ] Version command works: `guardmesh --version`
- [ ] Init command works: `guardmesh init test --template custom`
- [ ] Help text displays: `guardmesh --help`
- [ ] All commands tested

## Documentation
- [ ] README.md has installation instructions
- [ ] Examples are working
- [ ] Quick start guide is accurate
- [ ] API documentation is complete

## Git
- [ ] All changes committed
- [ ] Repository pushed to GitHub
- [ ] Repository is public
- [ ] .gitignore configured

## Final Checks
- [ ] Dry run successful: `npm publish --dry-run`
- [ ] Package size reasonable (< 5MB)
- [ ] No sensitive data in package
- [ ] Version number is correct

## Publish
- [ ] Run: `npm publish --access public`
- [ ] Verify on npmjs.com
- [ ] Test installation: `npm install -g @guardmesh/cli`
- [ ] Push git tags: `git push --tags`

## Post-Publish
- [ ] Update README with npm badge
- [ ] Update hackathon submission
- [ ] Share on social media
- [ ] Announce in Discord

---

**Ready to publish?** Run: `./publish.sh` or `npm publish --access public`
