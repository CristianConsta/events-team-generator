(function initEventWiki(global) {
    'use strict';

    // ── State ──────────────────────────────────────────────────────────────
    var state = {
        gameId: '',
        eventId: '',
        uid: '',
        allianceId: '',
        wikiData: null,
        quillEditor: null,
        isEditing: false,
        isAuthorized: false,
        currentUser: null,
        db: null,
    };

    // ── Helpers ────────────────────────────────────────────────────────────

    function tLocal(key) {
        return global.DSI18N && typeof global.DSI18N.t === 'function'
            ? (global.DSI18N.t(key) || key) : key;
    }

    function $(id) {
        return global.document.getElementById(id);
    }

    function show(id) {
        var el = $(id);
        if (el) el.classList.remove('hidden');
    }

    function hide(id) {
        var el = $(id);
        if (el) el.classList.add('hidden');
    }

    function showState(stateName) {
        var states = ['wikiLoading', 'wikiContent', 'wikiEmpty', 'wikiEditorSection', 'wikiError'];
        states.forEach(function(s) { hide(s); });
        show(stateName);
    }

    function showToast(message) {
        var toast = $('wikiToast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(function() { toast.classList.add('hidden'); }, 3000);
    }

    // ── URL Parsing ────────────────────────────────────────────────────────

    function parseUrlParams() {
        var params = new URLSearchParams(global.location.search);
        state.gameId = (params.get('game') || '').trim();
        state.eventId = (params.get('event') || '').trim();
        state.uid = (params.get('uid') || '').trim();
        state.allianceId = (params.get('aid') || '').trim();
    }

    function isAllianceWiki() {
        return !!state.allianceId;
    }

    // ── Firestore Access ───────────────────────────────────────────────────

    function getWikiDocRef() {
        if (!state.db || !state.gameId || !state.eventId) return null;
        if (isAllianceWiki()) {
            if (!state.allianceId) return null;
            return state.db.collection('games').doc(state.gameId)
                .collection('alliances').doc(state.allianceId)
                .collection('event_wiki').doc(state.eventId);
        }
        if (!state.uid) return null;
        return state.db.collection('games').doc(state.gameId)
            .collection('soloplayers').doc(state.uid)
            .collection('event_wiki').doc(state.eventId);
    }

    async function loadWiki() {
        var docRef = getWikiDocRef();
        if (!docRef) {
            showState('wikiError');
            return;
        }
        try {
            var snap = await docRef.get();
            if (snap.exists) {
                state.wikiData = snap.data();
                renderReadMode();
            } else {
                state.wikiData = null;
                showState('wikiEmpty');
                updateAuthUI();
            }
        } catch (err) {
            console.error('Failed to load wiki:', err);
            showState('wikiError');
        }
    }

    async function saveWiki() {
        var docRef = getWikiDocRef();
        if (!docRef || !state.quillEditor || !state.currentUser) return;
        var content = state.quillEditor.root.innerHTML;
        if (content === '<p><br></p>') content = '';
        var payload = {
            eventId: state.eventId,
            gameId: state.gameId,
            content: content,
            published: true,
            lastEditedBy: state.currentUser.uid,
            lastEditedByName: state.currentUser.displayName || '',
            lastEditedAt: global.firebase.firestore.FieldValue.serverTimestamp(),
            ownerType: isAllianceWiki() ? 'alliance' : 'personal',
        };
        // Preserve header fields from existing data
        if (state.wikiData) {
            if (state.wikiData.eventName) payload.eventName = state.wikiData.eventName;
            if (state.wikiData.gameName) payload.gameName = state.wikiData.gameName;
            if (state.wikiData.logoDataUrl) payload.logoDataUrl = state.wikiData.logoDataUrl;
        }
        try {
            var snap = await docRef.get();
            if (!snap.exists) {
                payload.createdBy = state.currentUser.uid;
                payload.createdByName = state.currentUser.displayName || '';
                payload.createdAt = global.firebase.firestore.FieldValue.serverTimestamp();
            }
            await docRef.set(payload, { merge: true });
            state.wikiData = Object.assign({}, state.wikiData || {}, payload);
            exitEditMode();
            renderReadMode();
            showToast(tLocal('wiki_save_success'));
        } catch (err) {
            console.error('Failed to save wiki:', err);
            showToast(tLocal('wiki_save_error'));
        }
    }

    async function deleteWiki() {
        if (!global.confirm(tLocal('wiki_delete_confirm'))) return;
        var docRef = getWikiDocRef();
        if (!docRef) return;
        try {
            await docRef.delete();
            state.wikiData = null;
            exitEditMode();
            showState('wikiEmpty');
            updateAuthUI();
            showToast(tLocal('wiki_delete_success'));
        } catch (err) {
            console.error('Failed to delete wiki:', err);
            showToast(tLocal('wiki_save_error'));
        }
    }

    // ── Rendering ──────────────────────────────────────────────────────────

    function renderHeader() {
        var headerEl = $('wikiHeader');
        if (!headerEl) return;

        var gameBadge = $('wikiGameBadge');
        var eventName = $('wikiEventName');
        var eventLogo = $('wikiEventLogo');

        if (gameBadge) {
            var gameName = (state.wikiData && state.wikiData.gameName) || state.gameId || '';
            gameBadge.textContent = gameName.replace(/_/g, ' ');
        }
        if (eventName) {
            var name = (state.wikiData && state.wikiData.eventName) || state.eventId.replace(/_/g, ' ') || '';
            eventName.textContent = name;
        }
        if (eventLogo) {
            var logoUrl = (state.wikiData && state.wikiData.logoDataUrl) || '';
            if (logoUrl) {
                eventLogo.src = logoUrl;
            } else {
                eventLogo.src = 'data:,';
            }
        }
        show('wikiHeader');
    }

    function renderReadMode() {
        renderHeader();
        var contentBody = $('wikiContentBody');
        if (contentBody && state.wikiData && state.wikiData.content) {
            contentBody.innerHTML = state.wikiData.content;
        } else if (contentBody) {
            contentBody.innerHTML = '';
        }

        var metaEl = $('wikiMeta');
        if (metaEl && state.wikiData && state.wikiData.lastEditedByName) {
            var editedText = tLocal('wiki_last_edited_by')
                .replace('{name}', state.wikiData.lastEditedByName);
            metaEl.textContent = editedText;
            show('wikiMeta');
        }

        showState('wikiContent');
        updateAuthUI();
    }

    // ── Auth ───────────────────────────────────────────────────────────────

    function checkAuthorization(user) {
        if (!user) {
            state.isAuthorized = false;
            return;
        }
        if (isAllianceWiki()) {
            // Alliance wiki: user must be alliance member.
            // We cannot fully verify membership client-side without loading alliance doc,
            // so we attempt writes and let Firestore rules enforce access.
            // For UX, show edit button if user is signed in and the URL has alliance context.
            state.isAuthorized = true;
        } else {
            // Personal wiki: only the owner can edit
            state.isAuthorized = user.uid === state.uid;
        }
    }

    function updateAuthUI() {
        var authBar = $('wikiAuthBar');
        if (!authBar) return;

        show('wikiAuthBar');

        if (state.currentUser) {
            hide('wikiSignInBtn');
            var userEl = $('wikiAuthUser');
            if (userEl) {
                userEl.textContent = state.currentUser.displayName || state.currentUser.email || '';
            }
            if (state.isAuthorized) {
                if (state.wikiData) {
                    show('wikiEditBtn');
                    show('wikiShareBtn');
                } else {
                    // Show create button in empty state
                    show('wikiCreateBtn');
                }
            }
        } else {
            show('wikiSignInBtn');
            hide('wikiEditBtn');
            hide('wikiShareBtn');
        }
    }

    async function handleSignIn() {
        try {
            var provider = new global.firebase.auth.GoogleAuthProvider();
            await global.firebase.auth().signInWithPopup(provider);
        } catch (err) {
            console.error('Sign-in failed:', err);
            showToast(tLocal('wiki_sign_in_error') || 'Sign-in failed');
        }
    }

    // ── Editor ─────────────────────────────────────────────────────────────

    function initQuillEditor() {
        if (state.quillEditor) return;

        var Quill = global.Quill;
        if (!Quill) {
            console.error('Quill.js not loaded');
            return;
        }

        state.quillEditor = new Quill('#wikiEditor', {
            theme: 'snow',
            placeholder: tLocal('wiki_editor_placeholder') || 'Write your strategy guide...',
            modules: {
                toolbar: [
                    [{ header: [2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['blockquote', 'code-block'],
                    ['link', 'image', 'video'],
                    ['clean'],
                ],
            },
        });

        // Custom image handler: compress + insert as base64
        state.quillEditor.getModule('toolbar').addHandler('image', handleImageUpload);
    }

    function handleImageUpload() {
        var input = global.document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp';
        input.addEventListener('change', function() {
            var file = input.files && input.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                showToast('Image too large (max 5MB)');
                return;
            }
            var reader = new FileReader();
            reader.onload = function(e) {
                var img = new Image();
                img.onload = function() {
                    var dataUrl = compressImage(img, 800, 0.8);
                    var range = state.quillEditor.getSelection(true);
                    state.quillEditor.insertEmbed(range.index, 'image', dataUrl);
                    state.quillEditor.setSelection(range.index + 1);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
        input.click();
    }

    function compressImage(img, maxWidth, quality) {
        var canvas = global.document.createElement('canvas');
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (w > maxWidth) {
            h = Math.round(h * maxWidth / w);
            w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        return canvas.toDataURL('image/jpeg', quality);
    }

    function enterEditMode() {
        state.isEditing = true;
        initQuillEditor();
        if (state.wikiData && state.wikiData.content) {
            state.quillEditor.root.innerHTML = state.wikiData.content;
        } else {
            state.quillEditor.root.innerHTML = '';
        }
        hide('wikiContent');
        hide('wikiEmpty');
        hide('wikiAuthBar');
        showState('wikiEditorSection');
        if (state.wikiData) {
            show('wikiDeleteBtn');
        } else {
            hide('wikiDeleteBtn');
        }
    }

    function exitEditMode() {
        state.isEditing = false;
        hide('wikiEditorSection');
        show('wikiAuthBar');
    }

    // ── Share ──────────────────────────────────────────────────────────────

    function handleShare() {
        var url = global.location.href;
        if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
            global.navigator.clipboard.writeText(url).then(function() {
                showToast(tLocal('wiki_link_copied'));
            }).catch(function() {
                showToast(url);
            });
        } else {
            showToast(url);
        }
    }

    // ── Event Binding ──────────────────────────────────────────────────────

    function bindEvents() {
        var signInBtn = $('wikiSignInBtn');
        if (signInBtn) signInBtn.addEventListener('click', handleSignIn);

        var editBtn = $('wikiEditBtn');
        if (editBtn) editBtn.addEventListener('click', enterEditMode);

        var createBtn = $('wikiCreateBtn');
        if (createBtn) createBtn.addEventListener('click', enterEditMode);

        var saveBtn = $('wikiSaveBtn');
        if (saveBtn) saveBtn.addEventListener('click', saveWiki);

        var cancelBtn = $('wikiCancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                exitEditMode();
                if (state.wikiData) {
                    renderReadMode();
                } else {
                    showState('wikiEmpty');
                    updateAuthUI();
                }
            });
        }

        var deleteBtn = $('wikiDeleteBtn');
        if (deleteBtn) deleteBtn.addEventListener('click', deleteWiki);

        var shareBtn = $('wikiShareBtn');
        if (shareBtn) shareBtn.addEventListener('click', handleShare);
    }

    // ── Init ───────────────────────────────────────────────────────────────

    function init() {
        parseUrlParams();

        if (!state.gameId || !state.eventId || (!state.uid && !state.allianceId)) {
            showState('wikiError');
            var errMsg = $('wikiErrorMessage');
            if (errMsg) errMsg.textContent = 'Invalid wiki URL. Missing required parameters.';
            return;
        }

        // Init i18n
        var langParam = new URLSearchParams(global.location.search).get('lang');
        var savedLang = global.localStorage && global.localStorage.getItem('ds_language');
        var lang = langParam || savedLang || 'en';

        if (global.DSI18N && typeof global.DSI18N.init === 'function') {
            global.DSI18N.init({
                onApply: function() {
                    global.document.title = tLocal('wiki_page_title');
                },
            });
            global.DSI18N.setLanguage(lang);
        }

        // Language switcher
        var langSelect = $('languageSelect');
        if (langSelect) {
            langSelect.value = lang;
            langSelect.addEventListener('change', function() {
                if (global.DSI18N && typeof global.DSI18N.setLanguage === 'function') {
                    global.DSI18N.setLanguage(langSelect.value);
                }
            });
        }

        // Init Firebase
        if (typeof global.firebase === 'undefined') {
            console.error('Firebase SDK not loaded');
            showState('wikiError');
            return;
        }

        try {
            if (!global.firebase.apps.length) {
                global.firebase.initializeApp(global.firebaseConfig);
            }
            state.db = global.firebase.firestore();
        } catch (err) {
            console.error('Firebase init error:', err);
            showState('wikiError');
            return;
        }

        bindEvents();

        // Auth state listener
        global.firebase.auth().onAuthStateChanged(function(user) {
            state.currentUser = user || null;
            checkAuthorization(user);
            updateAuthUI();
        });

        // Load wiki data
        loadWiki();
    }

    // ── Bootstrap ──────────────────────────────────────────────────────────

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0);
    }

    global.DSEventWiki = { init: init };
})(window);
