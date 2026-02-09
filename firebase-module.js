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
    
    // Private variables
    let auth = null;
    let db = null;
    let currentUser = null;
    let playerDatabase = {};
    // Per-event building data: { desert_storm: { buildingConfig, buildingPositions, buildingPositionsVersion }, canyon_battlefield: { ... } }
    let eventData = {
        desert_storm: { buildingConfig: null, buildingPositions: null, buildingPositionsVersion: 0 },
        canyon_battlefield: { buildingConfig: null, buildingPositions: null, buildingPositionsVersion: 0 }
    };
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
                eventData[eid] = { buildingConfig: null, buildingPositions: null, buildingPositionsVersion: 0 };
            });
            allianceId = null;
            allianceName = null;
            allianceData = null;
            playerSource = 'personal';
            pendingInvitations = [];
            userProfile = normalizeUserProfile(null);

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
                                buildingPositions: ed.buildingPositions && typeof ed.buildingPositions === 'object' ? ed.buildingPositions : null,
                                buildingPositionsVersion: typeof ed.buildingPositionsVersion === 'number' ? ed.buildingPositionsVersion : 0
                            };
                        } else {
                            eventData[eid] = { buildingConfig: null, buildingPositions: null, buildingPositionsVersion: 0 };
                        }
                    });
                } else if (Array.isArray(data.buildingConfig) || (data.buildingPositions && typeof data.buildingPositions === 'object')) {
                    // Migration: old top-level fields → move to events.desert_storm
                    console.log('🔄 Migrating old building data to per-event schema...');
                    eventData.desert_storm = {
                        buildingConfig: Array.isArray(data.buildingConfig) ? data.buildingConfig : null,
                        buildingPositions: data.buildingPositions && typeof data.buildingPositions === 'object' ? data.buildingPositions : null,
                        buildingPositionsVersion: typeof data.buildingPositionsVersion === 'number' ? data.buildingPositionsVersion : 0
                    };
                    eventData.canyon_battlefield = { buildingConfig: null, buildingPositions: null, buildingPositionsVersion: 0 };
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
                        eventData[eid] = { buildingConfig: null, buildingPositions: null, buildingPositionsVersion: 0 };
                    });
                }

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
                    eventData[eid] = { buildingConfig: null, buildingPositions: null, buildingPositionsVersion: 0 };
                });
                allianceId = null;
                allianceName = null;
                playerSource = 'personal';
                userProfile = normalizeUserProfile(null);
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
        if (!eventData[eid]) eventData[eid] = { buildingConfig: null, buildingPositions: null, buildingPositionsVersion: 0 };
        eventData[eid].buildingConfig = config;
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
        if (!eventData[eid]) eventData[eid] = { buildingConfig: null, buildingPositions: null, buildingPositionsVersion: 0 };
        eventData[eid].buildingPositions = positions;
    }

    function getBuildingPositionsVersion(eventId) {
        const eid = eventId || 'desert_storm';
        return eventData[eid] ? eventData[eid].buildingPositionsVersion : 0;
    }

    function setBuildingPositionsVersion(eventId, version) {
        const eid = eventId || 'desert_storm';
        if (!eventData[eid]) eventData[eid] = { buildingConfig: null, buildingPositions: null, buildingPositionsVersion: 0 };
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
        getBuildingPositions: getBuildingPositions,
        setBuildingPositions: setBuildingPositions,
        getBuildingPositionsVersion: getBuildingPositionsVersion,
        setBuildingPositionsVersion: setBuildingPositionsVersion,
        
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


