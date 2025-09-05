
// SafeBrowse Advanced - Popup JavaScript v2.0.0
// Features: Password protection, Whitelist management, AI detection, Scheduling

let isUnlocked = false;
let currentStats = {};
let currentLogs = [];
let currentTabUrl = '';

document.addEventListener('DOMContentLoaded', function() {
    initializePopup();
});

async function initializePopup() {
    try {
        await loadStats();
        await getCurrentTabUrl();
        setupEventListeners();
        showPasswordScreen();
    } catch (error) {
        console.error('Error initializing popup:', error);
    }
}

async function getCurrentTabUrl() {
    try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs[0]) {
            currentTabUrl = tabs[0].url;
            updateCurrentSiteDisplay();
        }
    } catch (error) {
        console.error('Error getting current tab:', error);
        currentTabUrl = '';
    }
}

function updateCurrentSiteDisplay() {
    const displays = ['current-site-display', 'current-site-url'];
    displays.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (currentTabUrl && !currentTabUrl.startsWith('chrome://') && !currentTabUrl.startsWith('moz://') && !currentTabUrl.startsWith('edge://')) {
                const hostname = new URL(currentTabUrl).hostname;
                element.textContent = hostname;
                document.getElementById('quick-whitelist-btn')?.style.setProperty('display', 'block');
                document.getElementById('add-current-site-btn')?.style.setProperty('display', 'block');
            } else {
                element.textContent = 'Extension or system page';
                document.getElementById('quick-whitelist-btn')?.style.setProperty('display', 'none');
                document.getElementById('add-current-site-btn')?.style.setProperty('display', 'none');
            }
        }
    });
}

function setupEventListeners() {
    // Password screen
    document.getElementById('unlock-btn').addEventListener('click', handleUnlock);
    document.getElementById('stats-view-btn').addEventListener('click', showStatsView);
    document.getElementById('back-to-password').addEventListener('click', showPasswordScreen);
    document.getElementById('password').addEventListener('keypress', handlePasswordKeypress);

    // Quick whitelist buttons
    document.getElementById('quick-whitelist-btn')?.addEventListener('click', addCurrentSiteToWhitelist);
    document.getElementById('add-current-site-btn')?.addEventListener('click', addCurrentSiteToWhitelist);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });

    // Settings
    document.getElementById('extension-enabled').addEventListener('change', toggleExtension);
    document.getElementById('focus-mode-enabled').addEventListener('change', toggleFocusMode);
    document.getElementById('keywords').addEventListener('input', updateKeywordCount);
    document.getElementById('urls').addEventListener('input', updateUrlCount);
    document.getElementById('whitelist-domains').addEventListener('input', updateWhitelistCount);

    // Whitelist functionality
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => loadPresetWhitelist(e.target.dataset.preset));
    });
    document.getElementById('import-whitelist-btn').addEventListener('click', importWhitelist);
    document.getElementById('export-whitelist-btn').addEventListener('click', exportWhitelist);
    document.getElementById('clear-whitelist-btn').addEventListener('click', clearWhitelist);

    // Logs
    document.getElementById('refresh-logs').addEventListener('click', loadLogs);
    document.getElementById('clear-logs').addEventListener('click', clearLogs);
    document.getElementById('log-filter').addEventListener('change', filterLogs);

    // Save
    document.getElementById('saveBtn').addEventListener('click', saveAllSettings);
}

function showPasswordScreen() {
    document.getElementById('password-screen').style.display = 'block';
    document.getElementById('stats-only-view').style.display = 'none';
    document.getElementById('main-settings').style.display = 'none';
    document.getElementById('password').focus();
    clearPasswordError();
}

function showStatsView() {
    document.getElementById('password-screen').style.display = 'none';
    document.getElementById('stats-only-view').style.display = 'block';
    document.getElementById('main-settings').style.display = 'none';
    updateStatsOnlyView();
}

function showMainSettings() {
    document.getElementById('password-screen').style.display = 'none';
    document.getElementById('stats-only-view').style.display = 'none';
    document.getElementById('main-settings').style.display = 'block';
    loadAllSettings();
}

async function handleUnlock() {
    const password = document.getElementById('password').value;
    if (!password) {
        showPasswordError('Please enter a password');
        return;
    }

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'verifyPassword',
            password: password
        });

        if (response) {
            isUnlocked = true;
            showMainSettings();
        } else {
            showPasswordError('Incorrect password');
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    } catch (error) {
        showPasswordError('Error verifying password');
    }
}

function handlePasswordKeypress(e) {
    if (e.key === 'Enter') {
        handleUnlock();
    }
}

function showPasswordError(message) {
    const errorEl = document.getElementById('password-error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => errorEl.style.display = 'none', 3000);
}

function clearPasswordError() {
    document.getElementById('password-error').style.display = 'none';
}

async function loadStats() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getStats' });
        currentStats = response;
        updateAllStatsDisplays(response);
    } catch (error) {
        console.error('Error loading stats:', error);
        const defaultStats = {
            blockedCount: 0,
            todayBlocked: 0,
            whitelistedCount: 0,
            timeSaved: 0,
            sessionActive: true,
            isEnabled: true
        };
        updateAllStatsDisplays(defaultStats);
    }
}

function updateAllStatsDisplays(stats) {
    const aiBlocks = currentLogs.filter(log => log.reason === 'nsfw-image').length;

    // Main settings stats
    if (document.getElementById('blocked-count')) {
        document.getElementById('blocked-count').textContent = stats.blockedCount || 0;
        document.getElementById('today-count').textContent = stats.todayBlocked || 0;
        document.getElementById('ai-blocks').textContent = aiBlocks;
        document.getElementById('whitelisted-count').textContent = stats.whitelistedCount || 0;
    }

    // Stats-only view
    document.getElementById('stats-blocked-count').textContent = stats.blockedCount || 0;
    document.getElementById('stats-today-count').textContent = stats.todayBlocked || 0;
    document.getElementById('stats-whitelisted-count').textContent = stats.whitelistedCount || 0;

    updateSessionStatus(stats.sessionActive, stats.isEnabled);
}

function updateStatsOnlyView() {
    updateAllStatsDisplays(currentStats);
}

function updateSessionStatus(sessionActive, isEnabled) {
    const indicators = [
        { dot: 'session-dot', text: 'session-text' },
        { dot: 'status-dot', text: 'status-text' }
    ];

    indicators.forEach(indicator => {
        const dotEl = document.getElementById(indicator.dot);
        const textEl = document.getElementById(indicator.text);

        if (dotEl && textEl) {
            if (!isEnabled) {
                dotEl.className = 'session-dot inactive';
                textEl.textContent = 'Disabled';
            } else if (sessionActive) {
                dotEl.className = 'session-dot active';
                textEl.textContent = 'Active';
            } else {
                dotEl.className = 'session-dot blocked';
                textEl.textContent = 'Focus Mode';
            }
        }
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');

    if (tabName === 'logs') {
        loadLogs();
    } else if (tabName === 'whitelist') {
        updateCurrentSiteDisplay();
    }
}

async function loadAllSettings() {
    try {
        const result = await chrome.storage.local.get([
            'blockedKeywords',
            'blockedURLs',
            'whitelistedDomains',
            'nsfwDetectionEnabled',
            'safeSearchEnabled',
            'whitelistEnabled',
            'isEnabled',
            'focusModeSchedule'
        ]);

        const keywords = result.blockedKeywords || [];
        document.getElementById('keywords').value = keywords.join('\n');
        updateKeywordCount();

        const urls = result.blockedURLs || [];
        document.getElementById('urls').value = urls.join('\n');
        updateUrlCount();

        const whitelistedDomains = result.whitelistedDomains || [];
        document.getElementById('whitelist-domains').value = whitelistedDomains.join('\n');
        updateWhitelistCount();

        document.getElementById('extension-enabled').checked = result.isEnabled !== false;
        document.getElementById('safesearch-enabled').checked = result.safeSearchEnabled !== false;
        document.getElementById('nsfw-detection-enabled').checked = result.nsfwDetectionEnabled !== false;
        document.getElementById('whitelist-enabled').checked = result.whitelistEnabled !== false;

        const schedule = result.focusModeSchedule || { enabled: false, startHour: 22, endHour: 6 };
        document.getElementById('focus-mode-enabled').checked = schedule.enabled;
        document.getElementById('start-hour').value = schedule.startHour;
        document.getElementById('end-hour').value = schedule.endHour;

        toggleFocusMode({ target: { checked: schedule.enabled } });

    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function toggleExtension() {
    const enabled = document.getElementById('extension-enabled').checked;
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'toggleExtension',
            enabled: enabled
        });

        if (response.success) {
            await loadStats();
            showSaveStatus('Extension ' + (enabled ? 'enabled' : 'disabled'), true);
        }
    } catch (error) {
        console.error('Error toggling extension:', error);
    }
}

function toggleFocusMode(e) {
    const scheduleSettings = document.getElementById('schedule-settings');
    scheduleSettings.style.display = e.target.checked ? 'block' : 'none';
}

function updateKeywordCount() {
    const keywords = document.getElementById('keywords').value
        .split('\n')
        .filter(k => k.trim().length > 0);
    document.getElementById('keyword-count').textContent = keywords.length;
}

function updateUrlCount() {
    const urls = document.getElementById('urls').value
        .split('\n')
        .filter(u => u.trim().length > 0);
    document.getElementById('url-count').textContent = urls.length;
}

function updateWhitelistCount() {
    const domains = document.getElementById('whitelist-domains').value
        .split('\n')
        .filter(d => d.trim().length > 0);
    document.getElementById('whitelist-count').textContent = domains.length;

    // Update stats
    if (currentStats) {
        currentStats.whitelistedCount = domains.length;
        updateAllStatsDisplays(currentStats);
    }
}

// NEW: Whitelist functionality
async function addCurrentSiteToWhitelist() {
    if (!currentTabUrl || currentTabUrl.startsWith('chrome://')) {
        showWhitelistStatus('Cannot whitelist system pages', false);
        return;
    }

    try {
        const hostname = new URL(currentTabUrl).hostname;
        const currentWhitelist = document.getElementById('whitelist-domains').value;
        const domains = currentWhitelist.split('\n').filter(d => d.trim().length > 0);

        if (domains.includes(hostname)) {
            showWhitelistStatus(`${hostname} is already whitelisted`, false);
            return;
        }

        domains.push(hostname);
        document.getElementById('whitelist-domains').value = domains.join('\n');
        updateWhitelistCount();

        showWhitelistStatus(`✅ Added ${hostname} to whitelist`, true);

        // Auto-save
        await saveAllSettings();

    } catch (error) {
        console.error('Error adding current site to whitelist:', error);
        showWhitelistStatus('Error adding site to whitelist', false);
    }
}

function loadPresetWhitelist(preset) {
    const presets = {
        educational: [
            'wikipedia.org', 'wikimedia.org', 'khanacademy.org', 'coursera.org',
            'edx.org', 'mit.edu', 'stanford.edu', 'harvard.edu', 'berkeley.edu',
            'yale.edu', 'ox.ac.uk', 'cambridge.org', 'nature.com', 'scholar.google.com'
        ],
        work: [
            'google.com', 'gmail.com', 'drive.google.com', 'docs.google.com',
            'office.com', 'outlook.com', 'microsoft.com', 'teams.microsoft.com',
            'slack.com', 'zoom.us', 'dropbox.com', 'onedrive.com', 'sharepoint.com'
        ],
        news: [
            'bbc.com', 'cnn.com', 'reuters.com', 'ap.org', 'npr.org',
            'theguardian.com', 'nytimes.com', 'washingtonpost.com', 'wsj.com',
            'economist.com', 'time.com', 'newsweek.com', 'bloomberg.com'
        ],
        social: [
            'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com',
            'whatsapp.com', 'telegram.org', 'discord.com', 'reddit.com',
            'pinterest.com', 'snapchat.com', 'tiktok.com'
        ],
        entertainment: [
            'youtube.com', 'netflix.com', 'spotify.com', 'twitch.tv',
            'hulu.com', 'disney.com', 'primevideo.com', 'hbomax.com',
            'imdb.com', 'rottentomatoes.com', 'metacritic.com'
        ],
        health: [
            'mayoclinic.org', 'webmd.com', 'healthline.com', 'medlineplus.gov',
            'nih.gov', 'cdc.gov', 'who.int', 'pubmed.ncbi.nlm.nih.gov',
            'clevelandclinic.org', 'johnshopkins.edu'
        ]
    };

    const currentWhitelist = document.getElementById('whitelist-domains').value;
    const currentDomains = currentWhitelist.split('\n').filter(d => d.trim().length > 0);
    const presetDomains = presets[preset] || [];

    // Merge without duplicates
    const mergedDomains = [...new Set([...currentDomains, ...presetDomains])];

    document.getElementById('whitelist-domains').value = mergedDomains.join('\n');
    updateWhitelistCount();

    showWhitelistStatus(`✅ Added ${presetDomains.length} ${preset} domains to whitelist`, true);
}

async function importWhitelist() {
    try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.json';

        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const text = await file.text();
            let domains = [];

            try {
                // Try JSON first
                const jsonData = JSON.parse(text);
                domains = Array.isArray(jsonData) ? jsonData : jsonData.domains || [];
            } catch {
                // Fall back to plain text
                domains = text.split('\n').filter(d => d.trim().length > 0);
            }

            const currentWhitelist = document.getElementById('whitelist-domains').value;
            const currentDomains = currentWhitelist.split('\n').filter(d => d.trim().length > 0);
            const mergedDomains = [...new Set([...currentDomains, ...domains])];

            document.getElementById('whitelist-domains').value = mergedDomains.join('\n');
            updateWhitelistCount();

            showWhitelistStatus(`✅ Imported ${domains.length} domains`, true);
        };

        input.click();
    } catch (error) {
        showWhitelistStatus('Error importing whitelist', false);
    }
}

function exportWhitelist() {
    try {
        const domains = document.getElementById('whitelist-domains').value
            .split('\n')
            .filter(d => d.trim().length > 0);

        if (domains.length === 0) {
            showWhitelistStatus('No domains to export', false);
            return;
        }

        const exportData = {
            exportDate: new Date().toISOString(),
            version: '2.0.0',
            domains: domains
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `safebrowse-whitelist-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
        showWhitelistStatus(`✅ Exported ${domains.length} domains`, true);

    } catch (error) {
        showWhitelistStatus('Error exporting whitelist', false);
    }
}

function clearWhitelist() {
    if (!confirm('Are you sure you want to clear ALL whitelisted domains? This cannot be undone.')) {
        return;
    }

    document.getElementById('whitelist-domains').value = '';
    updateWhitelistCount();
    showWhitelistStatus('✅ Whitelist cleared', true);
}

function showWhitelistStatus(message, isSuccess) {
    const statusElements = ['whitelist-status', 'whitelist-operation-status'];

    statusElements.forEach(id => {
        const statusEl = document.getElementById(id);
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `whitelist-status ${isSuccess ? 'success' : 'error'}`;
            statusEl.style.display = 'block';
            setTimeout(() => statusEl.style.display = 'none', 3000);
        }
    });
}

async function loadLogs() {
    try {
        const response = await chrome.runtime.sendMessage({ 
            action: 'getBlockedLog',
            limit: 50 
        });

        currentLogs = response.entries || [];
        displayLogs(currentLogs);
        document.getElementById('total-logs').textContent = response.total || 0;

    } catch (error) {
        console.error('Error loading logs:', error);
        document.getElementById('logList').innerHTML = '<li class="log-error">Error loading logs</li>';
    }
}

function filterLogs() {
    const filter = document.getElementById('log-filter').value;
    let filteredLogs = currentLogs;

    switch (filter) {
        case 'blocked':
            filteredLogs = currentLogs.filter(log => log.action === 'blocked');
            break;
        case 'whitelisted':
            filteredLogs = currentLogs.filter(log => log.action === 'whitelisted');
            break;
        case 'ai-detection':
            filteredLogs = currentLogs.filter(log => log.reason === 'nsfw-image');
            break;
    }

    displayLogs(filteredLogs);
}

function displayLogs(logs) {
    const logList = document.getElementById('logList');

    if (!logs || logs.length === 0) {
        logList.innerHTML = '<li class="log-empty">No events recorded</li>';
        return;
    }

    logList.innerHTML = '';

    logs.forEach(entry => {
        const li = document.createElement('li');
        li.className = 'log-entry';

        const actionClass = entry.action || 'blocked';
        const reasonClass = entry.reason.replace('-', '_');
        const reasonText = formatReason(entry.reason);
        const timeAgo = formatTimeAgo(entry.time);
        const actionIcon = entry.action === 'whitelisted' ? '✅' : '🚫';

        li.innerHTML = `
            <div class="log-item ${actionClass}">
                <div class="log-header">
                    <span class="log-action">${actionIcon}</span>
                    <span class="log-reason ${reasonClass}">${reasonText}</span>
                    <span class="log-time">${timeAgo}</span>
                </div>
                <div class="log-url">${truncateUrl(entry.url)}</div>
                ${entry.details ? `<div class="log-details">${entry.details}</div>` : ''}
            </div>
        `;

        logList.appendChild(li);
    });
}

async function clearLogs() {
    if (!confirm('Clear all activity logs?')) return;

    try {
        await chrome.runtime.sendMessage({ action: 'clearBlockedLog' });
        await loadLogs();
        await loadStats();
        showSaveStatus('Logs cleared successfully', true);
    } catch (error) {
        console.error('Error clearing logs:', error);
    }
}

async function saveAllSettings() {
    if (!isUnlocked) {
        showSaveStatus('Please unlock settings first', false);
        return;
    }

    try {
        const keywords = document.getElementById('keywords').value
            .split('\n')
            .map(k => k.trim())
            .filter(k => k.length > 0);

        const urls = document.getElementById('urls').value
            .split('\n')
            .map(u => u.trim())
            .filter(u => u.length > 0);

        const whitelistedDomains = document.getElementById('whitelist-domains').value
            .split('\n')
            .map(d => d.trim())
            .filter(d => d.length > 0);

        const extensionEnabled = document.getElementById('extension-enabled').checked;
        const nsfwDetectionEnabled = document.getElementById('nsfw-detection-enabled').checked;
        const safeSearchEnabled = document.getElementById('safesearch-enabled').checked;
        const whitelistEnabled = document.getElementById('whitelist-enabled').checked;

        const focusModeSchedule = {
            enabled: document.getElementById('focus-mode-enabled').checked,
            startHour: parseInt(document.getElementById('start-hour').value),
            endHour: parseInt(document.getElementById('end-hour').value),
            weekendsOnly: document.getElementById('weekends-only') ? 
                         document.getElementById('weekends-only').checked : false
        };

        const settingsResponse = await chrome.runtime.sendMessage({
            action: 'updateSettings',
            settings: {
                blockedKeywords: keywords,
                blockedURLs: urls,
                whitelistedDomains: whitelistedDomains,
                nsfwDetectionEnabled,
                safeSearchEnabled,
                whitelistEnabled,
                isEnabled: extensionEnabled
            }
        });

        const scheduleResponse = await chrome.runtime.sendMessage({
            action: 'updateSchedule',
            schedule: focusModeSchedule
        });

        if (settingsResponse.success && scheduleResponse.success) {
            showSaveStatus('All settings saved successfully!', true);
            updateKeywordCount();
            updateUrlCount();
            updateWhitelistCount();
            await loadStats();
        } else {
            const error = settingsResponse.error || scheduleResponse.error || 'Unknown error';
            showSaveStatus('Error saving settings: ' + error, false);
        }

    } catch (error) {
        console.error('Error saving settings:', error);
        showSaveStatus('Error saving settings', false);
    }
}

// Utility functions
function formatTime(minutes) {
    if (minutes < 60) return minutes + 'm';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours + 'h' + (mins > 0 ? ' ' + mins + 'm' : '');
}

function formatReason(reason) {
    const reasonMap = {
        'blocked keyword': 'Keyword',
        'blocked URL': 'URL',
        'nsfw-image': 'AI Detection',
        'content': 'Content',
        'whitelisted': 'Whitelisted'
    };
    return reasonMap[reason] || reason;
}

function formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHours < 24) return diffHours + 'h ago';
    return diffDays + 'd ago';
}

function truncateUrl(url) {
    return url.length > 40 ? url.substring(0, 37) + '...' : url;
}

function showSaveStatus(message, isSuccess) {
    const statusEl = document.getElementById('save-status');
    statusEl.textContent = message;
    statusEl.className = `save-status ${isSuccess ? 'success' : 'error'}`;
    statusEl.style.display = 'block';
    setTimeout(() => statusEl.style.display = 'none', 3000);
}

// Auto-refresh stats
setInterval(() => {
    if (document.getElementById('main-settings').style.display !== 'none' ||
        document.getElementById('stats-only-view').style.display !== 'none') {
        loadStats();
    }
}, 30000);
