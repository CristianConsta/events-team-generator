(function initPlayerController(global) {
    global.DSPlayerController = {
        toggleUploadPanel: global.toggleUploadPanel,
        downloadPlayerTemplate: global.downloadPlayerTemplate,
        uploadPlayerData: global.uploadPlayerData,
        uploadToPersonal: global.uploadToPersonal,
        uploadToAlliance: global.uploadToAlliance,
        closeUploadTargetModal: global.closeUploadTargetModal,
        loadPlayerData: global.loadPlayerData,
        showSelectionInterface: global.showSelectionInterface,
        renderPlayersTable: global.renderPlayersTable,
        toggleTeam: global.toggleTeam,
        togglePlayerRole: global.togglePlayerRole,
        clearPlayerSelection: global.clearPlayerSelection,
        clearAllSelections: global.clearAllSelections,
        filterPlayers: global.filterPlayers,
        updateTeamCounters: global.updateTeamCounters,
    };
})(window);
