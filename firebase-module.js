/**
 * FIREBASE MODULE FOR DESERT STORM & CANYON BATTLEFIELD
 * =====================================================
 * 
 * This module handles all Firebase functionality:
 * - Authentication (Google + Email/Password)
 * - Firestore database operations
 * - Player database management
 * - Backup/restore functionality
 * 
 * USAGE:
 * 1. Include Firebase SDKs in your HTML
 * 2. Include this file
 * 3. Call FirebaseManager.init()
 * 4. Use provided functions
 */

const FirebaseManager = (function() {
    
    // Firebase configuration - loaded from firebase-config.js
    // DO NOT hardcode your API key here - use firebase-config.js instead
    let firebaseConfig = null;
    
    // Check if config is loaded from firebase-config.js
    if (typeof FIREBASE_CONFIG !== 'undefined') {
        firebaseConfig = FIREBASE_CONFIG;
        console.log('✅ Firebase config loaded from firebase-config.js');
    } else {
        console.error('❌ Firebase config not found!');
        console.error('Please create firebase-config.js with your Firebase credentials');
        alert('Firebase configuration missing! Please create firebase-config.js file.');
    }
    
    function createEmptyEventEntry() {
        return { buildingConfig: null, buildingConfigVersion: 0, buildingPositions: null, buildingPositionsVersion: 0 };
    }

    function createEmptyEventData() {
        return {
            desert_storm: createEmptyEventEntry(),
            canyon_battlefield: createEmptyEventEntry()
        };
    }

    // Private variables
    let auth = null;
    let db = null;
    let currentUser = null;
    let playerDatabase = {};
    // Per-event building data: { desert_storm: { buildingConfig, buildingConfigVersion, buildingPositions, buildingPositionsVersion }, canyon_battlefield: { ... } }
    let eventData = createEmptyEventData();
    let allianceId = null;
    let allianceName = null;
    let allianceData = null;
    let playerSource = 'personal';
    let pendingInvitations = [];
    let userProfile = { displayName: '', nickname: '', avatarDataUrl: '' };
    let onAuthCallback = null;
    let onDataLoadCallback = null;

    const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
    const MAX_PROFILE_TEXT_LEN = 60;
    const MAX_AVATAR_DATA_URL_LEN = 400000;
    const EVENT_IDS = ['desert_storm', 'canyon_battlefield'];
    const GLOBAL_COORD_OWNER_EMAIL = 'constantinescu.cristian@gmail.com';
    const GLOBAL_COORDS_COLLECTION = 'app_config';
    const GLOBAL_COORDS_DOC_ID = 'default_event_positions';
    const GLOBAL_BUILDING_CONFIG_DOC_ID = 'default_event_building_config';
    let globalDefaultEventPositions = {
        desert_storm: {},
        canyon_battlefield: {}
    };
    let globalDefaultPositionsVersion = 0;
    let globalDefaultEventBuildingConfig = {
        desert_storm: null,
        canyon_battlefield: null
    };
    let globalDefaultBuildingConfigVersion = 0;

    function emptyGlobalEventPositions() {
        return {
            desert_storm: {},
            canyon_battlefield: {}
        };
    }

    function emptyGlobalBuildingConfig() {
        return {
            desert_storm: null,
            canyon_battlefield: null
        };
    }

    function normalizeCoordinatePair(value) {
        if (!Array.isArray(value) || value.length < 2) {
            return null;
        }
        const x = Number(value[0]);
        const y = Number(value[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }
        return [Math.round(x), Math.round(y)];
    }

    function normalizePositionsMap(positions) {
        if (!positions || typeof positions !== 'object') {
            return {};
        }
        const normalized = {};
        Object.entries(positions).forEach(([name, coords]) => {
            if (typeof name !== 'string' || !name.trim()) {
                return;
            }
            const pair = normalizeCoordinatePair(coords);
            if (pair) {
                normalized[name] = pair;
            }
        });
        return normalized;
    }

    function normalizeEventPositionsPayload(payload) {
        const source = payload && typeof payload === 'object'
            ? payload
            : {};
        const normalized = emptyGlobalEventPositions();
        EVENT_IDS.forEach((eid) => {
            normalized[eid] = normalizePositionsMap(source[eid]);
        });
        return normalized;
    }

    function hasAnyPositions(events) {
        return EVENT_IDS.some((eid) => Object.keys((events && events[eid]) || {}).length > 0);
    }

    function toMillis(value) {
        if (!value) {
            return 0;
        }
        if (typeof value.toMillis === 'function') {
            const ms = Number(value.toMillis());
            return Number.isFinite(ms) && ms > 0 ? ms : 0;
        }
        if (typeof value === 'string') {
            const parsed = Date.parse(value);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        }
        if (typeof value === 'number') {
            return Number.isFinite(value) && value > 0 ? value : 0;
        }
        return 0;
    }

    function extractVersionFromUserData(data) {
        if (!data || typeof data !== 'object') {
            return 0;
        }
        const metadata = data.metadata && typeof data.metadata === 'object'
            ? data.metadata
            : {};
        const metaVersion = Math.max(
            toMillis(metadata.lastModified),
            toMillis(metadata.lastUpload)
        );
        let eventVersion = 0;
        if (data.events && typeof data.events === 'object') {
            EVENT_IDS.forEach((eid) => {
                const entry = data.events[eid];
                if (!entry || typeof entry !== 'object') {
                    return;
                }
                const positionsVersion = Number(entry.buildingPositionsVersion);
                if (Number.isFinite(positionsVersion) && positionsVersion > eventVersion) {
                    eventVersion = positionsVersion;
                }
                const configVersion = Number(entry.buildingConfigVersion);
                if (Number.isFinite(configVersion) && configVersion > eventVersion) {
                    eventVersion = configVersion;
                }
            });
        } else {
            const legacyPositionsVersion = Number(data.buildingPositionsVersion);
            if (Number.isFinite(legacyPositionsVersion) && legacyPositionsVersion > 0) {
                eventVersion = legacyPositionsVersion;
            }
            const legacyConfigVersion = Number(data.buildingConfigVersion);
            if (Number.isFinite(legacyConfigVersion) && legacyConfigVersion > eventVersion) {
                eventVersion = legacyConfigVersion;
            }
        }
        return Math.max(metaVersion, eventVersion);
    }

    function extractPositionsFromUserData(data) {
        const events = emptyGlobalEventPositions();
        if (data && data.events && typeof data.events === 'object') {
            EVENT_IDS.forEach((eid) => {
                const entry = data.events[eid];
                if (!entry || typeof entry !== 'object') {
                    return;
                }
                events[eid] = normalizePositionsMap(entry.buildingPositions);
            });
            return events;
        }
        if (data && data.buildingPositions && typeof data.buildingPositions === 'object') {
            events.desert_storm = normalizePositionsMap(data.buildingPositions);
        }
        return events;
    }

    function setGlobalDefaultPositions(events, version) {
        globalDefaultEventPositions = normalizeEventPositionsPayload(events);
        const parsedVersion = Number(version);
        globalDefaultPositionsVersion = Number.isFinite(parsedVersion) && parsedVersion > 0 ? parsedVersion : 0;
    }

    function normalizeBuildingConfigArray(config) {
        if (!Array.isArray(config)) {
            return null;
        }
        const normalized = [];
        config.forEach((item) => {
            if (!item || typeof item !== 'object') {
                return;
            }
            const name = typeof item.name === 'string' ? item.name.trim() : '';
            if (!name) {
                return;
            }
            const next = { name: name };
            if (typeof item.label === 'string' && item.label.trim()) {
                next.label = item.label.trim();
            }
            const slots = Number(item.slots);
            if (Number.isFinite(slots)) {
                next.slots = Math.round(slots);
            }
            const priority = Number(item.priority);
            if (Number.isFinite(priority)) {
                next.priority = Math.round(priority);
            }
            normalized.push(next);
        });
        return normalized.length > 0 ? normalized : null;
    }

    function normalizeEventBuildingConfigPayload(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const normalized = emptyGlobalBuildingConfig();
        EVENT_IDS.forEach((eid) => {
            normalized[eid] = normalizeBuildingConfigArray(source[eid]);
        });
        return normalized;
    }

    function hasAnyBuildingConfig(payload) {
        return EVENT_IDS.some((eid) => Array.isArray(payload && payload[eid]) && payload[eid].length > 0);
    }

    function extractBuildingConfigFromUserData(data) {
        const result = emptyGlobalBuildingConfig();
        if (data && data.events && typeof data.events === 'object') {
            EVENT_IDS.forEach((eid) => {
                const entry = data.events[eid];
                if (!entry || typeof entry !== 'object') {
                    return;
                }
                result[eid] = normalizeBuildingConfigArray(entry.buildingConfig);
            });
            return result;
        }
        if (data && Array.isArray(data.buildingConfig)) {
            result.desert_storm = normalizeBuildingConfigArray(data.buildingConfig);
        }
        return result;
    }

    function setGlobalDefaultBuildingConfig(payload, version) {
        globalDefaultEventBuildingConfig = normalizeEventBuildingConfigPayload(payload);
        const parsedVersion = Number(version);
        globalDefaultBuildingConfigVersion = Number.isFinite(parsedVersion) && parsedVersion > 0 ? parsedVersion : 0;
    }

    function getGlobalDefaultBuildingConfig(eventId) {
        const eid = eventId || 'desert_storm';
        return JSON.parse(JSON.stringify(globalDefaultEventBuildingConfig[eid] || null));
    }

    function getGlobalDefaultBuildingConfigVersion() {
        return globalDefaultBuildingConfigVersion;
    }

    function getGlobalDefaultBuildingPositions(eventId) {
        const eid = eventId || 'desert_storm';
        return JSON.parse(JSON.stringify(globalDefaultEventPositions[eid] || {}));
    }

    function getGlobalDefaultBuildingPositionsVersion() {
        return globalDefaultPositionsVersion;
    }

    async function tryLoadGlobalDefaultsDoc() {
        try {
            const defaultsDoc = await db.collection(GLOBAL_COORDS_COLLECTION).doc(GLOBAL_COORDS_DOC_ID).get();
            if (!defaultsDoc.exists) {
                return false;
            }
            const data = defaultsDoc.data() || {};
            const events = normalizeEventPositionsPayload(data.events || {});
            const version = Number(data.version);
            if (!hasAnyPositions(events)) {
                return false;
            }
            setGlobalDefaultPositions(events, Number.isFinite(version) && version > 0 ? version : 0);
            return true;
        } catch (error) {
            console.warn('Unable to load shared coordinate defaults:', error.message || error);
            return false;
        }
    }

    async function tryLoadGlobalDefaultsFromOwnerUser() {
        try {
            let query = await db.collection('users')
                .where('metadata.emailLower', '==', GLOBAL_COORD_OWNER_EMAIL)
                .limit(1)
                .get();
            if (query.empty) {
                query = await db.collection('users')
                    .where('metadata.email', '==', GLOBAL_COORD_OWNER_EMAIL)
                    .limit(1)
                    .get();
            }
            if (query.empty) {
                return false;
            }

            const ownerData = query.docs[0].data() || {};
            const events = extractPositionsFromUserData(ownerData);
            if (!hasAnyPositions(events)) {
                return false;
            }
            const version = Math.max(extractVersionFromUserData(ownerData), 1);
            setGlobalDefaultPositions(events, version);
            return true;
        } catch (error) {
            console.warn('Unable to load owner coordinate defaults:', error.message || error);
            return false;
        }
    }

    async function loadGlobalDefaultBuildingPositions() {
        if (!db) {
            setGlobalDefaultPositions(emptyGlobalEventPositions(), 0);
            return false;
        }
        const fromSharedDoc = await tryLoadGlobalDefaultsDoc();
        if (fromSharedDoc) {
            return true;
        }
        if (!currentUser || !currentUser.email || currentUser.email.toLowerCase() !== GLOBAL_COORD_OWNER_EMAIL) {
            return false;
        }
        return tryLoadGlobalDefaultsFromOwnerUser();
    }

    async function maybePublishGlobalDefaultsFromCurrentUser(userData) {
        if (!currentUser || !currentUser.email || currentUser.email.toLowerCase() !== GLOBAL_COORD_OWNER_EMAIL) {
            return false;
        }
        const events = extractPositionsFromUserData(userData || {});
        if (!hasAnyPositions(events)) {
            return false;
        }
        const version = Math.max(Date.now(), extractVersionFromUserData(userData || {}), 1);
        try {
            await db.collection(GLOBAL_COORDS_COLLECTION).doc(GLOBAL_COORDS_DOC_ID).set({
                sourceEmail: GLOBAL_COORD_OWNER_EMAIL,
                version: version,
                events: events,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            setGlobalDefaultPositions(events, version);
            return true;
        } catch (error) {
            console.warn('Unable to publish shared coordinate defaults:', error.message || error);
            return false;
        }
    }

    async function loadGlobalDefaultBuildingConfig() {
        if (!db) {
            setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
            return false;
        }
        try {
            const configDoc = await db.collection(GLOBAL_COORDS_COLLECTION).doc(GLOBAL_BUILDING_CONFIG_DOC_ID).get();
            if (!configDoc.exists) {
                setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
                return false;
            }
            const data = configDoc.data() || {};
            const events = normalizeEventBuildingConfigPayload(data.events || {});
            const version = Number(data.version);
            if (!hasAnyBuildingConfig(events)) {
                setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
                return false;
            }
            setGlobalDefaultBuildingConfig(events, Number.isFinite(version) && version > 0 ? version : 0);
            return true;
        } catch (error) {
            console.warn('Unable to load shared building config defaults:', error.message || error);
            setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
            return false;
        }
    }

    async function maybePublishGlobalBuildingConfigFromCurrentUser(userData) {
        if (!currentUser || !currentUser.email || currentUser.email.toLowerCase() !== GLOBAL_COORD_OWNER_EMAIL) {
            return false;
        }
        const events = extractBuildingConfigFromUserData(userData || {});
        if (!hasAnyBuildingConfig(events)) {
            return false;
        }
        const version = Math.max(Date.now(), extractVersionFromUserData(userData || {}), 1);
        try {
            await db.collection(GLOBAL_COORDS_COLLECTION).doc(GLOBAL_BUILDING_CONFIG_DOC_ID).set({
                sourceEmail: GLOBAL_COORD_OWNER_EMAIL,
                version: version,
                events: events,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            setGlobalDefaultBuildingConfig(events, version);
            return true;
        } catch (error) {
            console.warn('Unable to publish shared building config defaults:', error.message || error);
            return false;
        }
    }

    function normalizeUserProfile(profile) {
        const next = profile && typeof profile === 'object' ? profile : {};
        const displayName = typeof next.displayName === 'string' ? next.displayName.trim().slice(0, MAX_PROFILE_TEXT_LEN) : '';
        const nickname = typeof next.nickname === 'string' ? next.nickname.trim().slice(0, MAX_PROFILE_TEXT_LEN) : '';
        let avatarDataUrl = typeof next.avatarDataUrl === 'string' ? next.avatarDataUrl.trim() : '';
        if (!avatarDataUrl.startsWith('data:image/') || avatarDataUrl.length > MAX_AVATAR_DATA_URL_LEN) {
            avatarDataUrl = '';
        }
        return { displayName, nickname, avatarDataUrl };
    }
    
    /**
     * Initialize Firebase
     */
    function init() {
        try {
            if (!firebaseConfig) {
                throw new Error('Firebase configuration not loaded. Please create firebase-config.js');
            }
            
            firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();
            
            // Set up auth state observer
            auth.onAuthStateChanged(handleAuthStateChanged);
            
            console.log('✅ Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            return false;
        }
    }
    
    /**
     * Handle authentication state changes
     */
    function handleAuthStateChanged(user) {
        currentUser = user;
        
        if (user) {
            if (isPasswordProvider(user) && !user.emailVerified) {
                console.warn('Email not verified. Signing out.');
                auth.signOut();
                if (onAuthCallback) {
                    onAuthCallback(false, null);
                }
                return;
            }

            console.log('✅ User signed in:', user.email);
            loadUserData(user);
            
            if (onAuthCallback) {
                onAuthCallback(true, user);
            }
        } else {
            console.log('ℹ️ User signed out');
            playerDatabase = {};
            Object.keys(eventData).forEach(eid => {
                eventData[eid] = createEmptyEventEntry();
            });
            allianceId = null;
            allianceName = null;
            allianceData = null;
            playerSource = 'personal';
            pendingInvitations = [];
            userProfile = normalizeUserProfile(null);
            setGlobalDefaultPositions(emptyGlobalEventPositions(), 0);
            setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);

            if (onAuthCallback) {
                onAuthCallback(false, null);
            }
        }
    }
    
    /**
     * Set callback for auth state changes
     */
    function setAuthCallback(callback) {
        onAuthCallback = callback;
    }
    
    /**
     * Set callback for data load
     */
    function setDataLoadCallback(callback) {
        onDataLoadCallback = callback;
    }
    
    
    function isPasswordProvider(user) {
        if (!user || !user.providerData) {
            return false;
        }
        return user.providerData.some((provider) => provider.providerId === 'password');
    }

    // ============================================================
    // AUTHENTICATION FUNCTIONS
    // ============================================================
    
    /**
     * Sign in with Google
     */
    async function signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            console.log('✅ Google sign-in successful');
            return { success: true, user: result.user };
        } catch (error) {
            console.error('❌ Google sign-in failed:', error);
            const popupErrorCodes = new Set([
                'auth/popup-blocked',
                'auth/popup-closed-by-user',
                'auth/cancelled-popup-request',
                'auth/operation-not-supported-in-this-environment',
            ]);

            if (error && popupErrorCodes.has(error.code)) {
                try {
                    const provider = new firebase.auth.GoogleAuthProvider();
                    await auth.signInWithRedirect(provider);
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
    
    /**
     * Sign in with email and password
     */
    async function signInWithEmail(email, password) {
        try {
            const result = await auth.signInWithEmailAndPassword(email, password);

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
    
    /**
     * Sign up with email and password
     */
    async function signUpWithEmail(email, password) {
        try {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            await result.user.sendEmailVerification();
            console.log('✅ Account created successfully');
            return { 
                success: true, 
                user: result.user,
                message: 'Account created! Please check your email for verification.' 
            };
        } catch (error) {
            console.error('❌ Sign-up failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Send password reset email
     */
    async function resetPassword(email) {
        try {
            await auth.sendPasswordResetEmail(email);
            console.log('✅ Password reset email sent');
            return { 
                success: true, 
                message: 'Password reset email sent. Check your inbox.' 
            };
        } catch (error) {
            console.error('❌ Password reset failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Sign out current user
     */
    async function signOut() {
        try {
            await auth.signOut();
            console.log('✅ User signed out');
            return { success: true };
        } catch (error) {
            console.error('❌ Sign-out failed:', error);
            return { success: false, error: error.message };
        }
    }

    function isReauthRequiredError(error) {
        const code = error && error.code ? String(error.code) : '';
        return code === 'auth/requires-recent-login' || code === 'auth/user-token-expired';
    }

    async function deleteDocsByRefs(refs) {
        if (!Array.isArray(refs) || refs.length === 0) {
            return;
        }
        const chunkSize = 400;
        for (let i = 0; i < refs.length; i += chunkSize) {
            const chunk = refs.slice(i, i + chunkSize);
            const batch = db.batch();
            chunk.forEach((ref) => {
                batch.delete(ref);
            });
            await batch.commit();
        }
    }

    async function collectInvitationRefs(uid, emailLower) {
        const refMap = new Map();
        if (!db) {
            return [];
        }
        if (uid) {
            const byInviter = await db.collection('invitations')
                .where('invitedBy', '==', uid)
                .get();
            byInviter.docs.forEach((doc) => refMap.set(doc.id, doc.ref));
        }
        if (emailLower) {
            const byInvitee = await db.collection('invitations')
                .where('invitedEmail', '==', emailLower)
                .get();
            byInvitee.docs.forEach((doc) => refMap.set(doc.id, doc.ref));
        }
        return Array.from(refMap.values());
    }

    async function cleanupAllianceMembership(uid, emailLower) {
        if (!allianceId || !uid) {
            return;
        }
        try {
            const allianceRef = db.collection('alliances').doc(allianceId);
            const snap = await allianceRef.get();
            if (!snap.exists) {
                return;
            }
            const data = snap.data() || {};
            const members = data.members && typeof data.members === 'object' ? data.members : {};
            const memberIds = Object.keys(members);
            const onlyCurrentMember = memberIds.length === 1 && memberIds[0] === uid;
            if (onlyCurrentMember && data.createdBy === uid) {
                await allianceRef.delete();
                return;
            }
            const memberPath = `members.${uid}`;
            await allianceRef.update({
                [memberPath]: firebase.firestore.FieldValue.delete()
            });
        } catch (error) {
            console.warn('Failed to clean alliance membership during account deletion:', error.message || error);
        }
    }

    async function deleteUserAccountAndData() {
        const authUser = (auth && auth.currentUser) || currentUser;
        if (!authUser) {
            return { success: false, error: 'No user signed in' };
        }

        const uid = authUser.uid;
        const email = authUser.email || '';
        const emailLower = email ? email.toLowerCase() : '';
        const dataDeletionErrors = [];

        try {
            await cleanupAllianceMembership(uid, emailLower);
        } catch (error) {
            dataDeletionErrors.push(error);
        }

        try {
            const invitationRefs = await collectInvitationRefs(uid, emailLower);
            await deleteDocsByRefs(invitationRefs);
        } catch (error) {
            dataDeletionErrors.push(error);
        }

        try {
            const userDocIds = Array.from(new Set([uid, email, emailLower].filter(Boolean)));
            for (const docId of userDocIds) {
                try {
                    await db.collection('users').doc(docId).delete();
                } catch (error) {
                    if (docId === uid) {
                        throw error;
                    }
                    console.warn(`Skipping optional user doc delete (${docId}):`, error.message || error);
                }
            }
        } catch (error) {
            dataDeletionErrors.push(error);
        }

        playerDatabase = {};
        eventData = createEmptyEventData();
        allianceId = null;
        allianceName = null;
        allianceData = null;
        playerSource = 'personal';
        pendingInvitations = [];
        userProfile = normalizeUserProfile(null);
        setGlobalDefaultPositions(emptyGlobalEventPositions(), 0);
        setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);

        try {
            await authUser.delete();
            return { success: dataDeletionErrors.length === 0, dataDeleted: true, accountDeleted: true };
        } catch (error) {
            if (isReauthRequiredError(error)) {
                try {
                    await auth.signOut();
                } catch (signOutError) {
                    console.warn('Failed to sign out after reauth-required delete:', signOutError.message || signOutError);
                }
                return {
                    success: false,
                    dataDeleted: true,
                    accountDeleted: false,
                    reauthRequired: true,
                    error: error.message,
                };
            }
            return {
                success: false,
                dataDeleted: dataDeletionErrors.length === 0,
                accountDeleted: false,
                error: error.message,
            };
        }
    }
    
    /**
     * Get current user
     */
    function getCurrentUser() {
        return currentUser;
    }
    
    /**
     * Check if user is signed in
     */
    function isSignedIn() {
        return currentUser !== null;
    }
    
    // ============================================================
    // DATABASE FUNCTIONS
    // ============================================================
    
    /**
     * Load user data from Firestore
     */
    async function loadUserData(user) {
        try {
            console.log('Loading data for UID:', user.uid);
            const docRef = db.collection('users').doc(user.uid);
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                playerDatabase = data.playerDatabase || {};
                allianceId = data.allianceId || null;
                allianceName = data.allianceName || null;
                playerSource = data.playerSource || 'personal';
                userProfile = normalizeUserProfile(data.userProfile || data.profile || null);

                // Load per-event building data
                if (data.events && typeof data.events === 'object') {
                    // New schema: per-event data under events map
                    Object.keys(eventData).forEach(eid => {
                        const ed = data.events[eid];
                        if (ed && typeof ed === 'object') {
                            eventData[eid] = {
                                buildingConfig: Array.isArray(ed.buildingConfig) ? ed.buildingConfig : null,
                                buildingConfigVersion: typeof ed.buildingConfigVersion === 'number' ? ed.buildingConfigVersion : 0,
                                buildingPositions: ed.buildingPositions && typeof ed.buildingPositions === 'object' ? ed.buildingPositions : null,
                                buildingPositionsVersion: typeof ed.buildingPositionsVersion === 'number' ? ed.buildingPositionsVersion : 0
                            };
                        } else {
                            eventData[eid] = createEmptyEventEntry();
                        }
                    });
                } else if (
                    Array.isArray(data.buildingConfig)
                    || (data.buildingPositions && typeof data.buildingPositions === 'object')
                    || typeof data.buildingConfigVersion === 'number'
                ) {
                    // Migration: old top-level fields → move to events.desert_storm
                    console.log('🔄 Migrating old building data to per-event schema...');
                    eventData.desert_storm = {
                        buildingConfig: Array.isArray(data.buildingConfig) ? data.buildingConfig : null,
                        buildingConfigVersion: typeof data.buildingConfigVersion === 'number' ? data.buildingConfigVersion : 0,
                        buildingPositions: data.buildingPositions && typeof data.buildingPositions === 'object' ? data.buildingPositions : null,
                        buildingPositionsVersion: typeof data.buildingPositionsVersion === 'number' ? data.buildingPositionsVersion : 0
                    };
                    eventData.canyon_battlefield = createEmptyEventEntry();
                    // Save migrated data and remove old top-level fields
                    try {
                        const batch = db.batch();
                        const userRef = db.collection('users').doc(user.uid);
                        batch.set(userRef, {
                            events: {
                                desert_storm: eventData.desert_storm,
                                canyon_battlefield: eventData.canyon_battlefield
                            }
                        }, { merge: true });
                        batch.update(userRef, {
                            buildingConfig: firebase.firestore.FieldValue.delete(),
                            buildingConfigVersion: firebase.firestore.FieldValue.delete(),
                            buildingPositions: firebase.firestore.FieldValue.delete(),
                            buildingPositionsVersion: firebase.firestore.FieldValue.delete()
                        });
                        await batch.commit();
                        console.log('✅ Migration complete');
                    } catch (migErr) {
                        console.warn('⚠️ Migration save failed (will retry next load):', migErr);
                    }
                } else {
                    // No building data at all — reset
                    Object.keys(eventData).forEach(eid => {
                        eventData[eid] = createEmptyEventEntry();
                    });
                }

                await loadGlobalDefaultBuildingPositions();
                await loadGlobalDefaultBuildingConfig();
                await maybePublishGlobalDefaultsFromCurrentUser(data);
                await maybePublishGlobalBuildingConfigFromCurrentUser(data);

                console.log(`✅ Loaded ${Object.keys(playerDatabase).length} players`);

                if (allianceId) {
                    await loadAllianceData();
                }
                await checkInvitations();

                if (onDataLoadCallback) {
                    onDataLoadCallback(playerDatabase);
                }

                return {
                    success: true,
                    data: playerDatabase,
                    playerCount: Object.keys(playerDatabase).length
                };
            } else {
                console.log('ℹ️ No existing data found');
                playerDatabase = {};
                Object.keys(eventData).forEach(eid => {
                    eventData[eid] = createEmptyEventEntry();
                });
                allianceId = null;
                allianceName = null;
                playerSource = 'personal';
                userProfile = normalizeUserProfile(null);
                await loadGlobalDefaultBuildingPositions();
                await loadGlobalDefaultBuildingConfig();
                await checkInvitations();
                return { success: true, data: {}, playerCount: 0 };
            }
        } catch (error) {
            console.error('❌ Failed to load data:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Save user data to Firestore
     */
    async function saveUserData() {
        if (!currentUser) {
            return { success: false, error: 'No user signed in' };
        }
        
        try {
            console.log('💾 Saving data...');
            
            await db.collection('users').doc(currentUser.uid).set({
                playerDatabase: playerDatabase,
                events: eventData,
                userProfile: userProfile,
                metadata: {
                    email: currentUser.email || null,
                    emailLower: currentUser.email ? currentUser.email.toLowerCase() : null,
                    totalPlayers: Object.keys(playerDatabase).length,
                    lastUpload: new Date().toISOString(),
                    lastModified: firebase.firestore.FieldValue.serverTimestamp()
                }
            }, { merge: true });
            
            console.log('✅ Data saved successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ Failed to save data:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Upload player database from Excel
     */
    async function uploadPlayerDatabase(file) {
        return new Promise((resolve, reject) => {
            if (!file || file.size > MAX_UPLOAD_BYTES) {
                reject({ success: false, error: 'File too large (max 5MB)' });
                return;
            }

            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    
                    // Check if Players sheet exists
                    if (!workbook.Sheets['Players']) {
                        reject({ success: false, error: 'Excel file must contain a "Players" sheet' });
                        return;
                    }
                    
                    const sheet = workbook.Sheets['Players'];
                    // Headers at row 10, so start reading from row 10 (0-indexed = 9)
                    const players = XLSX.utils.sheet_to_json(sheet, {range: 9});
                    
                    // Clear existing database
                    playerDatabase = {};
                    
                    // Add players to database
                    let addedCount = 0;
                    let skippedCount = 0;
                    const skippedPlayers = [];
                    
                    players.forEach(row => {
                        const name = row['Player Name'];
                        const power = row['E1 Total Power(M)'];
                        const troops = row['E1 Troops'];
                        
                        // Only require name (power and troops are optional)
                        if (name) {
                            playerDatabase[name] = {
                                power: power ? parseFloat(power) : 0, // Default to 0 if power missing
                                troops: troops || 'Unknown', // Default to 'Unknown' if troops missing
                                lastUpdated: new Date().toISOString()
                            };
                            addedCount++;
                        } else {
                            // Track skipped players (only if name is missing)
                            skippedCount++;
                            skippedPlayers.push(`Row with no name (power: ${power || 'none'}, troops: ${troops || 'none'})`);
                        }
                    });
                    
                    // Save to Firestore
                    const saveResult = await saveUserData();
                    
                    if (saveResult.success) {
                        console.log(`✅ Uploaded ${addedCount} players`);
                        if (skippedCount > 0) {
                            console.warn(`⚠️ Skipped ${skippedCount} rows with no player name:`, skippedPlayers);
                        }
                        
                        let message = `✅ ${addedCount} players stored in cloud`;
                        if (skippedCount > 0) {
                            message += ` (${skippedCount} skipped - missing name)`;
                        }
                        
                        resolve({ 
                            success: true, 
                            playerCount: addedCount,
                            skippedCount: skippedCount,
                            message: message
                        });
                    } else {
                        reject(saveResult);
                    }
                    
                } catch (error) {
                    console.error('❌ Failed to process Excel file:', error);
                    reject({ success: false, error: error.message });
                }
            };
            
            reader.onerror = () => {
                reject({ success: false, error: 'Failed to read file' });
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    /**
     * Get player database
     */
    function getPlayerDatabase() {
        return playerDatabase;
    }

    /**
     * Get building configuration for an event
     */
    function getBuildingConfig(eventId) {
        const eid = eventId || 'desert_storm';
        return eventData[eid] ? eventData[eid].buildingConfig : null;
    }

    /**
     * Set building configuration for an event
     */
    function setBuildingConfig(eventId, config) {
        const eid = eventId || 'desert_storm';
        if (!eventData[eid]) eventData[eid] = createEmptyEventEntry();
        eventData[eid].buildingConfig = config;
    }

    function getBuildingConfigVersion(eventId) {
        const eid = eventId || 'desert_storm';
        return eventData[eid] ? eventData[eid].buildingConfigVersion : 0;
    }

    function setBuildingConfigVersion(eventId, version) {
        const eid = eventId || 'desert_storm';
        if (!eventData[eid]) eventData[eid] = createEmptyEventEntry();
        eventData[eid].buildingConfigVersion = version;
    }

    /**
     * Get building positions for an event
     */
    function getBuildingPositions(eventId) {
        const eid = eventId || 'desert_storm';
        return eventData[eid] ? eventData[eid].buildingPositions : null;
    }

    /**
     * Set building positions for an event
     */
    function setBuildingPositions(eventId, positions) {
        const eid = eventId || 'desert_storm';
        if (!eventData[eid]) eventData[eid] = createEmptyEventEntry();
        eventData[eid].buildingPositions = positions;
    }

    function getBuildingPositionsVersion(eventId) {
        const eid = eventId || 'desert_storm';
        return eventData[eid] ? eventData[eid].buildingPositionsVersion : 0;
    }

    function setBuildingPositionsVersion(eventId, version) {
        const eid = eventId || 'desert_storm';
        if (!eventData[eid]) eventData[eid] = createEmptyEventEntry();
        eventData[eid].buildingPositionsVersion = version;
    }

    /**
     * Get player count
     */
    function getPlayerCount() {
        return Object.keys(playerDatabase).length;
    }
    
    /**
     * Get player by name
     */
    function getPlayer(name) {
        return playerDatabase[name] || null;
    }
    
    // ============================================================
    // ALLIANCE FUNCTIONS
    // ============================================================

    async function createAlliance(name) {
        if (!currentUser) return { success: false, error: 'Not signed in' };
        if (!name || name.length > 40) return { success: false, error: 'Name must be 1-40 characters' };

        try {
            const members = {};
            members[currentUser.uid] = {
                email: currentUser.email,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                role: 'member'
            };

            const docRef = await db.collection('alliances').add({
                name: name,
                createdBy: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                members: members,
                playerDatabase: {},
                metadata: {
                    totalPlayers: 0,
                    lastUpload: null,
                    lastModified: firebase.firestore.FieldValue.serverTimestamp()
                }
            });

            const id = docRef.id;
            allianceId = id;
            allianceName = name;
            await db.collection('users').doc(currentUser.uid).set({
                allianceId: id,
                allianceName: name
            }, { merge: true });

            await loadAllianceData();
            return { success: true, allianceId: id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function loadAllianceData() {
        if (!currentUser || !allianceId) {
            allianceData = null;
            return;
        }
        try {
            const doc = await db.collection('alliances').doc(allianceId).get();
            if (doc.exists) {
                allianceData = doc.data();
                if (!allianceData.members || !allianceData.members[currentUser.uid]) {
                    allianceId = null;
                    allianceName = null;
                    allianceData = null;
                    playerSource = 'personal';
                    await db.collection('users').doc(currentUser.uid).set({
                        allianceId: null, allianceName: null, playerSource: 'personal'
                    }, { merge: true });
                }
            } else {
                allianceId = null;
                allianceName = null;
                allianceData = null;
                playerSource = 'personal';
                await db.collection('users').doc(currentUser.uid).set({
                    allianceId: null, allianceName: null, playerSource: 'personal'
                }, { merge: true });
            }
        } catch (error) {
            console.error('Failed to load alliance data:', error);
        }
    }

    async function leaveAlliance() {
        if (!currentUser || !allianceId) return { success: false, error: 'Not in an alliance' };

        try {
            const memberPath = `members.${currentUser.uid}`;
            await db.collection('alliances').doc(allianceId).update({
                [memberPath]: firebase.firestore.FieldValue.delete()
            });

            allianceId = null;
            allianceName = null;
            allianceData = null;
            playerSource = 'personal';

            await db.collection('users').doc(currentUser.uid).set({
                allianceId: null, allianceName: null, playerSource: 'personal'
            }, { merge: true });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function sendInvitation(email) {
        if (!currentUser || !allianceId) return { success: false, error: 'Not in an alliance' };

        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) return { success: false, error: 'Email is required' };

        try {
            const existing = await db.collection('invitations')
                .where('allianceId', '==', allianceId)
                .where('invitedEmail', '==', normalizedEmail)
                .where('status', '==', 'pending')
                .get();

            if (!existing.empty) {
                return { success: false, error: 'Invitation already pending for this email' };
            }

            await db.collection('invitations').add({
                allianceId: allianceId,
                allianceName: allianceName,
                invitedEmail: normalizedEmail,
                invitedBy: currentUser.uid,
                inviterEmail: currentUser.email,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                respondedAt: null
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function checkInvitations() {
        if (!currentUser || !currentUser.email) {
            pendingInvitations = [];
            return [];
        }

        try {
            const snapshot = await db.collection('invitations')
                .where('invitedEmail', '==', currentUser.email.toLowerCase())
                .where('status', '==', 'pending')
                .get();

            pendingInvitations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            return pendingInvitations;
        } catch (error) {
            console.error('Failed to check invitations:', error);
            pendingInvitations = [];
            return [];
        }
    }

    async function acceptInvitation(invitationId) {
        if (!currentUser) return { success: false, error: 'Not signed in' };

        try {
            const invDoc = await db.collection('invitations').doc(invitationId).get();
            if (!invDoc.exists) return { success: false, error: 'Invitation not found' };

            const inv = invDoc.data();
            if (inv.status !== 'pending') return { success: false, error: 'Invitation already responded to' };

            if (allianceId) {
                await leaveAlliance();
            }

            const memberPath = `members.${currentUser.uid}`;
            await db.collection('alliances').doc(inv.allianceId).update({
                [memberPath]: {
                    email: currentUser.email,
                    joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    role: 'member'
                }
            });

            await db.collection('invitations').doc(invitationId).update({
                status: 'accepted',
                respondedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            allianceId = inv.allianceId;
            allianceName = inv.allianceName;
            await db.collection('users').doc(currentUser.uid).set({
                allianceId: inv.allianceId,
                allianceName: inv.allianceName
            }, { merge: true });

            await loadAllianceData();
            return { success: true, allianceId: inv.allianceId, allianceName: inv.allianceName };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function rejectInvitation(invitationId) {
        if (!currentUser) return { success: false, error: 'Not signed in' };

        try {
            await db.collection('invitations').doc(invitationId).update({
                status: 'rejected',
                respondedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            pendingInvitations = pendingInvitations.filter(inv => inv.id !== invitationId);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function uploadAlliancePlayerDatabase(file) {
        if (!currentUser || !allianceId) {
            return Promise.reject({ success: false, error: 'Not in an alliance' });
        }

        return new Promise((resolve, reject) => {
            if (!file || file.size > MAX_UPLOAD_BYTES) {
                reject({ success: false, error: 'File too large (max 5MB)' });
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    if (!workbook.Sheets['Players']) {
                        reject({ success: false, error: 'Excel file must contain a "Players" sheet' });
                        return;
                    }

                    const sheet = workbook.Sheets['Players'];
                    const players = XLSX.utils.sheet_to_json(sheet, { range: 9 });

                    const alliancePlayerDB = {};
                    let addedCount = 0;

                    players.forEach(row => {
                        const name = row['Player Name'];
                        if (name) {
                            alliancePlayerDB[name] = {
                                power: row['E1 Total Power(M)'] ? parseFloat(row['E1 Total Power(M)']) : 0,
                                troops: row['E1 Troops'] || 'Unknown',
                                lastUpdated: new Date().toISOString(),
                                updatedBy: currentUser.uid
                            };
                            addedCount++;
                        }
                    });

                    await db.collection('alliances').doc(allianceId).set({
                        playerDatabase: alliancePlayerDB,
                        metadata: {
                            totalPlayers: addedCount,
                            lastUpload: new Date().toISOString(),
                            lastModified: firebase.firestore.FieldValue.serverTimestamp()
                        }
                    }, { merge: true });

                    if (allianceData) {
                        allianceData.playerDatabase = alliancePlayerDB;
                    }

                    resolve({
                        success: true,
                        playerCount: addedCount,
                        message: `${addedCount} players uploaded to alliance`
                    });
                } catch (error) {
                    reject({ success: false, error: error.message });
                }
            };
            reader.onerror = () => reject({ success: false, error: 'Failed to read file' });
            reader.readAsArrayBuffer(file);
        });
    }

    function getAlliancePlayerDatabase() {
        return allianceData && allianceData.playerDatabase ? allianceData.playerDatabase : {};
    }

    function getActivePlayerDatabase() {
        if (playerSource === 'alliance' && allianceData && allianceData.playerDatabase) {
            return allianceData.playerDatabase;
        }
        return playerDatabase;
    }

    function getUserProfile() {
        return normalizeUserProfile(userProfile);
    }

    function setUserProfile(profile) {
        userProfile = normalizeUserProfile(profile);
        return getUserProfile();
    }

    async function setPlayerSource(source) {
        if (source !== 'personal' && source !== 'alliance') return;
        playerSource = source;
        if (currentUser) {
            await db.collection('users').doc(currentUser.uid).set({
                playerSource: source
            }, { merge: true });
        }
    }

    function getAllianceId() { return allianceId; }
    function getAllianceName() { return allianceName; }
    function getAllianceData() { return allianceData; }
    function getPlayerSource() { return playerSource; }
    function getPendingInvitations() { return pendingInvitations; }
    function getAllianceMembers() {
        return allianceData && allianceData.members ? allianceData.members : {};
    }

    // ============================================================
    // BACKUP & RESTORE FUNCTIONS
    // ============================================================
    
    /**
     * Export player database as Excel
     */
    function exportBackup() {
        const players = Object.keys(playerDatabase).map(name => ({
            'Player Name': name,
            'E1 Total Power(M)': playerDatabase[name].power,
            'E1 Troops': playerDatabase[name].troops,
            'Last Updated': playerDatabase[name].lastUpdated
        }));
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(players);
        XLSX.utils.book_append_sheet(wb, ws, 'Players');
        
        // Add metadata sheet
        const metadata = [
            ['Total Players', Object.keys(playerDatabase).length],
            ['Export Date', new Date().toISOString()],
            ['Account Email', currentUser ? currentUser.email : 'N/A']
        ];
        const wsMeta = XLSX.utils.aoa_to_sheet(metadata);
        XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadata');
        
        const emailSlug = currentUser && currentUser.email ? currentUser.email.replace('@', '_') : 'unknown';
        const filename = `backup_${emailSlug}_${Date.now()}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        console.log('✅ Backup exported:', filename);
        return { success: true, filename: filename };
    }
    
    /**
     * Restore player database from Excel backup
     */
    async function restoreFromBackup(file) {
        return new Promise((resolve, reject) => {
            if (!file || file.size > MAX_UPLOAD_BYTES) {
                reject({ success: false, error: 'File too large (max 5MB)' });
                return;
            }

            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    
                    if (!workbook.Sheets['Players']) {
                        reject({ success: false, error: 'Invalid backup file' });
                        return;
                    }
                    
                    const sheet = workbook.Sheets['Players'];
                    const players = XLSX.utils.sheet_to_json(sheet);
                    
                    const restored = {};
                    players.forEach(row => {
                        const name = row['Player Name'];
                        if (name) {
                            restored[name] = {
                                power: row['E1 Total Power(M)'],
                                troops: row['E1 Troops'],
                                lastUpdated: row['Last Updated'] || new Date().toISOString()
                            };
                        }
                    });
                    
                    playerDatabase = restored;
                    const saveResult = await saveUserData();
                    
                    if (saveResult.success) {
                        console.log(`✅ Restored ${Object.keys(restored).length} players`);
                        resolve({ 
                            success: true, 
                            playerCount: Object.keys(restored).length,
                            message: `✅ Database restored: ${Object.keys(restored).length} players`
                        });
                    } else {
                        reject(saveResult);
                    }
                    
                } catch (error) {
                    console.error('❌ Failed to restore backup:', error);
                    reject({ success: false, error: error.message });
                }
            };
            
            reader.onerror = () => {
                reject({ success: false, error: 'Failed to read file' });
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    // ============================================================
    // TEMPLATE GENERATION FUNCTIONS
    // ============================================================
    
    /**
     * Generate player database template
     */
    function generatePlayerDatabaseTemplate() {
        const wb = XLSX.utils.book_new();
        
        const instructions = [
            ['PLAYER DATABASE TEMPLATE'],
            ['Fill this template with ALL your alliance members'],
            ['Update this file monthly or when player stats change'],
            [''],
            ['Instructions:'],
            ['1. Fill Player Name column (exact names from game)'],
            ['2. Fill E1 Total Power(M) column (numeric value, e.g., 65.0)'],
            ['3. Fill E1 Troops column (Tank, Aero, or Missile)'],
            ['4. Upload to generator - data saved to cloud forever!'],
            ['']
        ];
        
        const headers = [['Player Name', 'E1 Total Power(M)', 'E1 Troops']];
        const example = [
            ['Example Player', 65.0, 'Tank'],
            ['', '', ''],
            ['', '', '']
        ];
        
        const data = [...instructions, ...headers, ...example];
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Set column widths
        ws['!cols'] = [{wch: 20}, {wch: 20}, {wch: 15}];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Players');
        XLSX.writeFile(wb, 'player_database_template.xlsx');
        
        console.log('✅ Player database template downloaded');
    }
    
    /**
     * Generate team roster template
     */
    function generateTeamRosterTemplate() {
        const wb = XLSX.utils.book_new();
        
        const instructions = [
            ['TEAM ROSTER TEMPLATE'],
            ['Fill this template before each battle with weekly assignments'],
            [''],
            ['Instructions:'],
            ['1. Fill Player Name column (must match names in player database)'],
            ['2. Fill Team column with "A" or "B"'],
            ['3. Upload to generator - system matches with database automatically'],
            ['4. Generate assignments and download maps!'],
            [''],
            ['Required: 20 players per team (40 total)'],
            ['']
        ];
        
        const headers = [['Player Name', 'Team']];
        const examples = [
            ['Example Player 1', 'A'],
            ['Example Player 2', 'A'],
            ['Example Player 3', 'B'],
            ['', ''],
            ['', '']
        ];
        
        const data = [...instructions, ...headers, ...examples];
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Set column widths
        ws['!cols'] = [{wch: 25}, {wch: 10}];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Roster');
        XLSX.writeFile(wb, 'team_roster_template.xlsx');
        
        console.log('✅ Team roster template downloaded');
    }
    
    // ============================================================
    // PUBLIC API
    // ============================================================
    
    return {
        // Initialization
        init: init,
        setAuthCallback: setAuthCallback,
        setDataLoadCallback: setDataLoadCallback,
        
        // Authentication
        signInWithGoogle: signInWithGoogle,
        signInWithEmail: signInWithEmail,
        signUpWithEmail: signUpWithEmail,
        resetPassword: resetPassword,
        signOut: signOut,
        deleteUserAccountAndData: deleteUserAccountAndData,
        getCurrentUser: getCurrentUser,
        isSignedIn: isSignedIn,
        
        // Database operations
        loadUserData: loadUserData,
        saveUserData: saveUserData,
        uploadPlayerDatabase: uploadPlayerDatabase,
        getPlayerDatabase: getPlayerDatabase,
        getPlayerCount: getPlayerCount,
        getPlayer: getPlayer,

        // Building config
        getBuildingConfig: getBuildingConfig,
        setBuildingConfig: setBuildingConfig,
        getBuildingConfigVersion: getBuildingConfigVersion,
        setBuildingConfigVersion: setBuildingConfigVersion,
        getBuildingPositions: getBuildingPositions,
        setBuildingPositions: setBuildingPositions,
        getBuildingPositionsVersion: getBuildingPositionsVersion,
        setBuildingPositionsVersion: setBuildingPositionsVersion,
        getGlobalDefaultBuildingConfig: getGlobalDefaultBuildingConfig,
        getGlobalDefaultBuildingConfigVersion: getGlobalDefaultBuildingConfigVersion,
        getGlobalDefaultBuildingPositions: getGlobalDefaultBuildingPositions,
        getGlobalDefaultBuildingPositionsVersion: getGlobalDefaultBuildingPositionsVersion,
        
        // Backup & restore
        exportBackup: exportBackup,
        restoreFromBackup: restoreFromBackup,
        
        // Templates
        generatePlayerDatabaseTemplate: generatePlayerDatabaseTemplate,
        generateTeamRosterTemplate: generateTeamRosterTemplate,

        // Alliance
        createAlliance: createAlliance,
        leaveAlliance: leaveAlliance,
        loadAllianceData: loadAllianceData,
        sendInvitation: sendInvitation,
        checkInvitations: checkInvitations,
        acceptInvitation: acceptInvitation,
        rejectInvitation: rejectInvitation,
        uploadAlliancePlayerDatabase: uploadAlliancePlayerDatabase,
        getAlliancePlayerDatabase: getAlliancePlayerDatabase,
        getActivePlayerDatabase: getActivePlayerDatabase,
        getUserProfile: getUserProfile,
        setUserProfile: setUserProfile,
        setPlayerSource: setPlayerSource,
        getAllianceId: getAllianceId,
        getAllianceName: getAllianceName,
        getAllianceData: getAllianceData,
        getPlayerSource: getPlayerSource,
        getPendingInvitations: getPendingInvitations,
        getAllianceMembers: getAllianceMembers
    };
    
})();

// Expose for adapters that read from window/global object
if (typeof window !== 'undefined') {
    window.FirebaseManager = FirebaseManager;
}

// Auto-initialize on load
if (typeof firebase !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        FirebaseManager.init();
    });
}


