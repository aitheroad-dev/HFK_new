#!/bin/bash
set -a
source .env
set +a
cd apps/api
npx tsx src/index.ts
