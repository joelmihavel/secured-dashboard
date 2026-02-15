#!/bin/bash
# BuildBot Maestro wrapper — sets JAVA_HOME and PATH for Maestro CLI
# Usage: ./scripts/maestro-run.sh [maestro args...]
# Example: ./scripts/maestro-run.sh test .maestro/buildbot/profile.yaml

export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:/Users/atrishabh/.maestro/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH

maestro "$@"
