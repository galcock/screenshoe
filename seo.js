/**
 * Screenshoe - SEO Module
 * Dynamic meta tag, canonical URL, robots, and structured data management for SPA pages.
 * Designed for world-class SEO targeting celebrity name searches.
 */

const SEO = {
    _defaultTitle: 'Screenshoe',
    _titleSuffix: ' | Screenshoe',
    _defaultDescription: 'The social network for verified Hollywood professionals. Connect, share, and collaborate with the film and television industry.',
    _defaultImage: '/og-image.png',
    _baseUrl: 'https://screenshoe.com',
    _fkBaseUrl: 'https://freshkernels.com',

    /**
     * Update page meta tags for SEO and social sharing.
     * Sets canonical URL on every page.
     *
     * @param {Object} options
     * @param {string} [options.title] - Page title (suffix appended automatically)
     * @param {string} [options.description] - Meta description
     * @param {string} [options.image] - Open Graph image URL (absolute or relative)
     * @param {string} [options.url] - Canonical URL path (e.g. "/person/123/name")
     * @param {string} [options.type] - og:type (default "website")
     */
    updateMeta({ title, description, image, url, type } = {}) {
        // Document title
        if (title) {
            document.title = title + this._titleSuffix;
        } else {
            document.title = this._defaultTitle;
        }

        const desc = description || this._defaultDescription;
        const img = this._resolveUrl(image || this._defaultImage);
        const canonical = this._resolveUrl(url || window.location.pathname);
        const ogType = type || 'website';
        const displayTitle = title ? title + this._titleSuffix : this._defaultTitle;

        // Standard meta
        this._setMeta('name', 'description', desc);

        // Open Graph
        this._setMeta('property', 'og:title', displayTitle);
        this._setMeta('property', 'og:description', desc);
        this._setMeta('property', 'og:image', img);
        this._setMeta('property', 'og:url', canonical);
        this._setMeta('property', 'og:type', ogType);
        this._setMeta('property', 'og:site_name', 'Screenshoe');

        // Twitter Card
        this._setMeta('name', 'twitter:card', 'summary_large_image');
        this._setMeta('name', 'twitter:title', displayTitle);
        this._setMeta('name', 'twitter:description', desc);
        this._setMeta('name', 'twitter:image', img);

        // Canonical link — set on every page
        this._setCanonical(canonical);
    },

    /**
     * Set robots meta tag content.
     * @param {string} content - e.g. "index,follow" or "noindex,nofollow"
     */
    setRobots(content) {
        this._setMeta('name', 'robots', content);
    },

    /**
     * Add full Person JSON-LD structured data for Google Knowledge Graph.
     * Includes every available field: name, url, image, jobTitle, birthDate,
     * birthPlace, sameAs (social + Fresh Kernels), performerIn / filmography.
     *
     * @param {Object} person - TMDB person object (with movie_credits, tv_credits, external_ids)
     */
    setPersonSchema(person) {
        if (!person || !person.name) return;

        const personUrl = this._resolveUrl(API.getPersonUrl(person));
        const fkSlug = API.generateSlug(person.name);
        const fkUrl = `${this._fkBaseUrl}/person/${person.id}/${fkSlug}`;

        const schema = {
            '@context': 'https://schema.org',
            '@type': 'Person',
            'name': person.name,
            'url': personUrl
        };

        if (person.biography) {
            schema.description = person.biography.substring(0, 300);
        }

        if (person.profile_path) {
            schema.image = API.profileUrl(person.profile_path, 'large');
        }

        if (person.birthday) {
            schema.birthDate = person.birthday;
        }

        if (person.place_of_birth) {
            schema.birthPlace = person.place_of_birth;
        }

        if (person.known_for_department) {
            schema.jobTitle = person.known_for_department;
        }

        // Social links from external IDs + Fresh Kernels profile
        const sameAs = [];
        sameAs.push(fkUrl);
        if (person.external_ids) {
            if (person.external_ids.imdb_id) {
                sameAs.push(`https://www.imdb.com/name/${person.external_ids.imdb_id}`);
            }
            if (person.external_ids.instagram_id) {
                sameAs.push(`https://www.instagram.com/${person.external_ids.instagram_id}`);
            }
            if (person.external_ids.twitter_id) {
                sameAs.push(`https://twitter.com/${person.external_ids.twitter_id}`);
            }
            if (person.external_ids.facebook_id) {
                sameAs.push(`https://www.facebook.com/${person.external_ids.facebook_id}`);
            }
            if (person.external_ids.tiktok_id) {
                sameAs.push(`https://www.tiktok.com/@${person.external_ids.tiktok_id}`);
            }
            if (person.external_ids.youtube_id) {
                sameAs.push(`https://www.youtube.com/channel/${person.external_ids.youtube_id}`);
            }
            if (person.external_ids.wikidata_id) {
                sameAs.push(`https://www.wikidata.org/wiki/${person.external_ids.wikidata_id}`);
            }
        }
        if (sameAs.length) {
            schema.sameAs = sameAs;
        }

        // performerIn — top movie credits as Movie schemas
        const movieCredits = person.movie_credits?.cast || [];
        const crewMovies = person.movie_credits?.crew || [];
        const tvCredits = person.tv_credits?.cast || [];
        const crewTV = person.tv_credits?.crew || [];

        const performerIn = [];

        // Top cast movie credits (by popularity)
        const topMovies = [...movieCredits]
            .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
            .slice(0, 10);

        for (const m of topMovies) {
            const movieSchema = {
                '@type': 'Movie',
                'name': m.title || m.original_title
            };
            if (m.release_date) movieSchema.datePublished = m.release_date;
            if (m.id) movieSchema.url = `https://freshkernels.com/movie/${m.id}`;
            performerIn.push(movieSchema);
        }

        // Top cast TV credits (by popularity)
        const topTV = [...tvCredits]
            .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
            .slice(0, 5);

        for (const t of topTV) {
            const tvSchema = {
                '@type': 'TVSeries',
                'name': t.name || t.original_name
            };
            if (t.first_air_date) tvSchema.datePublished = t.first_air_date;
            if (t.id) tvSchema.url = `https://freshkernels.com/tv/${t.id}`;
            performerIn.push(tvSchema);
        }

        if (performerIn.length) {
            schema.performerIn = performerIn;
        }

        // For crew-primary people, add worksFor-style credits via 'hasOccupation'
        const isCrewPrimary = ['Directing', 'Writing', 'Production', 'Sound', 'Camera', 'Art', 'Editing', 'Visual Effects']
            .includes(person.known_for_department);

        if (isCrewPrimary) {
            const topCrewMovies = [...crewMovies]
                .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
                .slice(0, 5);
            const topCrewTV = [...crewTV]
                .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
                .slice(0, 3);

            const workedOn = [];
            for (const m of topCrewMovies) {
                workedOn.push({
                    '@type': 'Movie',
                    'name': m.title || m.original_title,
                    ...(m.release_date && { datePublished: m.release_date }),
                    ...(m.id && { url: `https://freshkernels.com/movie/${m.id}` })
                });
            }
            for (const t of topCrewTV) {
                workedOn.push({
                    '@type': 'TVSeries',
                    'name': t.name || t.original_name,
                    ...(t.first_air_date && { datePublished: t.first_air_date }),
                    ...(t.id && { url: `https://freshkernels.com/tv/${t.id}` })
                });
            }
            if (workedOn.length && !performerIn.length) {
                schema.performerIn = workedOn;
            }
        }

        this._setJsonLd(schema, 'person');
    },

    /**
     * Add BreadcrumbList JSON-LD for person pages.
     * Structure: Home > Discover > Person Name
     *
     * @param {Object} person - TMDB person object
     */
    setBreadcrumbs(person) {
        if (!person || !person.name) return;

        const schema = {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            'itemListElement': [
                {
                    '@type': 'ListItem',
                    'position': 1,
                    'name': 'Home',
                    'item': this._baseUrl
                },
                {
                    '@type': 'ListItem',
                    'position': 2,
                    'name': 'Discover',
                    'item': `${this._baseUrl}/discover`
                },
                {
                    '@type': 'ListItem',
                    'position': 3,
                    'name': person.name,
                    'item': this._resolveUrl(API.getPersonUrl(person))
                }
            ]
        };

        this._setJsonLd(schema, 'breadcrumb');
    },

    /**
     * Set Organization JSON-LD for the homepage / site-wide.
     */
    setOrganizationSchema() {
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            'name': 'Screenshoe',
            'url': this._baseUrl,
            'logo': `${this._baseUrl}/og-image.png`,
            'description': 'The first social network exclusively for verified film and television professionals.',
            'sameAs': [
                this._fkBaseUrl
            ],
            'foundingDate': '2025',
            'contactPoint': {
                '@type': 'ContactPoint',
                'contactType': 'customer support',
                'url': `${this._baseUrl}/about`
            }
        };

        this._setJsonLd(schema, 'organization');
    },

    /**
     * Set WebSite JSON-LD with SearchAction for Google sitelinks search box.
     */
    setWebSiteSchema() {
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            'name': 'Screenshoe',
            'url': this._baseUrl,
            'description': 'The social network for verified Hollywood professionals.',
            'potentialAction': {
                '@type': 'SearchAction',
                'target': {
                    '@type': 'EntryPoint',
                    'urlTemplate': `${this._baseUrl}/search?q={search_term_string}`
                },
                'query-input': 'required name=search_term_string'
            }
        };

        this._setJsonLd(schema, 'website');
    },

    /**
     * Build a keyword-rich title for a person page.
     * Format: "Brad Pitt — Acting | Screenshoe"
     *
     * @param {Object} person
     * @returns {string}
     */
    buildPersonTitle(person) {
        if (!person || !person.name) return this._defaultTitle;
        const dept = person.known_for_department || 'Film Professional';
        return `${person.name} \u2014 ${dept}`;
    },

    /**
     * Build a keyword-rich meta description for a person page.
     * Includes name, department, and known-for credits.
     *
     * @param {Object} person
     * @returns {string}
     */
    buildPersonDescription(person) {
        if (!person || !person.name) return this._defaultDescription;

        const dept = person.known_for_department || 'film professional';
        const name = person.name;

        // Gather known-for titles
        const knownFor = [];
        const movieCast = person.movie_credits?.cast || [];
        const tvCast = person.tv_credits?.cast || [];
        const movieCrew = person.movie_credits?.crew || [];
        const tvCrew = person.tv_credits?.crew || [];

        const allCredits = [
            ...movieCast.map(c => ({ title: c.title, pop: c.popularity || 0 })),
            ...tvCast.map(c => ({ title: c.name, pop: c.popularity || 0 })),
            ...movieCrew.map(c => ({ title: c.title, pop: c.popularity || 0 })),
            ...tvCrew.map(c => ({ title: c.name, pop: c.popularity || 0 }))
        ];

        // Deduplicate and sort by popularity
        const seen = new Set();
        const unique = [];
        for (const c of allCredits.sort((a, b) => b.pop - a.pop)) {
            if (c.title && !seen.has(c.title)) {
                seen.add(c.title);
                unique.push(c.title);
            }
            if (unique.length >= 4) break;
        }

        let desc = `${name} is a verified ${dept.toLowerCase()} professional on Screenshoe.`;
        if (unique.length > 0) {
            desc += ` Known for: ${unique.join(', ')}.`;
        }
        desc += ` View filmography, posts, and connect with ${name}.`;

        // Truncate to ~160 chars for search results
        if (desc.length > 200) {
            desc = desc.substring(0, 197) + '...';
        }

        return desc;
    },

    // ============================================
    // Internal Helpers
    // ============================================

    /**
     * Set or create a meta tag
     */
    _setMeta(attr, key, value) {
        let el = document.querySelector(`meta[${attr}="${key}"]`);
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute(attr, key);
            document.head.appendChild(el);
        }
        el.setAttribute('content', value);
    },

    /**
     * Set or create the canonical link element
     */
    _setCanonical(url) {
        let el = document.querySelector('link[rel="canonical"]');
        if (!el) {
            el = document.createElement('link');
            el.setAttribute('rel', 'canonical');
            document.head.appendChild(el);
        }
        el.setAttribute('href', url);
    },

    /**
     * Set or replace JSON-LD structured data in the document head.
     * Uses a data-screenshoe-type attribute to allow multiple JSON-LD blocks
     * (person, breadcrumb, organization, website) to coexist.
     *
     * @param {Object} schema - The JSON-LD object
     * @param {string} [schemaType='default'] - Identifier for this JSON-LD block
     */
    _setJsonLd(schema, schemaType = 'default') {
        // Remove existing JSON-LD of this type
        const existing = document.querySelector(`script[type="application/ld+json"][data-screenshoe-type="${schemaType}"]`);
        if (existing) {
            existing.remove();
        }

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-screenshoe-type', schemaType);
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
    },

    /**
     * Remove all dynamic JSON-LD blocks (on page change).
     */
    clearJsonLd() {
        const blocks = document.querySelectorAll('script[type="application/ld+json"][data-screenshoe-type]');
        blocks.forEach(b => b.remove());
    },

    /**
     * Resolve a relative URL to absolute using the base URL
     */
    _resolveUrl(path) {
        if (!path) return this._baseUrl;
        if (path.startsWith('http')) return path;
        return this._baseUrl + (path.startsWith('/') ? path : '/' + path);
    }
};

// Export for use in other modules
window.SEO = SEO;
