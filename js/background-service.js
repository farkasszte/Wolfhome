/**
 * WolfHome Background Service Worker
 * Handles header modification for iframes and keep-alive sessions.
 */

// Dynamic rules to strip security headers (X-Frame-Options, CSP) for trusted e-Kréta domains inside the iframe
const KRETA_RULES = [
    {
        id: 1,
        priority: 1,
        action: {
            type: 'modifyHeaders',
            responseHeaders: [
                { header: 'X-Frame-Options', operation: 'remove' },
                { header: 'Frame-Options', operation: 'remove' },
                { header: 'Content-Security-Policy', operation: 'remove' }
            ]
        },
        condition: {
            urlFilter: '||e-kreta.hu',
            resourceTypes: ['sub_frame']
        }
    }
];

// Register declarativeNetRequest rules dynamically in Manifest V3
if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest) {
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1, 2],
        addRules: KRETA_RULES
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("DNR szabály regisztrációs hiba:", chrome.runtime.lastError);
        } else {
            console.log("e-Kréta fejléc szabályok sikeresen regisztrálva.");
        }
    });
} else if (typeof browser !== 'undefined' && browser.declarativeNetRequest) {
    browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1, 2],
        addRules: KRETA_RULES
    });
}

// Session Keep-alive: Ping e-Kréta dynamically matching the configured URL every 10 minutes
let currentKretaUrl = '';

function updateKretaUrlFromStorage() {
    const storageAPI = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync)
        ? chrome.storage.sync
        : (typeof browser !== 'undefined' && browser.storage && browser.storage.sync)
            ? browser.storage.sync
            : null;

    if (storageAPI) {
        storageAPI.get('wolfhome_config', (result) => {
            if (result && result.wolfhome_config && result.wolfhome_config.kretaUrl) {
                currentKretaUrl = result.wolfhome_config.kretaUrl;
                console.log("e-Kréta háttér URL frissítve:", currentKretaUrl);
            }
        });
    }
}

// Listen for storage changes to update currentKretaUrl on the fly
const storageAPI = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage : (typeof browser !== 'undefined' && browser.storage) ? browser.storage : null;
if (storageAPI) {
    storageAPI.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' && changes.wolfhome_config) {
            const newVal = changes.wolfhome_config.newValue;
            if (newVal && newVal.kretaUrl) {
                currentKretaUrl = newVal.kretaUrl;
                console.log("e-Kréta háttér URL változás miatt frissítve:", currentKretaUrl);
            }
        }
    });
}

// Initial load
updateKretaUrlFromStorage();

function pingKreta() {
    if (!currentKretaUrl) return;
    console.log("e-Kréta session ping indítása ide:", currentKretaUrl);
    fetch(currentKretaUrl + '/Orarend/TanariOrarend')
        .then(response => {
            if (response.ok) console.log("e-Kréta session ping sikeres.");
            else console.warn("e-Kréta session ping hiba:", response.status);
        })
        .catch(err => console.error("e-Kréta session ping hiba:", err));
}

// Initial ping (delayed slightly to allow storage retrieval to complete)
setTimeout(pingKreta, 2000);

// Interval ping (10 mins)
setInterval(pingKreta, 10 * 60 * 1000);

// Unified runtime messaging API for Chrome & Firefox MV3
const runtimeAPI = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome.runtime : (typeof browser !== 'undefined' && browser.runtime) ? browser.runtime : null;

if (runtimeAPI) {
    runtimeAPI.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'fetchIcal') {
            fetch(message.url)
                .then(res => {
                    if (!res.ok) throw new Error(`Szerver hiba: ${res.status}`);
                    return res.text();
                })
                .then(text => {
                    sendResponse({ success: true, text });
                })
                .catch(err => {
                    sendResponse({ success: false, error: err.message });
                });
            return true; // Keep message channel open for asynchronous sendResponse
        }
    });
}


