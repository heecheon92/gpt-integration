#!/bin/sh

run_pnpm() {
    if command -v pnpm >/dev/null 2>&1; then
        pnpm "$@"
        return $?
    fi

    if [ -n "${PNPM_HOME:-}" ] && [ -x "$PNPM_HOME/pnpm" ]; then
        "$PNPM_HOME/pnpm" "$@"
        return $?
    fi

    if [ -x "$HOME/Library/pnpm/pnpm" ]; then
        "$HOME/Library/pnpm/pnpm" "$@"
        return $?
    fi

    if command -v corepack >/dev/null 2>&1; then
        corepack pnpm "$@"
        return $?
    fi

    echo "pnpm is not available in this hook environment."
    echo "Install pnpm or ensure corepack is available before committing."
    return 1
}
