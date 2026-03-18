#!/usr/bin/env node
/**
 * Generate discover-index.json for Screenshoe
 *
 * 1. Reads FK's people-slim.json + movies.json + tv.json (5,000 people)
 * 2. Fetches additional people from TMDB popular endpoint (500 pages = 10,000 people)
 *    to fill underrepresented departments (Sound, Camera, Art, Editing, VFX, etc.)
 * 3. Builds a compact searchable index with genre associations, credit counts,
 *    and prominence scores.
 *
 * Output: ~1-2MB, loaded once on discover page
 */

const fs = require('fs');
const path = require('path');

const FK_DATA = path.join(__dirname, '../../fresh-kernels/data');
const OUT = path.join(__dirname, '../data/discover-index.json');

// TMDB Bearer token (read from Screenshoe's api.js)
const TMDB_TOKEN = process.env.TMDB_TOKEN || (() => {
    try {
        const apiJs = fs.readFileSync(path.join(__dirname, '../api.js'), 'utf8');
        const match = apiJs.match(/API_KEY:\s*'([^']+)'/);
        if (match) return match[1];
    } catch (e) {}
    return null;
})();

console.log('Loading FK data...');
const people = require(path.join(FK_DATA, 'people-slim.json')).people || require(path.join(FK_DATA, 'people-slim.json'));
const movies = require(path.join(FK_DATA, 'movies.json')).movies || require(path.join(FK_DATA, 'movies.json'));
const tvShows = require(path.join(FK_DATA, 'tv.json')).shows || require(path.join(FK_DATA, 'tv.json'));

console.log(`Loaded: ${people.length} people, ${movies.length} movies, ${tvShows.length} TV shows`);

// Build movie genre lookup: movieId → [genreId, ...]
const movieGenres = {};
movies.forEach(m => {
    movieGenres[m.id] = (m.genres || []).map(g => g.id);
});

// Build TV genre lookup
const tvGenres = {};
(Array.isArray(tvShows) ? tvShows : []).forEach(t => {
    tvGenres[t.id] = (t.genres || []).map(g => g.id);
});

// Build movie title lookup for "known for" display
const movieTitles = {};
movies.forEach(m => { movieTitles[m.id] = m.title; });
const tvTitles = {};
(Array.isArray(tvShows) ? tvShows : []).forEach(t => { tvTitles[t.id] = t.name || t.title; });

// Genre ID → name mapping
const genreNames = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
    80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
    14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
    9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie',
    53: 'Thriller', 10752: 'War', 37: 'Western',
    10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News',
    10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
    10767: 'Talk', 10768: 'War & Politics'
};

// Process FK people into index entries
function processFK(p) {
    const movieCredits = p.movie_credits || [];
    const tvCredits = p.tv_credits || [];

    const genreSet = new Set();
    movieCredits.forEach(c => {
        (movieGenres[c.id] || []).forEach(g => genreSet.add(g));
    });
    tvCredits.forEach(c => {
        (tvGenres[c.id] || []).forEach(g => genreSet.add(g));
    });

    const allCredits = [
        ...movieCredits.map(c => ({ rating: c.vote_average || 0, title: movieTitles[c.id] })),
        ...tvCredits.map(c => ({ rating: c.vote_average || 0, title: tvTitles[c.id] }))
    ].filter(c => c.title && c.rating > 0);
    allCredits.sort((a, b) => b.rating - a.rating);
    const knownFor = allCredits.slice(0, 3).map(c => c.title);

    const allRatings = [...movieCredits, ...tvCredits].map(c => c.vote_average).filter(r => r && r > 0);
    const avgRating = allRatings.length > 0
        ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
        : 0;

    const totalCredits = movieCredits.length + tvCredits.length;
    const prominence = Math.round(totalCredits * (avgRating / 10) * 10) / 10;

    const hasMovies = movieCredits.length > 0;
    const hasTV = tvCredits.length > 0;

    return {
        i: p.id,
        n: p.name,
        p: p.profile_path || '',
        d: p.known_for_department || '',
        g: [...genreSet].filter(g => g in genreNames),
        k: knownFor,
        m: hasMovies && hasTV ? 'both' : hasMovies ? 'movie' : 'tv',
        mc: movieCredits.length,
        tc: tvCredits.length,
        r: avgRating,
        s: prominence,
        b: p.birthday || '',
        dd: p.deathday || '',
    };
}

// Process TMDB popular person into index entry
function processTMDB(p) {
    const knownFor = (p.known_for || []).slice(0, 3).map(k => k.title || k.name).filter(Boolean);
    const genreSet = new Set();
    (p.known_for || []).forEach(k => {
        (k.genre_ids || []).forEach(g => genreSet.add(g));
    });
    const hasMovies = (p.known_for || []).some(k => k.media_type === 'movie');
    const hasTV = (p.known_for || []).some(k => k.media_type === 'tv');

    return {
        i: p.id,
        n: p.name,
        p: p.profile_path || '',
        d: p.known_for_department || '',
        g: [...genreSet].filter(g => g in genreNames),
        k: knownFor,
        m: hasMovies && hasTV ? 'both' : hasMovies ? 'movie' : 'tv',
        mc: 0,
        tc: 0,
        r: 0,
        s: Math.round(p.popularity || 0),
        b: '',
        dd: '',
    };
}

async function fetchTMDBPopular(page) {
    if (!TMDB_TOKEN) return [];
    const url = `https://api.themoviedb.org/3/person/popular?page=${page}`;
    try {
        const resp = await fetch(url, {
            headers: { 'Authorization': `Bearer ${TMDB_TOKEN}` }
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.results || [];
    } catch (e) {
        return [];
    }
}

async function fetchTMDBPersonDetails(id) {
    if (!TMDB_TOKEN) return null;
    const url = `https://api.themoviedb.org/3/person/${id}?append_to_response=movie_credits,tv_credits`;
    try {
        const resp = await fetch(url, {
            headers: { 'Authorization': `Bearer ${TMDB_TOKEN}` }
        });
        if (!resp.ok) return null;
        return await resp.json();
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log('Processing FK people...');
    const fkIndex = people.map(processFK);
    const seenIds = new Set(fkIndex.map(p => p.i));

    // Check department coverage
    const deptCounts = {};
    fkIndex.forEach(p => { deptCounts[p.d] = (deptCounts[p.d] || 0) + 1; });
    console.log('FK department coverage:', deptCounts);

    // Departments we want to fill
    const targetDepts = ['Sound', 'Camera', 'Art', 'Editing', 'Visual Effects', 'Lighting', 'Costume & Make-Up', 'Crew'];
    const needsMore = targetDepts.filter(d => (deptCounts[d] || 0) < 50);
    console.log('Departments needing more data:', needsMore);

    let tmdbPeople = [];
    if (TMDB_TOKEN && needsMore.length > 0) {
        console.log('Fetching TMDB popular people to fill gaps...');
        // Fetch 500 pages (10,000 people) in batches of 40 concurrent
        const TOTAL_PAGES = 500;
        const BATCH_SIZE = 40;

        for (let batch = 0; batch < Math.ceil(TOTAL_PAGES / BATCH_SIZE); batch++) {
            const start = batch * BATCH_SIZE + 1;
            const end = Math.min(start + BATCH_SIZE, TOTAL_PAGES + 1);
            const fetches = [];
            for (let i = start; i < end; i++) {
                fetches.push(fetchTMDBPopular(i));
            }
            const results = await Promise.all(fetches);
            const batchPeople = results.flat();

            // Only add people not already in FK index
            batchPeople.forEach(p => {
                if (!seenIds.has(p.id)) {
                    seenIds.add(p.id);
                    tmdbPeople.push(p);
                }
            });

            process.stdout.write(`\r  Pages ${start}-${end - 1}: ${tmdbPeople.length} new people found`);
        }
        console.log('');

        // Show what we got
        const tmdbDepts = {};
        tmdbPeople.forEach(p => { tmdbDepts[p.known_for_department || 'unknown'] = (tmdbDepts[p.known_for_department || 'unknown'] || 0) + 1; });
        console.log('TMDB department coverage:', tmdbDepts);
    } else if (!TMDB_TOKEN) {
        console.log('No TMDB API key found — skipping TMDB enrichment.');
        console.log('Set TMDB_API_KEY env var or ensure FK api.js is accessible.');
    }

    // Convert TMDB people to index format
    const tmdbIndex = tmdbPeople.map(processTMDB);

    // Merge: FK people first (richer data), then TMDB extras
    const index = [...fkIndex, ...tmdbIndex];

    // Sort by prominence score descending
    index.sort((a, b) => b.s - a.s);

    const output = {
        generated: new Date().toISOString(),
        count: index.length,
        genreNames,
        people: index
    };

    fs.writeFileSync(OUT, JSON.stringify(output));

    const sizeBytes = fs.statSync(OUT).size;
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    console.log(`\nGenerated: ${OUT}`);
    console.log(`People: ${index.length} (${fkIndex.length} FK + ${tmdbIndex.length} TMDB)`);
    console.log(`Size: ${sizeMB} MB`);
    console.log(`\nTop 10 by prominence:`);
    index.slice(0, 10).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.n} (${p.d}) — ${p.mc}M/${p.tc}T credits, ${p.r} avg, score: ${p.s}`);
    });

    // Full department distribution
    const deptDist = {};
    index.forEach(p => { deptDist[p.d] = (deptDist[p.d] || 0) + 1; });
    console.log('\nFinal department distribution:');
    Object.entries(deptDist).sort((a, b) => b[1] - a[1]).forEach(([dept, count]) => {
        console.log(`  ${dept}: ${count}`);
    });

    // Genre distribution
    const genreDist = {};
    index.forEach(p => p.g.forEach(g => { genreDist[genreNames[g]] = (genreDist[genreNames[g]] || 0) + 1; }));
    console.log('\nGenre coverage:');
    Object.entries(genreDist).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
        console.log(`  ${name}: ${count} people`);
    });
}

main().catch(e => {
    console.error('Error:', e);
    process.exit(1);
});
