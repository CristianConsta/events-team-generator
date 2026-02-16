(function initApplication(global) {
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

        FirebaseService.setAuthCallback((isSignedIn, user) => {
            if (isSignedIn) {
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                if (typeof updateUserHeaderIdentity === 'function') {
                    updateUserHeaderIdentity(user);
                }
                applyTranslations();
                initOnboarding();
                if (
                    global.getNotificationsFeatureController
                    && typeof global.getNotificationsFeatureController === 'function'
                ) {
                    const notificationsController = global.getNotificationsFeatureController();
                    if (notificationsController && typeof notificationsController.startPolling === 'function') {
                        notificationsController.startPolling();
                    } else {
                        startNotificationPolling();
                    }
                } else {
                    startNotificationPolling();
                }
            } else {
                document.getElementById('loginScreen').style.display = 'block';
                document.getElementById('mainApp').style.display = 'none';
                if (typeof updateUserHeaderIdentity === 'function') {
                    updateUserHeaderIdentity(null);
                }
                if (
                    global.getNotificationsFeatureController
                    && typeof global.getNotificationsFeatureController === 'function'
                ) {
                    const notificationsController = global.getNotificationsFeatureController();
                    if (notificationsController && typeof notificationsController.stopPolling === 'function') {
                        notificationsController.stopPolling();
                    } else {
                        stopNotificationPolling();
                    }
                } else {
                    stopNotificationPolling();
                }
            }
        });

        FirebaseService.setDataLoadCallback((playerDatabase) => {
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
