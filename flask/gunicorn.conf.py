import os
import sys

# ── Bind ──────────────────────────────────────────────────────────────────────
bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"

# ── Workers / threads ─────────────────────────────────────────────────────────
# Each worker loads a ~310 MB model copy; 512 MB RAM only fits ONE.
workers = 1
threads = 4

# ── Timeouts ──────────────────────────────────────────────────────────────────
timeout = 120
graceful_timeout = 25       # Render sends SIGTERM → we have this long to finish

# ── Hooks ─────────────────────────────────────────────────────────────────────

def on_exit(server):
    """Flush dirty bandit state when gunicorn shuts down."""
    try:
        from app import _flush_bandit_on_shutdown
        _flush_bandit_on_shutdown()
    except Exception as e:
        print(f"[gunicorn on_exit] bandit flush error: {e}", file=sys.stderr)
