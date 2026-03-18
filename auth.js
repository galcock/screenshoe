const Auth = {
    _currentUser: null,        // Firebase Auth user
    _userProfile: null,        // Firestore user document data
    _initialized: false,
    _authResolve: null,

    // The Firestore user document schema:
    // Collection: 'ss_users' (prefixed to avoid collision with FK's 'users')
    // Doc ID: Firebase Auth UID
    // Fields: { email, displayName, photoURL, tmdbId, verified, role, verificationStatus, createdAt, lastLoginAt, blockedUsers, notificationPrefs }

    init() {
        return new Promise((resolve) => {
            this._authResolve = resolve;

            if (!auth || !auth.onAuthStateChanged) {
                console.warn('Firebase Auth not available');
                this._initialized = true;
                this._updateNav(null);
                resolve();
                return;
            }

            const timeout = setTimeout(() => {
                if (!this._initialized) {
                    this._initialized = true;
                    this._updateNav(null);
                    resolve();
                }
            }, 5000);

            auth.onAuthStateChanged(async (user) => {
                clearTimeout(timeout);
                this._currentUser = user;

                if (user) {
                    await this._loadUserProfile(user);
                    this._updateNav(user);
                } else {
                    this._userProfile = null;
                    this._updateNav(null);
                }

                if (!this._initialized) {
                    this._initialized = true;
                    resolve();
                }
            });
        });
    },

    async _loadUserProfile(user) {
        // Load from Firestore ss_users/{uid}
        // If doc doesn't exist, create it (first sign-in)
        // Update lastLoginAt
        try {
            if (!db) return;
            const doc = await db.collection('ss_users').doc(user.uid).get();
            if (doc.exists) {
                this._userProfile = doc.data();
                // Update last login
                db.collection('ss_users').doc(user.uid).update({
                    lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(() => {});
            } else {
                // First time sign-in — create user doc
                const profile = {
                    email: user.email,
                    displayName: user.displayName || '',
                    photoURL: user.photoURL || '',
                    tmdbId: null,
                    verified: false,
                    role: 'user',
                    verificationStatus: 'none', // none, pending, approved, rejected
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
                    blockedUsers: [],
                    notificationPrefs: { dmEmail: true }
                };
                await db.collection('ss_users').doc(user.uid).set(profile);
                this._userProfile = profile;
            }
        } catch (err) {
            console.error('Failed to load user profile:', err);
        }
    },

    // Sign in with Google
    async signInWithGoogle() {
        if (!auth) {
            Components.toast('Authentication not available', 'error');
            return;
        }
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
            Components.toast('Welcome to Screenshoe!', 'success');
            // Redirect to verify if not verified
            if (!this.isVerified()) {
                Router.navigate('/verify');
            } else {
                Router.navigate('/');
            }
        } catch (err) {
            if (err.code !== 'auth/popup-closed-by-user') {
                Components.toast('Sign in failed: ' + err.message, 'error');
            }
        }
    },

    async signOut() {
        if (!auth) return;
        try {
            await auth.signOut();
            this._userProfile = null;
            Components.toast('Signed out', 'info');
            Router.navigate('/');
        } catch (err) {
            Components.toast('Sign out failed', 'error');
        }
    },

    // Getters
    isSignedIn() { return !!this._currentUser; },
    isVerified() { return this._userProfile?.verified === true; },
    isAdmin() { return this._userProfile?.role === 'admin'; },
    getUser() { return this._currentUser; },
    getProfile() { return this._userProfile; },
    getUid() { return this._currentUser?.uid || null; },
    getTmdbId() { return this._userProfile?.tmdbId || null; },

    // Get the verified user's profile URL
    getProfileUrl() {
        if (!this._userProfile?.tmdbId) return null;
        return `/person/${this._userProfile.tmdbId}`;
    },

    // Check if a TMDB person is claimed
    async isProfileClaimed(tmdbId) {
        if (!db) return false;
        try {
            const doc = await db.collection('ss_profiles').doc(String(tmdbId)).get();
            return doc.exists && doc.data().claimedBy != null;
        } catch (err) {
            return false;
        }
    },

    // Check if current user owns a specific profile
    ownsProfile(tmdbId) {
        return this.isVerified() && this._userProfile?.tmdbId === Number(tmdbId);
    },

    // Update nav UI based on auth state
    _updateNav(user) {
        const guestEls = document.querySelectorAll('.nav-link-guest');
        const authEls = document.querySelectorAll('.nav-link-auth');
        const avatar = document.querySelector('.nav-user-avatar');

        if (user && this._userProfile) {
            guestEls.forEach(el => el.style.display = 'none');
            authEls.forEach(el => el.style.display = '');
            if (avatar) {
                avatar.src = this._userProfile.customPhotoUrl || user.photoURL || '';
                avatar.alt = user.displayName || 'Profile';
            }
            // Update "My Profile" link
            const profileLink = document.querySelector('.nav-user-dropdown a[href="/profile"]');
            if (profileLink && this._userProfile.tmdbId) {
                profileLink.href = `/person/${this._userProfile.tmdbId}`;
            }
        } else {
            guestEls.forEach(el => el.style.display = '');
            authEls.forEach(el => el.style.display = 'none');
        }
    },

    // Require auth — redirect to login if not signed in
    requireAuth() {
        if (!this.isSignedIn()) {
            Router.navigate('/login');
            return false;
        }
        return true;
    },

    // Require verified — redirect to verify if not verified
    requireVerified() {
        if (!this.isSignedIn()) {
            Router.navigate('/login');
            return false;
        }
        if (!this.isVerified()) {
            Router.navigate('/verify');
            return false;
        }
        return true;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        if (e.target.id === 'nav-signout' || e.target.closest('#nav-signout')) {
            e.preventDefault();
            Auth.signOut();
        }
        // Toggle user dropdown
        if (e.target.closest('.nav-user')) {
            const dropdown = document.querySelector('.nav-user-dropdown');
            if (dropdown) dropdown.style.display = dropdown.style.display === 'none' ? '' : 'none';
        } else {
            const dropdown = document.querySelector('.nav-user-dropdown');
            if (dropdown) dropdown.style.display = 'none';
        }
    });
});
