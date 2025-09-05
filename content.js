
// SafeBrowse Advanced - Enhanced Content Script v2.0.0
// Features: Whitelist protection, Dynamic AI loading, keyword/URL blocking, SafeSearch, Session limits, Enhanced logging

(function() {
    'use strict';

    let nsfwModel = null;
    let isModelLoaded = false;
    let isLoadingModel = false;
    let blockedCount = 0;
    let isWhitelisted = false;
    let whitelistCheckDone = false;

    // Default blocked keywords and URLs (used as fallback)
    const DEFAULT_KEYWORDS = [
        'porn', 'sex', 'xxx', 'adult', 'nude', 'naked', 'erotic', 'sexual',
        'nsfw', 'explicit', 'hardcore', 'softcore', 'escort', 'hookup',
        'boobs', 'pussy', 'dick', 'cock', 'fuck', 'anal', 'blowjob',
        'milf', 'teen', 'cumshot', 'orgasm', 'masturbation', 'fetish', 'bdsm',
        'webcam', 'cam', 'live', 'strip', 'tits', 'ass', 'horny', 'sexy'
    ];

    const DEFAULT_BLOCKED_URLS = [
        'pornhub.com', 'xvideos.com', 'xhamster.com', 'xnxx.com', 'redtube.com',
        'youporn.com', 'tube8.com', 'spankbang.com', 'beeg.com', 'onlyfans.com',
        'chaturbate.com', 'livejasmin.com', 'stripchat.com', 'cam4.com'
    ];

    // Dynamically load external scripts
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }

    // Initialize AI libraries dynamically
    async function initializeAILibraries() {
        if (isLoadingModel || isModelLoaded || isWhitelisted) return;

        try {
            isLoadingModel = true;
            console.log('SafeBrowse: Loading AI libraries...');

            // Load TensorFlow.js first
            if (typeof tf === 'undefined') {
                await loadScript('https://unpkg.com/@tensorflow/tfjs@latest/dist/tf.min.js');
                console.log('SafeBrowse: TensorFlow.js loaded');
            }

            // Load NSFWJS
            if (typeof nsfwjs === 'undefined') {
                await loadScript('https://unpkg.com/nsfwjs@latest/dist/nsfwjs.min.js');
                console.log('SafeBrowse: NSFWJS loaded');
            }

            // Initialize NSFW model
            if (typeof nsfwjs !== 'undefined') {
                nsfwModel = await nsfwjs.load();
                isModelLoaded = true;
                console.log('SafeBrowse: NSFW model loaded successfully');
            }

        } catch (error) {
            console.error('SafeBrowse: Error loading AI libraries:', error);
            isModelLoaded = false;
        } finally {
            isLoadingModel = false;
        }
    }

    // NEW: Check if current site is whitelisted
    async function checkCurrentSiteWhitelist() {
        if (whitelistCheckDone) return isWhitelisted;

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'checkWhitelist',
                url: window.location.href
            });

            isWhitelisted = response.isWhitelisted;
            whitelistCheckDone = true;

            if (isWhitelisted) {
                console.log(`SafeBrowse: Site whitelisted - ${response.hostname} (matched: ${response.matchedDomain})`);
                // Add visual indicator for whitelisted sites
                addWhitelistIndicator(response.matchedDomain);
            }

            return isWhitelisted;

        } catch (error) {
            console.error('SafeBrowse: Error checking whitelist:', error);
            whitelistCheckDone = true;
            return false;
        }
    }

    // NEW: Add subtle visual indicator for whitelisted sites
    function addWhitelistIndicator(matchedDomain) {
        // Only add indicator if not already present
        if (document.getElementById('safebrowse-whitelist-indicator')) return;

        const indicator = document.createElement('div');
        indicator.id = 'safebrowse-whitelist-indicator';
        indicator.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                right: 10px;
                background: linear-gradient(135deg, #48bb78, #38a169);
                color: white;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 11px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-weight: 600;
                z-index: 10000;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                backdrop-filter: blur(10px);
                opacity: 0.9;
                transition: opacity 0.3s ease;
                cursor: pointer;
                user-select: none;
            ">
                🔓 SafeBrowse: Protected by Whitelist
            </div>
        `;

        // Add hover effect and auto-hide
        const indicatorEl = indicator.firstElementChild;
        indicatorEl.addEventListener('mouseenter', () => {
            indicatorEl.style.opacity = '1';
            indicatorEl.innerHTML = `🔓 Whitelisted: ${matchedDomain}`;
        });
        indicatorEl.addEventListener('mouseleave', () => {
            indicatorEl.style.opacity = '0.9';
            indicatorEl.innerHTML = '🔓 SafeBrowse: Protected by Whitelist';
        });

        // Auto-hide after 10 seconds
        setTimeout(() => {
            indicatorEl.style.opacity = '0';
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 300);
        }, 10000);

        document.body.appendChild(indicator);
    }

    // Enhanced SafeSearch enforcement for multiple search engines
    function enforceSafeSearch() {
        const hostname = window.location.hostname.toLowerCase();
        const currentURL = window.location.href;

        try {
            // Google SafeSearch
            if (hostname.includes('google.com') && currentURL.includes('/search')) {
                const params = new URLSearchParams(window.location.search);
                if (params.get('safe') !== 'active') {
                    params.set('safe', 'active');
                    console.log('SafeBrowse: Enforcing Google SafeSearch');
                    window.location.search = params.toString();
                    return true;
                }
            }

            // Bing SafeSearch
            if (hostname.includes('bing.com') && currentURL.includes('/search')) {
                const params = new URLSearchParams(window.location.search);
                if (params.get('adlt') !== 'strict') {
                    params.set('adlt', 'strict');
                    console.log('SafeBrowse: Enforcing Bing SafeSearch');
                    window.location.search = params.toString();
                    return true;
                }
            }

            // DuckDuckGo SafeSearch
            if (hostname.includes('duckduckgo.com')) {
                const params = new URLSearchParams(window.location.search);
                if (params.get('kp') !== '1') {
                    params.set('kp', '1');
                    console.log('SafeBrowse: Enforcing DuckDuckGo SafeSearch');
                    window.location.search = params.toString();
                    return true;
                }
            }

            // Yahoo SafeSearch
            if (hostname.includes('yahoo.com') && currentURL.includes('/search')) {
                const params = new URLSearchParams(window.location.search);
                if (params.get('vm') !== 'r') {
                    params.set('vm', 'r');
                    console.log('SafeBrowse: Enforcing Yahoo SafeSearch');
                    window.location.search = params.toString();
                    return true;
                }
            }

        } catch (error) {
            console.error('SafeBrowse: Error in SafeSearch enforcement:', error);
        }

        return false;
    }

    // NSFW Image Detection with whitelist protection
    async function detectNSFWImages() {
        if (!isModelLoaded || !nsfwModel || isWhitelisted) {
            if (isWhitelisted) {
                console.log('SafeBrowse: Skipping image detection - site is whitelisted');
            }
            return;
        }

        const images = document.querySelectorAll('img');
        console.log(`SafeBrowse: Scanning ${images.length} images for NSFW content...`);

        for (let img of images) {
            try {
                // Skip images that are too small or already processed
                if (img.width < 50 || img.height < 50 || img.dataset.nsfwChecked) {
                    continue;
                }

                // Skip images that haven't loaded yet
                if (!img.complete || img.naturalWidth === 0) {
                    continue;
                }

                // Mark as checked to avoid reprocessing
                img.dataset.nsfwChecked = 'true';

                const predictions = await nsfwModel.classify(img);
                console.log('SafeBrowse: NSFW predictions:', predictions);

                // Check for inappropriate content (porn, hentai)
                const inappropriatePredictions = predictions.filter(p => 
                    ['Porn', 'Hentai'].includes(p.className) && p.probability > 0.6
                );

                if (inappropriatePredictions.length > 0) {
                    // Blur the inappropriate image
                    img.style.filter = 'blur(20px)';
                    img.style.transition = 'filter 0.3s ease';
                    img.title = 'Content blocked by SafeBrowse Advanced AI';

                    // Add click handler to temporarily unblur (for false positives)
                    img.addEventListener('click', function() {
                        if (confirm('This image was blocked by AI as inappropriate content. Show anyway?')) {
                            this.style.filter = 'none';
                        }
                    });

                    // Log the blocked image via background script
                    const topPrediction = inappropriatePredictions[0];
                    chrome.runtime.sendMessage({
                        action: 'logBlockedEvent',
                        url: img.src || img.currentSrc || 'image',
                        reason: 'nsfw-image',
                        details: `AI Detection: ${topPrediction.className} (${(topPrediction.probability * 100).toFixed(1)}%)`,
                        action: 'blocked'
                    });

                    console.log(`SafeBrowse: Blocked NSFW image - ${topPrediction.className}: ${(topPrediction.probability * 100).toFixed(1)}%`);
                }

            } catch (error) {
                console.log('SafeBrowse: NSFW detection error for image:', error);
            }
        }
    }

    // Enhanced block page with whitelist information
    function blockPage(reason, details = '') {
        const originalUrl = window.location.href;

        // Create blocked page content
        document.documentElement.innerHTML = `
            <html>
            <head>
                <title>Blocked by SafeBrowse Advanced</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0;
                        color: #333;
                    }
                    .container {
                        background: rgba(255, 255, 255, 0.95);
                        border-radius: 20px;
                        padding: 40px;
                        max-width: 600px;
                        text-align: center;
                        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                        backdrop-filter: blur(10px);
                    }
                    .icon { font-size: 80px; margin-bottom: 20px; animation: pulse 2s infinite; }
                    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
                    .title { font-size: 36px; font-weight: 700; margin-bottom: 16px; color: #2d3748; }
                    .subtitle { font-size: 18px; color: #718096; margin-bottom: 20px; }
                    .details { font-size: 14px; color: #e53e3e; background: rgba(229, 62, 62, 0.1); 
                              padding: 12px; border-radius: 8px; margin-bottom: 20px; }
                    .message { background: linear-gradient(135deg, #48bb78, #38a169); color: white; 
                              padding: 20px; border-radius: 12px; font-size: 16px; margin-bottom: 20px; }
                    .blocked-url { font-size: 12px; color: #718096; margin-top: 10px; word-break: break-all; }
                    .premium-badge { 
                        display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2);
                        color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px;
                        font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px;
                    }
                    .whitelist-info {
                        background: rgba(72, 187, 120, 0.1); color: #48bb78; padding: 16px;
                        border-radius: 12px; margin-top: 20px; font-size: 14px; border: 2px solid rgba(72, 187, 120, 0.2);
                    }
                    .whitelist-info h4 {
                        margin: 0 0 10px 0; font-size: 16px; color: #2f855a;
                    }
                    .whitelist-info code {
                        background: rgba(72, 187, 120, 0.1); padding: 2px 6px; border-radius: 4px;
                        font-family: monospace; font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">🛡️</div>
                    <div class="premium-badge">SafeBrowse Advanced v2.0</div>
                    <h1 class="title">Content Blocked</h1>
                    <p class="subtitle">This content has been blocked by SafeBrowse Advanced's protection system</p>
                    <div class="details">
                        <strong>Reason:</strong> ${reason}<br>
                        ${details ? `<strong>Details:</strong> ${details}` : ''}
                    </div>
                    <div class="message">
                        🌟 Excellent! You're staying focused on your goals. Every time you resist temptation, you're building stronger willpower and investing in your future self.
                    </div>
                    <div class="blocked-url">Blocked URL: ${originalUrl}</div>
                    <div class="whitelist-info">
                        <h4>🔓 Want to Allow This Site?</h4>
                        <p>If you believe this site should be allowed, you can add <code>${window.location.hostname}</code> to your whitelist in the SafeBrowse Advanced settings.</p>
                        <p><strong>Tip:</strong> Whitelisted sites are never blocked, even if they match keywords or blocked URLs.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    // Main content filtering function with whitelist protection
    async function performContentFiltering() {
        // Skip if we're on extension pages
        if (window.location.protocol === 'chrome-extension:') {
            return;
        }

        // FIRST: Check if site is whitelisted
        const siteIsWhitelisted = await checkCurrentSiteWhitelist();
        if (siteIsWhitelisted) {
            console.log('SafeBrowse: Site is whitelisted, skipping all filtering');
            return; // Exit early if whitelisted
        }

        // Check if extension is enabled and get settings
        const data = await new Promise(resolve => {
            chrome.storage.local.get([
                'blockedKeywords', 
                'blockedURLs', 
                'whitelistedDomains',
                'sessionActive', 
                'nsfwDetectionEnabled',
                'safeSearchEnabled',
                'whitelistEnabled',
                'isEnabled'
            ], resolve);
        });

        const keywords = data.blockedKeywords || DEFAULT_KEYWORDS;
        const urls = data.blockedURLs || DEFAULT_BLOCKED_URLS;
        const sessionActive = data.sessionActive !== false; // default true
        const nsfwDetectionEnabled = data.nsfwDetectionEnabled !== false; // default true
        const safeSearchEnabled = data.safeSearchEnabled !== false; // default true
        const isEnabled = data.isEnabled !== false; // default true

        // Skip if extension is disabled
        if (!isEnabled) {
            console.log('SafeBrowse: Extension is disabled');
            return;
        }

        // Check if session is active (for scheduled blocking)
        if (!sessionActive) {
            console.log('SafeBrowse: Session inactive due to focus mode, but not blocking whitelisted site');
            return;
        }

        const currentURL = window.location.href.toLowerCase();

        // URL blocking check
        for (let blockedURL of urls) {
            if (blockedURL && blockedURL.trim() && 
                currentURL.includes(blockedURL.trim().toLowerCase())) {
                blockPage('Blocked URL', `URL matches blocked pattern: ${blockedURL}`);
                return;
            }
        }

        // Keyword blocking check
        const pageTitle = document.title.toLowerCase();
        const pageText = document.body ? document.body.innerText.toLowerCase() : '';
        const metaDescription = document.querySelector('meta[name="description"]');
        const description = metaDescription ? metaDescription.content.toLowerCase() : '';

        const textToCheck = `${pageTitle} ${pageText.substring(0, 5000)} ${description}`;

        for (let keyword of keywords) {
            if (keyword && keyword.trim() && 
                textToCheck.includes(keyword.trim().toLowerCase())) {
                blockPage('Blocked Keyword', `Page contains blocked keyword: "${keyword}"`);
                return;
            }
        }

        // SafeSearch enforcement
        if (safeSearchEnabled) {
            if (enforceSafeSearch()) {
                return; // Page will reload with SafeSearch
            }
        }

        // NSFW Image Detection (only if not whitelisted)
        if (nsfwDetectionEnabled) {
            if (!isModelLoaded && !isLoadingModel) {
                initializeAILibraries().then(() => {
                    setTimeout(() => {
                        detectNSFWImages();
                    }, 2000);
                });
            } else if (isModelLoaded) {
                setTimeout(() => {
                    detectNSFWImages();
                }, 2000);
            }
        }
    }

    // Initialize and run content filtering
    function initialize() {
        // Skip if we're on extension pages
        if (window.location.protocol === 'chrome-extension:') {
            return;
        }

        // Perform initial content filtering
        performContentFiltering();

        // Monitor for dynamic content changes
        const observer = new MutationObserver((mutations) => {
            let hasNewImages = false;
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'IMG' || 
                                node.querySelector && node.querySelector('img')) {
                                hasNewImages = true;
                            }
                        }
                    });
                }
            });

            if (hasNewImages && isModelLoaded && !isWhitelisted) {
                setTimeout(() => {
                    detectNSFWImages();
                }, 1000);
            }
        });

        // Start observing after page loads
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // Re-scan for new images periodically if AI is loaded and not whitelisted
        setInterval(() => {
            if (isModelLoaded && !isWhitelisted) {
                detectNSFWImages();
            }
        }, 10000);
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
