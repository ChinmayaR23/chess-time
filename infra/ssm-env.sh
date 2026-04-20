#!/bin/bash
# Fetches all secrets from SSM Parameter Store and writes to /etc/chesstime/env.
# Run before starting services. Requires IAM instance profile with ssm:GetParametersByPath.
set -e

aws ssm get-parameters-by-path \
  --path /chesstime/prod/ \
  --with-decryption \
  --region eu-north-1 \
  --output json \
| python3 -c "
import json, sys
params = json.load(sys.stdin)['Parameters']
for p in params:
    name = p['Name'].split('/')[-1]
    value = p['Value'].replace('\n', '\\\\n')
    print(f'{name}={value}')
" > /etc/chesstime/env

chmod 600 /etc/chesstime/env
