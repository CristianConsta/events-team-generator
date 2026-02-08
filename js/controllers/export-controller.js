(function initExportController(global) {
    global.DSExportController = {
        generateTeamAssignments: global.generateTeamAssignments,
        openDownloadModal: global.openDownloadModal,
        closeDownloadModal: global.closeDownloadModal,
        downloadTeamMap: global.downloadTeamMap,
        downloadTeamExcel: global.downloadTeamExcel,
    };
})(window);
