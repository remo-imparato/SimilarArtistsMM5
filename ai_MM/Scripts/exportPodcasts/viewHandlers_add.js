/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

nodeHandlers.subscriptions.toolbarActions.push(actions.exportPodcasts);
nodeHandlers.subscriptions.menuAddons = nodeHandlers.subscriptions.menuAddons || [];
nodeHandlers.subscriptions.menuAddons.push({
    action: actions.exportPodcasts,
    order: 90,
    grouporder: 10
});