/**
 * FIREBASE AUTH MODULE
 * ====================
 *
 * Auth lifecycle extracted from firebase-module.js (Phase 4).
 * Provides: sign-in, sign-out, sign-up, password reset,
 * auth state change handling, and auth query helpers.
 *
 * Depends on: configure(deps) called by firebase-module.js init().
 * Export: window.DSFirebaseAuth
 */

(function initFirebaseAuth(global) {
    'use strict';

    // ── Dependency holders (set via configure) ───────────────────────────────
    var deps = {
        getAuth: null,
        getCurrentUser: null,
        setCurrentUser: null,
        getOnAuthCallback: null,
        setOnAuthCallback: null,
        applySignOutState: null,
        triggerPostSignInLoad: null,
        invalidateGameMetadataCache: null,
        stopAllianceDocListener: null,
    };

    function configure(options) {
        if (!options || typeof options !== 'object') { return; }
        Object.keys(deps).forEach(function (key) {
            if (typeof options[key] === 'function') {
                deps[key] = options[key];
            }
        });
    }

    // ── Pure helpers ─────────────────────────────────────────────────────────

    function isPasswordProvider(user) {
        if (!user || !user.providerData) {
            return false;
        }
        return user.providerData.some(function (provider) { return provider.providerId === 'password'; });
    }

    function isReauthRequiredError(error) {
        var code = error && error.code ? String(error.code) : '';
        return code === 'auth/requires-recent-login' || code === 'auth/user-token-expired';
    }

    // ── Auth state handler ───────────────────────────────────────────────────

    function handleAuthStateChanged(user) {
        deps.setCurrentUser(user);
        deps.invalidateGameMetadataCache();
        if (!user) {
            deps.stopAllianceDocListener();
        }

        if (user) {
            if (isPasswordProvider(user) && !user.emailVerified) {
                console.warn('Email not verified. Signing out.');
                deps.getAuth().signOut();
                var cb = deps.getOnAuthCallback();
                if (cb) { cb(false, null); }
                return;
            }

            console.log('✅ User signed in:', user.email);
            deps.triggerPostSignInLoad(user);

            var authCb = deps.getOnAuthCallback();
            if (authCb) { authCb(true, user); }
        } else {
            console.log('ℹ️ User signed out');
            deps.applySignOutState();

            var signOutCb = deps.getOnAuthCallback();
            if (signOutCb) { signOutCb(false, null); }
        }
    }

    // ── Auth callback setter ─────────────────────────────────────────────────

    function setAuthCallback(callback) {
        deps.setOnAuthCallback(callback);
    }

    // ── Auth operations ──────────────────────────────────────────────────────

    async function signInWithGoogle() {
        try {
            var auth = deps.getAuth();
            var provider = new firebase.auth.GoogleAuthProvider();
            var result = await auth.signInWithPopup(provider);
            console.log('✅ Google sign-in successful');
            return { success: true, user: result.user };
        } catch (error) {
            console.error('❌ Google sign-in failed:', error);
            var popupErrorCodes = new Set([
                'auth/popup-blocked',
                'auth/popup-closed-by-user',
                'auth/cancelled-popup-request',
                'auth/operation-not-supported-in-this-environment',
            ]);

            if (error && popupErrorCodes.has(error.code)) {
                try {
                    var authRetry = deps.getAuth();
                    var redirectProvider = new firebase.auth.GoogleAuthProvider();
                    await authRetry.signInWithRedirect(redirectProvider);
                    console.log('🔁 Falling back to redirect sign-in');
                    return { success: true, redirect: true };
                } catch (redirectError) {
                    console.error('❌ Redirect sign-in failed:', redirectError);
                    return { success: false, error: redirectError.message || 'Redirect sign-in failed' };
                }
            }

            return { success: false, error: error.message || 'Google sign-in failed' };
        }
    }

    async function signInWithEmail(email, password) {
        try {
            var auth = deps.getAuth();
            var result = await auth.signInWithEmailAndPassword(email, password);

            if (!result.user.emailVerified) {
                await auth.signOut();
                return { success: false, error: 'Email not verified. Check your inbox.' };
            }
            console.log('✅ Email sign-in successful');
            return { success: true, user: result.user };
        } catch (error) {
            console.error('❌ Email sign-in failed:', error);
            return { success: false, error: error.message };
        }
    }

    async function signUpWithEmail(email, password) {
        try {
            var auth = deps.getAuth();
            var result = await auth.createUserWithEmailAndPassword(email, password);
            await result.user.sendEmailVerification();
            console.log('✅ Account created successfully');
            return {
                success: true,
                user: result.user,
                message: 'Account created! Please check your email for verification.',
            };
        } catch (error) {
            console.error('❌ Sign-up failed:', error);
            return { success: false, error: error.message };
        }
    }

    async function resetPassword(email) {
        try {
            var auth = deps.getAuth();
            await auth.sendPasswordResetEmail(email);
            console.log('✅ Password reset email sent');
            return {
                success: true,
                message: 'Password reset email sent. Check your inbox.',
            };
        } catch (error) {
            console.error('❌ Password reset failed:', error);
            return { success: false, error: error.message };
        }
    }

    async function signOut() {
        try {
            var auth = deps.getAuth();
            await auth.signOut();
            console.log('✅ User signed out');
            return { success: true };
        } catch (error) {
            console.error('❌ Sign-out failed:', error);
            return { success: false, error: error.message };
        }
    }

    // ── Auth query helpers ───────────────────────────────────────────────────

    function getCurrentUser() {
        return deps.getCurrentUser();
    }

    function isSignedIn() {
        return deps.getCurrentUser() !== null;
    }

    // ── Public API ───────────────────────────────────────────────────────────

    global.DSFirebaseAuth = {
        configure: configure,
        handleAuthStateChanged: handleAuthStateChanged,
        setAuthCallback: setAuthCallback,
        signInWithGoogle: signInWithGoogle,
        signInWithEmail: signInWithEmail,
        signUpWithEmail: signUpWithEmail,
        resetPassword: resetPassword,
        signOut: signOut,
        getCurrentUser: getCurrentUser,
        isSignedIn: isSignedIn,
        isPasswordProvider: isPasswordProvider,
        isReauthRequiredError: isReauthRequiredError,
    };

})(typeof window !== 'undefined' ? window : global);
