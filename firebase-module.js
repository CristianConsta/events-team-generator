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
    
    // Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyDOpgLIoUwh5r3xFL9GultXkVaTrUq4xe0",
        authDomain: "last-war-game-desert-storm.firebaseapp.com",
        projectId: "last-war-game-desert-storm",
        storageBucket: "last-war-game-desert-storm.firebasestorage.app",
        messagingSenderId: "481454789926",
        appId: "1:481454789926:web:6b9be1afec0fa0d1045de7"
    };
    
    // Private variables
    let auth = null;
    let db = null;
    let currentUser = null;
    let playerDatabase = {};
    let onAuthCallback = null;
    let onDataLoadCallback = null;
    
    /**
     * Initialize Firebase
     */
    function init() {
        try {
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
            console.log('✅ User signed in:', user.email);
            loadUserData(user.email);
            
            if (onAuthCallback) {
                onAuthCallback(true, user);
            }
        } else {
            console.log('ℹ️ User signed out');
            playerDatabase = {};
            
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
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Sign in with email and password
     */
    async function signInWithEmail(email, password) {
        try {
            const result = await auth.signInWithEmailAndPassword(email, password);
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
    async function loadUserData(email) {
        try {
            console.log('📥 Loading data for:', email);
            const docRef = db.collection('users').doc(email);
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                playerDatabase = data.playerDatabase || {};
                
                console.log(`✅ Loaded ${Object.keys(playerDatabase).length} players`);
                
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
            
            await db.collection('users').doc(currentUser.email).set({
                playerDatabase: playerDatabase,
                metadata: {
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
                    players.forEach(row => {
                        const name = row['Player Name'];
                        const power = row['E1 Total Power(M)'];
                        const troops = row['E1 Troops'];
                        
                        if (name && power && troops) {
                            playerDatabase[name] = {
                                power: parseFloat(power),
                                troops: troops,
                                lastUpdated: new Date().toISOString()
                            };
                            addedCount++;
                        }
                    });
                    
                    // Save to Firestore
                    const saveResult = await saveUserData();
                    
                    if (saveResult.success) {
                        console.log(`✅ Uploaded ${addedCount} players`);
                        resolve({ 
                            success: true, 
                            playerCount: addedCount,
                            message: `✅ ${addedCount} players stored in cloud`
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
    
    /**
     * Match roster with player database
     */
    function matchRosterWithDatabase(roster) {
        const teamA = [];
        const teamB = [];
        const missing = [];
        
        roster.forEach(row => {
            const name = row['Player Name'];
            const team = row['Team'];
            const playerData = playerDatabase[name];
            
            if (playerData) {
                const player = {
                    name: name,
                    power: playerData.power,
                    troops: playerData.troops,
                    team: team
                };
                
                if (team === 'A') {
                    teamA.push(player);
                } else if (team === 'B') {
                    teamB.push(player);
                }
            } else {
                missing.push({ name, team });
            }
        });
        
        return {
            teamA: teamA,
            teamB: teamB,
            missing: missing,
            matchedCount: teamA.length + teamB.length,
            missingCount: missing.length
        };
    }
    
    /**
     * Add missing player to database
     */
    async function addPlayer(name, power, troops) {
        playerDatabase[name] = {
            power: parseFloat(power),
            troops: troops,
            lastUpdated: new Date().toISOString()
        };
        
        return await saveUserData();
    }
    
    /**
     * Update player in database
     */
    async function updatePlayer(name, power, troops) {
        if (playerDatabase[name]) {
            playerDatabase[name].power = parseFloat(power);
            playerDatabase[name].troops = troops;
            playerDatabase[name].lastUpdated = new Date().toISOString();
            
            return await saveUserData();
        }
        return { success: false, error: 'Player not found' };
    }
    
    /**
     * Delete player from database
     */
    async function deletePlayer(name) {
        if (playerDatabase[name]) {
            delete playerDatabase[name];
            return await saveUserData();
        }
        return { success: false, error: 'Player not found' };
    }
    
    /**
     * Clear entire player database
     */
    async function clearDatabase() {
        playerDatabase = {};
        return await saveUserData();
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
        
        const filename = `backup_${currentUser.email.replace('@', '_')}_${Date.now()}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        console.log('✅ Backup exported:', filename);
        return { success: true, filename: filename };
    }
    
    /**
     * Restore player database from Excel backup
     */
    async function restoreFromBackup(file) {
        return new Promise((resolve, reject) => {
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
        matchRosterWithDatabase: matchRosterWithDatabase,
        addPlayer: addPlayer,
        updatePlayer: updatePlayer,
        deletePlayer: deletePlayer,
        clearDatabase: clearDatabase,
        
        // Backup & restore
        exportBackup: exportBackup,
        restoreFromBackup: restoreFromBackup,
        
        // Templates
        generatePlayerDatabaseTemplate: generatePlayerDatabaseTemplate,
        generateTeamRosterTemplate: generateTeamRosterTemplate
    };
    
})();

// Auto-initialize on load
if (typeof firebase !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        FirebaseManager.init();
    });
}
