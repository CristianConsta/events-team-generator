(function initOnboardingController(global) {
    'use strict';

    var ONBOARDING_STEPS = [
        { titleKey: 'onboarding_step1_title', descKey: 'onboarding_step1_desc', targetSelector: '#navMenuBtn',           position: 'bottom' },
        { titleKey: 'onboarding_step2_title', descKey: 'onboarding_step2_desc', targetSelector: '#navPlayersBtn',        position: 'bottom' },
        { titleKey: 'onboarding_step3_title', descKey: 'onboarding_step3_desc', targetSelector: '#downloadTemplateBtn',  position: 'bottom' },
        { titleKey: 'onboarding_step4_title', descKey: 'onboarding_step4_desc', targetSelector: '#uploadPlayerBtn',         position: 'bottom' },
        { titleKey: 'onboarding_fill_sample_title', descKey: 'onboarding_fill_sample_desc', targetSelector: '#fillSamplePlayersBtn', position: 'bottom', skipIfAbsent: true },
        { titleKey: 'onboarding_step5_title', descKey: 'onboarding_step5_desc', targetSelector: '#playersMgmtAddPanelHeader', position: 'bottom' },
        { titleKey: 'onboarding_step6_title', descKey: 'onboarding_step6_desc', targetSelector: '#navConfigBtn',         position: 'bottom' },
        { titleKey: 'onboarding_step7_title', descKey: 'onboarding_step7_desc', targetSelector: '#eventsList',           position: 'top'    },
        { titleKey: 'onboarding_step8_title', descKey: 'onboarding_step8_desc', targetSelector: '#mapCoordinatesBtn',    position: 'top'    },
        { titleKey: 'onboarding_step9_title', descKey: 'onboarding_step9_desc', targetSelector: '#navGeneratorBtn',      position: 'bottom' },
        { titleKey: 'onboarding_step10_title', descKey: 'onboarding_step10_desc', targetSelector: '#navAllianceBtn',     position: 'bottom' },
        { titleKey: 'onboarding_step11_title', descKey: 'onboarding_step11_desc', targetSelector: '#alliancePage',       position: 'top'    },
        { titleKey: 'onboarding_step12_title', descKey: 'onboarding_step12_desc', targetSelector: '#navEventHistoryBtn',  position: 'bottom' },
        { titleKey: 'onboarding_step13_title', descKey: 'onboarding_step13_desc', targetSelector: '#eventHistoryView',    position: 'top'    },
        { titleKey: 'onboarding_step14_title', descKey: 'onboarding_step14_desc', targetSelector: '#navPlayerUpdatesBtn', position: 'bottom' },
    ];

    var onboardingActive = false;
    var currentOnboardingStep = 0;
    var pendingOnboardingStep = null;
    var currentHighlightTarget = null;

    var deps = null;

    function t(key, params) {
        return deps && typeof deps.t === 'function' ? deps.t(key, params) : key;
    }

    function initOnboarding() {
        try {
            if (localStorage.getItem('ds_onboarding_done')) return;
        } catch (e) { return; }
        onboardingActive = true;
        currentOnboardingStep = 0;
        showOnboardingStep(0);
    }

    function showOnboardingStep(index) {
        if (index >= ONBOARDING_STEPS.length) {
            completeOnboarding();
            return;
        }
        var step = ONBOARDING_STEPS[index];
        if (
            step.targetSelector === '#navPlayersBtn' ||
            step.targetSelector === '#navConfigBtn' ||
            step.targetSelector === '#navGeneratorBtn' ||
            step.targetSelector === '#navAllianceBtn' ||
            step.targetSelector === '#navEventHistoryBtn' ||
            step.targetSelector === '#navPlayerUpdatesBtn'
        ) {
            if (deps && typeof deps.openNavigationMenu === 'function') {
                deps.openNavigationMenu();
            }
        }
        var target = document.querySelector(step.targetSelector);

        if (!target || target.closest('.hidden') || getComputedStyle(target).display === 'none') {
            if (step.skipIfAbsent) {
                showOnboardingStep(index + 1);
                return;
            }
            pendingOnboardingStep = index;
            return;
        }
        pendingOnboardingStep = null;
        currentOnboardingStep = index;

        if (currentHighlightTarget) {
            currentHighlightTarget.classList.remove('onboarding-highlight');
        }
        currentHighlightTarget = target;
        target.classList.add('onboarding-highlight');

        document.getElementById('onboardingStepLabel').textContent = t('onboarding_step', { current: index + 1, total: ONBOARDING_STEPS.length });
        document.getElementById('onboardingTitle').textContent = t(step.titleKey);
        document.getElementById('onboardingDesc').textContent = t(step.descKey);
        document.getElementById('onboardingSkip').textContent = t('onboarding_skip');

        var tooltip = document.getElementById('onboardingTooltip');
        tooltip.classList.remove('hidden');
        positionOnboardingTooltip();
    }

    function positionOnboardingTooltip() {
        var tooltip = document.getElementById('onboardingTooltip');
        if (!tooltip || tooltip.classList.contains('hidden')) return;

        var step = ONBOARDING_STEPS[currentOnboardingStep];
        var target = document.querySelector(step.targetSelector);
        if (!target) return;

        var rect = target.getBoundingClientRect();
        var tWidth = tooltip.offsetWidth || 280;
        var tHeight = tooltip.offsetHeight || 160;
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var gap = 10;

        var place = step.position;

        if (place === 'bottom' && rect.bottom + gap + tHeight > vh) place = 'top';
        if (place === 'top' && rect.top - gap - tHeight < 0) place = 'bottom';

        var top;
        if (place === 'bottom') {
            top = rect.bottom + gap;
            tooltip.setAttribute('data-arrow', 'top');
        } else {
            top = rect.top - gap - tHeight;
            tooltip.setAttribute('data-arrow', 'bottom');
        }

        var left = rect.left + rect.width / 2 - tWidth / 2;
        left = Math.max(8, Math.min(left, vw - tWidth - 8));

        var arrowOffset = (rect.left + rect.width / 2) - left - 7;
        arrowOffset = Math.max(12, Math.min(arrowOffset, tWidth - 26));

        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
        tooltip.style.setProperty('--arrow-offset', arrowOffset + 'px');
    }

    function dismissOnboardingStep() {
        if (!onboardingActive) return;
        if (currentHighlightTarget) {
            currentHighlightTarget.classList.remove('onboarding-highlight');
            currentHighlightTarget = null;
        }
        document.getElementById('onboardingTooltip').classList.add('hidden');

        var next = currentOnboardingStep + 1;
        if (next >= ONBOARDING_STEPS.length) {
            completeOnboarding();
        } else {
            showOnboardingStep(next);
        }
    }

    function completeOnboarding() {
        onboardingActive = false;
        if (currentHighlightTarget) {
            currentHighlightTarget.classList.remove('onboarding-highlight');
            currentHighlightTarget = null;
        }
        document.getElementById('onboardingTooltip').classList.add('hidden');
        try { localStorage.setItem('ds_onboarding_done', 'true'); } catch (e) { /* ignore */ }
    }

    function updateOnboardingTooltip() {
        if (!onboardingActive) return;
        var step = ONBOARDING_STEPS[currentOnboardingStep];
        document.getElementById('onboardingStepLabel').textContent = t('onboarding_step', { current: currentOnboardingStep + 1, total: ONBOARDING_STEPS.length });
        document.getElementById('onboardingTitle').textContent = t(step.titleKey);
        document.getElementById('onboardingDesc').textContent = t(step.descKey);
        document.getElementById('onboardingSkip').textContent = t('onboarding_skip');
    }

    function resumePendingOnboardingStep() {
        if (pendingOnboardingStep === null) {
            return;
        }
        var pending = pendingOnboardingStep;
        pendingOnboardingStep = null;
        showOnboardingStep(pending);
    }

    function isOnboardingActive() {
        return onboardingActive;
    }

    function bindOnboardingListeners() {
        document.addEventListener('click', function (event) {
            if (!onboardingActive) return;
            var step = ONBOARDING_STEPS[currentOnboardingStep];
            if (!step) return;
            var target = document.querySelector(step.targetSelector);
            if (!target) return;
            if (target.contains(event.target)) {
                dismissOnboardingStep();
            }
        });
        var skipEl = document.getElementById('onboardingSkip');
        if (skipEl) {
            skipEl.addEventListener('click', completeOnboarding);
        }
    }

    ['scroll', 'resize'].forEach(function (ev) {
        window.addEventListener(ev, function () { if (onboardingActive) positionOnboardingTooltip(); }, { passive: true });
    });

    global.DSOnboardingController = {
        init: function (dependencies) {
            deps = dependencies;
        },
        initOnboarding: initOnboarding,
        showOnboardingStep: showOnboardingStep,
        dismissOnboardingStep: dismissOnboardingStep,
        completeOnboarding: completeOnboarding,
        updateOnboardingTooltip: updateOnboardingTooltip,
        resumePendingOnboardingStep: resumePendingOnboardingStep,
        isOnboardingActive: isOnboardingActive,
        bindOnboardingListeners: bindOnboardingListeners,
    };
})(window);
