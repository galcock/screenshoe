/**
 * Screenshoe — The Industry Talks Here
 * Main application: page rendering and initialization
 */

const Pages = {
    // After-render hooks (called after page HTML is inserted into DOM)
    _afterRender: {},

    // ==========================================
    // HOME PAGE
    // ==========================================
    async home() {
        SEO.clearJsonLd();
        SEO.updateMeta({
            title: 'Screenshoe \u2014 The Industry Talks Here',
            description: 'The first social network exclusively for verified film & television professionals. Connect with actors, directors, writers, producers, and crew from Hollywood and worldwide.',
            url: 'https://screenshoe.com'
        });
        SEO.setOrganizationSchema();
        SEO.setWebSiteSchema();
        SEO.setRobots('index,follow');

        // Load trending people from TMDB
        let trendingPeople = [];
        try {
            const data = await API.getPopularPeople(1);
            trendingPeople = (data.results || []).slice(0, 12);
        } catch (e) {
            console.warn('Failed to load trending people:', e);
        }

        // Load verified profiles from Firestore (recent joins)
        let recentMembers = [];
        let memberCount = 0;
        if (db) {
            try {
                const snap = await db.collection('ss_profiles')
                    .where('verified', '==', true)
                    .orderBy('claimedAt', 'desc')
                    .limit(8)
                    .get();
                recentMembers = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Get approximate member count
                const countSnap = await db.collection('ss_profiles')
                    .where('verified', '==', true)
                    .get();
                memberCount = countSnap.size;
            } catch (e) {
                console.warn('Failed to load members:', e);
            }
        }

        // Load recent feed posts
        let recentPosts = [];
        if (db) {
            try {
                const snap = await db.collection('ss_posts')
                    .where('hidden', '==', false)
                    .orderBy('createdAt', 'desc')
                    .limit(3)
                    .get();
                recentPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn('Failed to load posts:', e);
            }
        }

        const departments = [
            { name: 'Acting', icon: '🎭', slug: 'acting' },
            { name: 'Directing', icon: '🎬', slug: 'directing' },
            { name: 'Writing', icon: '✍️', slug: 'writing' },
            { name: 'Production', icon: '🎥', slug: 'production' },
            { name: 'Music', icon: '🎵', slug: 'sound' },
            { name: 'Cinematography', icon: '📷', slug: 'camera' },
            { name: 'Art & Design', icon: '🎨', slug: 'art' },
            { name: 'Editing', icon: '✂️', slug: 'editing' },
        ];

        return `
            <!-- Hero Section -->
            <section class="hero">
                <div class="hero-bg"></div>
                <div class="hero-content">
                    <h1 class="hero-tagline">The Industry<br>Talks Here.</h1>
                    <p class="hero-subtitle">The first social network exclusively for verified film & television professionals.</p>
                    <div class="hero-cta-row">
                        ${Auth.isVerified()
                            ? `<a href="/feed" class="btn btn-primary btn-lg">View Feed</a>`
                            : Auth.isSignedIn()
                                ? `<a href="/verify" class="btn btn-primary btn-lg">Claim Your Profile</a>`
                                : `<a href="/verify" class="btn btn-primary btn-lg">Claim Your Profile</a>
                                   <a href="/discover" class="btn btn-secondary btn-lg">Discover People</a>`
                        }
                    </div>
                    ${recentMembers.length > 0 ? `
                        <div class="hero-members">
                            <div class="hero-members-avatars">
                                ${recentMembers.slice(0, 5).map(m => `
                                    <img class="hero-member-avatar"
                                         src="${m.customPhotoUrl || (m.profilePath ? API.profileUrl(m.profilePath, 'small') : '')}"
                                         alt="${m.name || ''}"
                                         onerror="this.style.display='none'">
                                `).join('')}
                            </div>
                            <span class="hero-members-text">
                                ${memberCount > 0 ? `Join ${memberCount}+ verified professional${memberCount !== 1 ? 's' : ''}` : 'Join verified professionals on Screenshoe'}
                            </span>
                        </div>
                    ` : `
                        <div class="hero-members">
                            <span class="hero-members-text">Exclusively for verified film & TV professionals</span>
                        </div>
                    `}
                </div>
            </section>

            <!-- Browse by Department -->
            <section class="container" style="padding-top:var(--spacing-3xl)">
                <h2 class="section-heading">Browse by Department</h2>
                <div class="department-grid">
                    ${departments.map(d => `
                        <a href="/discover/${d.slug}" class="department-card">
                            <span class="department-icon">${d.icon}</span>
                            <span class="department-name">${d.name}</span>
                        </a>
                    `).join('')}
                </div>
            </section>

            <!-- Trending in Hollywood -->
            <section class="container" style="padding-top:var(--spacing-3xl)">
                <div class="section-header">
                    <h2 class="section-heading">Trending in Hollywood</h2>
                    <a href="/discover" class="section-link">View All →</a>
                </div>
                <div class="person-card-grid">
                    ${trendingPeople.map(p => Components.personCard(p)).join('')}
                </div>
            </section>

            ${recentPosts.length > 0 ? `
            <!-- Latest from the Industry -->
            <section class="container" style="padding-top:var(--spacing-3xl);padding-bottom:var(--spacing-3xl)">
                <div class="section-header">
                    <h2 class="section-heading">Latest from the Industry</h2>
                    <a href="/feed" class="section-link">View Feed →</a>
                </div>
                <div class="feed-posts" style="max-width:var(--max-width-narrow)">
                    ${recentPosts.map(p => Components.postCard(p)).join('')}
                </div>
            </section>
            ` : ''}

            <!-- Value Props -->
            <section class="container" style="padding-top:var(--spacing-2xl);padding-bottom:var(--spacing-3xl)">
                <div class="about-values-grid">
                    <div class="about-value">
                        <div class="about-value-icon">🔐</div>
                        <h3 class="about-value-title">Verified Only</h3>
                        <p class="about-value-text">Every member is identity-verified against their professional credits. No fans, no bots, no imposters.</p>
                    </div>
                    <div class="about-value">
                        <div class="about-value-icon">💬</div>
                        <h3 class="about-value-title">Direct Access</h3>
                        <p class="about-value-text">Message any verified professional directly. No agents, no managers, no gatekeepers.</p>
                    </div>
                    <div class="about-value">
                        <div class="about-value-icon">🎬</div>
                        <h3 class="about-value-title">Industry First</h3>
                        <p class="about-value-text">Built by and for the entertainment industry. Your professional network, your way.</p>
                    </div>
                </div>
            </section>
        `;
    },

    // ==========================================
    // DISCOVER PAGE
    // ==========================================
    async discover(department) {
        const deptMap = {
            'acting': 'Acting',
            'directing': 'Directing',
            'writing': 'Writing',
            'production': 'Production',
            'sound': 'Sound',
            'camera': 'Camera',
            'art': 'Art',
            'editing': 'Editing',
            'visual-effects': 'Visual Effects',
        };

        const selectedDept = department ? (deptMap[department] || department) : null;
        const pageTitle = selectedDept ? `Discover — ${selectedDept}` : 'Discover';

        SEO.clearJsonLd();
        SEO.updateMeta({
            title: pageTitle,
            description: `Browse ${selectedDept || 'film & television'} professionals on Screenshoe. Discover actors, directors, writers, producers, and crew from Hollywood and worldwide.`,
            url: `https://screenshoe.com/discover${department ? '/' + department : ''}`
        });
        SEO.setRobots('index,follow');

        // Store state for pagination & search
        window._discoverDept = department;
        window._discoverPage = 1;
        window._discoverQuery = '';
        window._discoverLoading = false;
        window._discoverHasMore = true;

        const deptFilters = [
            { slug: '', label: 'All' },
            { slug: 'acting', label: 'Acting' },
            { slug: 'directing', label: 'Directing' },
            { slug: 'writing', label: 'Writing' },
            { slug: 'production', label: 'Production' },
            { slug: 'sound', label: 'Music & Sound' },
            { slug: 'camera', label: 'Cinematography' },
            { slug: 'art', label: 'Art & Design' },
            { slug: 'editing', label: 'Editing' },
        ];

        // Sort/view options
        window._discoverSort = 'popularity';
        window._discoverGender = 'all';
        window._discoverView = 'grid';

        return `
            <div class="container" style="padding-top:var(--spacing-2xl);padding-bottom:var(--spacing-3xl)">
                <h1 class="page-title">Discover</h1>
                <p class="text-secondary" style="margin-bottom:var(--spacing-lg)">Every person in film & television has a profile. Search for anyone.</p>

                <div class="discover-search" style="margin-bottom:var(--spacing-md)">
                    <input type="text" id="discover-search-input" class="form-input form-input-lg"
                        placeholder="Search by name — actors, directors, writers, crew..." autocomplete="off">
                </div>

                <div class="discover-filters">
                    ${deptFilters.map(f => `
                        <a href="/discover${f.slug ? '/' + f.slug : ''}"
                           class="discover-filter ${(department || '') === f.slug ? 'active' : ''}">
                            ${f.label}
                        </a>
                    `).join('')}
                </div>

                <div class="discover-toolbar">
                    <div class="discover-toolbar-left">
                        <div class="discover-sort">
                            <label>Sort:</label>
                            <select id="discover-sort-select" class="form-select" onchange="Pages._discoverSetSort(this.value)">
                                <option value="popularity">Popularity</option>
                                <option value="name-az">Name A→Z</option>
                                <option value="name-za">Name Z→A</option>
                            </select>
                        </div>
                        <div class="discover-gender-filter">
                            <label>Gender:</label>
                            <select id="discover-gender-select" class="form-select" onchange="Pages._discoverSetGender(this.value)">
                                <option value="all">All</option>
                                <option value="female">Female</option>
                                <option value="male">Male</option>
                                <option value="other">Non-Binary</option>
                            </select>
                        </div>
                    </div>
                    <div class="discover-toolbar-right">
                        <button class="discover-view-btn ${window._discoverView === 'grid' ? 'active' : ''}" onclick="Pages._discoverSetView('grid')" title="Grid view">⊞</button>
                        <button class="discover-view-btn ${window._discoverView === 'list' ? 'active' : ''}" onclick="Pages._discoverSetView('list')" title="List view">☰</button>
                    </div>
                </div>

                <div id="discover-results">
                    <div class="spinner" style="margin:2rem auto"></div>
                </div>

                <div id="discover-load-more" style="text-align:center;margin-top:var(--spacing-lg);display:none">
                    <button class="btn btn-secondary" onclick="Pages._discoverLoadMore()">Load More</button>
                </div>

                <div id="discover-status" class="text-tertiary text-center" style="margin-top:var(--spacing-md);font-size:0.8rem"></div>
            </div>
        `;
    },

    // ==========================================
    // PERSON PROFILE PAGE
    // ==========================================
    async person(id) {
        // Fetch TMDB data
        let person;
        try {
            person = await API.getPersonDetails(id);
        } catch (e) {
            return Components.errorPage('Could not load this profile.');
        }

        if (!person || !person.name) {
            return Components.errorPage('Profile not found.');
        }

        // SEO: keyword-rich title and description for person pages
        SEO.clearJsonLd();
        SEO.updateMeta({
            title: SEO.buildPersonTitle(person),
            description: SEO.buildPersonDescription(person),
            image: person.profile_path ? API.profileUrl(person.profile_path, 'large') : undefined,
            url: `https://screenshoe.com${API.getPersonUrl(person)}`,
            type: 'profile'
        });
        SEO.setPersonSchema(person);
        SEO.setBreadcrumbs(person);
        SEO.setRobots('index,follow');

        // Check Firestore for claimed profile
        let profileData = null;
        let isVerified = false;
        let isClaimed = false;
        let isOwner = Auth.ownsProfile(id);

        if (db) {
            try {
                const doc = await db.collection('ss_profiles').doc(String(id)).get();
                if (doc.exists) {
                    profileData = doc.data();
                    isVerified = profileData.verified === true;
                    isClaimed = profileData.claimedBy != null;
                }
            } catch (e) {}
        }

        // Load posts if verified
        let posts = [];
        if (isVerified) {
            posts = await Posts.loadPersonPosts(id, 10);
        }

        // ----- Build combined credits (FK-style) -----
        // Map movie cast credits
        const movieCredits = (person.movie_credits?.cast || []).map(c => ({
            ...c,
            type: 'movie',
            title: c.title,
            date: c.release_date,
            role: 'Acting',
            roleDetail: c.character || ''
        }));

        // Map TV cast credits
        const tvCredits = (person.tv_credits?.cast || []).map(c => ({
            ...c,
            type: 'tv',
            title: c.name,
            date: c.first_air_date,
            role: 'Acting',
            roleDetail: c.character || ''
        }));

        // Map crew credits with deduplication by id+job
        const seenCrewKeys = new Set();
        const crewCredits = [];
        const movieCrew = (person.movie_credits?.crew || []).map(c => ({ ...c, type: 'movie' }));
        const tvCrew = (person.tv_credits?.crew || []).map(c => ({ ...c, type: 'tv' }));
        [...movieCrew, ...tvCrew].forEach(c => {
            const key = `${c.id}-${c.job}`;
            if (seenCrewKeys.has(key)) return;
            seenCrewKeys.add(key);
            crewCredits.push({
                id: c.id,
                type: c.type,
                title: c.title || c.name,
                date: c.release_date || c.first_air_date,
                poster_path: c.poster_path,
                vote_average: c.vote_average,
                vote_count: c.vote_count,
                genre_ids: c.genre_ids,
                role: c.job === 'Director' ? 'Directing' : c.job === 'Producer' || c.job === 'Executive Producer' ? 'Producing' : c.department || 'Crew',
                roleDetail: c.job
            });
        });

        // Combine and sort by date descending
        const allCredits = [...movieCredits, ...tvCredits, ...crewCredits]
            .sort((a, b) => {
                const dateA = a.date ? new Date(a.date) : new Date(0);
                const dateB = b.date ? new Date(b.date) : new Date(0);
                return dateB - dateA;
            });

        // Store for client-side filter/sort
        window._ssFilmographyCredits = allCredits;
        window._ssFilmographySortMode = 'date';
        window._ssFilmographyTypeFilter = 'all';

        // Merge duplicates for initial view
        const initialCredits = this._ssMergeFilmographyCredits(allCredits);

        // ----- Compute stats -----
        const totalCredits = allCredits.length;
        const movieCount = allCredits.filter(c => c.type === 'movie').length;
        const tvCount = allCredits.filter(c => c.type === 'tv').length;
        const ratingsArr = allCredits.filter(c => c.vote_average && c.vote_average > 0).map(c => c.vote_average);
        const avgRating = ratingsArr.length > 0
            ? (ratingsArr.reduce((sum, r) => sum + r, 0) / ratingsArr.length).toFixed(1)
            : null;

        const bio = profileData?.customBio || person.biography || '';
        const photoUrl = profileData?.customPhotoUrl ||
            (person.profile_path ? API.profileUrl(person.profile_path, 'large') : '');

        const age = person.birthday ? (() => {
            const birth = new Date(person.birthday);
            const end = person.deathday ? new Date(person.deathday) : new Date();
            return Math.floor((end - birth) / (365.25 * 24 * 60 * 60 * 1000));
        })() : null;

        // Fresh Kernels link
        const fkSlug = API.generateSlug(person.name);
        const fkUrl = `https://freshkernels.com/person/${fkSlug}-${id}`;

        // External links
        const extIds = person.external_ids || {};
        const externalLinks = [];
        if (extIds.imdb_id) externalLinks.push({ label: 'IMDb', url: `https://www.imdb.com/name/${extIds.imdb_id}` });
        if (extIds.instagram_id) externalLinks.push({ label: 'Instagram', url: `https://instagram.com/${extIds.instagram_id}` });
        if (extIds.twitter_id) externalLinks.push({ label: 'X / Twitter', url: `https://x.com/${extIds.twitter_id}` });
        if (extIds.facebook_id) externalLinks.push({ label: 'Facebook', url: `https://facebook.com/${extIds.facebook_id}` });
        if (extIds.tiktok_id) externalLinks.push({ label: 'TikTok', url: `https://tiktok.com/@${extIds.tiktok_id}` });
        if (extIds.youtube_id) externalLinks.push({ label: 'YouTube', url: `https://youtube.com/${extIds.youtube_id}` });
        if (extIds.wikidata_id) externalLinks.push({ label: 'Wikidata', url: `https://www.wikidata.org/wiki/${extIds.wikidata_id}` });
        externalLinks.push({ label: 'Fresh Kernels', url: fkUrl });

        return `
            <!-- Profile Hero -->
            <div class="profile-hero">
                <div class="profile-hero-bg" ${person.known_for?.length && person.known_for[0]?.backdrop_path
                    ? `style="background-image:url(${API.backdropUrl(person.known_for[0].backdrop_path, 'large')})"`
                    : ''}></div>
                <div class="profile-hero-overlay"></div>
                <div class="container">
                    <div class="profile-header">
                        <div class="profile-photo-wrapper">
                            ${photoUrl
                                ? `<img class="profile-photo ${isVerified ? 'profile-photo-verified' : ''}" src="${photoUrl}" alt="${person.name}">`
                                : `<div class="profile-photo profile-photo-placeholder ${isVerified ? 'profile-photo-verified' : ''}">${person.name.charAt(0)}</div>`
                            }
                        </div>
                        <div class="profile-info">
                            <h1 class="profile-name">
                                ${person.name}
                                ${isVerified ? Components.verifiedBadge('lg') : ''}
                            </h1>
                            <div class="profile-dept">${person.known_for_department || 'Film Professional'}</div>
                            ${person.birthday ? `
                                <div class="profile-meta">
                                    ${person.birthday ? `<span>Born ${new Date(person.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>` : ''}
                                    ${age ? `<span>· ${person.deathday ? 'Died age' : 'Age'} ${age}</span>` : ''}
                                    ${person.place_of_birth ? `<span>· ${person.place_of_birth}</span>` : ''}
                                </div>
                            ` : ''}

                            <!-- Stats Row -->
                            <div class="person-stats-row">
                                <div class="person-stat-item">
                                    <div class="person-stat-value">${totalCredits}</div>
                                    <div class="person-stat-label">Credits</div>
                                </div>
                                <div class="person-stat-item">
                                    <div class="person-stat-value">${movieCount}</div>
                                    <div class="person-stat-label">Movies</div>
                                </div>
                                <div class="person-stat-item">
                                    <div class="person-stat-value">${tvCount}</div>
                                    <div class="person-stat-label">TV Shows</div>
                                </div>
                                ${avgRating ? `
                                <div class="person-stat-item">
                                    <div class="person-stat-value">${avgRating}</div>
                                    <div class="person-stat-label">Avg Rating</div>
                                </div>
                                ` : ''}
                            </div>

                            <div class="profile-actions">
                                ${isVerified && Auth.isVerified() && !isOwner ? `
                                    <button class="btn btn-primary" id="profile-message-btn" data-uid="${profileData?.claimedBy}" data-name="${person.name}" data-photo="${photoUrl}" data-tmdb-id="${id}">
                                        💬 Message
                                    </button>
                                ` : ''}
                                ${isOwner ? `
                                    <button class="btn btn-secondary" id="profile-edit-btn">Edit Profile</button>
                                ` : ''}
                                ${!isClaimed && !Auth.isVerified() ? `
                                    <a href="/verify" class="btn btn-primary">Claim This Profile</a>
                                ` : ''}
                                <a href="${fkUrl}" target="_blank" class="btn btn-secondary btn-sm">View on Fresh Kernels</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="container" style="padding-bottom:var(--spacing-3xl)">
                <!-- Bio -->
                ${bio ? `
                    <section class="profile-section">
                        <h2 class="profile-section-title">About</h2>
                        <p class="profile-bio">${bio.replace(/\n/g, '<br>')}</p>
                    </section>
                ` : ''}

                <!-- External Links -->
                ${externalLinks.length > 0 ? `
                    <div class="person-external-links">
                        ${externalLinks.map(l => `<a href="${l.url}" target="_blank" rel="noopener noreferrer" class="person-external-link">${l.label}</a>`).join('')}
                    </div>
                ` : ''}

                ${!isClaimed ? Components.claimProfileCTA(person) : ''}

                <!-- Posts (verified users only) -->
                ${isVerified && posts.length > 0 ? `
                    <section class="profile-section">
                        <h2 class="profile-section-title">Posts</h2>
                        <div class="feed-posts">
                            ${posts.map(p => Components.postCard(p)).join('')}
                        </div>
                    </section>
                ` : ''}

                ${isOwner ? `
                    <section class="profile-section">
                        <h2 class="profile-section-title">New Post</h2>
                        ${Components.postComposer({ photoUrl: photoUrl, name: person.name })}
                    </section>
                ` : ''}

                <!-- Filmography -->
                ${allCredits.length > 0 ? `
                    <section class="profile-section filmography-section">
                        <h2 class="profile-section-title">Filmography</h2>

                        <div class="filmography-controls">
                            <div class="filmography-type-toggle">
                                <button class="sort-toggle-btn active" data-type="all" onclick="Pages.ssSetFilmographyType('all')">All</button>
                                <button class="sort-toggle-btn" data-type="movie" onclick="Pages.ssSetFilmographyType('movie')">Movies</button>
                                <button class="sort-toggle-btn" data-type="tv" onclick="Pages.ssSetFilmographyType('tv')">TV</button>
                            </div>
                            <div class="filmography-sort-toggle">
                                <button class="sort-toggle-btn active" data-sort="date" onclick="Pages.ssSetFilmographySort('date')">Date</button>
                                <button class="sort-toggle-btn" data-sort="rating" onclick="Pages.ssSetFilmographySort('rating')">Rating</button>
                            </div>
                        </div>

                        <div id="ss-filmography-grid">
                            ${this.ssRenderFilmographyGrid(initialCredits)}
                        </div>
                    </section>
                ` : ''}
            </div>
        `;
    },

    // ==========================================
    // FILMOGRAPHY HELPERS (Screenshoe person page)
    // ==========================================

    ssRenderFilmographyGrid(credits) {
        if (!credits || credits.length === 0) {
            return '<p style="color:var(--text-secondary);text-align:center">No credits found</p>';
        }
        return `<div class="filmography-list">${credits.map(c => {
            const type = c.type === 'tv' ? 'tv' : 'movie';
            const title = c.title || 'Untitled';
            const slug = API.generateSlug(title);
            const href = `https://freshkernels.com/${type}/${slug}-${c.id}`;
            const posterUrl = API.posterUrl(c.poster_path, 'small');
            const year = c.date ? c.date.substring(0, 4) : '';
            const rating = c.vote_average ? c.vote_average.toFixed(1) : '';
            const roleDisplay = c.roleDetail || c.role || '';

            const posterHtml = posterUrl
                ? `<img class="filmography-item__poster" src="${posterUrl}" alt="${Components._esc(title)}" loading="lazy">`
                : `<div class="filmography-item__poster filmography-item__poster--fallback">${Components.icons.image}</div>`;

            return `<a href="${href}" class="filmography-item" target="_blank" rel="noopener noreferrer">
                <div class="filmography-item__poster-wrap">${posterHtml}</div>
                <div class="filmography-item__info">
                    <span class="filmography-item__title">${Components._esc(title)}</span>
                    ${roleDisplay ? `<span class="filmography-item__role">${Components._esc(roleDisplay)}</span>` : ''}
                    <div class="filmography-item__meta">
                        ${year ? `<span class="filmography-item__year">${year}</span>` : ''}
                        ${rating ? `<span class="filmography-item__rating">★ ${rating}</span>` : ''}
                    </div>
                </div>
            </a>`;
        }).join('')}</div>`;
    },

    ssSetFilmographySort(mode) {
        window._ssFilmographySortMode = mode;
        document.querySelectorAll('.filmography-sort-toggle .sort-toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sort === mode);
        });
        this.ssApplyFilmographyFilters();
    },

    ssSetFilmographyType(type) {
        window._ssFilmographyTypeFilter = type;
        document.querySelectorAll('.filmography-type-toggle .sort-toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        this.ssApplyFilmographyFilters();
    },

    _ssMergeFilmographyCredits(credits) {
        const merged = new Map();
        for (const c of credits) {
            const key = `${c.type}-${c.id}`;
            if (merged.has(key)) {
                const existing = merged.get(key);
                if (c.roleDetail && !existing._allRoles.includes(c.roleDetail)) {
                    existing._allRoles.push(c.roleDetail);
                    existing.roleDetail = existing._allRoles.join(', ');
                }
                if ((c.vote_average || 0) > (existing.vote_average || 0)) existing.vote_average = c.vote_average;
            } else {
                merged.set(key, { ...c, _allRoles: [c.roleDetail || c.role || ''] });
            }
        }
        return Array.from(merged.values());
    },

    ssApplyFilmographyFilters() {
        const container = document.getElementById('ss-filmography-grid');
        if (!container) return;

        let credits = [...(window._ssFilmographyCredits || [])];
        const typeFilter = window._ssFilmographyTypeFilter || 'all';
        const sortMode = window._ssFilmographySortMode || 'date';

        // Type filter
        if (typeFilter !== 'all') {
            credits = credits.filter(c => c.type === typeFilter);
        }

        // Merge duplicates
        credits = this._ssMergeFilmographyCredits(credits);

        // Sort
        if (sortMode === 'rating') {
            credits.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        } else {
            credits.sort((a, b) => {
                const dateA = a.date ? new Date(a.date) : new Date(0);
                const dateB = b.date ? new Date(b.date) : new Date(0);
                return dateB - dateA;
            });
        }

        container.innerHTML = this.ssRenderFilmographyGrid(credits);
    },

    // ==========================================
    // DISCOVER PAGE HELPERS
    // ==========================================

    _deptMap: {
        'acting': 'Acting', 'directing': 'Directing', 'writing': 'Writing',
        'production': 'Production', 'sound': 'Sound', 'camera': 'Camera',
        'art': 'Art', 'editing': 'Editing'
    },

    // TMDB gender codes: 0=not set, 1=female, 2=male, 3=non-binary
    _filterPeople(people) {
        let filtered = [...people];
        const dept = window._discoverDept;
        const gender = window._discoverGender || 'all';

        if (dept && this._deptMap[dept]) {
            filtered = filtered.filter(p =>
                p.known_for_department?.toLowerCase() === this._deptMap[dept].toLowerCase()
            );
        }
        if (gender === 'female') filtered = filtered.filter(p => p.gender === 1);
        else if (gender === 'male') filtered = filtered.filter(p => p.gender === 2);
        else if (gender === 'other') filtered = filtered.filter(p => p.gender === 3 || p.gender === 0);

        return filtered;
    },

    _sortPeople(people) {
        const sort = window._discoverSort || 'popularity';
        const sorted = [...people];
        if (sort === 'name-az') sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        else if (sort === 'name-za') sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        else sorted.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        return sorted;
    },

    _renderDiscoverGrid(people) {
        const view = window._discoverView || 'grid';
        if (people.length === 0) return Components.emptyState('🔍', 'No results', 'Try a different search, department, or filter.');
        if (view === 'list') {
            return `<div class="discover-list">${people.map(p => {
                const photo = p.profile_path ? API.profileUrl(p.profile_path, 'medium') : '';
                const dept = p.known_for_department || '';
                const knownFor = (p.known_for || []).slice(0, 3).map(k => k.title || k.name).filter(Boolean).join(', ');
                const href = API.getPersonUrl(p);
                return `<a href="${href}" class="discover-list-item" data-link>
                    <div class="discover-list-photo">
                        ${photo ? `<img src="${photo}" alt="${p.name}" loading="lazy">` : `<div class="discover-list-placeholder">${(p.name || '?').charAt(0)}</div>`}
                    </div>
                    <div class="discover-list-info">
                        <span class="discover-list-name">${p.name}</span>
                        <span class="discover-list-dept">${dept}</span>
                    </div>
                    <div class="discover-list-known">${knownFor}</div>
                    <div class="discover-list-pop">${Math.round(p.popularity || 0)}</div>
                </a>`;
            }).join('')}</div>`;
        }
        return `<div class="person-card-grid">${people.map(p => Components.personCard(p)).join('')}</div>`;
    },

    async _discoverLoadInitial() {
        const resultsEl = document.getElementById('discover-results');
        const statusEl = document.getElementById('discover-status');
        const loadMoreBtn = document.getElementById('discover-load-more');
        if (!resultsEl) return;

        resultsEl.innerHTML = '<div class="spinner" style="margin:2rem auto"></div>';

        try {
            const fetches = [API.getPopularPeople(1), API.getPopularPeople(2), API.getPopularPeople(3)];
            const pages = await Promise.all(fetches);
            let allPeople = pages.flatMap(p => p.results || []);

            const seen = new Set();
            allPeople = allPeople.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

            // Store raw, then filter/sort for display
            window._discoverRawPeople = allPeople;
            window._discoverPopularPage = 3;

            let people = this._filterPeople(allPeople);
            people = this._sortPeople(people);
            window._discoverAllPeople = people;

            resultsEl.innerHTML = this._renderDiscoverGrid(people);
            if (statusEl) statusEl.textContent = `Showing ${people.length} popular ${this._deptMap[window._discoverDept] || ''} professionals. Search to find anyone from 3M+ people.`;
            if (loadMoreBtn) loadMoreBtn.style.display = 'block';
        } catch (e) {
            resultsEl.innerHTML = Components.emptyState('⚠️', 'Failed to load', 'Please refresh and try again.');
        }
    },

    async _discoverSearch(query, page = 1, append = false) {
        const resultsEl = document.getElementById('discover-results');
        const statusEl = document.getElementById('discover-status');
        const loadMoreBtn = document.getElementById('discover-load-more');
        if (!resultsEl) return;
        if (window._discoverLoading) return;
        window._discoverLoading = true;

        if (!append) resultsEl.innerHTML = '<div class="spinner" style="margin:2rem auto"></div>';

        try {
            const fetches = [];
            for (let i = page; i < page + 3; i++) fetches.push(API.searchPeople(query, i));
            const pages = await Promise.all(fetches);
            let results = pages.flatMap(p => p.results || []);
            const totalResults = pages[0]?.total_results || 0;
            const totalPages = pages[0]?.total_pages || 0;

            const seen = new Set();
            results = results.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

            // Apply filters & sort
            results = this._filterPeople(results);
            results = this._sortPeople(results);

            window._discoverPage = page + 3;
            window._discoverHasMore = (page + 3) <= totalPages;

            if (append) {
                const grid = resultsEl.querySelector('.person-card-grid, .discover-list');
                if (grid) {
                    // Re-render all for consistent sort in list view
                    window._discoverAllPeople = [...(window._discoverAllPeople || []), ...results];
                    grid.insertAdjacentHTML('beforeend', this._renderDiscoverGrid(results).replace(/<div class="(person-card-grid|discover-list)">|<\/div>$/g, ''));
                }
            } else {
                window._discoverAllPeople = results;
                resultsEl.innerHTML = this._renderDiscoverGrid(results);
            }

            const deptLabel = this._deptMap[window._discoverDept] || '';
            if (statusEl) statusEl.textContent = totalResults > 0
                ? `Found ${totalResults.toLocaleString()} results for "${query}"${deptLabel ? ` in ${deptLabel}` : ''}`
                : '';
            if (loadMoreBtn) loadMoreBtn.style.display = (results.length > 0 && window._discoverHasMore) ? 'block' : 'none';
        } catch (e) {
            if (!append) resultsEl.innerHTML = Components.emptyState('⚠️', 'Search failed', 'Please try again.');
        }
        window._discoverLoading = false;
    },

    _discoverLoadMore() {
        const query = window._discoverQuery;
        if (query && query.length >= 2) {
            this._discoverSearch(query, window._discoverPage, true);
        } else {
            this._discoverLoadMorePopular();
        }
    },

    async _discoverLoadMorePopular() {
        const resultsEl = document.getElementById('discover-results');
        const loadMoreBtn = document.getElementById('discover-load-more');
        if (!resultsEl || window._discoverLoading) return;
        window._discoverLoading = true;

        const nextPage = (window._discoverPopularPage || 3) + 1;
        try {
            const fetches = [];
            for (let i = nextPage; i < nextPage + 3; i++) fetches.push(API.getPopularPeople(i));
            const pages = await Promise.all(fetches);
            let newPeople = pages.flatMap(p => p.results || []);

            const existing = new Set((window._discoverRawPeople || []).map(p => p.id));
            newPeople = newPeople.filter(p => !existing.has(p.id));
            window._discoverRawPeople = [...(window._discoverRawPeople || []), ...newPeople];
            window._discoverPopularPage = nextPage + 2;

            let filtered = this._filterPeople(newPeople);
            filtered = this._sortPeople(filtered);
            window._discoverAllPeople = [...(window._discoverAllPeople || []), ...filtered];

            const grid = resultsEl.querySelector('.person-card-grid, .discover-list');
            if (grid && filtered.length > 0) {
                grid.insertAdjacentHTML('beforeend', this._renderDiscoverGrid(filtered).replace(/<div class="(person-card-grid|discover-list)">|<\/div>$/g, ''));
            }

            const statusEl = document.getElementById('discover-status');
            if (statusEl) statusEl.textContent = `Showing ${(window._discoverAllPeople || []).length} professionals. Search to find anyone.`;
            if (loadMoreBtn) loadMoreBtn.style.display = filtered.length > 0 ? 'block' : 'none';
        } catch (e) {
            console.warn('Failed to load more:', e);
        }
        window._discoverLoading = false;
    },

    _discoverSetSort(value) {
        window._discoverSort = value;
        this._discoverReapplyFilters();
    },

    _discoverSetGender(value) {
        window._discoverGender = value;
        this._discoverReapplyFilters();
    },

    _discoverSetView(view) {
        window._discoverView = view;
        document.querySelectorAll('.discover-view-btn').forEach(b => b.classList.toggle('active', b.textContent.trim() === (view === 'grid' ? '⊞' : '☰')));
        this._discoverReapplyFilters();
    },

    _discoverReapplyFilters() {
        const resultsEl = document.getElementById('discover-results');
        if (!resultsEl) return;

        const query = window._discoverQuery;
        if (query && query.length >= 2) {
            // Re-search with new filters
            window._discoverPage = 1;
            this._discoverSearch(query, 1, false);
            return;
        }

        // Re-filter/sort stored popular people
        let people = this._filterPeople(window._discoverRawPeople || []);
        people = this._sortPeople(people);
        window._discoverAllPeople = people;
        resultsEl.innerHTML = this._renderDiscoverGrid(people);

        const statusEl = document.getElementById('discover-status');
        if (statusEl) statusEl.textContent = `Showing ${people.length} professionals. Search to find anyone.`;
    },

    // ==========================================
    // FEED PAGE
    // ==========================================
    async feed() {
        SEO.updateMeta({
            title: 'Feed',
            description: 'Latest posts from verified film & television professionals on Screenshoe.',
            url: 'https://screenshoe.com/feed'
        });

        const posts = await Posts.loadFeed(true);

        return `
            <div class="container container-narrow" style="padding-top:var(--spacing-2xl);padding-bottom:var(--spacing-3xl)">
                <h1 class="page-title">Feed</h1>

                ${Auth.isVerified() ? Components.postComposer({
                    photoUrl: Auth.getProfile()?.customPhotoUrl || Auth.getProfile()?.photoURL || '',
                    name: Auth.getProfile()?.displayName || ''
                }) : `
                    <div class="card" style="padding:var(--spacing-lg);margin-bottom:var(--spacing-xl);text-align:center">
                        <p class="text-secondary">Only verified professionals can post.</p>
                        <a href="/verify" class="btn btn-primary btn-sm" style="margin-top:var(--spacing-md)">Get Verified</a>
                    </div>
                `}

                <div id="feed-posts" class="feed-posts">
                    ${posts.length > 0
                        ? posts.map(p => Components.postCard(p)).join('')
                        : Components.emptyState('📝', 'No posts yet', 'Be the first verified professional to post on Screenshoe.')
                    }
                </div>

                ${Posts._feedHasMore ? `<div id="feed-sentinel" class="text-center" style="padding:2rem"><div class="spinner"></div></div>` : ''}
            </div>
        `;
    },

    // ==========================================
    // POST DETAIL PAGE
    // ==========================================
    async postDetail(postId) {
        const post = await Posts.getPost(postId);

        if (!post) {
            return Components.errorPage('Post not found.');
        }

        SEO.updateMeta({
            title: `${post.authorName}'s post`,
            description: post.text?.substring(0, 160) || 'A post on Screenshoe',
            url: `https://screenshoe.com/post/${postId}`
        });

        const authorSlug = API.generateSlug(post.authorName || '');
        const isOwner = Auth.getUid() === post.authorId;

        return `
            <div class="container container-narrow" style="padding-top:var(--spacing-2xl);padding-bottom:var(--spacing-3xl)">
                <a href="/feed" class="btn btn-secondary btn-sm" style="margin-bottom:var(--spacing-lg)">← Back to Feed</a>

                <div class="post-card post-card-detail">
                    <div class="post-header">
                        <a href="/person/${post.authorTmdbId}/${authorSlug}" class="post-author-link">
                            ${post.authorPhotoUrl
                                ? `<img class="post-author-photo" src="${post.authorPhotoUrl}" alt="${post.authorName}">`
                                : `<div class="post-author-photo post-author-photo-placeholder">${(post.authorName || '?').charAt(0)}</div>`
                            }
                            <div>
                                <span class="post-author-name">${post.authorName || 'Unknown'} ${post.authorVerified ? Components.verifiedBadge('sm') : ''}</span>
                                <span class="post-timestamp">${Components.relativeTime(post.createdAt?.toDate?.() || post.createdAt)}</span>
                            </div>
                        </a>
                        ${isOwner ? `<button class="btn btn-icon btn-sm" data-action="delete-post" data-post-id="${postId}" title="Delete post">🗑️</button>` : ''}
                    </div>
                    <div class="post-content">${(post.text || '').replace(/\n/g, '<br>')}</div>
                    ${post.imageUrl ? `<img class="post-image" src="${post.imageUrl}" alt="Post image">` : ''}
                    <div class="post-actions">
                        <button class="post-action ${post.liked ? 'liked' : ''}" data-action="like" data-post-id="${postId}">
                            <span class="like-icon">${post.liked ? Components._icons.heartFilled : Components._icons.heart}</span>
                            <span class="like-count">${post.likeCount || 0}</span>
                        </button>
                        <span class="post-action">
                            ${Components._icons.comment}
                            <span>${post.commentCount || 0}</span>
                        </span>
                    </div>
                </div>

                <!-- Comments -->
                <div class="comments-section">
                    <h3 style="margin-bottom:var(--spacing-lg)">Comments</h3>

                    ${Auth.isVerified() ? `
                        <div class="comment-composer" style="margin-bottom:var(--spacing-xl)">
                            <textarea id="comment-input-${postId}" class="form-textarea" placeholder="Add a comment..." rows="2" maxlength="500"></textarea>
                            <button class="btn btn-primary btn-sm" data-action="submit-comment" data-post-id="${postId}" style="margin-top:var(--spacing-sm)">Comment</button>
                        </div>
                    ` : ''}

                    ${post.comments && post.comments.length > 0 ? `
                        <div class="comments-list">
                            ${post.comments.map(c => {
                                const cSlug = API.generateSlug(c.authorName || '');
                                return `
                                    <div class="comment-item">
                                        <a href="/person/${c.authorTmdbId}/${cSlug}" class="comment-author-link">
                                            ${c.authorPhotoUrl
                                                ? `<img class="comment-author-photo" src="${c.authorPhotoUrl}" alt="${c.authorName}">`
                                                : `<div class="comment-author-photo comment-author-photo-placeholder">${(c.authorName || '?').charAt(0)}</div>`
                                            }
                                        </a>
                                        <div class="comment-body">
                                            <span class="comment-author-name">${c.authorName || 'Unknown'} ${Components.verifiedBadge('sm')}</span>
                                            <p class="comment-text">${(c.text || '').replace(/</g, '&lt;')}</p>
                                            <span class="comment-time">${Components.relativeTime(c.createdAt?.toDate?.() || c.createdAt)}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : `
                        <p class="text-secondary">No comments yet.</p>
                    `}
                </div>
            </div>
        `;
    },

    // ==========================================
    // MESSAGES PAGE
    // ==========================================
    async messages() {
        if (!Auth.requireVerified()) return '';

        SEO.updateMeta({ title: 'Messages', url: 'https://screenshoe.com/messages' });
        SEO.setRobots('noindex,nofollow');

        return `
            <div class="messages-layout">
                <div class="messages-sidebar">
                    <div class="messages-sidebar-header">
                        <h2>Messages</h2>
                    </div>
                    <div id="conversations-list" class="messages-list">
                        ${Components.skeleton('message', 3)}
                    </div>
                </div>
                <div class="chat-area" id="chat-area">
                    <div class="chat-empty">
                        <div class="empty-state">
                            <div class="empty-state-icon">💬</div>
                            <h3>Select a conversation</h3>
                            <p class="empty-state-text">Choose a conversation from the sidebar or start one from someone's profile.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // ==========================================
    // CONVERSATION PAGE (specific chat)
    // ==========================================
    async conversation(convId) {
        if (!Auth.requireVerified()) return '';

        SEO.updateMeta({ title: 'Messages' });
        SEO.setRobots('noindex,nofollow');

        // Find the conversation
        let conv = Messaging.getConversation(convId);
        let otherName = 'Unknown';
        let otherPhotoUrl = '';
        let otherTmdbId = null;

        if (conv) {
            const other = Messaging.getOtherParticipant(conv);
            otherName = other.name;
            otherPhotoUrl = other.photoUrl;
            otherTmdbId = other.tmdbId;
        }

        return `
            <div class="messages-layout">
                <div class="messages-sidebar messages-sidebar-mobile-hidden">
                    <div class="messages-sidebar-header">
                        <h2>Messages</h2>
                    </div>
                    <div id="conversations-list" class="messages-list">
                        ${Components.skeleton('message', 3)}
                    </div>
                </div>
                <div class="chat-area" id="chat-area">
                    <div class="chat-header">
                        <a href="/messages" class="chat-back-btn">←</a>
                        <a href="${otherTmdbId ? `/person/${otherTmdbId}` : '#'}" class="chat-header-user">
                            ${otherPhotoUrl
                                ? `<img class="chat-header-avatar" src="${otherPhotoUrl}" alt="${otherName}">`
                                : `<div class="chat-header-avatar chat-header-avatar-placeholder">${otherName.charAt(0)}</div>`
                            }
                            <span class="chat-header-name">${otherName} ${Components.verifiedBadge('sm')}</span>
                        </a>
                    </div>
                    <div class="chat-messages" id="chat-messages">
                        <div class="spinner" style="margin:2rem auto"></div>
                    </div>
                    <div class="chat-input-area">
                        <input type="text" id="chat-input" class="chat-input" placeholder="Type a message..." maxlength="2000" autocomplete="off">
                        <button id="chat-send-btn" class="btn btn-primary btn-icon chat-send-btn">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 2L9 11M18 2L12 18L9 11M18 2L2 8L9 11"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // ==========================================
    // VERIFY PAGE
    // ==========================================
    async verify() {
        if (Auth.isVerified()) {
            return `
                <div class="container container-narrow" style="padding-top:var(--spacing-3xl);padding-bottom:var(--spacing-3xl)">
                    <div class="text-center">
                        <div style="font-size:4rem;margin-bottom:1rem">✅</div>
                        <h1>You're Verified</h1>
                        <p class="text-secondary" style="margin:1rem 0 2rem">Your identity has been confirmed. You have full access to Screenshoe.</p>
                        <a href="${Auth.getProfileUrl() || '/'}" class="btn btn-primary">Go to Your Profile</a>
                    </div>
                </div>
            `;
        }

        SEO.updateMeta({
            title: 'Claim Your Profile',
            description: 'Verify your identity and claim your professional profile on Screenshoe.',
            url: 'https://screenshoe.com/verify'
        });

        // Check if there's a pending verification
        let existingVerification = null;
        if (Auth.isSignedIn()) {
            existingVerification = await Verification.getStatus();
        }

        if (existingVerification?.status === 'pending') {
            return `
                <div class="container container-narrow" style="padding-top:var(--spacing-3xl);padding-bottom:var(--spacing-3xl)">
                    <div class="text-center">
                        <div style="font-size:4rem;margin-bottom:1rem">⏳</div>
                        <h1>Verification Pending</h1>
                        <p class="text-secondary" style="margin:1rem 0;max-width:400px;margin-left:auto;margin-right:auto">
                            Your verification for <strong>${existingVerification.tmdbName}</strong> is being reviewed.
                            This typically takes less than 24 hours.
                        </p>
                        <a href="/" class="btn btn-secondary" style="margin-top:2rem">Back to Home</a>
                    </div>
                </div>
            `;
        }

        if (existingVerification?.status === 'rejected') {
            Verification.reset();
        }

        // Not signed in yet — show sign-in prompt first
        if (!Auth.isSignedIn()) {
            return `
                <div class="container container-narrow" style="padding-top:var(--spacing-3xl);padding-bottom:var(--spacing-3xl)">
                    <div class="auth-card" style="max-width:500px;margin:0 auto">
                        <h1 class="auth-title">Claim Your Profile</h1>
                        <p class="text-secondary text-center" style="margin-bottom:var(--spacing-lg)">
                            Screenshoe is exclusively for verified film & television professionals. Our identity verification is rigorous — only real people with real credits get in.
                        </p>
                        <button class="btn btn-full auth-provider-btn" onclick="Auth.signInWithGoogle()">
                            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                            Continue with Google
                        </button>

                        <div class="auth-divider"><span>how it works</span></div>

                        <div class="text-center text-secondary" style="font-size:0.9rem">
                            <p><strong>1.</strong> Find your profile in our TMDB database</p>
                            <p><strong>2.</strong> Complete a live photo challenge to prove it's you</p>
                            <p><strong>3.</strong> AI verifies your photo is real, not generated, and matches your profile</p>
                            <p><strong>4.</strong> Get your verified badge ✓</p>
                        </div>
                        <p class="text-tertiary text-center" style="font-size:0.75rem;margin-top:var(--spacing-md)">
                            🤖 AI-generated photos are automatically detected and rejected.
                            Only authentic, live photos are accepted.
                        </p>
                    </div>
                </div>
            `;
        }

        // Signed in — show verification steps
        Verification.reset();

        return `
            <div class="container container-narrow" style="padding-top:var(--spacing-2xl);padding-bottom:var(--spacing-3xl)">
                <!-- Step indicator -->
                <div class="verify-steps">
                    <div class="verify-step active" data-step="1"><span>1</span><label>Find</label></div>
                    <div class="verify-step-line"></div>
                    <div class="verify-step" data-step="2"><span>2</span><label>Confirm</label></div>
                    <div class="verify-step-line"></div>
                    <div class="verify-step" data-step="3"><span>3</span><label>Verify</label></div>
                </div>

                <div id="verify-content" style="max-width:500px;margin:var(--spacing-2xl) auto 0">
                    <!-- Step content rendered by Verification module -->
                </div>
            </div>
        `;
    },

    // ==========================================
    // LOGIN PAGE
    // ==========================================
    async login() {
        if (Auth.isSignedIn()) {
            Router.navigate(Auth.isVerified() ? '/' : '/verify');
            return '';
        }

        SEO.updateMeta({
            title: 'Sign In',
            description: 'Sign in to Screenshoe — the social network for verified film professionals.',
            url: 'https://screenshoe.com/login'
        });

        return `
            <div class="container" style="padding-top:var(--spacing-3xl);padding-bottom:var(--spacing-3xl)">
                <div class="auth-card" style="max-width:420px;margin:0 auto">
                    <div class="text-center" style="margin-bottom:var(--spacing-xl)">
                        <div style="font-size:3rem;margin-bottom:var(--spacing-md)">🎬</div>
                        <h1 class="auth-title">Welcome to Screenshoe</h1>
                        <p class="text-secondary">The social network for verified film & TV professionals.</p>
                    </div>

                    <button class="btn btn-full auth-provider-btn" onclick="Auth.signInWithGoogle()">
                        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                        Continue with Google
                    </button>

                    <p class="text-tertiary text-center" style="margin-top:var(--spacing-xl);font-size:0.85rem">
                        By signing in, you agree to Screenshoe's Terms of Service.
                        Only verified film & television professionals may claim profiles.
                    </p>
                </div>
            </div>
        `;
    },

    // ==========================================
    // SETTINGS PAGE
    // ==========================================
    async settings() {
        if (!Auth.requireVerified()) return '';

        SEO.updateMeta({ title: 'Settings' });
        SEO.setRobots('noindex,nofollow');

        const profile = Auth.getProfile();
        const tmdbId = profile?.tmdbId;

        let ssProfile = null;
        if (db && tmdbId) {
            try {
                const doc = await db.collection('ss_profiles').doc(String(tmdbId)).get();
                if (doc.exists) ssProfile = doc.data();
            } catch (e) {}
        }

        return `
            <div class="container container-narrow" style="padding-top:var(--spacing-2xl);padding-bottom:var(--spacing-3xl)">
                <h1 class="page-title">Settings</h1>

                <div class="settings-section">
                    <h3>Profile</h3>
                    <div class="form-group">
                        <label class="form-label">Custom Bio</label>
                        <textarea id="settings-bio" class="form-textarea" rows="4" maxlength="1000" placeholder="Write something about yourself...">${ssProfile?.customBio || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Profile Photo</label>
                        <p class="text-tertiary" style="font-size:0.85rem;margin-bottom:var(--spacing-sm)">Upload a custom profile photo. Your TMDB photo is used by default.</p>
                        <input type="file" id="settings-photo" accept="image/*" class="form-input">
                    </div>
                    <button id="settings-save-btn" class="btn btn-primary">Save Changes</button>
                </div>

                <div class="settings-section">
                    <h3>Notifications</h3>
                    <div class="flex flex-between" style="align-items:center">
                        <div>
                            <div class="form-label" style="margin-bottom:0">Email notifications for new messages</div>
                        </div>
                        <label class="settings-toggle">
                            <input type="checkbox" id="settings-dm-email" ${profile?.notificationPrefs?.dmEmail !== false ? 'checked' : ''}>
                            <span class="settings-toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <div class="settings-section">
                    <h3>Account</h3>
                    <p class="text-secondary" style="margin-bottom:var(--spacing-md)">Signed in as ${profile?.email || 'unknown'}</p>
                    <button class="btn btn-secondary" onclick="Auth.signOut()">Sign Out</button>
                </div>
            </div>
        `;
    },

    // ==========================================
    // ADMIN PAGE
    // ==========================================
    async admin() {
        if (!Auth.isAdmin()) {
            return Components.errorPage('Access denied. Admin only.');
        }

        SEO.updateMeta({ title: 'Admin' });
        SEO.setRobots('noindex,nofollow');

        // Load pending verifications
        let pendingVerifications = [];
        if (db) {
            try {
                const snap = await db.collection('ss_verifications')
                    .where('status', '==', 'pending')
                    .orderBy('createdAt', 'asc')
                    .limit(50)
                    .get();
                pendingVerifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn('Failed to load verifications:', e);
            }
        }

        // Load stats
        let stats = { verified: 0, pending: 0, posts: 0 };
        if (db) {
            try {
                const [verifiedSnap, pendingSnap, postsSnap] = await Promise.all([
                    db.collection('ss_profiles').where('verified', '==', true).get(),
                    db.collection('ss_verifications').where('status', '==', 'pending').get(),
                    db.collection('ss_posts').get()
                ]);
                stats.verified = verifiedSnap.size;
                stats.pending = pendingSnap.size;
                stats.posts = postsSnap.size;
            } catch (e) {}
        }

        return `
            <div class="container" style="padding-top:var(--spacing-2xl);padding-bottom:var(--spacing-3xl)">
                <h1 class="page-title">Admin Dashboard</h1>

                <div class="admin-stat-grid">
                    <div class="admin-stat-card">
                        <div class="admin-stat-number">${stats.verified}</div>
                        <div class="admin-stat-label">Verified Members</div>
                    </div>
                    <div class="admin-stat-card">
                        <div class="admin-stat-number">${stats.pending}</div>
                        <div class="admin-stat-label">Pending Verifications</div>
                    </div>
                    <div class="admin-stat-card">
                        <div class="admin-stat-number">${stats.posts}</div>
                        <div class="admin-stat-label">Total Posts</div>
                    </div>
                </div>

                <h2 style="margin-top:var(--spacing-2xl)">Pending Verifications</h2>

                ${pendingVerifications.length > 0 ? `
                    <div class="admin-verifications">
                        ${pendingVerifications.map(v => `
                            <div class="admin-verification-item" data-verification-id="${v.id}">
                                <div class="admin-verification-photos">
                                    <div class="admin-verification-photo-col">
                                        <label class="form-label">TMDB Photo</label>
                                        ${v.tmdbPhotoUrl
                                            ? `<img src="${v.tmdbPhotoUrl}" alt="TMDB photo of ${v.tmdbName}">`
                                            : `<div class="admin-verification-no-photo">No TMDB photo</div>`
                                        }
                                    </div>
                                    <div class="admin-verification-photo-col">
                                        <label class="form-label">Selfie</label>
                                        <img src="${v.selfieUrl}" alt="Verification selfie">
                                    </div>
                                </div>
                                <div class="admin-verification-info">
                                    <h3>${v.tmdbName}</h3>
                                    <p class="text-secondary">TMDB ID: ${v.tmdbId} · Submitted ${Components.relativeTime(v.createdAt?.toDate?.() || v.createdAt)}</p>
                                    ${v.confidenceScore != null ? `<p class="text-secondary">AI Confidence: ${v.confidenceScore}%</p>` : ''}
                                </div>
                                <div class="admin-verification-actions">
                                    <button class="btn btn-primary btn-sm" onclick="Verification.approveVerification('${v.id}').then(() => Router.handleRoute())">Approve</button>
                                    <button class="btn btn-danger btn-sm" onclick="Verification.rejectVerification('${v.id}', 'Identity could not be confirmed').then(() => Router.handleRoute())">Reject</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    ${Components.emptyState('✅', 'All clear', 'No pending verifications.')}
                `}
            </div>
        `;
    },

    // ==========================================
    // SEARCH PAGE
    // ==========================================
    async search(query) {
        const q = query?.q || '';
        SEO.updateMeta({ title: q ? `Search: ${q}` : 'Search' });

        let results = [];
        if (q.length >= 2) {
            try {
                const data = await API.searchPeople(q);
                results = data.results || [];
            } catch (e) {}
        }

        // Check which are verified
        let verifiedIds = new Set();
        if (db && results.length > 0) {
            try {
                const snap = await db.collection('ss_profiles')
                    .where('verified', '==', true)
                    .get();
                snap.docs.forEach(d => verifiedIds.add(Number(d.id)));
            } catch (e) {}
        }

        results = results.map(p => ({ ...p, verified: verifiedIds.has(p.id) }));

        return `
            <div class="container" style="padding-top:var(--spacing-2xl);padding-bottom:var(--spacing-3xl)">
                <h1 class="page-title">Search</h1>
                <form action="/search" method="get" class="search-form" style="margin-bottom:var(--spacing-xl)">
                    <input type="text" name="q" value="${q.replace(/"/g, '&quot;')}" class="form-input" placeholder="Search people in film & television..." style="font-size:1.1rem">
                </form>

                ${q.length >= 2 ? `
                    ${results.length > 0 ? `
                        <div class="person-card-grid">
                            ${results.map(p => Components.personCard(p)).join('')}
                        </div>
                    ` : Components.emptyState('🔍', 'No results', `No one found for "${q}". They must be in the TMDB database.`)}
                ` : `
                    <p class="text-secondary">Enter a name to search for film & television professionals.</p>
                `}
            </div>
        `;
    },

    // ==========================================
    // ABOUT PAGE
    // ==========================================
    async about() {
        SEO.clearJsonLd();
        SEO.updateMeta({
            title: 'About Screenshoe \u2014 Social Network for Film & TV Professionals',
            description: 'Screenshoe is the first social network exclusively for verified film & television professionals. Learn how identity verification works and join the industry community.',
            url: 'https://screenshoe.com/about'
        });
        SEO.setRobots('index,follow');

        return `
            <div class="about-hero">
                <h1 class="about-hero-title">The Industry<br>Talks Here.</h1>
                <p class="about-hero-subtitle">Screenshoe is the first and only social network built exclusively for verified professionals in film and television.</p>
            </div>

            <div class="container container-narrow" style="padding-bottom:var(--spacing-3xl)">
                <section class="about-section">
                    <h2>Why Screenshoe?</h2>
                    <p>Every other social network is built for everyone. Screenshoe is built for the industry. No fans, no bots, no influencers — just the people who actually make movies and television.</p>
                    <p>Every member is identity-verified against their professional credits in the TMDB database. When you see a verified badge on Screenshoe, you know you're looking at the real person.</p>
                </section>

                <section class="about-section">
                    <h2>How It Works</h2>
                    <div class="about-values-grid">
                        <div class="about-value">
                            <div class="about-value-icon">🔍</div>
                            <h3 class="about-value-title">Find Your Profile</h3>
                            <p class="about-value-text">Search for yourself in our database of film & TV professionals, powered by TMDB and Fresh Kernels.</p>
                        </div>
                        <div class="about-value">
                            <div class="about-value-icon">📸</div>
                            <h3 class="about-value-title">Verify Your Identity</h3>
                            <p class="about-value-text">Submit a photo for identity verification. We compare it to your known professional photos.</p>
                        </div>
                        <div class="about-value">
                            <div class="about-value-icon">✅</div>
                            <h3 class="about-value-title">Join the Community</h3>
                            <p class="about-value-text">Once verified, post updates, message anyone in the industry, and own your official profile.</p>
                        </div>
                    </div>
                </section>

                <section class="about-section">
                    <h2>Who Can Join?</h2>
                    <p>Screenshoe is exclusively for professionals who appear in the TMDB (The Movie Database) credits. This includes:</p>
                    <ul style="color:var(--text-secondary);line-height:2;padding-left:1.5rem">
                        <li>Actors and actresses</li>
                        <li>Directors and producers</li>
                        <li>Writers and showrunners</li>
                        <li>Cinematographers and editors</li>
                        <li>Composers and sound designers</li>
                        <li>Production designers and art directors</li>
                        <li>Costume designers and makeup artists</li>
                        <li>Visual effects artists</li>
                        <li>Stunt coordinators</li>
                        <li>And any other credited professional</li>
                    </ul>
                    <p style="margin-top:var(--spacing-lg)">If you have credits on TMDB, you can claim your profile. If you don't, you can't join — and that's the whole point.</p>
                </section>

                <section class="about-section">
                    <h2>Fresh Kernels Integration</h2>
                    <p>Screenshoe is powered by <a href="https://freshkernels.com" target="_blank">Fresh Kernels</a>, the community-driven movie and TV ratings platform. Every professional on Screenshoe has a corresponding <a href="https://freshkernels.com" target="_blank">Fresh Kernels profile</a> with audience ratings, filmography details, and community reviews for their work. Explore ratings and reviews for movies and TV shows at <a href="https://freshkernels.com" target="_blank">freshkernels.com</a>.</p>
                </section>

                <section class="about-section">
                    <h2>Data & Privacy</h2>
                    <p>Profile data is sourced from <a href="https://tmdb.org" target="_blank">TMDB</a> and <a href="https://freshkernels.com" target="_blank">Fresh Kernels</a>. Your verification photo is stored securely and used only for identity confirmation. Messages between users are private and encrypted in transit.</p>
                </section>

                <section class="about-section text-center">
                    <a href="/verify" class="btn btn-primary btn-lg">Claim Your Profile</a>
                </section>
            </div>
        `;
    },

    // ==========================================
    // NOT FOUND
    // ==========================================
    notFound() {
        SEO.updateMeta({ title: 'Page Not Found' });
        return Components.errorPage('This page doesn\'t exist.');
    },

    // ==========================================
    // ERROR
    // ==========================================
    error(message) {
        return Components.errorPage(message);
    }
};

// ==========================================
// AFTER-RENDER HOOKS
// ==========================================

Pages._afterRender = {
    // Verify page: initialize verification step rendering
    verify: () => {
        if (Auth.isSignedIn() && !Auth.isVerified()) {
            Verification._renderStep();
        }
    },

    // Discover page: search, filter, paginate
    discover: () => {
        // Load initial popular people
        Pages._discoverLoadInitial();

        const input = document.getElementById('discover-search-input');
        if (!input) return;
        let debounce;
        input.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                const query = input.value.trim();
                window._discoverQuery = query;
                window._discoverPage = 1;
                window._discoverHasMore = true;

                if (query.length < 2) {
                    // Reset to popular people
                    Pages._discoverLoadInitial();
                } else {
                    Pages._discoverSearch(query, 1, false);
                }
            }, 300);
        });
    },

    // Feed page: initialize composer and infinite scroll
    feed: () => {
        Posts.initComposer();
        Posts.initInfiniteScroll();
    },

    // Messages page: start listening to conversations
    messages: () => {
        Messaging.listenToConversations();
    },

    // Conversation page: listen to messages + init input
    conversation: (params) => {
        Messaging.listenToConversations();
        Messaging.listenToMessages(params.id);
        Messaging.initChatInput(params.id);
    },

    // Person profile: init message button + post composer
    person: (params) => {
        // Message button handler
        const msgBtn = document.getElementById('profile-message-btn');
        if (msgBtn) {
            msgBtn.addEventListener('click', async () => {
                const otherUid = msgBtn.dataset.uid;
                const otherName = msgBtn.dataset.name;
                const otherPhoto = msgBtn.dataset.photo;
                const otherTmdbId = Number(msgBtn.dataset.tmdbId);

                const convId = await Messaging.openConversation(otherUid, otherName, otherPhoto, otherTmdbId);
                if (convId) {
                    Router.navigate(`/messages/${convId}`);
                }
            });
        }

        // Edit profile button handler
        const editBtn = document.getElementById('profile-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                Router.navigate('/settings');
            });
        }

        // Post composer
        if (Auth.ownsProfile(params.id)) {
            Posts.initComposer();
        }
    },

    // Settings: save handlers
    settings: () => {
        const saveBtn = document.getElementById('settings-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const bio = document.getElementById('settings-bio')?.value?.trim() || null;
                const photoInput = document.getElementById('settings-photo');
                const dmEmail = document.getElementById('settings-dm-email')?.checked ?? true;

                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';

                try {
                    const tmdbId = Auth.getTmdbId();
                    if (!tmdbId || !db) throw new Error('Not verified');

                    const profileUpdate = { customBio: bio };

                    // Upload photo if selected
                    if (photoInput?.files?.[0]) {
                        const file = photoInput.files[0];
                        if (file.size > 5 * 1024 * 1024) {
                            Components.toast('Photo must be under 5MB', 'error');
                            saveBtn.disabled = false;
                            saveBtn.textContent = 'Save Changes';
                            return;
                        }
                        const path = `ss_profiles/${tmdbId}/photo_${Date.now()}.jpg`;
                        const ref = storage.ref(path);
                        await ref.put(file);
                        profileUpdate.customPhotoUrl = await ref.getDownloadURL();
                    }

                    await db.collection('ss_profiles').doc(String(tmdbId)).update(profileUpdate);

                    // Update notification prefs
                    await db.collection('ss_users').doc(Auth.getUid()).update({
                        'notificationPrefs.dmEmail': dmEmail
                    });

                    Components.toast('Settings saved!', 'success');
                } catch (err) {
                    console.error('Save settings failed:', err);
                    Components.toast('Failed to save: ' + err.message, 'error');
                }

                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
            });
        }
    },

    // Search: handle form submission
    search: () => {
        const form = document.querySelector('.search-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const q = form.querySelector('input[name="q"]')?.value?.trim();
                if (q) Router.navigate(`/search?q=${encodeURIComponent(q)}`);
            });
        }
    }
};

// ==========================================
// SEARCH OVERLAY
// ==========================================
const SearchOverlay = {
    _debounce: null,

    init() {
        const toggle = document.querySelector('.nav-search-toggle');
        const overlay = document.querySelector('.search-overlay');
        const input = overlay?.querySelector('.search-input');
        const close = overlay?.querySelector('.search-close');
        const results = overlay?.querySelector('.search-results');

        if (!toggle || !overlay) return;

        toggle.addEventListener('click', () => {
            overlay.style.display = 'flex';
            input?.focus();
        });

        close?.addEventListener('click', () => {
            overlay.style.display = 'none';
            if (input) input.value = '';
            if (results) results.innerHTML = '';
        });

        // Close on ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.style.display !== 'none') {
                overlay.style.display = 'none';
                if (input) input.value = '';
                if (results) results.innerHTML = '';
            }
        });

        // Search as you type
        input?.addEventListener('input', () => {
            clearTimeout(this._debounce);
            const q = input.value.trim();

            if (q.length < 2) {
                if (results) results.innerHTML = '';
                return;
            }

            this._debounce = setTimeout(async () => {
                if (results) results.innerHTML = '<div class="spinner" style="margin:2rem auto"></div>';

                try {
                    const data = await API.searchPeople(q);
                    const people = (data.results || []).slice(0, 8);

                    if (people.length === 0) {
                        results.innerHTML = '<p class="text-secondary text-center" style="padding:2rem">No results found</p>';
                        return;
                    }

                    results.innerHTML = people.map(p => Components.searchResultItem(p)).join('');

                    // Click to navigate
                    results.querySelectorAll('.search-result-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const personId = item.dataset.personId;
                            const slug = item.dataset.slug;
                            overlay.style.display = 'none';
                            input.value = '';
                            results.innerHTML = '';
                            Router.navigate(`/person/${personId}/${slug}`);
                        });
                    });
                } catch (e) {
                    results.innerHTML = '<p class="text-secondary text-center" style="padding:2rem">Search failed</p>';
                }
            }, 300);
        });

        // Enter to go to search page
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const q = input.value.trim();
                if (q) {
                    overlay.style.display = 'none';
                    input.value = '';
                    if (results) results.innerHTML = '';
                    Router.navigate(`/search?q=${encodeURIComponent(q)}`);
                }
            }
        });
    }
};

// ==========================================
// MOBILE NAV
// ==========================================
const MobileNav = {
    init() {
        const toggle = document.querySelector('.nav-mobile-toggle');
        const menu = document.querySelector('.nav-mobile-menu');
        if (!toggle || !menu) return;

        toggle.addEventListener('click', () => {
            const isOpen = menu.style.display !== 'none';
            menu.style.display = isOpen ? 'none' : 'flex';
            toggle.classList.toggle('active', !isOpen);
        });

        // Close on route change
        Router.onRouteChange(() => {
            menu.style.display = 'none';
            toggle.classList.remove('active');
        });
    }
};

// ==========================================
// APP INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize auth first (wait for auth state)
    await Auth.init();

    // Start conversation listener if verified
    if (Auth.isVerified()) {
        Messaging.listenToConversations();
    }

    // Initialize search overlay
    SearchOverlay.init();

    // Initialize mobile nav
    MobileNav.init();

    // Initialize router (renders initial page)
    Router.init();

    console.log('🎬 Screenshoe initialized');
});
