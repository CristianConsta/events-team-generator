(function initEventWiki(global) {
    'use strict';

    // ── Constants ────────────────────────────────────────────────────────────
    var SUPPORTED_LANGS = ['en', 'fr', 'de', 'it', 'ko', 'ro'];
    var LANG_NAMES = { en: 'English', fr: 'Français', de: 'Deutsch', it: 'Italiano', ko: '한국어', ro: 'Română' };
    var MEDIA_PLACEHOLDER_RE = /\{\{MEDIA_(\d+)\}\}/g;
    var TRANSLATE_API_BASE = 'https://translate.googleapis.com/translate_a/single';

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
        activeViewLang: '',
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
        var contentLangSelect = $('wikiContentLanguage');
        var contentLanguage = (contentLangSelect && contentLangSelect.value) || 'en';
        var payload = {
            eventId: state.eventId,
            gameId: state.gameId,
            content: content,
            contentLanguage: contentLanguage,
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
        state.activeViewLang = '';
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

        renderTranslationTabs();
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
                    show('wikiTranslateBtn');
                } else {
                    // Show create button in empty state
                    show('wikiCreateBtn');
                }
            }
        } else {
            show('wikiSignInBtn');
            hide('wikiEditBtn');
            hide('wikiShareBtn');
            hide('wikiTranslateBtn');
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
        var contentLangSelect = $('wikiContentLanguage');
        if (contentLangSelect) {
            contentLangSelect.value = (state.wikiData && state.wikiData.contentLanguage) || 'en';
        }
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

    // ── Translation ────────────────────────────────────────────────────────

    function simpleHash(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return String(hash);
    }

    function extractMediaFromHtml(html) {
        var container = global.document.createElement('div');
        container.innerHTML = html;
        var mediaElements = [];
        var mediaNodes = container.querySelectorAll('img, iframe, video, source');
        for (var i = 0; i < mediaNodes.length; i++) {
            var node = mediaNodes[i];
            var placeholder = '{{MEDIA_' + mediaElements.length + '}}';
            mediaElements.push(node.outerHTML);
            var span = global.document.createElement('span');
            span.textContent = placeholder;
            node.parentNode.replaceChild(span, node);
        }
        return { cleanHtml: container.innerHTML, mediaElements: mediaElements };
    }

    function restoreMediaInHtml(html, mediaElements) {
        return html.replace(MEDIA_PLACEHOLDER_RE, function(match, index) {
            var i = parseInt(index, 10);
            return (i < mediaElements.length) ? mediaElements[i] : match;
        });
    }

    async function translateText(text, sourceLang, targetLang) {
        if (!text || !text.trim()) return '';
        var response = await fetch(TRANSLATE_API_BASE +
            '?client=gtx&sl=' + encodeURIComponent(sourceLang) +
            '&tl=' + encodeURIComponent(targetLang) +
            '&dt=t&q=' + encodeURIComponent(text));
        if (!response.ok) throw new Error('HTTP ' + response.status);
        var data = await response.json();
        var result = '';
        if (data && data[0]) {
            data[0].forEach(function(segment) {
                if (segment && segment[0]) result += segment[0];
            });
        }
        return result;
    }

    async function translateDomTextNodes(node, sourceLang, targetLang) {
        for (var i = 0; i < node.childNodes.length; i++) {
            var child = node.childNodes[i];
            if (child.nodeType === 3) {
                var text = child.textContent;
                if (text.trim() && !MEDIA_PLACEHOLDER_RE.test(text)) {
                    child.textContent = await translateText(text, sourceLang, targetLang);
                }
            } else if (child.nodeType === 1) {
                var tag = child.tagName;
                if (tag !== 'CODE' && tag !== 'PRE') {
                    await translateDomTextNodes(child, sourceLang, targetLang);
                }
            }
        }
    }

    async function translateHtmlContent(html, sourceLang, targetLang) {
        var extracted = extractMediaFromHtml(html);
        var container = global.document.createElement('div');
        container.innerHTML = extracted.cleanHtml;
        await translateDomTextNodes(container, sourceLang, targetLang);
        return restoreMediaInHtml(container.innerHTML, extracted.mediaElements);
    }

    async function translateToAllLanguages() {
        if (!state.wikiData || !state.wikiData.content) return;
        var sourceLang = state.wikiData.contentLanguage || 'en';
        var targetLangs = SUPPORTED_LANGS.filter(function(l) { return l !== sourceLang; });
        var progressEl = $('wikiTranslateProgress');
        var translateBtn = $('wikiTranslateBtn');

        if (translateBtn) translateBtn.disabled = true;
        show('wikiTranslateProgress');

        var translations = {};
        try {
            for (var i = 0; i < targetLangs.length; i++) {
                var lang = targetLangs[i];
                if (progressEl) {
                    progressEl.textContent = tLocal('wiki_translate_progress')
                        .replace('{current}', String(i + 1))
                        .replace('{total}', String(targetLangs.length));
                }
                translations[lang] = await translateHtmlContent(
                    state.wikiData.content, sourceLang, lang
                );
                // Small delay between languages to avoid rate limiting
                if (i < targetLangs.length - 1) {
                    await new Promise(function(r) { setTimeout(r, 200); });
                }
            }
            var docRef = getWikiDocRef();
            if (docRef) {
                await docRef.set({
                    translations: translations,
                    translatedAt: global.firebase.firestore.FieldValue.serverTimestamp(),
                    translatedFromContentHash: simpleHash(state.wikiData.content),
                }, { merge: true });
                state.wikiData.translations = translations;
                state.wikiData.translatedFromContentHash = simpleHash(state.wikiData.content);
                renderTranslationTabs();
                showToast(tLocal('wiki_translate_success')
                    .replace('{count}', String(targetLangs.length)));
            }
        } catch (err) {
            console.error('Translation failed:', err);
            showToast(tLocal('wiki_translate_error'));
        } finally {
            if (translateBtn) translateBtn.disabled = false;
            hide('wikiTranslateProgress');
        }
    }

    function renderTranslationTabs() {
        var tabsEl = $('wikiTranslationTabs');
        if (!tabsEl) return;
        if (!state.wikiData || !state.wikiData.translations ||
            Object.keys(state.wikiData.translations).length === 0) {
            hide('wikiTranslationTabs');
            hide('wikiTranslationStale');
            return;
        }

        var sourceLang = state.wikiData.contentLanguage || 'en';
        var availableLangs = [sourceLang].concat(
            Object.keys(state.wikiData.translations).sort()
        );

        tabsEl.innerHTML = '';
        availableLangs.forEach(function(lang) {
            var btn = global.document.createElement('button');
            btn.type = 'button';
            btn.className = 'wiki-translation-tab';
            btn.textContent = LANG_NAMES[lang] || lang;
            btn.dataset.lang = lang;
            if (lang === (state.activeViewLang || sourceLang)) {
                btn.classList.add('active');
            }
            btn.addEventListener('click', function() {
                switchTranslationView(lang);
            });
            tabsEl.appendChild(btn);
        });
        show('wikiTranslationTabs');

        // Show stale warning if content changed since translation
        var staleEl = $('wikiTranslationStale');
        if (staleEl && state.wikiData.translatedFromContentHash) {
            var isStale = simpleHash(state.wikiData.content) !== state.wikiData.translatedFromContentHash;
            staleEl.classList.toggle('hidden', !isStale);
        }
    }

    function switchTranslationView(lang) {
        var contentBody = $('wikiContentBody');
        if (!contentBody || !state.wikiData) return;

        var sourceLang = state.wikiData.contentLanguage || 'en';
        state.activeViewLang = lang;

        if (lang === sourceLang) {
            contentBody.innerHTML = state.wikiData.content || '';
        } else if (state.wikiData.translations && state.wikiData.translations[lang]) {
            contentBody.innerHTML = state.wikiData.translations[lang];
        }

        var tabsEl = $('wikiTranslationTabs');
        if (tabsEl) {
            var tabs = tabsEl.querySelectorAll('.wiki-translation-tab');
            for (var i = 0; i < tabs.length; i++) {
                tabs[i].classList.toggle('active', tabs[i].dataset.lang === lang);
            }
        }
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

        var translateBtn = $('wikiTranslateBtn');
        if (translateBtn) translateBtn.addEventListener('click', translateToAllLanguages);

        var retranslateBtn = $('wikiRetranslateBtn');
        if (retranslateBtn) retranslateBtn.addEventListener('click', translateToAllLanguages);
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
                global.firebase.initializeApp(global.FIREBASE_CONFIG);
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

    global.DSEventWiki = {
        init: init,
        _extractMediaFromHtml: extractMediaFromHtml,
        _restoreMediaInHtml: restoreMediaInHtml,
        _simpleHash: simpleHash,
    };
})(window);
