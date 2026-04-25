#!/bin/bash
# Load the user's bash environment to initialize fnm, pnpm, and PATH
# We use a non-interactive login-like approach
source /home/ai/.bashrc

# Navigate to the project root
cd /home/ai/ai-lab/paperclip

# Execute the server
# 'exec' ensures the node process takes over the PID, so signals like SIGTERM work correctly
exec node --import ./server/node_modules/tsx/dist/loader.mjs server/dist/index.js
