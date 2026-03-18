#!/usr/bin/env node

/**
 * Screenshoe — Sitemap Generator
 *
 * Fetches the top 500 popular people from TMDB API (pages 1-25)
 * and generates a sitemap.xml with entries for each person plus core pages.
 *
 * Usage: node scripts/generate-sitemap.js
 * Requires: Node 18+ (uses native fetch)
 */

const fs = require('fs');
const path = require('path');

// TMDB API bearer token (read-only)
const API_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxMTczOTZhNjk1Njk4MDVhNzkxMWJlZGYwZTBjYjRmNCIsIm5iZiI6MTczMzYzODgwMS4xOTEsInN1YiI6IjY3NTUzYTkxMTg3ZDI3YjI2NmEzYjVhOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.aQEXJUJNKMvrSYNpgoMjf0LC6DVqEvxxgnPVBQtb02w';
const BASE_URL = 'https://api.themoviedb.org/3';
const SITE_URL = 'https://screenshoe.com';
const TOTAL_PAGES = 25; // 20 results per page = 500 people

/**
 * Generate a URL-safe slug from a name.
 * Same logic as api.js: lowercase, normalize diacritics, remove special chars.
 */
function generateSlug(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
        .replace(/[^a-z0-9\s-]/g, '')     // remove non-alphanumeric
        .trim()
        .replace(/\s+/g, '-')             // spaces to hyphens
        .replace(/-+/g, '-');             // collapse multiple hyphens
}

/**
 * Fetch a single page of popular people from TMDB.
 */
async function fetchPopularPeople(page) {
    const url = `${BASE_URL}/person/popular?page=${page}&language=en-US`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`
        }
    });

    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status} ${response.statusText} (page ${page})`);
    }

    return response.json();
}

/**
 * Escape XML special characters.
 */
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Main: fetch all pages and generate sitemap.xml
 */
async function main() {
    console.log(`Fetching top ${TOTAL_PAGES * 20} popular people from TMDB...`);

    const allPeople = [];

    for (let page = 1; page <= TOTAL_PAGES; page++) {
        try {
            const data = await fetchPopularPeople(page);
            const results = data.results || [];
            allPeople.push(...results);
            console.log(`  Page ${page}/${TOTAL_PAGES}: ${results.length} people (total: ${allPeople.length})`);

            // Small delay to avoid rate limiting
            if (page < TOTAL_PAGES) {
                await new Promise(resolve => setTimeout(resolve, 250));
            }
        } catch (err) {
            console.error(`  Error on page ${page}: ${err.message}`);
        }
    }

    console.log(`\nFetched ${allPeople.length} people total.`);

    // Deduplicate by ID
    const seen = new Set();
    const uniquePeople = [];
    for (const person of allPeople) {
        if (!seen.has(person.id)) {
            seen.add(person.id);
            uniquePeople.push(person);
        }
    }
    console.log(`After deduplication: ${uniquePeople.length} unique people.`);

    // Build sitemap XML
    const today = new Date().toISOString().split('T')[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Core pages
    const corePages = [
        { loc: '/', changefreq: 'daily', priority: '1.0' },
        { loc: '/discover', changefreq: 'daily', priority: '0.9' },
        { loc: '/discover/acting', changefreq: 'weekly', priority: '0.8' },
        { loc: '/discover/directing', changefreq: 'weekly', priority: '0.8' },
        { loc: '/discover/writing', changefreq: 'weekly', priority: '0.8' },
        { loc: '/discover/production', changefreq: 'weekly', priority: '0.8' },
        { loc: '/feed', changefreq: 'hourly', priority: '0.7' },
        { loc: '/about', changefreq: 'monthly', priority: '0.6' },
    ];

    for (const page of corePages) {
        xml += `  <url>\n`;
        xml += `    <loc>${SITE_URL}${page.loc}</loc>\n`;
        xml += `    <lastmod>${today}</lastmod>\n`;
        xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
        xml += `    <priority>${page.priority}</priority>\n`;
        xml += `  </url>\n`;
    }

    // Person pages
    for (const person of uniquePeople) {
        const slug = generateSlug(person.name);
        if (!slug) continue;
        const loc = `${SITE_URL}/person/${person.id}/${escapeXml(slug)}`;
        xml += `  <url>\n`;
        xml += `    <loc>${loc}</loc>\n`;
        xml += `    <lastmod>${today}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
    }

    xml += '</urlset>\n';

    // Write to ../sitemap.xml
    const outputPath = path.resolve(__dirname, '..', 'sitemap.xml');
    fs.writeFileSync(outputPath, xml, 'utf-8');
    console.log(`\nSitemap written to: ${outputPath}`);
    console.log(`Total URLs: ${corePages.length + uniquePeople.length}`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
