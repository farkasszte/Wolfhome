/**
 * WolfHome Background Module
 */
import { config, saveConfig } from './config.js';
import { compressImage } from './utils.js';

let currentBgBlobUrl = null;
let bgUpdateTimeout = null;

/**
 * Update the dashboard background based on current config
 */
export function updateBackground(forceRefresh = false) {
    const type = config.bgType || 'none';
    const bgLayer = document.getElementById('bg-layer');
    if (!bgLayer) return;

    // Update filter (always)
    const brightness = 100 - (config.bgBrightness ?? 0);
    bgLayer.style.filter = `brightness(${brightness}%) blur(${config.bgBlur ?? 0}px)`;

    // Handle static backgrounds (Color/Gradient)
    if (type === 'color') {
        bgLayer.style.backgroundImage = '';
        bgLayer.style.backgroundColor = config.bgColor;
        updateBackgroundActionsVisibility(false);
        return;
    } else if (type === 'gradient') {
        bgLayer.style.backgroundColor = '';
        const start = config.bgGradientStart || '#1a2a6c';
        const end = config.bgGradientEnd || '#b21f1f';
        const angle = config.bgGradientAngle || 135;
        bgLayer.style.backgroundImage = `linear-gradient(${angle}deg, ${start}, ${end})`;
        updateBackgroundActionsVisibility(false);
        return;
    } else if (type === 'none') {
        bgLayer.style.backgroundImage = '';
        bgLayer.style.backgroundColor = '#000';
        updateBackgroundActionsVisibility(false);
        return;
    }

    // Handle Image backgrounds (Upload/Unsplash)
    updateBackgroundActionsVisibility(true);

    // If we only changed fit mode/brightness/blur and already have an image
    if (!forceRefresh && bgLayer.style.backgroundImage && bgLayer.style.backgroundImage !== 'none') {
        applyFitMode(bgLayer);
        return;
    }

    bgLayer.style.backgroundColor = '';
    if (forceRefresh) bgLayer.style.backgroundImage = '';

    if (type === 'upload' && config.bgImage) {
        bgLayer.style.backgroundImage = `url(${config.bgImage})`;
        currentBgBlobUrl = config.bgImage;
        applyFitMode(bgLayer);
    } else if (type === 'unsplash') {
        // Use cached image if no refresh needed (blob URLs don't survive page reloads)
        if (!forceRefresh && config.bgCachedImage) {
            bgLayer.style.backgroundImage = `url(${config.bgCachedImage})`;
            currentBgBlobUrl = config.bgCachedImage;
            applyFitMode(bgLayer);
            return;
        }

        const query = (config.bgUnsplashQuery || 'nature').split(/[\s,]+/).filter(Boolean).join(',');
        const url = `https://loremflickr.com/1920/1080/${query}?random=${Date.now()}`;

        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP hiba! státusz: ${response.status}`);
                return response.blob();
            })
            .then(blob => {
                if (currentBgBlobUrl && currentBgBlobUrl.startsWith('blob:')) URL.revokeObjectURL(currentBgBlobUrl);
                currentBgBlobUrl = URL.createObjectURL(blob);
                bgLayer.style.backgroundImage = `url(${currentBgBlobUrl})`;
                config.lastBgUpdate = Date.now();
                applyFitMode(bgLayer);

                // Cache as base64 so the same image survives new tab loads
                const reader = new FileReader();
                reader.onload = async (e) => {
                    config.bgCachedImage = await compressImage(e.target.result);
                    saveConfig();
                };
                reader.readAsDataURL(blob);
            })
            .catch(err => {
                console.error("Háttér betöltési hiba:", err);
                // Fall back to cached image if available
                if (config.bgCachedImage) {
                    bgLayer.style.backgroundImage = `url(${config.bgCachedImage})`;
                    applyFitMode(bgLayer);
                } else {
                    bgLayer.style.backgroundColor = '#000';
                }
            });
    }
}

/**
 * Debounced background update
 */
export function debouncedBgUpdate(forceRefresh = false) {
    if (bgUpdateTimeout) clearTimeout(bgUpdateTimeout);
    bgUpdateTimeout = setTimeout(() => {
        updateBackground(forceRefresh);
    }, 50);
}

/**
 * Apply fit mode to background layer
 */
function applyFitMode(bgLayer) {
    const fit = config.bgFitMode || 'cover';
    if (fit === 'cover') {
        bgLayer.style.backgroundSize = 'cover';
        bgLayer.style.backgroundRepeat = 'no-repeat';
        bgLayer.style.backgroundPosition = 'center';
    } else if (fit === 'contain') {
        bgLayer.style.backgroundSize = 'contain';
        bgLayer.style.backgroundRepeat = 'no-repeat';
        bgLayer.style.backgroundPosition = 'center';
    } else if (fit === 'repeat') {
        bgLayer.style.backgroundSize = 'auto';
        bgLayer.style.backgroundRepeat = 'repeat';
        bgLayer.style.backgroundPosition = 'top left';
    }
}

/**
 * Toggle visibility of background-related UI actions
 */
export function updateBackgroundActionsVisibility(visible) {
    const actionsGroup = document.getElementById('bg-actions-group');
    const lockBtn = document.getElementById('lock-bg-btn');
    const type = config.bgType;

    if (actionsGroup) actionsGroup.classList.toggle('hidden', !visible);
    if (lockBtn) lockBtn.classList.toggle('hidden', !visible || type === 'upload');
}
