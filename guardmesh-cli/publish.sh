#!/bin/bash

# GuardMesh CLI npm Publishing Script

set -e

echo "🚀 GuardMesh CLI Publishing Script"
echo "=================================="
echo ""

# Check if logged in to npm
if ! npm whoami &> /dev/null; then
    echo "❌ Not logged in to npm"
    echo "Please run: npm login"
    exit 1
fi

echo "✓ Logged in as: $(npm whoami)"
echo ""

# Check if on main branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
    echo "⚠️  Warning: Not on main/master branch (current: $BRANCH)"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run build
echo "🔨 Building project..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✓ Build successful"
echo ""

# Test locally
echo "🧪 Testing locally..."
npm link

if ! guardmesh --version &> /dev/null; then
    echo "❌ CLI test failed"
    exit 1
fi

echo "✓ CLI works: $(guardmesh --version)"
echo ""

# Dry run
echo "📋 Dry run..."
npm publish --dry-run

echo ""
echo "Ready to publish!"
echo ""

# Confirm
read -p "Publish to npm? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

# Publish
echo ""
echo "📤 Publishing to npm..."
npm publish --access public

echo ""
echo "✅ Published successfully!"
echo ""
echo "Next steps:"
echo "  1. Test installation: npm install -g @guardmesh/cli"
echo "  2. Push to GitHub: git push && git push --tags"
echo "  3. Update documentation with npm install command"
echo "  4. Share on social media!"
echo ""
echo "Package URL: https://www.npmjs.com/package/@guardmesh/cli"
