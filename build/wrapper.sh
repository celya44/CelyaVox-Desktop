#!/bin/bash
exec "$(dirname "$0")/celyavox-dev" --no-sandbox --disable-dev-shm-usage "$@"
