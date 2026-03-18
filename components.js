/**
 * Screenshoe - Reusable UI Components
 * Rendering methods that return HTML strings for the Hollywood professional network.
 */

const Components = {

    // ============================================
    // SVG Icons (20x20 viewBox, 1.5px stroke)
    // ============================================

    icons: {
        heartOutline: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17.5S2.5 13 2.5 7.5A4 4 0 0 1 6.5 3.5C8 3.5 9.3 4.3 10 5.5 10.7 4.3 12 3.5 13.5 3.5A4 4 0 0 1 17.5 7.5C17.5 13 10 17.5 10 17.5Z"/></svg>`,
        heartFilled: `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17.5S2.5 13 2.5 7.5A4 4 0 0 1 6.5 3.5C8 3.5 9.3 4.3 10 5.5 10.7 4.3 12 3.5 13.5 3.5A4 4 0 0 1 17.5 7.5C17.5 13 10 17.5 10 17.5Z"/></svg>`,
        comment: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5C3 3.67 3.67 3 4.5 3H15.5C16.33 3 17 3.67 17 4.5V12.5C17 13.33 16.33 14 15.5 14H7L3 17V4.5Z"/></svg>`,
        share: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7L10 2L5 7"/><path d="M10 2V13"/><path d="M3 11V16C3 16.55 3.45 17 4 17H16C16.55 17 17 16.55 17 16V11"/></svg>`,
        image: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="16" height="14" rx="2"/><circle cx="7" cy="8" r="1.5"/><path d="M18 13L14 9L5 17"/></svg>`,
        check: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5L8 14.5L16 5.5"/></svg>`,
        checkDouble: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10.5L6 14.5L14 5.5"/><path d="M7 10.5L11 14.5L19 5.5"/></svg>`,
        close: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5L15 15"/><path d="M15 5L5 15"/></svg>`,
    },

    // ============================================
    // Loading States
    // ============================================

    pageLoading() {
        return `<div class="page-loading"><div class="spinner"></div></div>`;
    },

    skeleton(type = 'card', count = 1) {
        const templates = {
            card: `<div class="skeleton skeleton-card">
                <div class="skeleton-image"></div>
                <div class="skeleton-body">
                    <div class="skeleton-line skeleton-line--title"></div>
                    <div class="skeleton-line skeleton-line--text"></div>
                </div>
            </div>`,
            'person-card': `<div class="skeleton skeleton-person-card">
                <div class="skeleton-avatar skeleton-avatar--lg"></div>
                <div class="skeleton-line skeleton-line--name"></div>
                <div class="skeleton-line skeleton-line--dept"></div>
            </div>`,
            post: `<div class="skeleton skeleton-post">
                <div class="skeleton-header">
                    <div class="skeleton-avatar"></div>
                    <div class="skeleton-header-text">
                        <div class="skeleton-line skeleton-line--name"></div>
                        <div class="skeleton-line skeleton-line--meta"></div>
                    </div>
                </div>
                <div class="skeleton-body">
                    <div class="skeleton-line skeleton-line--text"></div>
                    <div class="skeleton-line skeleton-line--text" style="width:75%"></div>
                    <div class="skeleton-line skeleton-line--text" style="width:50%"></div>
                </div>
            </div>`,
            message: `<div class="skeleton skeleton-message">
                <div class="skeleton-avatar skeleton-avatar--sm"></div>
                <div class="skeleton-body" style="flex:1">
                    <div class="skeleton-line skeleton-line--name" style="width:40%"></div>
                    <div class="skeleton-line skeleton-line--text" style="width:70%"></div>
                </div>
            </div>`,
            text: `<div class="skeleton skeleton-text">
                <div class="skeleton-line skeleton-line--text"></div>
                <div class="skeleton-line skeleton-line--text" style="width:80%"></div>
                <div class="skeleton-line skeleton-line--text" style="width:60%"></div>
            </div>`,
        };

        const template = templates[type] || templates.card;
        return Array(count).fill(template).join('');
    },

    // ============================================
    // Verified Badge
    // ============================================

    verifiedBadge(size = '') {
        const sizeClass = size ? `verified-badge--${size}` : '';
        return `<span class="verified-badge ${sizeClass}" title="Verified Professional">
            <svg viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="11" fill="var(--verified-blue)"/>
                <path d="M9.5 14.25L6.75 11.5L7.81 10.44L9.5 12.13L14.19 7.44L15.25 8.5L9.5 14.25Z" fill="white"/>
            </svg>
        </span>`;
    },

    // ============================================
    // Person Card
    // ============================================

    personCard(person) {
        if (!person) return '';
        const id = person.id;
        const name = person.name || 'Unknown';
        const profilePath = person.profile_path || person.profilePath;
        const department = person.known_for_department || person.knownForDepartment || '';
        const verified = person.verified;
        const slug = API.generateSlug(name);
        const href = slug ? `/person/${id}/${slug}` : `/person/${id}`;
        const imgUrl = API.profileUrl(profilePath, 'medium');
        const initial = name.charAt(0).toUpperCase();

        const photoHtml = imgUrl
            ? `<img class="person-card__photo" src="${imgUrl}" alt="${this._esc(name)}" loading="lazy">`
            : `<div class="person-card__photo person-card__photo--fallback">🎬</div>`;

        const badgeHtml = verified ? ` ${this.verifiedBadge('sm')}` : '';

        return `<a href="${href}" class="person-card" data-navlink>
            <div class="person-card__photo-wrap">${photoHtml}</div>
            <h3 class="person-card__name">${this._esc(name)}${badgeHtml}</h3>
            ${department ? `<span class="person-card__dept">${this._esc(department)}</span>` : ''}
        </a>`;
    },

    personCardGrid(people, title = '') {
        if (!people || !people.length) return '';
        const cards = people.map(p => this.personCard(p)).join('');
        const titleHtml = title ? `<h2 class="section-title">${this._esc(title)}</h2>` : '';
        return `${titleHtml}<div class="person-card-grid">${cards}</div>`;
    },

    // ============================================
    // Person Avatar (smaller, inline)
    // ============================================

    personAvatar(person, size = 'md') {
        if (!person) return '';
        const name = person.name || '';
        const profilePath = person.profile_path || person.profilePath || person.photoUrl;
        const verified = person.verified;
        const initial = name.charAt(0).toUpperCase();

        const sizeMap = { sm: 'small', md: 'small', lg: 'medium' };
        const apiSize = sizeMap[size] || 'small';
        const imgUrl = profilePath
            ? (profilePath.startsWith('http') ? profilePath : API.profileUrl(profilePath, apiSize))
            : null;

        const imgHtml = imgUrl
            ? `<img class="avatar__img" src="${imgUrl}" alt="${this._esc(name)}" loading="lazy">`
            : `<span class="avatar__fallback">${initial}</span>`;

        const badgeHtml = verified ? this.verifiedBadge('sm') : '';

        return `<div class="avatar avatar--${size}">
            ${imgHtml}
            ${badgeHtml}
        </div>`;
    },

    // ============================================
    // Post Card
    // ============================================

    postCard(post) {
        if (!post) return '';
        const {
            id, authorTmdbId, authorName = 'Unknown', authorPhotoUrl,
            text = '', imageUrl, likeCount = 0, commentCount = 0,
            createdAt, liked
        } = post;

        const slug = API.generateSlug(authorName);
        const authorHref = authorTmdbId
            ? (slug ? `/person/${authorTmdbId}/${slug}` : `/person/${authorTmdbId}`)
            : '#';

        const avatarHtml = this.personAvatar({
            name: authorName,
            photoUrl: authorPhotoUrl,
            verified: true
        }, 'md');

        const timeHtml = this.relativeTime(createdAt);
        const heartIcon = liked ? this.icons.heartFilled : this.icons.heartOutline;
        const likedClass = liked ? ' post-action--liked' : '';

        const imageHtml = imageUrl
            ? `<div class="post-card__image"><img src="${imageUrl}" alt="Post image" loading="lazy"></div>`
            : '';

        return `<article class="post-card" data-post-id="${id}">
            <div class="post-card__header">
                <a href="${authorHref}" class="post-card__author" data-navlink>
                    ${avatarHtml}
                    <div class="post-card__author-info">
                        <span class="post-card__author-name">${this._esc(authorName)} ${this.verifiedBadge('sm')}</span>
                        <span class="post-card__time">${timeHtml}</span>
                    </div>
                </a>
            </div>
            <div class="post-card__content">
                <p class="post-card__text">${this._escMultiline(text)}</p>
                ${imageHtml}
            </div>
            <div class="post-card__actions">
                <button class="post-action${likedClass}" data-action="like" data-post-id="${id}">
                    <span class="post-action__icon">${heartIcon}</span>
                    <span class="post-action__count">${likeCount > 0 ? likeCount : ''}</span>
                </button>
                <a href="/post/${id}" class="post-action" data-navlink>
                    <span class="post-action__icon">${this.icons.comment}</span>
                    <span class="post-action__count">${commentCount > 0 ? commentCount : ''}</span>
                </a>
                <button class="post-action" data-action="share" data-post-id="${id}">
                    <span class="post-action__icon">${this.icons.share}</span>
                </button>
            </div>
        </article>`;
    },

    // ============================================
    // Post Composer
    // ============================================

    postComposer(user) {
        if (!user) return '';
        const avatarHtml = this.personAvatar({
            name: user.name,
            photoUrl: user.photoUrl,
            verified: true
        }, 'md');

        return `<div class="post-composer">
            <div class="post-composer__header">
                ${avatarHtml}
                <textarea class="post-composer__input" placeholder="What's on your mind?" maxlength="1000" rows="1"></textarea>
            </div>
            <div class="post-composer__footer">
                <div class="post-composer__tools">
                    <button class="post-composer__tool" data-action="upload-image" title="Add image">
                        ${this.icons.image}
                    </button>
                </div>
                <div class="post-composer__meta">
                    <span class="post-composer__counter">0 / 1000</span>
                    <button class="btn btn-primary post-composer__submit" disabled>Post</button>
                </div>
            </div>
            <div class="post-composer__preview" style="display:none"></div>
        </div>`;
    },

    // ============================================
    // Conversation Item
    // ============================================

    conversationItem(conversation, currentUserId) {
        if (!conversation) return '';
        const {
            id, participants = [], participantNames = [], participantPhotos = [],
            participantTmdbIds = [], lastMessage = '', lastMessageAt, unreadCount = 0
        } = conversation;

        // Find the other participant
        let otherIndex = participants.indexOf(currentUserId) === 0 ? 1 : 0;
        if (participants.length < 2) otherIndex = 0;

        const otherName = participantNames[otherIndex] || 'Unknown';
        const otherPhoto = participantPhotos[otherIndex] || null;

        const avatarHtml = this.personAvatar({
            name: otherName,
            photoUrl: otherPhoto,
            verified: true
        }, 'md');

        const timeHtml = this.relativeTime(lastMessageAt);
        const truncatedMsg = lastMessage.length > 80
            ? lastMessage.substring(0, 80) + '...'
            : lastMessage;
        const unreadHtml = unreadCount > 0
            ? `<span class="conversation-item__unread">${unreadCount}</span>`
            : '';

        return `<a href="/messages/${id}" class="conversation-item${unreadCount > 0 ? ' conversation-item--unread' : ''}" data-navlink>
            <div class="conversation-item__avatar">${avatarHtml}</div>
            <div class="conversation-item__body">
                <div class="conversation-item__top">
                    <span class="conversation-item__name">${this._esc(otherName)} ${this.verifiedBadge('sm')}</span>
                    <span class="conversation-item__time">${timeHtml}</span>
                </div>
                <div class="conversation-item__bottom">
                    <span class="conversation-item__preview">${this._esc(truncatedMsg)}</span>
                    ${unreadHtml}
                </div>
            </div>
        </a>`;
    },

    // ============================================
    // Chat Message Bubble
    // ============================================

    chatMessage(message, isSent) {
        if (!message) return '';
        const { text = '', createdAt, readAt } = message;
        const timeHtml = this.relativeTime(createdAt);
        const alignClass = isSent ? 'chat-message--sent' : 'chat-message--received';

        let receiptHtml = '';
        if (isSent) {
            receiptHtml = readAt
                ? `<span class="chat-message__receipt chat-message__receipt--read">${this.icons.checkDouble}</span>`
                : `<span class="chat-message__receipt">${this.icons.check}</span>`;
        }

        return `<div class="chat-message ${alignClass}">
            <div class="chat-message__bubble">
                <p class="chat-message__text">${this._escMultiline(text)}</p>
            </div>
            <div class="chat-message__meta">
                <span class="chat-message__time">${timeHtml}</span>
                ${receiptHtml}
            </div>
        </div>`;
    },

    // ============================================
    // Toast Notification
    // ============================================

    toast(message, type = 'info') {
        const iconMap = {
            success: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><path d="M7 10L9 12L13 8"/></svg>`,
            error: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--danger)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><path d="M10 6.5V10.5"/><circle cx="10" cy="13.5" r="0.5" fill="var(--danger)"/></svg>`,
            warning: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--warning)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L18 17H2L10 3Z"/><path d="M10 9V12"/><circle cx="10" cy="14.5" r="0.5" fill="var(--warning)"/></svg>`,
            info: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--info)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><path d="M10 9V14"/><circle cx="10" cy="6.5" r="0.5" fill="var(--info)"/></svg>`,
        };

        // Ensure toast container exists
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const el = document.createElement('div');
        el.className = `toast toast--${type}`;
        el.innerHTML = `
            <span class="toast__icon">${iconMap[type] || iconMap.info}</span>
            <span class="toast__message">${this._esc(message)}</span>
            <button class="toast__close" aria-label="Close">${this.icons.close}</button>
        `;

        container.appendChild(el);

        // Trigger enter animation on next frame
        requestAnimationFrame(() => {
            el.classList.add('toast--visible');
        });

        const dismiss = () => {
            el.classList.remove('toast--visible');
            el.addEventListener('transitionend', () => el.remove(), { once: true });
            // Fallback removal if transition doesn't fire
            setTimeout(() => { if (el.parentNode) el.remove(); }, 400);
        };

        el.querySelector('.toast__close').addEventListener('click', dismiss);

        // Auto-dismiss after 4 seconds
        setTimeout(dismiss, 4000);
    },

    // ============================================
    // Modal
    // ============================================

    modal(title, bodyHtml, footerHtml = '') {
        const footerSection = footerHtml
            ? `<div class="modal__footer">${footerHtml}</div>`
            : '';

        return `<div class="modal-overlay">
            <div class="modal">
                <div class="modal__header">
                    <h2 class="modal__title">${this._esc(title)}</h2>
                    <button class="modal__close" aria-label="Close modal">${this.icons.close}</button>
                </div>
                <div class="modal__body">${bodyHtml}</div>
                ${footerSection}
            </div>
        </div>`;
    },

    showModal(title, bodyHtml, footerHtml = '') {
        // Remove any existing modal
        this.closeModal();

        const html = this.modal(title, bodyHtml, footerHtml);
        const wrapper = document.createElement('div');
        wrapper.id = 'modal-root';
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);

        const overlay = wrapper.querySelector('.modal-overlay');
        const modalEl = wrapper.querySelector('.modal');
        const closeBtn = wrapper.querySelector('.modal__close');

        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('modal-overlay--visible');
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeModal();
        });

        // Close on button click
        closeBtn.addEventListener('click', () => this.closeModal());

        // Close on ESC
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        return modalEl;
    },

    closeModal() {
        const root = document.getElementById('modal-root');
        if (!root) return;
        const overlay = root.querySelector('.modal-overlay');
        if (overlay) {
            overlay.classList.remove('modal-overlay--visible');
            overlay.addEventListener('transitionend', () => root.remove(), { once: true });
            setTimeout(() => { if (root.parentNode) root.remove(); }, 400);
        } else {
            root.remove();
        }
    },

    // ============================================
    // Empty State
    // ============================================

    emptyState(icon, title, message, actionHtml = '') {
        return `<div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <h2 class="empty-state-title">${this._esc(title)}</h2>
            <p class="empty-state-text">${this._esc(message)}</p>
            ${actionHtml ? `<div class="empty-state-action">${actionHtml}</div>` : ''}
        </div>`;
    },

    // ============================================
    // Section
    // ============================================

    section(title, contentHtml, extraClass = '') {
        const cls = extraClass ? ` ${extraClass}` : '';
        return `<section class="section${cls}">
            <h2 class="section-title">${this._esc(title)}</h2>
            <div class="section-content">${contentHtml}</div>
        </section>`;
    },

    // ============================================
    // Error Page
    // ============================================

    errorPage(message) {
        return `<div class="empty-state" style="min-height:60vh">
            <div class="empty-state-icon">😵</div>
            <h2>Something went wrong</h2>
            <p class="empty-state-text">${this._esc(message) || 'Please try again.'}</p>
            <a href="/" class="btn btn-primary" style="margin-top:1rem">Go Home</a>
        </div>`;
    },

    // ============================================
    // Relative Time
    // ============================================

    relativeTime(dateString) {
        if (!dateString) return '';

        let date;
        try {
            date = new Date(dateString);
        } catch (e) {
            return '';
        }

        if (isNaN(date.getTime())) return '';

        const now = Date.now();
        const diffMs = now - date.getTime();

        // Future dates: show as "just now"
        if (diffMs < 0) return 'just now';

        const seconds = Math.floor(diffMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        // Beyond 7 days: "Mon D" format
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
    },

    // ============================================
    // Filmography Item
    // ============================================

    filmographyItem(credit, type = 'movie') {
        if (!credit) return '';
        const title = credit.title || credit.name || 'Untitled';
        const role = credit.character || credit.job || '';
        const posterPath = credit.poster_path;
        const releaseDate = credit.release_date || credit.first_air_date || '';
        const year = releaseDate ? releaseDate.substring(0, 4) : '';
        const rating = credit.vote_average ? credit.vote_average.toFixed(1) : '';

        const posterUrl = API.posterUrl(posterPath, 'small');
        const posterHtml = posterUrl
            ? `<img class="filmography-item__poster" src="${posterUrl}" alt="${this._esc(title)}" loading="lazy">`
            : `<div class="filmography-item__poster filmography-item__poster--fallback">${this.icons.image}</div>`;

        const slug = API.generateSlug(title);
        const linkType = type === 'tv' ? 'tv' : 'movie';
        const href = `https://freshkernels.com/${linkType}/${slug}-${credit.id}`;

        return `<a href="${href}" class="filmography-item" target="_blank" rel="noopener noreferrer">
            <div class="filmography-item__poster-wrap">${posterHtml}</div>
            <div class="filmography-item__info">
                <span class="filmography-item__title">${this._esc(title)}</span>
                ${role ? `<span class="filmography-item__role">${this._esc(role)}</span>` : ''}
                <div class="filmography-item__meta">
                    ${year ? `<span class="filmography-item__year">${year}</span>` : ''}
                    ${rating ? `<span class="filmography-item__rating">★ ${rating}</span>` : ''}
                </div>
            </div>
        </a>`;
    },

    // ============================================
    // Claim Profile CTA
    // ============================================

    claimProfileCTA(person) {
        if (!person) return '';
        const name = person.name || 'Unknown';
        return `<div class="claim-cta">
            <div class="claim-cta__content">
                <h3 class="claim-cta__title">Is this you?</h3>
                <p class="claim-cta__text">Claim your profile on Screenshoe and connect with other verified professionals in the industry.</p>
                <a href="/verify" class="btn btn-primary claim-cta__btn" data-navlink>Claim ${this._esc(name)}'s Profile</a>
            </div>
        </div>`;
    },

    // ============================================
    // Stats Row
    // ============================================

    statsRow(stats) {
        if (!stats || !stats.length) return '';
        const items = stats.map(s =>
            `<div class="stat-item">
                <span class="stat-item__value">${this._esc(String(s.value))}</span>
                <span class="stat-item__label">${this._esc(s.label)}</span>
            </div>`
        ).join('');
        return `<div class="stats-row">${items}</div>`;
    },

    // ============================================
    // Search Result Item
    // ============================================

    searchResultItem(person) {
        if (!person) return '';
        const id = person.id;
        const name = person.name || 'Unknown';
        const profilePath = person.profile_path;
        const department = person.known_for_department || '';
        const verified = person.verified;

        const slug = API.generateSlug(name);
        const href = slug ? `/person/${id}/${slug}` : `/person/${id}`;
        const imgUrl = API.profileUrl(profilePath, 'small');
        const initial = name.charAt(0).toUpperCase();

        const photoHtml = imgUrl
            ? `<img class="search-result__photo" src="${imgUrl}" alt="${this._esc(name)}" loading="lazy">`
            : `<div class="search-result__photo search-result__photo--fallback">${initial}</div>`;

        const badgeHtml = verified ? ` ${this.verifiedBadge('sm')}` : '';

        return `<a href="${href}" class="search-result" data-navlink>
            <div class="search-result__photo-wrap">${photoHtml}</div>
            <div class="search-result__info">
                <span class="search-result__name">${this._esc(name)}${badgeHtml}</span>
                ${department ? `<span class="search-result__dept">${this._esc(department)}</span>` : ''}
            </div>
        </a>`;
    },

    // ============================================
    // Pagination
    // ============================================

    pagination(currentPage, totalPages, baseUrl) {
        if (!totalPages || totalPages <= 1) return '';
        const page = parseInt(currentPage, 10) || 1;
        const total = parseInt(totalPages, 10) || 1;

        const separator = baseUrl.includes('?') ? '&' : '?';

        const prevDisabled = page <= 1;
        const nextDisabled = page >= total;

        const prevHref = prevDisabled ? '#' : `${baseUrl}${separator}page=${page - 1}`;
        const nextHref = nextDisabled ? '#' : `${baseUrl}${separator}page=${page + 1}`;

        return `<nav class="pagination">
            <a href="${prevHref}" class="pagination__btn${prevDisabled ? ' pagination__btn--disabled' : ''}" data-navlink${prevDisabled ? ' aria-disabled="true"' : ''}>← Previous</a>
            <span class="pagination__info">Page ${page} of ${total}</span>
            <a href="${nextHref}" class="pagination__btn${nextDisabled ? ' pagination__btn--disabled' : ''}" data-navlink${nextDisabled ? ' aria-disabled="true"' : ''}>Next →</a>
        </nav>`;
    },

    // ============================================
    // Department Badge
    // ============================================

    departmentBadge(department) {
        if (!department) return '';
        return `<span class="dept-badge">${this._esc(department)}</span>`;
    },

    // ============================================
    // Utility: HTML Escaping
    // ============================================

    _esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    _escMultiline(str) {
        if (str == null) return '';
        return this._esc(str).replace(/\n/g, '<br>');
    },
};

// Export for use in other modules
window.Components = Components;
