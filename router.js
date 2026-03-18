/**
 * Screenshoe - SPA Router
 * History API based router for client-side navigation
 */

const Router = {
    routes: {
        '/': 'home',
        '/discover': 'discover',
        '/discover/:department': 'discoverDepartment',
        '/person/:id': 'person',
        '/person/:id/:slug': 'person',
        '/feed': 'feed',
        '/post/:id': 'postDetail',
        '/messages': 'messages',
        '/messages/:id': 'conversation',
        '/verify': 'verify',
        '/settings': 'settings',
        '/admin': 'admin',
        '/login': 'login',
        '/about': 'about',
        '/search': 'search',
    },

    current: { route: null, params: {}, query: {} },
    _listeners: [],

    init() {
        // Check sessionStorage for redirect from 404.html
        const redirectPath = sessionStorage.getItem('screenshoe-redirect-path');
        if (redirectPath) {
            sessionStorage.removeItem('screenshoe-redirect-path');
            history.replaceState(null, '', redirectPath);
        }

        // Listen for popstate (back/forward)
        window.addEventListener('popstate', () => this.handleRoute());

        // Intercept all link clicks for SPA navigation
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            const href = link.getAttribute('href');
            if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#') || link.target === '_blank') return;
            e.preventDefault();
            this.navigate(href);
        });

        this.handleRoute();
    },

    navigate(path) {
        if (path === window.location.pathname + window.location.search) return;
        history.pushState(null, '', path);
        this.handleRoute();
        window.scrollTo(0, 0);
    },

    handleRoute() {
        const path = window.location.pathname;
        const query = Object.fromEntries(new URLSearchParams(window.location.search));

        for (const [pattern, route] of Object.entries(this.routes)) {
            const params = this._matchRoute(pattern, path);
            if (params !== null) {
                this.current = { route, params, query };
                this.render(route, params, query);
                return;
            }
        }

        // 404
        this.current = { route: 'notFound', params: {}, query };
        this.render('notFound', {}, query);
    },

    _matchRoute(pattern, path) {
        const patternParts = pattern.split('/').filter(Boolean);
        const pathParts = path.split('/').filter(Boolean);

        // Handle exact root match
        if (patternParts.length === 0 && pathParts.length === 0) return {};

        // For non-optional params, lengths must match
        // But allow slug to be optional for person routes
        if (pattern.includes(':slug')) {
            if (pathParts.length < patternParts.length - 1 || pathParts.length > patternParts.length) return null;
        } else {
            if (patternParts.length !== pathParts.length) return null;
        }

        const params = {};
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i].startsWith(':')) {
                const key = patternParts[i].slice(1);
                if (pathParts[i]) {
                    params[key] = decodeURIComponent(pathParts[i]);
                }
            } else if (patternParts[i] !== pathParts[i]) {
                return null;
            }
        }
        return params;
    },

    async render(route, params, query) {
        const app = document.getElementById('app');
        if (!app) return;

        // Show loading
        app.innerHTML = Components.pageLoading();

        try {
            let content = '';
            switch (route) {
                case 'home': content = await Pages.home(); break;
                case 'discover': content = await Pages.discover(); break;
                case 'discoverDepartment': content = await Pages.discover(params.department); break;
                case 'person': content = await Pages.person(params.id, params.slug); break;
                case 'feed': content = await Pages.feed(); break;
                case 'postDetail': content = await Pages.postDetail(params.id); break;
                case 'messages': content = await Pages.messages(); break;
                case 'conversation': content = await Pages.conversation(params.id); break;
                case 'verify': content = await Pages.verify(); break;
                case 'settings': content = await Pages.settings(); break;
                case 'admin': content = await Pages.admin(); break;
                case 'login': content = await Pages.login(); break;
                case 'about': content = await Pages.about(); break;
                case 'search': content = await Pages.search(query); break;
                default: content = Pages.notFound(); break;
            }
            app.innerHTML = content;

            // Run page-specific initialization
            if (Pages._afterRender[route]) {
                Pages._afterRender[route](params, query);
            }

            // Notify listeners
            this._listeners.forEach(fn => fn(route, params, query));
        } catch (err) {
            console.error('Route render error:', err);
            app.innerHTML = Pages.error(err.message);
        }
    },

    onRouteChange(fn) {
        this._listeners.push(fn);
    }
};

// Export for use in other modules
window.Router = Router;
