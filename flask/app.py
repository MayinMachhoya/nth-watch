from flask import Flask, request, jsonify
from recommendation_model import RecommendationModel, ThompsonSamplingBandit
import os
import hmac
import logging
import atexit
import signal
import threading
import time

from dotenv import load_dotenv

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
)
log = logging.getLogger(__name__)

app = Flask(__name__)

# ── Shared-secret auth: only the Node backend may call this service ──────────
INTERNAL_API_KEY = os.getenv('INTERNAL_API_KEY')
if not INTERNAL_API_KEY:
    raise RuntimeError('INTERNAL_API_KEY is not set')

@app.before_request
def require_internal_key():
    if request.path == '/health':
        return None
    provided = request.headers.get('X-Internal-Key', '')
    if not hmac.compare_digest(provided.encode(), INTERNAL_API_KEY.encode()):
        return jsonify({'error': 'Unauthorized'}), 401

# ── Load model once at startup ────────────────────────────────────────────────
log.info("Initializing recommendation model...")
model = RecommendationModel(models_dir='models')
log.info("Models loaded")

# ══════════════════════════════════════════════════════════════════════════════
# Bandit persistence — Neon Postgres
#
# NOTE: This design assumes a single instance (last writer wins).
# With multiple workers/instances, the last flush overwrites all others.
# ══════════════════════════════════════════════════════════════════════════════

DATABASE_URL         = os.getenv('DATABASE_URL')
BANDIT_STATE_ID      = os.getenv('BANDIT_STATE_ID', 'rl_bandit')
BANDIT_SAVE_INTERVAL = int(os.getenv('BANDIT_SAVE_INTERVAL_S', '30'))

_bandit_lock       = threading.Lock()   # protects bandit state + dirty flags
_bandit_dirty      = False
_bandit_updates    = 0
_bandit_last_save  = time.monotonic()
_bandit_read_only  = False              # True when DB is completely unavailable
_shutdown_started  = False

# ── Postgres helpers (short-lived connections) ────────────────────────────────

def _get_db_connection():
    """Open a short-lived Postgres connection. Returns None on failure."""
    if not DATABASE_URL:
        return None
    try:
        import psycopg2
        conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
        return conn
    except Exception as e:
        log.warning("DB connect failed: %s", e)
        return None


def _ensure_bandit_table():
    """Create the bandit_state table if it doesn't exist."""
    conn = _get_db_connection()
    if conn is None:
        return False
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS bandit_state (
                        id         TEXT        PRIMARY KEY,
                        blob       BYTEA       NOT NULL,
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                """)
        return True
    except Exception as e:
        log.warning("Failed to create bandit_state table: %s", e)
        return False
    finally:
        conn.close()


def _load_bandit_from_db():
    """Try to load bandit state from Neon. Returns a ThompsonSamplingBandit or None."""
    conn = _get_db_connection()
    if conn is None:
        return None
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT blob FROM bandit_state WHERE id = %s",
                    (BANDIT_STATE_ID,),
                )
                row = cur.fetchone()
                if row is None:
                    log.info("No bandit row '%s' in DB — will use seed file", BANDIT_STATE_ID)
                    return None
                return ThompsonSamplingBandit.load_from_bytes(bytes(row[0]))
    except Exception as e:
        log.warning("Failed to load bandit from DB: %s", e)
        return None
    finally:
        conn.close()


def _persist_bandit():
    """Upsert bandit state to Neon. Returns True on success."""
    global _bandit_dirty, _bandit_updates, _bandit_last_save

    if _bandit_read_only or not DATABASE_URL:
        return False

    # Serialise under lock (fast — in-memory copy)
    with _bandit_lock:
        blob = model.bandit.to_bytes()

    conn = _get_db_connection()
    if conn is None:
        log.warning("Bandit persist skipped — DB unreachable (will retry)")
        return False
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO bandit_state (id, blob, updated_at)
                    VALUES (%s, %s, now())
                    ON CONFLICT (id) DO UPDATE
                        SET blob = EXCLUDED.blob,
                            updated_at = EXCLUDED.updated_at
                """, (BANDIT_STATE_ID, blob))
        # Success — clear dirty state
        with _bandit_lock:
            _bandit_dirty     = False
            _bandit_updates   = 0
            _bandit_last_save = time.monotonic()
        log.info("Bandit state persisted to DB (id=%s)", BANDIT_STATE_ID)
        return True
    except Exception as e:
        log.warning("Bandit persist failed (will retry): %s", e)
        return False
    finally:
        conn.close()


def _should_persist():
    """Check if it's time to flush based on interval or update count."""
    if not _bandit_dirty:
        return False
    elapsed = time.monotonic() - _bandit_last_save
    return elapsed >= BANDIT_SAVE_INTERVAL or _bandit_updates >= 25


# ── Boot: load bandit from DB, fallback to seed file ─────────────────────────

if DATABASE_URL:
    _ensure_bandit_table()
    db_bandit = _load_bandit_from_db()
    if db_bandit is not None:
        model.bandit = db_bandit
        log.info("Bandit loaded from DB (id=%s)", BANDIT_STATE_ID)
    else:
        # Seed from the shipped joblib file (read-only seed)
        log.warning(
            "Using shipped models/rl_bandit.joblib as seed — "
            "bandit will be persisted to DB on first feedback"
        )
        # _bandit_read_only stays False — we can still write to DB
else:
    _bandit_read_only = True
    log.warning(
        "DATABASE_URL not set — bandit runs in-memory only; "
        "state will NOT survive a restart"
    )


# ── Background flush thread ──────────────────────────────────────────────────

def _bandit_flush_loop():
    """Periodically flush dirty bandit state to the database."""
    while not _shutdown_started:
        time.sleep(BANDIT_SAVE_INTERVAL)
        if _shutdown_started:
            break
        if _should_persist():
            _persist_bandit()

_flush_thread = threading.Thread(target=_bandit_flush_loop, daemon=True)
_flush_thread.start()


# ── Shutdown hook ─────────────────────────────────────────────────────────────

def _flush_bandit_on_shutdown():
    """Best-effort flush on SIGTERM / atexit. Must complete within ~8 s."""
    global _shutdown_started
    _shutdown_started = True
    if _bandit_dirty and not _bandit_read_only:
        log.info("Shutdown: flushing bandit state...")
        _persist_bandit()

atexit.register(_flush_bandit_on_shutdown)

# SIGTERM handler for gunicorn graceful shutdown (not available on Windows)
if hasattr(signal, 'SIGTERM'):
    _original_sigterm = signal.getsignal(signal.SIGTERM)

    def _sigterm_handler(signum, frame):
        _flush_bandit_on_shutdown()
        # Re-raise to let gunicorn finish gracefully
        if callable(_original_sigterm) and _original_sigterm not in (
            signal.SIG_DFL, signal.SIG_IGN,
        ):
            _original_sigterm(signum, frame)

    signal.signal(signal.SIGTERM, _sigterm_handler)


log.info("Flask ready")


# ── Health check ──────────────────────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200


# ── Get recommendations ───────────────────────────────────────────────────────
@app.route('/recommendations', methods=['POST'])
def recommendations():
    """
    POST /recommendations
    Body: {
        "user_id": 1,
        "top_n": 10,
        "genre_filter": ["Action", "Comedy"],   // optional
        "mood_filter": ["Comedy"],               // optional
        "seen_movie_ids": [1, 2, 3],             // optional
        "cf_weight": 0.6,                        // optional
        "cb_weight": 0.4                         // optional
    }
    """
    try:
        data         = request.get_json()
        user_id      = data.get('user_id')
        top_n        = data.get('top_n', 10)
        genre_filter = data.get('genre_filter', None)
        mood_filter  = data.get('mood_filter', None)
        runtime_filter = data.get('runtime_filter', None)
        content_type = data.get('content_type', None)
        seen_ids     = data.get('seen_movie_ids', None)
        cf_weight    = data.get('cf_weight', 0.6)
        cb_weight    = data.get('cb_weight', 0.4)

        if user_id is None:
            return jsonify({'error': 'user_id is required'}), 400

        # Lock while reading bandit alpha/beta during reranking
        with _bandit_lock:
            recs = model.get_recommendations(
                user_id        = user_id,
                top_n          = top_n,
                cf_weight      = cf_weight,
                cb_weight      = cb_weight,
                genre_filter   = genre_filter,
                mood_filter    = mood_filter,
                runtime_filter = runtime_filter,
                content_type   = content_type,
                exclude_seen   = True,
                seen_movie_ids = seen_ids
            )

        return jsonify({'recommendations': recs}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Get similar movies ────────────────────────────────────────────────────────
@app.route('/similar/<int:movie_id>', methods=['GET'])
def similar_movies(movie_id):
    """
    GET /similar/1
    Query params: ?top_n=10
    """
    try:
        top_n = int(request.args.get('top_n', 10))
        recs  = model.get_similar_movies(movie_id=movie_id, top_n=top_n)

        if not recs:
            return jsonify({'error': 'Movie not found'}), 404

        return jsonify({'similar': recs}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Search movies ─────────────────────────────────────────────────────────────
@app.route('/search', methods=['GET'])
def search():
    """
    GET /search?q=toy+story&top_n=10
    """
    try:
        query = request.args.get('q', '').strip()
        top_n = int(request.args.get('top_n', 10))

        if not query:
            return jsonify({'error': 'q parameter is required'}), 400

        results = model.search_movies(query=query, top_n=top_n)
        return jsonify({'results': results}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Get popular movies ────────────────────────────────────────────────────────
@app.route('/popular', methods=['GET'])
def popular():
    """
    GET /popular?genre=Action&top_n=10
    """
    try:
        genre = request.args.get('genre', None)
        top_n = int(request.args.get('top_n', 10))

        genre_filter = [genre] if genre else None
        results      = model.get_popular_movies(genre_filter=genre_filter, top_n=top_n)

        return jsonify({'popular': results}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Update bandit from user feedback ─────────────────────────────────────────
@app.route('/feedback', methods=['POST'])
def feedback():
    try:
        data     = request.get_json()
        movie_id = data.get('movie_id')
        reward   = data.get('reward')

        if movie_id is None or reward is None:
            return jsonify({'error': 'movie_id and reward are required'}), 400

        if reward not in [0, 1]:
            return jsonify({'error': 'reward must be 0 or 1'}), 400

        global _bandit_dirty, _bandit_updates

        with _bandit_lock:
            model.update_bandit(movie_id=movie_id, reward=reward)
            _bandit_dirty   = True
            _bandit_updates += 1

        # Persist if threshold reached (outside the lock — _persist_bandit
        # acquires the lock only briefly to serialise).  Errors are logged
        # and never change this response; the dirty flag stays so the
        # background thread retries.
        if _should_persist():
            _persist_bandit()

        return jsonify({'status': 'updated'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)