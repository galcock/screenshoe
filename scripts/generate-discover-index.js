#!/usr/bin/env node
/**
 * Generate discover-index.json for Screenshoe
 *
 * 1. Reads FK's people-slim.json + movies.json + tv.json (5,000 people)
 * 2. Fetches FULL CREW from TMDB movie credits for top-rated movies
 *    (cinematographers, editors, sound, art, costume, VFX, etc.)
 * 3. Also fetches TMDB popular people (500 pages) for additional coverage
 * 4. Builds a compact searchable index with genre associations, credit counts,
 *    and prominence scores.
 *
 * Output: ~3-5MB, loaded once on discover page
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

// TMDB job → department normalization
// TMDB uses granular job titles; we map to our department categories
function normalizeDepartment(dept) {
    if (!dept) return '';
    const d = dept.toLowerCase();
    if (d === 'acting') return 'Acting';
    if (d === 'directing') return 'Directing';
    if (d === 'writing') return 'Writing';
    if (d === 'production') return 'Production';
    if (d === 'sound') return 'Sound';
    if (d === 'camera') return 'Camera';
    if (d === 'art') return 'Art';
    if (d === 'editing') return 'Editing';
    if (d === 'visual effects') return 'Visual Effects';
    if (d === 'costume & make-up') return 'Costume & Make-Up';
    if (d === 'crew') return 'Crew';
    if (d === 'lighting') return 'Lighting';
    return dept; // keep original if not matched
}

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

    const entry = {
        i: p.id,
        n: p.name,
        p: p.profile_path || '',
        d: p.known_for_department || '',
        gn: p.gender || 0,
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
    if (!entry.gn) delete entry.gn; // save space
    return entry;
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

    const entry = {
        i: p.id,
        n: p.name,
        p: p.profile_path || '',
        d: p.known_for_department || '',
        gn: p.gender || 0,
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
    if (!entry.gn) delete entry.gn;
    return entry;
}

// Process a crew member extracted from movie credits
function processCrewMember(personData, crewCredits) {
    // crewCredits: array of { movieId, movieTitle, movieRating, department, job }
    const genreSet = new Set();
    const movieSet = new Set();
    crewCredits.forEach(c => {
        movieSet.add(c.movieId);
        (movieGenres[c.movieId] || []).forEach(g => genreSet.add(g));
    });

    // Best-rated movies for "known for"
    const sorted = [...crewCredits].sort((a, b) => (b.movieRating || 0) - (a.movieRating || 0));
    const seen = new Set();
    const knownFor = [];
    for (const c of sorted) {
        if (c.movieTitle && !seen.has(c.movieTitle)) {
            knownFor.push(c.movieTitle);
            seen.add(c.movieTitle);
            if (knownFor.length >= 3) break;
        }
    }

    const ratings = crewCredits.map(c => c.movieRating).filter(r => r && r > 0);
    const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : 0;

    const uniqueMovies = movieSet.size;
    const prominence = Math.round(uniqueMovies * (avgRating / 10) * 10) / 10;

    const entry = {
        i: personData.id,
        n: personData.name,
        p: personData.profile_path || '',
        d: normalizeDepartment(personData.department || crewCredits[0]?.department || ''),
        gn: personData.gender || 0,
        g: [...genreSet].filter(g => g in genreNames),
        k: knownFor,
        m: 'movie',
        mc: uniqueMovies,
        tc: 0,
        r: avgRating,
        s: prominence,
        b: personData.birthday || '',
        dd: personData.deathday || '',
    };
    if (!entry.gn) delete entry.gn;
    return entry;
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

async function fetchMovieCredits(movieId) {
    if (!TMDB_TOKEN) return null;
    const url = `https://api.themoviedb.org/3/movie/${movieId}/credits`;
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

// Rate-limited fetch helper — TMDB allows ~40 req/sec
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('Processing FK people...');
    const fkIndex = people.map(processFK);
    const seenIds = new Set(fkIndex.map(p => p.i));

    // Check department coverage
    const deptCounts = {};
    fkIndex.forEach(p => { deptCounts[p.d] = (deptCounts[p.d] || 0) + 1; });
    console.log('FK department coverage:', deptCounts);

    // ============================================================
    // PHASE 1: Fetch FULL CREW from top movies via TMDB credits API
    // This is the primary source for crew departments (Sound, Camera,
    // Art, Editing, VFX, Costume & Make-Up, etc.)
    // ============================================================

    // Sort movies by vote_average * vote_count to get most notable films
    const sortedMovies = [...movies]
        .filter(m => m.vote_count > 50) // Only movies with meaningful votes
        .sort((a, b) => {
            const scoreA = (a.vote_average || 0) * Math.log10((a.vote_count || 1) + 1);
            const scoreB = (b.vote_average || 0) * Math.log10((b.vote_count || 1) + 1);
            return scoreB - scoreA;
        });

    // Take top 2000 movies — each has ~20-80 crew members
    const moviesToFetch = sortedMovies.slice(0, 2000);
    console.log(`\nPHASE 1: Fetching full crew from top ${moviesToFetch.length} movies...`);

    // Collect crew members: personId → { id, name, profile_path, gender, department, credits: [...] }
    const crewMap = new Map();
    const CREW_DEPTS = new Set(['Sound', 'Camera', 'Art', 'Editing', 'Visual Effects', 'Costume & Make-Up', 'Crew', 'Lighting']);
    // Gender lookup: personId → gender (1=female, 2=male) — used to backfill FK people
    const genderLookup = new Map();

    if (TMDB_TOKEN) {
        const BATCH_SIZE = 35; // Stay under TMDB's ~40 req/sec limit
        let fetchedCount = 0;
        let crewFound = 0;

        for (let i = 0; i < moviesToFetch.length; i += BATCH_SIZE) {
            const batch = moviesToFetch.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch.map(m => fetchMovieCredits(m.id)));

            results.forEach((credits, idx) => {
                if (!credits) return;
                const movie = batch[idx];
                const movieRating = movie.vote_average || 0;

                // Process crew (not cast — cast is already well-covered)
                (credits.crew || []).forEach(crew => {
                    // Always capture gender for backfilling FK people
                    if (crew.gender) genderLookup.set(crew.id, crew.gender);
                    const dept = normalizeDepartment(crew.department);
                    if (!CREW_DEPTS.has(dept)) return; // Only collect underrepresented depts
                    if (seenIds.has(crew.id)) return; // Already in FK index

                    if (!crewMap.has(crew.id)) {
                        crewMap.set(crew.id, {
                            id: crew.id,
                            name: crew.name,
                            profile_path: crew.profile_path || '',
                            gender: crew.gender || 0,
                            department: dept,
                            credits: []
                        });
                    }
                    crewMap.get(crew.id).credits.push({
                        movieId: movie.id,
                        movieTitle: movie.title,
                        movieRating: movieRating,
                        department: dept,
                        job: crew.job
                    });
                });

                // Also collect cast we don't have yet
                (credits.cast || []).forEach(cast => {
                    // Always capture gender for backfilling FK people
                    if (cast.gender) genderLookup.set(cast.id, cast.gender);
                    if (seenIds.has(cast.id)) return;
                    if (!crewMap.has(cast.id)) {
                        crewMap.set(cast.id, {
                            id: cast.id,
                            name: cast.name,
                            profile_path: cast.profile_path || '',
                            gender: cast.gender || 0,
                            department: 'Acting',
                            credits: []
                        });
                    }
                    crewMap.get(cast.id).credits.push({
                        movieId: movie.id,
                        movieTitle: movie.title,
                        movieRating: movieRating,
                        department: 'Acting',
                        job: cast.character || 'Actor'
                    });
                });
            });

            fetchedCount += batch.length;
            const currentCrewCount = [...crewMap.values()].filter(c => CREW_DEPTS.has(c.department)).length;
            process.stdout.write(`\r  Movies: ${fetchedCount}/${moviesToFetch.length} | Crew found: ${currentCrewCount} | Total new: ${crewMap.size}`);

            // Small delay between batches to respect rate limits
            if (i + BATCH_SIZE < moviesToFetch.length) {
                await delay(1100); // ~1 second between batches
            }
        }
        console.log('');

        // Show crew department breakdown
        const crewDepts = {};
        crewMap.forEach(p => { crewDepts[p.department] = (crewDepts[p.department] || 0) + 1; });
        console.log('Crew from movie credits:', crewDepts);
    }

    // Convert crew members to index format
    // Filter: must have profile photo AND at least 2 credits
    const allCrewEntries = [];
    crewMap.forEach(person => {
        if (person.credits.length >= 2 && person.profile_path) {
            const entry = processCrewMember(person, person.credits);
            allCrewEntries.push(entry);
        }
    });
    console.log(`Crew with photos & 2+ credits: ${allCrewEntries.length}`);

    // Cap per department to keep file size manageable (~4MB target)
    // Keep top people by prominence per department
    const MAX_PER_DEPT = 1500;
    const crewByDept = {};
    allCrewEntries.forEach(p => {
        if (!crewByDept[p.d]) crewByDept[p.d] = [];
        crewByDept[p.d].push(p);
    });
    const crewIndex = [];
    Object.entries(crewByDept).forEach(([dept, people]) => {
        people.sort((a, b) => b.s - a.s); // Sort by prominence
        const kept = people.slice(0, MAX_PER_DEPT);
        crewIndex.push(...kept);
        console.log(`  ${dept}: ${people.length} total → keeping top ${kept.length}`);
    });
    crewIndex.forEach(p => seenIds.add(p.i));
    console.log(`Crew index entries (capped): ${crewIndex.length}`);

    // ============================================================
    // PHASE 2: TMDB Popular people (fills remaining gaps, mostly actors)
    // ============================================================

    let tmdbPeople = [];
    if (TMDB_TOKEN) {
        console.log('\nPHASE 2: Fetching TMDB popular people...');
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

            batchPeople.forEach(p => {
                if (!seenIds.has(p.id)) {
                    seenIds.add(p.id);
                    tmdbPeople.push(p);
                }
            });

            process.stdout.write(`\r  Pages ${start}-${end - 1}: ${tmdbPeople.length} new people found`);
        }
        console.log('');

        const tmdbDepts = {};
        tmdbPeople.forEach(p => { tmdbDepts[p.known_for_department || 'unknown'] = (tmdbDepts[p.known_for_department || 'unknown'] || 0) + 1; });
        console.log('TMDB popular department coverage:', tmdbDepts);
    } else {
        console.log('\nNo TMDB API key found — skipping TMDB enrichment.');
        console.log('Set TMDB_TOKEN env var or ensure api.js is accessible.');
    }

    // Also capture gender from TMDB popular people
    tmdbPeople.forEach(p => {
        if (p.gender) genderLookup.set(p.id, p.gender);
    });

    // Convert TMDB people to index format
    const tmdbIndex = tmdbPeople.map(processTMDB);

    // ============================================================
    // BACKFILL: Add gender to FK people from genderLookup
    // ============================================================
    let genderBackfilled = 0;
    fkIndex.forEach(p => {
        if (!p.gn && genderLookup.has(p.i)) {
            p.gn = genderLookup.get(p.i);
            genderBackfilled++;
        }
    });
    console.log(`\nGender backfilled for ${genderBackfilled}/${fkIndex.length} FK people (lookup has ${genderLookup.size} entries)`);

    // ============================================================
    // MERGE: FK people first (richest data), then movie crew, then TMDB popular extras
    // ============================================================
    const index = [...fkIndex, ...crewIndex, ...tmdbIndex];

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
    console.log(`People: ${index.length} (${fkIndex.length} FK + ${crewIndex.length} crew + ${tmdbIndex.length} TMDB popular)`);
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
