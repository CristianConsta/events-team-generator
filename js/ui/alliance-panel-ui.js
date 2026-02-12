(function initAlliancePanelUi(global) {
    function defaultTranslate(key) {
        return key;
    }

    function getTranslator(translate) {
        return typeof translate === 'function' ? translate : defaultTranslate;
    }

    function getTemplateContent(templateId) {
        const template = document.getElementById(templateId);
        if (!(template instanceof HTMLTemplateElement)) {
            return null;
        }
        return template.content.cloneNode(true);
    }

    function setElementText(container, selector, text) {
        const element = container.querySelector(selector);
        if (element) {
            element.textContent = text;
        }
    }

    function setElementPlaceholder(container, selector, text) {
        const element = container.querySelector(selector);
        if (element instanceof HTMLInputElement) {
            element.placeholder = text;
        }
    }

    function getPendingInvitations(config) {
        if (!config || typeof config.getPendingInvitations !== 'function') {
            return [];
        }
        const invitations = config.getPendingInvitations();
        return Array.isArray(invitations) ? invitations : [];
    }

    function getPendingFocusInviteId(config) {
        if (!config || typeof config.getPendingInviteFocusId !== 'function') {
            return '';
        }
        const value = config.getPendingInviteFocusId();
        return typeof value === 'string' ? value : '';
    }

    function clearPendingFocusInviteId(config) {
        if (config && typeof config.setPendingInviteFocusId === 'function') {
            config.setPendingInviteFocusId('');
        }
    }

    function renderAllianceInvitesSection(container, config) {
        const section = container.querySelector('#allianceInvitesSection');
        if (!section) {
            return;
        }

        const t = getTranslator(config && config.translate);
        const invitations = getPendingInvitations(config);
        const hasAllianceMembership = !!(config && config.hasAllianceMembership);
        const getInvitationSenderDisplay = config && typeof config.getInvitationSenderDisplay === 'function'
            ? config.getInvitationSenderDisplay
            : function fallbackSender() { return ''; };
        const formatInvitationCreatedAt = config && typeof config.formatInvitationCreatedAt === 'function'
            ? config.formatInvitationCreatedAt
            : function fallbackCreatedAt() { return ''; };

        if (invitations.length === 0) {
            const emptyTemplate = getTemplateContent('allianceInvitesEmptyTemplate');
            if (!emptyTemplate) {
                section.innerHTML = '';
                return;
            }
            setElementText(emptyTemplate, '.alliance-panel-subtitle', t('alliance_received_invites_title'));
            setElementText(emptyTemplate, '.alliance-panel-muted', t('alliance_received_invites_empty'));
            section.replaceChildren(emptyTemplate);
            return;
        }

        const invitesTemplate = getTemplateContent('allianceInvitesSectionTemplate');
        if (!invitesTemplate) {
            section.innerHTML = '';
            return;
        }

        setElementText(invitesTemplate, '.alliance-panel-subtitle', t('alliance_received_invites_title'));
        setElementText(invitesTemplate, '.alliance-panel-help', t('alliance_received_invites_help'));

        const lockedHintEl = invitesTemplate.querySelector('#allianceInvitesLockedHint');
        if (lockedHintEl) {
            if (hasAllianceMembership) {
                lockedHintEl.textContent = t('alliance_invites_leave_first');
                lockedHintEl.classList.remove('hidden');
            } else {
                lockedHintEl.classList.add('hidden');
            }
        }

        const cardsContainer = invitesTemplate.querySelector('#allianceInvitesCards');
        if (!cardsContainer) {
            section.replaceChildren(invitesTemplate);
            return;
        }

        invitations.forEach((inv) => {
            const cardTemplate = getTemplateContent('allianceInviteCardTemplate');
            if (!cardTemplate) {
                return;
            }
            const inviteId = typeof inv.id === 'string' ? inv.id : '';
            const allianceLabel = (typeof inv.allianceName === 'string' && inv.allianceName.trim())
                ? inv.allianceName.trim()
                : String(inv.allianceId || '');
            const sender = getInvitationSenderDisplay(inv);
            const createdAt = formatInvitationCreatedAt(inv.createdAt);

            const cardEl = cardTemplate.querySelector('.alliance-invite-card');
            if (!cardEl) {
                return;
            }
            cardEl.setAttribute('data-invite-id', inviteId);

            const allianceLabelEl = cardTemplate.querySelector('.alliance-invite-alliance');
            if (allianceLabelEl) {
                allianceLabelEl.textContent = t('notification_alliance_label', { alliance: allianceLabel || '-' });
            }

            const senderEl = cardTemplate.querySelector('.alliance-invite-sender');
            if (senderEl) {
                senderEl.textContent = t('notification_invited_by', { email: sender || '-' });
            }

            const createdAtEl = cardTemplate.querySelector('.alliance-invite-created');
            if (createdAtEl) {
                createdAtEl.textContent = createdAt || '';
                createdAtEl.classList.toggle('hidden', !createdAt);
            }

            cardTemplate.querySelectorAll('[data-invite-action]').forEach((btn) => {
                btn.setAttribute('data-invite-id', inviteId);
            });

            const acceptBtn = cardTemplate.querySelector('[data-invite-action="accept"]');
            if (acceptBtn) {
                acceptBtn.textContent = t('notification_accept');
            }
            const rejectBtn = cardTemplate.querySelector('[data-invite-action="reject"]');
            if (rejectBtn) {
                rejectBtn.textContent = t('notification_reject');
            }

            cardsContainer.appendChild(cardTemplate);
        });

        section.replaceChildren(invitesTemplate);

        section.querySelectorAll('[data-invite-action]').forEach((button) => {
            button.addEventListener('click', async () => {
                const action = button.getAttribute('data-invite-action');
                const invitationId = button.getAttribute('data-invite-id');
                if (!invitationId) {
                    return;
                }
                if (action === 'accept') {
                    if (config && typeof config.onAcceptInvitation === 'function') {
                        await config.onAcceptInvitation(invitationId, 'allianceInvitesStatus');
                    }
                    return;
                }
                if (action === 'reject' && config && typeof config.onRejectInvitation === 'function') {
                    await config.onRejectInvitation(invitationId, 'allianceInvitesStatus');
                }
            });
        });

        const pendingFocusInviteId = getPendingFocusInviteId(config);
        if (pendingFocusInviteId) {
            const focusCard = section.querySelector('[data-invite-id="' + pendingFocusInviteId + '"]');
            clearPendingFocusInviteId(config);
            if (focusCard) {
                focusCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                focusCard.classList.add('alliance-invite-card--focus');
                setTimeout(() => {
                    focusCard.classList.remove('alliance-invite-card--focus');
                }, 1600);
            }
        }
    }

    function renderAllianceJoinView(container, config) {
        const joinTemplate = getTemplateContent('allianceJoinTemplate');
        if (!joinTemplate) {
            container.innerHTML = '';
            return;
        }

        const t = getTranslator(config && config.translate);
        setElementText(joinTemplate, '.alliance-panel-subtitle', t('alliance_create_title'));
        setElementPlaceholder(joinTemplate, '#newAllianceName', t('alliance_name_placeholder'));
        setElementText(joinTemplate, '#allianceCreateActionBtn', t('alliance_create_button'));

        container.replaceChildren(joinTemplate);

        const createBtn = document.getElementById('allianceCreateActionBtn');
        if (createBtn && config && typeof config.onCreateAlliance === 'function') {
            createBtn.addEventListener('click', config.onCreateAlliance);
        }
        renderAllianceInvitesSection(container, Object.assign({}, config, {
            hasAllianceMembership: false,
        }));
    }

    function renderAllianceMemberView(container, config) {
        const members = config && typeof config.getAllianceMembers === 'function'
            ? (config.getAllianceMembers() || {})
            : {};
        const memberCount = Object.keys(members).length;
        const allianceName = config && typeof config.getAllianceName === 'function'
            ? config.getAllianceName()
            : '';

        const memberTemplate = getTemplateContent('allianceMemberTemplate');
        if (!memberTemplate) {
            container.innerHTML = '';
            return;
        }

        const t = getTranslator(config && config.translate);
        setElementText(memberTemplate, '#allianceMemberName', allianceName || '');
        setElementText(memberTemplate, '#allianceMemberCount', t('alliance_member_count', { count: memberCount }));
        setElementText(memberTemplate, '#allianceMembersTitle', t('alliance_members_title'));
        setElementText(memberTemplate, '#allianceInviteTitle', t('alliance_invite_title'));
        setElementPlaceholder(memberTemplate, '#inviteEmail', t('alliance_invite_placeholder'));
        setElementText(memberTemplate, '#allianceInviteActionBtn', t('alliance_invite_button'));
        setElementText(memberTemplate, '#allianceInviteHint', t('alliance_invite_platform_hint'));
        setElementText(memberTemplate, '#allianceLeaveBtn', t('alliance_leave_button'));

        const membersList = memberTemplate.querySelector('#allianceMembersList');
        if (membersList) {
            Object.values(members).forEach((member) => {
                const row = document.createElement('div');
                row.className = 'alliance-member-row';
                row.textContent = typeof member.email === 'string' ? member.email : '';
                membersList.appendChild(row);
            });
        }

        container.replaceChildren(memberTemplate);

        const inviteBtn = document.getElementById('allianceInviteActionBtn');
        if (inviteBtn && config && typeof config.onSendInvitation === 'function') {
            inviteBtn.addEventListener('click', config.onSendInvitation);
        }
        const leaveBtn = document.getElementById('allianceLeaveBtn');
        if (leaveBtn && config && typeof config.onLeaveAlliance === 'function') {
            leaveBtn.addEventListener('click', config.onLeaveAlliance);
        }
        renderAllianceInvitesSection(container, Object.assign({}, config, {
            hasAllianceMembership: true,
        }));
    }

    function renderAlliancePanel(options) {
        const config = options && typeof options === 'object' ? options : {};
        const content = config.contentElement || document.getElementById('alliancePanelContent');
        if (!content) {
            return;
        }
        if (config.hasAllianceMembership) {
            renderAllianceMemberView(content, config);
        } else {
            renderAllianceJoinView(content, config);
        }
    }

    global.DSAlliancePanelUI = {
        renderAlliancePanel: renderAlliancePanel,
    };
})(window);
