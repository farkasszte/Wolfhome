/**
 * WolfHome Background Service Worker / Script
 * Handles network requests (bypassing CORS for RSS feeds & iCal), header modification, and session keep-alive.
 */

async function handleFetchRequest(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Szerver hiba: ${res.status}`);
        const text = await res.text();
        return { success: true, text };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// 1. Message listener registered immediately for cross-browser fetching (bypasses CORS in Firefox & Chrome)
if (typeof browser !== 'undefined' && browser?.runtime?.onMessage) {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'fetchIcal' || message.action === 'fetchFeed' || message.action === 'fetchUrl') {
            const p = handleFetchRequest(message.url);
            p.then(res => {
                try { sendResponse(res); } catch (e) { }
            });
            return p; // Native Firefox Promise support
        }
    });
} else if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'fetchIcal' || message.action === 'fetchFeed' || message.action === 'fetchUrl') {
            handleFetchRequest(message.url).then(sendResponse);
            return true; // Keep channel open for asynchronous sendResponse in Chrome
        }
    });
}

// 2. Dynamic rules to strip security headers (X-Frame-Options, CSP) for trusted e-Kréta domains inside the iframe
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
try {
    if (typeof browser !== 'undefined' && browser?.declarativeNetRequest) {
        browser.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1, 2],
            addRules: KRETA_RULES
        }).catch(err => console.warn("DNR szabály frissítési figyelmeztetés:", err));
    } else if (typeof chrome !== 'undefined' && chrome?.declarativeNetRequest) {
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1, 2],
            addRules: KRETA_RULES
        }, () => {
            if (chrome.runtime?.lastError) {
                console.warn("DNR szabály regisztrációs figyelmeztetés:", chrome.runtime.lastError.message);
            }
        });
    }
} catch (e) {
    console.warn("DNR inicializációs hiba:", e);
}

// 3. Session Keep-alive: Ping e-Kréta dynamically matching the configured URL every 10 minutes
let currentKretaUrl = '';

function updateKretaUrlFromStorage() {
    const storageAPI = (typeof browser !== 'undefined' && browser.storage && browser.storage.sync)
        ? browser.storage.sync
        : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync)
            ? chrome.storage.sync
            : null;

    if (storageAPI) {
        try {
            storageAPI.get('wolfhome_config', (result) => {
                if (result && result.wolfhome_config && result.wolfhome_config.kretaUrl) {
                    currentKretaUrl = result.wolfhome_config.kretaUrl;
                    console.log("e-Kréta háttér URL frissítve:", currentKretaUrl);
                }
            });
        } catch (e) {
            console.warn("Hiba a konfiguráció kiolvasásakor a háttérben:", e);
        }
    }
}

// Listen for storage changes to update currentKretaUrl on the fly
const storageAPI = (typeof browser !== 'undefined' && browser.storage) ? browser.storage : (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage : null;
if (storageAPI && storageAPI.onChanged) {
    try {
        storageAPI.onChanged.addListener((changes, areaName) => {
            if (areaName === 'sync' && changes.wolfhome_config) {
                const newVal = changes.wolfhome_config.newValue;
                if (newVal && newVal.kretaUrl) {
                    currentKretaUrl = newVal.kretaUrl;
                    console.log("e-Kréta háttér URL változás miatt frissítve:", currentKretaUrl);
                }
            }
        });
    } catch (e) {
        console.warn("Hiba a tárolófigyelő regisztrálásakor:", e);
    }
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
