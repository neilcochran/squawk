#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Cross-platform clean script
const packagesDir = path.join(__dirname, '..', 'packages');

try {
  const packages = fs.readdirSync(packagesDir);

  for (const pkg of packages) {
    const distDir = path.join(packagesDir, pkg, 'dist');
    if (fs.existsSync(distDir)) {
      console.log(`Removing ${distDir}`);
      fs.rmSync(distDir, { recursive: true, force: true });
    }
  }

  console.log('Clean complete');
} catch (error) {
  console.error('Clean failed:', error.message);
  process.exit(1);
}
