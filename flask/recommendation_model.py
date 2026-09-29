import io

import numpy as np
import pandas as pd
import joblib
from rapidfuzz import process, fuzz

# ── Thompson Sampling Bandit (same class as train_model.py) ──────────────────
class ThompsonSamplingBandit:
    def __init__(self, n_movies):
        self.alpha    = np.ones(n_movies, dtype=np.float32)
        self.beta     = np.ones(n_movies, dtype=np.float32)
        self.n_movies = n_movies

    def rerank(self, movie_indices, hybrid_scores, explore_weight=0.15,
               *, rng=None):
        # Use a per-call Generator for thread safety (the global
        # np.random.* functions share state across threads).
        if rng is None:
            rng = np.random.default_rng()
        ts_samples  = rng.beta(
            self.alpha[movie_indices],
            self.beta[movie_indices]
        )
        ts_norm     = (ts_samples - ts_samples.min()) / (ts_samples.max() - ts_samples.min() + 1e-9)
        h_norm      = (hybrid_scores - hybrid_scores.min()) / (hybrid_scores.max() - hybrid_scores.min() + 1e-9)
        final       = (1 - explore_weight) * h_norm + explore_weight * ts_norm
        order       = np.argsort(final)[::-1]
        return movie_indices[order], final[order]

    def update(self, movie_idx, reward):
        if reward == 1:
            self.alpha[movie_idx] += 1
        else:
            self.beta[movie_idx]  += 1

    def save(self, path):
        joblib.dump({'alpha': self.alpha, 'beta': self.beta}, path)

    # ── Byte-level serialisation (for Neon BYTEA storage) ─────────────
    def to_bytes(self):
        """Serialise bandit state to bytes (joblib → BytesIO)."""
        buf = io.BytesIO()
        joblib.dump({'alpha': self.alpha, 'beta': self.beta}, buf)
        return buf.getvalue()

    @classmethod
    def load_from_bytes(cls, blob):
        """Deserialise bandit state from bytes."""
        buf    = io.BytesIO(blob)
        data   = joblib.load(buf)
        bandit = cls(len(data['alpha']))
        bandit.alpha = data['alpha']
        bandit.beta  = data['beta']
        return bandit

    @classmethod
    def load(cls, path):
        data         = joblib.load(path)
        bandit       = cls(len(data['alpha']))
        bandit.alpha = data['alpha']
        bandit.beta  = data['beta']
        return bandit


# ── Model loader ─────────────────────────────────────────────────────────────
class RecommendationModel:
    def __init__(self, models_dir='models'):
        print("Loading models...")
        self._load_models(models_dir)
        print("Models loaded ✅")

    def _load_models(self, models_dir):
        # SVD
        svd_data             = joblib.load(f'{models_dir}/svd_model.joblib')
        self.svd             = svd_data['svd']
        self.user_factors    = svd_data['user_factors']
        self.movie_factors   = svd_data['movie_factors']
        self.user_mean       = svd_data['user_mean']
        self.user_encoder    = svd_data['user_encoder']
        self.movie_encoder   = svd_data['movie_encoder']

        # TF-IDF
        tfidf_data           = joblib.load(f'{models_dir}/tfidf_model.joblib')
        self.tfidf           = tfidf_data['tfidf']
        self.tfidf_matrix    = tfidf_data['tfidf_matrix']

        # Movie mapper
        mapper_data          = joblib.load(f'{models_dir}/movie_mapper.joblib')
        self.movies          = mapper_data['movies']
        self.movie_id_to_idx = mapper_data['movie_id_to_idx']
        self.idx_to_movie_id = mapper_data['idx_to_movie_id']
        self.rated_movie_ids = mapper_data['rated_movie_ids']

        # Pre-compute search index (lowercase titles for vectorized matching)
        self.movies['_title_lower'] = self.movies['title'].str.lower()
        self._titles_list = self.movies['title'].tolist()

        # RL bandit
        self.bandit          = ThompsonSamplingBandit.load(f'{models_dir}/rl_bandit.joblib')
        self.models_dir      = models_dir

    # ── Internal helpers ──────────────────────────────────────────────────────
    def _cf_scores(self, user_idx):
        """Get collaborative filtering scores for all movies."""
        user_vector = self.user_factors[user_idx]
        cf_raw      = self.movie_factors.dot(user_vector)
        cf_norm     = (cf_raw - cf_raw.min()) / (cf_raw.max() - cf_raw.min() + 1e-9)

        all_cf = np.zeros(len(self.movies))
        for i, mid in enumerate(self.rated_movie_ids):
            if mid in self.movie_id_to_idx:
                all_cf[self.movie_id_to_idx[mid]] = cf_norm[i]
        return all_cf

    def _cb_scores(self, liked_movie_ids):
        """Get content-based scores based on liked movies."""
        liked_indices = [
            self.movie_id_to_idx[m]
            for m in liked_movie_ids
            if m in self.movie_id_to_idx
        ]
        if not liked_indices:
            return np.zeros(len(self.movies))

        from sklearn.metrics.pairwise import cosine_similarity
        user_profile = np.asarray(
            self.tfidf_matrix[liked_indices].mean(axis=0)
        ).flatten()
        cb_raw  = cosine_similarity(user_profile.reshape(1, -1), self.tfidf_matrix).flatten()
        cb_norm = (cb_raw - cb_raw.min()) / (cb_raw.max() - cb_raw.min() + 1e-9)
        return cb_norm

    def _apply_filters(self, scores, genre_filter=None, mood_filter=None):
        # Genre filter — hard filter, must match
        if genre_filter:
            def genre_matches(genres_str):
                if pd.isnull(genres_str):
                    return False
                return any(g.lower() in genres_str.lower() for g in genre_filter)
            genre_mask = self.movies['genres'].apply(genre_matches).values
            scores[~genre_mask] = -1

        # Mood filter — soft boost, doesn't exclude movies
        # Just boosts scores of matching movies by 20%
        if mood_filter:
            def mood_matches(genres_str):
                if pd.isnull(genres_str):
                    return False
                return any(g.lower() in genres_str.lower() for g in mood_filter)
            mood_mask = self.movies['genres'].apply(mood_matches).values
            scores[mood_mask] *= 1.2  # boost matching movies

        return scores

    def _popular_movies(self, genre_filter=None, top_n=10):
        """Popular movies based on rating count from rated_movie_ids."""
        # Use movies that actually have ratings — more reliable popularity signal
        rated_set    = set(self.rated_movie_ids)
        pop          = self.movies[self.movies['movieId'].isin(rated_set)].copy()

        if genre_filter:
            def matches(g):
                return any(f.lower() in str(g).lower() for f in genre_filter)
            pop = pop[pop['genres'].apply(matches)]

        # Sort by year as proxy for relevance, but prefer movies with ratings
        return (pop.sort_values('year', ascending=False)
                .head(top_n)
                [['movieId', 'title', 'genres', 'year', 'tmdbId', 'imdbId']]
                .assign(score=1.0, source='popular')
                .reset_index(drop=True)
                .to_dict('records'))

    # ── Public API ────────────────────────────────────────────────────────────
    def get_recommendations(
        self,
        user_id,
        top_n        = 10,
        cf_weight    = 0.6,
        cb_weight    = 0.4,
        genre_filter = None,
        mood_filter  = None,
        runtime_filter = None,
        content_type   = None,
        exclude_seen = True,
        seen_movie_ids = None
    ):
        """
        Main recommendation function.
        Returns list of dicts with movie info + scores.
        """
        # TODO: implement runtime_filter and content_type when runtime/type data available
        # Cold start
        if user_id not in self.user_encoder.classes_:
            return self._popular_movies(genre_filter, top_n)

        user_idx = self.user_encoder.transform([user_id])[0]

        # CF scores
        cf_scores = self._cf_scores(user_idx)

        # CB scores — based on top 10 liked movies
        liked_ids = (seen_movie_ids[:10] if seen_movie_ids
                     else list(self.rated_movie_ids[:10]))
        cb_scores = self._cb_scores(liked_ids)

        # Hybrid blend
        hybrid = (cf_weight * cf_scores) + (cb_weight * cb_scores)

        # Exclude seen
        if exclude_seen and seen_movie_ids:
            seen_indices = [
                self.movie_id_to_idx[m]
                for m in seen_movie_ids
                if m in self.movie_id_to_idx
            ]
            hybrid[seen_indices] = -1

        # Filters
        hybrid = self._apply_filters(hybrid, genre_filter, mood_filter)

        # RL reranking
        candidate_count   = min(top_n * 3, len(self.movies))
        top_candidate_idx = np.argsort(hybrid)[::-1][:candidate_count]
        top_candidate_idx = top_candidate_idx[hybrid[top_candidate_idx] > -1]

        if len(top_candidate_idx) == 0:
            return []

        reranked_idx, final_scores = self.bandit.rerank(
            top_candidate_idx,
            hybrid[top_candidate_idx]
        )

        # Build result
        final_idx      = reranked_idx[:top_n]
        result_movies  = self.movies.iloc[final_idx].copy()
        result_movies['score']  = final_scores[:top_n].round(4)
        result_movies['source'] = 'hybrid+rl'

        return result_movies[
            ['movieId', 'title', 'genres', 'year', 'tmdbId', 'imdbId', 'score', 'source']
        ].to_dict('records')

    def get_similar_movies(self, movie_id, top_n=10):
        """Content-based similar movies for a given movieId."""
        from sklearn.metrics.pairwise import cosine_similarity

        if movie_id not in self.movie_id_to_idx:
            return []

        idx        = self.movie_id_to_idx[movie_id]
        movie_vec  = self.tfidf_matrix[idx]
        scores     = cosine_similarity(movie_vec, self.tfidf_matrix).flatten()
        scores[idx] = -1  # exclude self

        top_idx    = np.argsort(scores)[::-1][:top_n]
        result     = self.movies.iloc[top_idx].copy()
        result['score']  = scores[top_idx].round(4)
        result['source'] = 'content'

        return result[
            ['movieId', 'title', 'genres', 'year', 'tmdbId', 'imdbId', 'score', 'source']
        ].to_dict('records')

    def search_movies(self, query, top_n=10):
        query_lower = query.lower().strip()
        if not query_lower:
            return []

        title_col = self.movies['_title_lower']
        title_len = self.movies['title'].str.len()
        q_len = len(query_lower)
        scored = pd.Series(np.zeros(len(self.movies)), index=self.movies.index)

        # Signal 1: Exact match → 100
        exact_mask = title_col == query_lower
        scored[exact_mask] = 100.0

        # Signal 2: Title starts with query → ~95
        remaining = ~exact_mask
        prefix_mask = remaining & title_col.str.startswith(query_lower)
        scored[prefix_mask] = 95.0 - np.minimum((title_len[prefix_mask] - q_len) * 0.15, 10.0)

        # Signal 3: Query contained anywhere in title → ~75
        remaining = remaining & ~prefix_mask
        contains_mask = remaining & title_col.str.contains(query_lower, regex=False, na=False)
        if contains_mask.any():
            positions = title_col[contains_mask].apply(lambda t: t.index(query_lower))
            scored[contains_mask] = 75.0 - np.minimum(positions * 0.5, 15.0)

        # Signal 3b: Multi-word — each query word matches a title word prefix → ~88
        #            Single word — matches start of any word in title → ~82
        query_words = query_lower.split()
        remaining = remaining & ~contains_mask
        if remaining.any():
            if len(query_words) > 1:
                # Multi-word: build regex pattern (?=.*\bword1)(?=.*\bword2)
                import re
                word_patterns = [re.escape(w) for w in query_words]
                # Each query word must be a prefix of some word in the title
                multi_mask = remaining.copy()
                for wp in word_patterns:
                    word_mask = title_col.str.contains(r'(?:^|\s)' + wp, regex=True, na=False)
                    multi_mask = multi_mask & word_mask
                scored[multi_mask] = 88.0 - np.minimum((title_len[multi_mask] - q_len) * 0.1, 10.0)
                remaining = remaining & ~multi_mask
            else:
                # Single query word matches start of any word
                word_start_mask = remaining & title_col.str.contains(
                    r'(?:^|\s)' + query_lower, regex=True, na=False
                )
                scored[word_start_mask] = 82.0 - np.minimum((title_len[word_start_mask] - q_len) * 0.1, 10.0)
                remaining = remaining & ~word_start_mask

        # Collect all deterministic hits (score > 0)
        hit_mask = scored > 0
        det_results = self.movies[hit_mask].copy()
        det_results['_score'] = scored[hit_mask]

        # Signal 4: Fuzzy fallback via rapidfuzz C-optimized extract
        # Only for SINGLE-WORD queries (typo tolerance: "incption" → "Inception")
        # Multi-word queries already have word-prefix matching; fuzzy just pollutes.
        fuzzy_results = pd.DataFrame()
        if len(query_words) == 1 and len(det_results) < top_n * 2:
            matches = process.extract(
                query_lower,
                self._titles_list,
                scorer=fuzz.WRatio,
                limit=top_n * 3,
                score_cutoff=75,
            )
            if matches:
                fuzzy_titles = {m[0]: m[1] * 0.65 for m in matches}  # scale down
                fuzz_mask = self.movies['title'].isin(fuzzy_titles.keys()) & ~hit_mask
                fuzzy_results = self.movies[fuzz_mask].copy()
                fuzzy_results['_score'] = fuzzy_results['title'].map(fuzzy_titles)

        # Combine deterministic + fuzzy, deduplicate
        combined = pd.concat([det_results, fuzzy_results], ignore_index=True)
        if combined.empty:
            return []

        combined['_score_norm'] = (combined['_score'] / 100.0).round(4)
        combined['_title_len'] = combined['title'].str.len()
        combined = combined.sort_values(['_score', '_title_len'], ascending=[False, True]).head(top_n)

        # Build output
        output = []
        for _, row in combined.iterrows():
            output.append({
                'movieId': int(row['movieId']),
                'title':   row['title'],
                'genres':  row['genres'],
                'year':    int(row['year']) if pd.notnull(row.get('year')) else None,
                'tmdbId':  int(row['tmdbId']) if pd.notnull(row.get('tmdbId')) else None,
                'imdbId':  int(row['imdbId']) if pd.notnull(row.get('imdbId')) else None,
                'score':   row['_score_norm'],
                'source':  'search',
            })
        return output

    def get_popular_movies(self, genre_filter=None, top_n=10):
        return self._popular_movies(genre_filter, top_n) 

    def update_bandit(self, movie_id, reward):
        """
        Update RL bandit from user feedback.
        reward = 1 (liked/clicked/watchlisted), 0 (skipped/disliked)
        """
        if movie_id not in self.movie_id_to_idx:
            return
        idx = self.movie_id_to_idx[movie_id]
        self.bandit.update(idx, reward)

    def save_bandit(self):
        """Persist updated bandit state to disk."""
        self.bandit.save(f'{self.models_dir}/rl_bandit.joblib')
        print("Bandit state saved ✅")