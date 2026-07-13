#!/usr/bin/env bash
set -euo pipefail

# Firebase emulators require Java 21+. Prefer a Homebrew JDK when JAVA_HOME is unset.
if [[ -z "${JAVA_HOME:-}" ]]; then
  for candidate in \
    /opt/homebrew/opt/openjdk@23/libexec/openjdk.jdk/Contents/Home \
    /opt/homebrew/opt/openjdk@22/libexec/openjdk.jdk/Contents/Home \
    /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
    /usr/local/opt/openjdk@23/libexec/openjdk.jdk/Contents/Home \
    /usr/local/opt/openjdk@22/libexec/openjdk.jdk/Contents/Home \
    /usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home; do
    if [[ -d "$candidate" ]]; then
      export JAVA_HOME="$candidate"
      export PATH="$JAVA_HOME/bin:$PATH"
      break
    fi
  done
fi

exec npx firebase "$@"
