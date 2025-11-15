#!/bin/bash
exec "$(dirname "$0")/sipapp-dev" --no-sandbox --disable-dev-shm-usage "$@"
