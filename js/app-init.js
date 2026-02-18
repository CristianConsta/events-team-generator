(function initApplication(global) {
    function resolveStartupFeatureFlags() {
        if (!global.FirebaseService || typeof global.FirebaseService.getFeatureFlags !== 'function') {
            return {};
        }
        return global.FirebaseService.getFeatureFlags();
    }

    function cacheStartupFeatureFlags() {
        global.__APP_FEATURE_FLAGS = resolveStartupFeatureFlags();
    }

    function ensureSignedInGameContext() {
        if (!global.FirebaseService || typeof global.FirebaseService.ensureActiveGame !== 'function') {
            return '';
        }
        const context = global.FirebaseService.ensureActiveGame();
        const activeGameId = context && typeof context.gameId === 'string' ? context.gameId : '';
        global.__ACTIVE_GAME_ID = activeGameId;
        if (activeGameId && typeof global.updateActiveGameBadge === 'function') {
            global.updateActiveGameBadge(activeGameId);
        }
        return activeGameId;
    }

    function renderMissingFirebaseError() {
        setTimeout(() => {
            const loginScreen = document.getElementById('loginScreen');
            if (loginScreen) {
                loginScreen.innerHTML = `
                    <div style="max-width: 600px; margin: 100px auto; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <h1 style="text-align: center; color: #DC143C;">${t('error_loading_title')}</h1>
                        <p style="color: #333; text-align: center; margin: 20px 0;">${t('error_missing_firebase_line1')}</p>
                        <p style="color: #666; text-align: center; font-size: 14px;">${t('error_missing_firebase_line2')}</p>
                        <ul style="color: #666; margin: 20px 40px;">
                            <li>${t('error_missing_firebase_file1')}</li>
                            <li>${t('error_missing_firebase_file2')}</li>
                        </ul>
                        <p style="color: #666; text-align: center; font-size: 14px; margin-top: 20px;">${t('error_missing_firebase_line3')}</p>
                    </div>
                `;
                loginScreen.style.display = 'block';
            }
        }, 100);
    }

    function initializeFirebaseCallbacks() {
        if (!global.FirebaseService || !global.FirebaseService.isAvailable()) {
            console.error('FirebaseService not available - cannot initialize callbacks');
            renderMissingFirebaseError();
            return;
        }

        cacheStartupFeatureFlags();

        FirebaseService.setAuthCallback((isSignedIn, user) => {
            if (isSignedIn) {
                ensureSignedInGameContext();
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                if (typeof updateUserHeaderIdentity === 'function') {
                    updateUserHeaderIdentity(user);
                }
                applyTranslations();
                if (typeof global.showPostAuthGameSelector === 'function') {
                    global.showPostAuthGameSelector();
                }
                initOnboarding();
                startNotificationPolling();
            } else {
                document.getElementById('loginScreen').style.display = 'block';
                document.getElementById('mainApp').style.display = 'none';
                global.__ACTIVE_GAME_ID = '';
                if (global.FirebaseService && typeof global.FirebaseService.clearActiveGame === 'function') {
                    global.FirebaseService.clearActiveGame();
                }
                if (typeof global.updateActiveGameBadge === 'function') {
                    global.updateActiveGameBadge('');
                }
                if (typeof global.resetPostAuthGameSelectorState === 'function') {
                    global.resetPostAuthGameSelectorState();
                }
                if (typeof updateUserHeaderIdentity === 'function') {
                    updateUserHeaderIdentity(null);
                }
                stopNotificationPolling();
            }
        });

        FirebaseService.setDataLoadCallback((playerDatabase) => {
            ensureSignedInGameContext();
            console.log('Player database loaded:', Object.keys(playerDatabase).length, 'players');
            loadPlayerData();
            const configNeedsSave = loadBuildingConfig();
            const positionsNeedsSave = loadBuildingPositions();
            if (configNeedsSave || positionsNeedsSave) {
                FirebaseService.saveUserData();
            }
            if (typeof updateUserHeaderIdentity === 'function') {
                updateUserHeaderIdentity();
            }
            updateAllianceHeaderDisplay();
            checkAndDisplayNotifications();
        });

        if (typeof FirebaseService.setAllianceDataCallback === 'function') {
            FirebaseService.setAllianceDataCallback(() => {
                if (typeof handleAllianceDataRealtimeUpdate === 'function') {
                    handleAllianceDataRealtimeUpdate();
                }
            });
        }
    }

    initLanguage();
    updateGenerateEventLabels();
    initializeFirebaseCallbacks();
})(window);
