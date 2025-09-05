
// SafeBrowse Advanced - Background Service Worker v2.0.0
// Features: Scheduled blocking, Whitelist protection, AI detection, Enhanced logging

// Initialize extension on installation
chrome.runtime.onInstalled.addListener(async () => {
    console.log('SafeBrowse Advanced v2.0.0 installed with whitelist support');
    await initializeStorage();
    await setupScheduledBlocking();
});

// Initialize storage with default values including whitelist
async function initializeStorage() {
    const result = await chrome.storage.local.get([
        'blockedCount',
        'whitelistedCount',
        'blockedLog', 
        'isEnabled',
        'installDate',
        'password',
        'blockedKeywords',
        'blockedURLs',
        'whitelistedDomains',
        'sessionActive',
        'nsfwDetectionEnabled',
        'safeSearchEnabled',
        'whitelistEnabled',
        'focusModeSchedule'
    ]);

    const updates = {};

    if (!result.blockedCount) updates.blockedCount = 0;
    if (!result.whitelistedCount) updates.whitelistedCount = 0;
    if (!result.blockedLog) updates.blockedLog = [];
    if (result.isEnabled === undefined) updates.isEnabled = true;
    if (!result.installDate) updates.installDate = Date.now();
    if (!result.password) updates.password = '1234';

    if (!result.blockedKeywords) {
        updates.blockedKeywords = [
            'porn', 'sex', 'xxx', 'adult', 'nude', 'naked', 'erotic', 'sexual',
            'nsfw', 'explicit', 'hardcore', 'escort', 'hookup', 'webcam', 'cam'
        ];
    }

    if (!result.blockedURLs) {
        updates.blockedURLs = [
            'pornhub.com', 'xvideos.com', 'onlyfans.com', 'chaturbate.com', 'exampleporn.com'
        ];
    }

    // NEW: Initialize whitelist with safe defaults
    if (!result.whitelistedDomains) {
        updates.whitelistedDomains = [
            'google.com', 'wikipedia.org', 'github.com', 'stackoverflow.com',
            'youtube.com', 'gmail.com', 'docs.google.com', 'drive.google.com'
        ];
        updates.whitelistedCount = 8;
    }

    if (result.sessionActive === undefined) updates.sessionActive = true;
    if (result.nsfwDetectionEnabled === undefined) updates.nsfwDetectionEnabled = true;
    if (result.safeSearchEnabled === undefined) updates.safeSearchEnabled = true;
    if (result.whitelistEnabled === undefined) updates.whitelistEnabled = true;

    if (!result.focusModeSchedule) {
        updates.focusModeSchedule = {
            enabled: false,
            startHour: 22,
            endHour: 6,
            weekendsOnly: false,
            customDays: []
        };
    }

    if (Object.keys(updates).length > 0) {
        await chrome.storage.local.set(updates);
    }
}

// Setup scheduled blocking alarms
async function setupScheduledBlocking() {
    await chrome.alarms.clearAll();
    chrome.alarms.create('focusMode', { periodInMinutes: 60 });
    chrome.alarms.create('dailyReset', { periodInMinutes: 1440 });
    console.log('SafeBrowse: Scheduled blocking alarms set up with whitelist support');
}

// Handle alarm events
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'focusMode') {
        await handleFocusMode();
    } else if (alarm.name === 'dailyReset') {
        await handleDailyReset();
    }
});

// Handle focus mode scheduling
async function handleFocusMode() {
    const result = await chrome.storage.local.get(['focusModeSchedule']);
    const schedule = result.focusModeSchedule;

    if (!schedule || !schedule.enabled) return;

    const now = new Date();
    const currentHour = now.getHours();
    let shouldBlock = false;

    if (schedule.startHour > schedule.endHour) {
        shouldBlock = currentHour >= schedule.startHour || currentHour < schedule.endHour;
    } else {
        shouldBlock = currentHour >= schedule.startHour && currentHour < schedule.endHour;
    }

    const sessionActive = !shouldBlock;
    await chrome.storage.local.set({ sessionActive });
    console.log(`SafeBrowse: Focus mode check - Session ${sessionActive ? 'active' : 'blocked'}`);
}

// Handle daily reset and whitelist maintenance
async function handleDailyReset() {
    const result = await chrome.storage.local.get(['blockedLog', 'whitelistedDomains']);

    // Trim log to prevent bloat
    if (result.blockedLog && result.blockedLog.length > 100) {
        const trimmedLog = result.blockedLog.slice(-100);
        await chrome.storage.local.set({ blockedLog: trimmedLog });
    }

    // Update whitelist count
    const whitelistedCount = (result.whitelistedDomains || []).length;
    await chrome.storage.local.set({ whitelistedCount });

    console.log('SafeBrowse: Daily reset completed with whitelist maintenance');
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getStats':
            getAdvancedStats().then(sendResponse);
            return true;
        case 'getBlockedLog':
            getBlockedLog(request.limit).then(sendResponse);
            return true;
        case 'clearBlockedLog':
            clearBlockedLog().then(sendResponse);
            return true;
        case 'toggleExtension':
            toggleExtension(request.enabled).then(sendResponse);
            return true;
        case 'verifyPassword':
            verifyPassword(request.password).then(sendResponse);
            return true;
        case 'updateSettings':
            updateSettings(request.settings).then(sendResponse);
            return true;
        case 'updateSchedule':
            updateSchedule(request.schedule).then(sendResponse);
            return true;
        case 'checkWhitelist':
            checkWhitelist(request.url).then(sendResponse);
            return true;
    }
});

// Get comprehensive statistics including whitelist data
async function getAdvancedStats() {
    const result = await chrome.storage.local.get([
        'blockedCount', 'whitelistedCount', 'installDate', 'isEnabled', 'blockedLog',
        'sessionActive', 'focusModeSchedule', 'whitelistedDomains'
    ]);

    const installDate = result.installDate || Date.now();
    const daysSince = Math.floor((Date.now() - installDate) / (1000 * 60 * 60 * 24));

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentBlocks = (result.blockedLog || []).filter(entry => 
        new Date(entry.time) > oneDayAgo && entry.action !== 'whitelisted'
    );

    // Calculate whitelist count from actual domains
    const whitelistedCount = (result.whitelistedDomains || []).length;

    return {
        blockedCount: result.blockedCount || 0,
        whitelistedCount: whitelistedCount,
        daysSince: daysSince,
        isEnabled: result.isEnabled !== false,
        sessionActive: result.sessionActive !== false,
        timeSaved: Math.round((result.blockedCount || 0) * 0.5),
        todayBlocked: recentBlocks.length,
        focusModeEnabled: result.focusModeSchedule ? result.focusModeSchedule.enabled : false
    };
}

// Enhanced get blocked log with whitelist events
async function getBlockedLog(limit = 50) {
    const result = await chrome.storage.local.get(['blockedLog']);
    const log = result.blockedLog || [];
    return {
        total: log.length,
        entries: log.slice(-limit).reverse()
    };
}

// Clear blocked log
async function clearBlockedLog() {
    await chrome.storage.local.set({ 
        blockedLog: [],
        blockedCount: 0
    });
    return { success: true };
}

// Toggle extension on/off
async function toggleExtension(enabled) {
    try {
        await chrome.storage.local.set({ isEnabled: enabled });

        // Log the toggle action
        const result = await chrome.storage.local.get(['blockedLog']);
        let log = result.blockedLog || [];
        log.push({
            url: 'EXTENSION_TOGGLE',
            reason: enabled ? 'extension-enabled' : 'extension-disabled',
            action: 'system',
            details: `Extension ${enabled ? 'enabled' : 'disabled'} by user`,
            time: new Date().toISOString(),
            hostname: 'extension'
        });

        await chrome.storage.local.set({ blockedLog: log });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Verify password
async function verifyPassword(inputPassword) {
    const result = await chrome.storage.local.get(['password']);
    const savedPassword = result.password || '1234';
    return inputPassword === savedPassword;
}

// Enhanced update settings with whitelist support
async function updateSettings(settings) {
    try {
        const updates = {};
        if (settings.blockedKeywords !== undefined) {
            updates.blockedKeywords = settings.blockedKeywords.filter(k => k.trim().length > 0);
        }
        if (settings.blockedURLs !== undefined) {
            updates.blockedURLs = settings.blockedURLs.filter(u => u.trim().length > 0);
        }
        if (settings.whitelistedDomains !== undefined) {
            updates.whitelistedDomains = settings.whitelistedDomains.filter(d => d.trim().length > 0);
            updates.whitelistedCount = updates.whitelistedDomains.length;
        }
        if (settings.nsfwDetectionEnabled !== undefined) {
            updates.nsfwDetectionEnabled = settings.nsfwDetectionEnabled;
        }
        if (settings.safeSearchEnabled !== undefined) {
            updates.safeSearchEnabled = settings.safeSearchEnabled;
        }
        if (settings.whitelistEnabled !== undefined) {
            updates.whitelistEnabled = settings.whitelistEnabled;
        }
        if (settings.isEnabled !== undefined) {
            updates.isEnabled = settings.isEnabled;
        }

        await chrome.storage.local.set(updates);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Update schedule
async function updateSchedule(schedule) {
    try {
        await chrome.storage.local.set({ focusModeSchedule: schedule });
        await handleFocusMode();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// NEW: Check if URL is whitelisted
async function checkWhitelist(url) {
    try {
        const result = await chrome.storage.local.get(['whitelistedDomains', 'whitelistEnabled']);

        if (!result.whitelistEnabled) {
            return { isWhitelisted: false, reason: 'whitelist-disabled' };
        }

        const whitelistedDomains = result.whitelistedDomains || [];
        const hostname = new URL(url).hostname;

        // Check exact match and subdomain match
        const isWhitelisted = whitelistedDomains.some(domain => {
            return hostname === domain || hostname.endsWith('.' + domain);
        });

        if (isWhitelisted) {
            // Log whitelist event
            await logWhitelistEvent(url, hostname);
        }

        return { 
            isWhitelisted: isWhitelisted, 
            hostname: hostname,
            matchedDomain: isWhitelisted ? whitelistedDomains.find(d => 
                hostname === d || hostname.endsWith('.' + d)) : null
        };

    } catch (error) {
        console.error('Error checking whitelist:', error);
        return { isWhitelisted: false, error: error.message };
    }
}

// NEW: Log whitelist events
async function logWhitelistEvent(url, hostname) {
    try {
        const result = await chrome.storage.local.get(['blockedLog']);
        let log = result.blockedLog || [];

        log.push({
            url: url,
            hostname: hostname,
            reason: 'whitelisted',
            action: 'whitelisted',
            details: `Site allowed via whitelist protection`,
            time: new Date().toISOString()
        });

        // Keep only last 100 entries
        if (log.length > 100) {
            log = log.slice(-100);
        }

        await chrome.storage.local.set({ blockedLog: log });
        console.log(`SafeBrowse: Whitelisted access - ${hostname}`);

    } catch (error) {
        console.error('Error logging whitelist event:', error);
    }
}

// NEW: Enhanced logging function for blocked content
async function logBlockedEvent(url, reason, details = '', action = 'blocked') {
    try {
        const result = await chrome.storage.local.get(['blockedLog', 'blockedCount']);
        let log = result.blockedLog || [];

        const hostname = new URL(url).hostname;

        log.push({
            url: url,
            hostname: hostname,
            reason: reason,
            action: action,
            details: details,
            time: new Date().toISOString()
        });

        // Update blocked count only for actual blocks
        let updates = { blockedLog: log };
        if (action === 'blocked') {
            updates.blockedCount = (result.blockedCount || 0) + 1;
        }

        // Keep only last 100 entries
        if (log.length > 100) {
            updates.blockedLog = log.slice(-100);
        }

        await chrome.storage.local.set(updates);
        console.log(`SafeBrowse: ${action} - ${reason}: ${hostname}`);

    } catch (error) {
        console.error('Error logging event:', error);
    }
}

// Export the logging function for use by content script
globalThis.logBlockedEvent = logBlockedEvent;
globalThis.logWhitelistEvent = logWhitelistEvent;

console.log('SafeBrowse Advanced Background Service Worker initialized with whitelist support');
