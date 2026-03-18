#!/usr/bin/env node
/**
 * Generate discover-index.json for Screenshoe
 *
 * Reads FK's people-slim.json + movies.json + tv.json to build a compact
 * searchable index of 5,000 people with genre associations, credit counts,
 * and prominence scores.
 *
 * Output: ~500KB gzipped, loaded once on discover page
 */

const fs = require('fs');
const path = require('path');

const FK_DATA = path.join(__dirname, '../../fresh-kernels/data');
const OUT = path.join(__dirname, '../data/discover-index.json');

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
    // TV-specific genres
    10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News',
    10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
    10767: 'Talk', 10768: 'War & Politics'
};

console.log('Processing people...');

const index = people.map(p => {
    const movieCredits = p.movie_credits || [];
    const tvCredits = p.tv_credits || [];

    // Collect genres from all credits
    const genreSet = new Set();
    movieCredits.forEach(c => {
        const genres = movieGenres[c.id] || [];
        genres.forEach(g => genreSet.add(g));
    });
    tvCredits.forEach(c => {
        const genres = tvGenres[c.id] || [];
        genres.forEach(g => genreSet.add(g));
    });

    // Top 3 highest-rated works for "known for" display
    const allCredits = [
        ...movieCredits.map(c => ({ id: c.id, type: 'movie', rating: c.vote_average || 0, title: movieTitles[c.id] })),
        ...tvCredits.map(c => ({ id: c.id, type: 'tv', rating: c.vote_average || 0, title: tvTitles[c.id] }))
    ].filter(c => c.title && c.rating > 0);
    allCredits.sort((a, b) => b.rating - a.rating);
    const knownFor = allCredits.slice(0, 3).map(c => c.title);

    // Avg rating across all credits
    const allRatings = [
        ...movieCredits.map(c => c.vote_average),
        ...tvCredits.map(c => c.vote_average)
    ].filter(r => r && r > 0);
    const avgRating = allRatings.length > 0
        ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
        : 0;

    // Prominence score: weighted combination of credit count + avg rating
    const totalCredits = movieCredits.length + tvCredits.length;
    const prominence = Math.round(totalCredits * (avgRating / 10) * 10) / 10;

    // Media type: movie, tv, or both
    const hasMovies = movieCredits.length > 0;
    const hasTV = tvCredits.length > 0;
    const media = hasMovies && hasTV ? 'both' : hasMovies ? 'movie' : 'tv';

    return {
        i: p.id,                                    // id
        n: p.name,                                   // name
        p: p.profile_path || '',                     // profile photo
        d: p.known_for_department || '',             // department
        g: [...genreSet].filter(g => g in genreNames), // genre IDs
        k: knownFor,                                 // known for titles
        m: media,                                    // media type
        mc: movieCredits.length,                     // movie credit count
        tc: tvCredits.length,                        // tv credit count
        r: avgRating,                                // avg rating
        s: prominence,                               // prominence score
        b: p.birthday || '',                         // birthday
        dd: p.deathday || '',                        // deathday
    };
});

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
console.log(`People: ${index.length}`);
console.log(`Size: ${sizeMB} MB`);
console.log(`Top 10 by prominence:`);
index.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.n} (${p.d}) — ${p.mc}M/${p.tc}T credits, ${p.r} avg, score: ${p.s}`);
});

// Genre distribution
const genreDist = {};
index.forEach(p => p.g.forEach(g => { genreDist[genreNames[g]] = (genreDist[genreNames[g]] || 0) + 1; }));
console.log('\nGenre coverage:');
Object.entries(genreDist).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    console.log(`  ${name}: ${count} people`);
});

// Department distribution
const deptDist = {};
index.forEach(p => { deptDist[p.d] = (deptDist[p.d] || 0) + 1; });
console.log('\nDepartment distribution:');
Object.entries(deptDist).sort((a, b) => b[1] - a[1]).forEach(([dept, count]) => {
    console.log(`  ${dept}: ${count}`);
});
