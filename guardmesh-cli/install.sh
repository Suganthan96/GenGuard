#!/bin/bash

# GuardMesh CLI Installation Script

set -e

echo "🛡️  Installing GuardMesh CLI..."
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✓ Node.js $(node -v) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Build the project
echo ""
echo "🔨 Building project..."
npm run build

# Link globally
echo ""
echo "🔗 Linking CLI globally..."
npm link

# Verify installation
echo ""
echo "✅ Installation complete!"
echo ""
echo "Verify installation:"
echo "  guardmesh --version"
echo ""
echo "Get started:"
echo "  guardmesh init my-agent --template code-analyzer"
echo ""
echo "Documentation:"
echo "  README.md - CLI documentation"
echo "  FRAMEWORK_GUIDE.md - Framework guide"
echo "  examples/quickstart.md - Quick start guide"
echo ""
echo "Need help? Join our Discord: https://discord.gg/guardmesh"
