/**
 * Screenshoe - Firebase Configuration
 * Reuses the Fresh Kernels Firebase project for auth, database, and storage.
 *
 * Required Firebase services:
 *  - Authentication (Email/Password + Google)
 *  - Cloud Firestore (user profiles, posts, messages, verification)
 *  - Cloud Storage (profile photos, post media)
 */

const firebaseConfig = {
    apiKey: "AIzaSyCS5jsWJClD15kAIhXyusgQlFJyFgPEWbQ",
    authDomain: "fresh-kernels.firebaseapp.com",
    projectId: "fresh-kernels",
    storageBucket: "fresh-kernels.firebasestorage.app",
    messagingSenderId: "503953284654",
    appId: "1:503953284654:web:b4a1f2c3162101bf6ec9bf",
    measurementId: "G-CX8BHCS7YY"
};

let auth = null;
let db = null;
let storage = null;

const _firebaseConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_');

if (_firebaseConfigured && typeof firebase !== 'undefined') {
    try {
        // Avoid double-initialization if already loaded
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        auth = firebase.auth();
        db = firebase.firestore();

        // Initialize storage if available
        if (firebase.storage) {
            storage = firebase.storage();
        }

        // Enable offline persistence for Firestore
        db.enablePersistence({ synchronizeTabs: true }).catch(err => {
            if (err.code === 'failed-precondition') {
                console.warn('Firestore persistence unavailable: multiple tabs open');
            } else if (err.code === 'unimplemented') {
                console.warn('Firestore persistence not supported in this browser');
            }
        });

        console.log('Firebase initialized for Screenshoe');
    } catch (e) {
        console.warn('Firebase initialization failed:', e.message);
        auth = null;
        db = null;
        storage = null;
    }
} else {
    if (typeof firebase === 'undefined') {
        console.log('Firebase SDK not loaded. Include Firebase scripts before firebase-config.js. Running in local-only mode.');
    } else {
        console.log('Firebase not configured. Running in local-only mode.');
    }
}

// Export globals
window.auth = auth;
window.db = db;
window.storage = storage;
