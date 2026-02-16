(function initNotificationsCore(global) {
    function getInvitationSenderDisplay(invitation) {
        if (!invitation || typeof invitation !== 'object') {
            return '';
        }
        if (typeof invitation.inviterName === 'string' && invitation.inviterName.trim()) {
            return invitation.inviterName.trim();
        }
        if (typeof invitation.inviterEmail === 'string' && invitation.inviterEmail.trim()) {
            return invitation.inviterEmail.trim();
        }
        return '';
    }

    function formatInvitationCreatedAt(createdAt) {
        if (!createdAt) {
            return '';
        }
        try {
            if (createdAt && typeof createdAt.toDate === 'function') {
                return createdAt.toDate().toLocaleString();
            }
            if (createdAt instanceof Date) {
                return createdAt.toLocaleString();
            }
            const value = new Date(createdAt);
            if (!Number.isNaN(value.getTime())) {
                return value.toLocaleString();
            }
        } catch (error) {
            return '';
        }
        return '';
    }

    function normalizeNotificationItems(options) {
        const settings = options && typeof options === 'object' ? options : {};
        if (Array.isArray(settings.invitationNotifications)) {
            return settings.invitationNotifications;
        }

        const invitations = Array.isArray(settings.pendingInvitations) ? settings.pendingInvitations : [];
        return invitations.map(function mapInvitation(invitation) {
            const source = invitation && typeof invitation === 'object' ? invitation : {};
            return {
                id: source.id ? `invite:${source.id}` : '',
                invitationId: source.id || '',
                notificationType: 'invitation_pending',
                allianceId: source.allianceId || '',
                allianceName: source.allianceName || '',
                inviterEmail: source.inviterEmail || '',
                inviterName: source.inviterName || '',
                createdAt: source.createdAt || null,
            };
        });
    }

    function getNotificationBadgeState(items) {
        const count = Array.isArray(items) ? items.length : 0;
        return {
            count: count,
            hasNotifications: count > 0,
        };
    }

    function getNotificationDetailText(item, translate) {
        const t = typeof translate === 'function' ? translate : function identity(value) { return value; };
        const notificationType = item && typeof item.notificationType === 'string'
            ? item.notificationType
            : 'invitation_pending';

        if (notificationType === 'invite_reminder_day1') {
            return t('notification_invite_reminder_day1');
        }
        if (notificationType === 'invite_reminder_day3') {
            return t('notification_invite_reminder_day3');
        }

        return t('notification_invited_by', { email: getInvitationSenderDisplay(item) || '-' });
    }

    global.DSFeatureNotificationsCore = {
        getInvitationSenderDisplay: getInvitationSenderDisplay,
        formatInvitationCreatedAt: formatInvitationCreatedAt,
        normalizeNotificationItems: normalizeNotificationItems,
        getNotificationBadgeState: getNotificationBadgeState,
        getNotificationDetailText: getNotificationDetailText,
    };
})(window);
