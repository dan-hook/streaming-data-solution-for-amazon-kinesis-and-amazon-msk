#!/usr/bin/env bash
set -e

if [[ -z "$HOST_UID" ]]; then
    echo "ERROR: please set HOST_UID" >&2
    exit 1
fi
if [[ -z "$HOST_GID" ]]; then
    echo "ERROR: please set HOST_GID" >&2
    exit 1
fi

# -OR-
# Use this code if you want to modify an existing user account:
sudo groupmod --gid "$HOST_GID" superchain
sudo usermod --uid "$HOST_UID" superchain

# Drop privileges and execute next container command, or 'bash' if not specified.
#if [[ $# -gt 0 ]]; then
#    exec sudo -u -H superchain -- "$@"
#else
#    exec sudo -u -H superchain -- bash
#fi