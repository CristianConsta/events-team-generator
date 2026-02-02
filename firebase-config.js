/**
 * FIREBASE CONFIGURATION FILE - YOUR ACTUAL CREDENTIALS
 * =====================================================
 * 
 * This file contains your actual Firebase credentials.
 * 
 * ⚠️ IMPORTANT SECURITY STEPS:
 * 
 * 1. REGENERATE YOUR API KEY IMMEDIATELY:
 *    - Go to: https://console.cloud.google.com/apis/credentials
 *    - Find API key: AIzaSyDOpgLIoUwh5r3xFL9GultXkVaTrUq4xe0
 *    - Click the key name
 *    - Click "REGENERATE KEY" button
 *    - Copy the NEW key and replace below
 *    - Delete the old key
 * 
 * 2. ADD API KEY RESTRICTIONS:
 *    - In the API key settings, add "HTTP referrers"
 *    - Add your GitHub Pages URL: https://cristianconsta.github.io/*
 *    - Add localhost for testing: http://localhost/*
 *    - Click "Save"
 * 
 * 3. NEVER COMMIT THIS FILE TO GITHUB:
 *    - Add to .gitignore
 *    - Keep this file private
 *    - Don't share on public repositories
 * 
 * 4. REMOVE EXPOSED KEY FROM GITHUB:
 *    - Delete the firebase-module.js commit that exposed the key
 *    - Or make the repository private
 */

// YOUR FIREBASE CONFIGURATION
// After regenerating, update the apiKey below with your NEW key
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCRnf1_04bcwr4Kf8pOauWjnNEzKiQD2ik",  // ⚠️ REGENERATE THIS KEY!
    authDomain: "last-war-game-desert-storm.firebaseapp.com",
    projectId: "last-war-game-desert-storm",
    storageBucket: "last-war-game-desert-storm.firebasestorage.app",
    messagingSenderId: "481454789926",
    appId: "1:481454789926:web:6b9be1afec0fa0d1045de7"
};

// DO NOT EDIT BELOW THIS LINE
if (typeof window !== 'undefined') {
    window.FIREBASE_CONFIG = FIREBASE_CONFIG;
}
