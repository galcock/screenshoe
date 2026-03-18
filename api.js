/**
 * Screenshoe - TMDB API Wrapper
 * Handles people-focused API requests for the Hollywood professional network
 */

const API = {
    // TMDB API Configuration
    BASE_URL: 'https://api.themoviedb.org/3',
    IMAGE_BASE: 'https://image.tmdb.org/t/p',

    // Read-only API access token
    API_KEY: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxMTczOTZhNjk1Njk4MDVhNzkxMWJlZGYwZTBjYjRmNCIsIm5iZiI6MTczMzYzODgwMS4xOTEsInN1YiI6IjY3NTUzYTkxMTg3ZDI3YjI2NmEzYjVhOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.aQEXJUJNKMvrSYNpgoMjf0LC6DVqEvxxgnPVBQtb02w',

    // Image sizes
    POSTER_SIZES: {
        small: '/w185',
        medium: '/w342',
        large: '/w500',
        original: '/original'
    },

    BACKDROP_SIZES: {
        small: '/w300',
        medium: '/w780',
        large: '/w1280',
        original: '/original'
    },

    PROFILE_SIZES: {
        small: '/w45',
        medium: '/w185',
        large: '/h632',
        original: '/original'
    },

    // Cache configuration
    _CACHE_PREFIX: 'ss_api_',
    _CACHE_TTL_DETAIL: 24 * 60 * 60 * 1000,   // 24 hours for person/movie/tv details
    _CACHE_TTL_LIST: 60 * 60 * 1000,            // 1 hour for searches, popular, trending

    // ============================================
    // Cache Management
    // ============================================

    /**
     * Generate a cache key from endpoint and params
     */
    _getCacheKey(endpoint, params = {}) {
        const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
        return this._CACHE_PREFIX + endpoint + (sorted ? '?' + sorted : '');
    },

    /**
     * Determine TTL based on endpoint type
     */
    _getTTL(endpoint) {
        // Detail endpoints get longer cache
        if (endpoint.match(/^\/(person|movie|tv)\/\d+/)) {
            return this._CACHE_TTL_DETAIL;
        }
        return this._CACHE_TTL_LIST;
    },

    /**
     * Get cached API response from localStorage, respecting TTL
     */
    _getCache(key, ttl) {
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw);
                const timestamp = parsed.t || 0;
                const data = parsed.d !== undefined ? parsed.d : parsed;

                // Check expiry
                if (Date.now() - timestamp < ttl) {
                    return data;
                }
                // Expired — remove it
                localStorage.removeItem(key);
            }
        } catch (e) {
            try { localStorage.removeItem(key); } catch (_) {}
        }
        return null;
    },

    /**
     * Store API response in localStorage with timestamp.
     * Evicts oldest entries if quota exceeded.
     */
    _setCache(key, data) {
        const entry = JSON.stringify({ d: data, t: Date.now() });
        try {
            localStorage.setItem(key, entry);
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                this._evictOldestCache(entry.length);
                try {
                    localStorage.setItem(key, entry);
                } catch (_) {
                    console.warn('[SS API Cache] Storage full, could not cache:', key);
                }
            }
        }
    },

    /**
     * Evict oldest cache entries to free space
     */
    _evictOldestCache(bytesNeeded) {
        const entries = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(this._CACHE_PREFIX)) {
                let ts = 0;
                try {
                    const parsed = JSON.parse(localStorage.getItem(k));
                    ts = parsed.t || 0;
                } catch (_) {}
                entries.push({ key: k, size: (localStorage.getItem(k) || '').length, ts });
            }
        }
        entries.sort((a, b) => a.ts - b.ts);
        let freed = 0;
        for (const entry of entries) {
            if (freed >= bytesNeeded) break;
            localStorage.removeItem(entry.key);
            freed += entry.size;
        }
    },

    /**
     * Clear all cached API responses
     */
    clearCache() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(this._CACHE_PREFIX)) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
        console.log(`[SS API Cache] Cleared ${keys.length} cached responses`);
        return keys.length;
    },

    /**
     * Get cache statistics
     */
    getCacheStats() {
        let count = 0, totalSize = 0, oldest = Infinity, newest = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(this._CACHE_PREFIX)) {
                count++;
                const raw = localStorage.getItem(k) || '';
                totalSize += raw.length;
                try {
                    const ts = JSON.parse(raw).t || 0;
                    if (ts < oldest) oldest = ts;
                    if (ts > newest) newest = ts;
                } catch (_) {}
            }
        }
        return {
            entries: count,
            sizeKB: (totalSize / 1024).toFixed(1),
            sizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            oldest: oldest < Infinity ? new Date(oldest).toLocaleString() : 'n/a',
            newest: newest > 0 ? new Date(newest).toLocaleString() : 'n/a'
        };
    },

    // ============================================
    // Core Request
    // ============================================

    /**
     * Make an API request to TMDB with TTL-based caching.
     *
     * Priority:
     *  1. localStorage cache (if not expired)
     *  2. TMDB API fetch (cached on success)
     */
    async request(endpoint, params = {}) {
        const cacheKey = this._getCacheKey(endpoint, params);
        const ttl = this._getTTL(endpoint);

        // Check cache
        const cached = this._getCache(cacheKey, ttl);
        if (cached) return cached;

        // Fetch from TMDB
        const url = new URL(`${this.BASE_URL}${endpoint}`);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value);
            }
        });

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${this.API_KEY}`
            }
        });

        if (!response.ok) {
            throw new Error(`TMDB API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        this._setCache(cacheKey, data);
        return data;
    },

    // ============================================
    // People
    // ============================================

    async searchPeople(query, page = 1) {
        return this.request('/search/person', {
            query,
            page,
            language: 'en-US',
            include_adult: false
        });
    },

    async getPersonDetails(id) {
        return this.request(`/person/${id}`, {
            language: 'en-US',
            append_to_response: 'movie_credits,tv_credits,external_ids,images'
        });
    },

    async getPopularPeople(page = 1) {
        return this.request('/person/popular', { page, language: 'en-US' });
    },

    async getPersonImages(id) {
        return this.request(`/person/${id}/images`);
    },

    // ============================================
    // Trending
    // ============================================

    async getTrending(mediaType = 'all', timeWindow = 'day') {
        return this.request(`/trending/${mediaType}/${timeWindow}`, { language: 'en-US' });
    },

    // ============================================
    // Movies & TV (for filmography links)
    // ============================================

    async getMovieDetails(id) {
        return this.request(`/movie/${id}`, {
            language: 'en-US',
            append_to_response: 'credits,videos'
        });
    },

    async getTVDetails(id) {
        return this.request(`/tv/${id}`, {
            language: 'en-US',
            append_to_response: 'credits,videos'
        });
    },

    // ============================================
    // Image URL Helpers
    // ============================================

    profileUrl(path, size = 'medium') {
        if (!path) return null;
        const sizeValue = this.PROFILE_SIZES[size] || this.PROFILE_SIZES.medium;
        return `${this.IMAGE_BASE}${sizeValue}${path}`;
    },

    posterUrl(path, size = 'medium') {
        if (!path) return null;
        const sizeValue = this.POSTER_SIZES[size] || this.POSTER_SIZES.medium;
        return `${this.IMAGE_BASE}${sizeValue}${path}`;
    },

    backdropUrl(path, size = 'medium') {
        if (!path) return null;
        const sizeValue = this.BACKDROP_SIZES[size] || this.BACKDROP_SIZES.medium;
        return `${this.IMAGE_BASE}${sizeValue}${path}`;
    },

    // ============================================
    // URL & Slug Helpers
    // ============================================

    /**
     * Generate a URL-safe slug from a name
     * e.g. "Robert De Niro" -> "robert-de-niro"
     */
    generateSlug(name) {
        if (!name) return '';
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
            .replace(/[^a-z0-9\s-]/g, '')     // remove non-alphanumeric
            .trim()
            .replace(/\s+/g, '-')             // spaces to hyphens
            .replace(/-+/g, '-');             // collapse multiple hyphens
    },

    /**
     * Get the canonical URL path for a person
     * e.g. { id: 6193, name: "Leonardo DiCaprio" } -> "/person/6193/leonardo-dicaprio"
     */
    getPersonUrl(person) {
        if (!person || !person.id) return '/';
        const slug = this.generateSlug(person.name);
        return slug ? `/person/${person.id}/${slug}` : `/person/${person.id}`;
    }
};

// Export for use in other modules
window.API = API;
