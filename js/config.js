/**
 * WolfHome Configuration Management
 */
import { extAPI } from './utils.js';

export const IMAGE_KEYS = ['bgImage', 'bgCachedImage'];

export const DEFAULT_CONFIG = {
    city: '',
    calendarUrl: '',
    calendars: [],
    kretaUrl: '',
    showGroups: true,
    openInNewTab: true,
    showSeconds: true,
    showNamedays: true,
    iconBorderRadius: 12,
    accentColor: '#24a66e',
    bgType: 'none',
    bgColor: '#000000',
    bgImage: '',
    bgUnsplashQuery: 'nature, dark', // Keywords for random background (LoremFlickr)
    bgFitMode: 'cover',
    bgBrightness: 0,
    bgBlur: 0,
    bgRefreshFreq: 'load',
    bgGradientStart: '#1a2a6c',
    bgGradientEnd: '#b21f1f',
    bgGradientAngle: 135,
    lastBgUpdate: 0,
    bgCachedImage: '',
    sections: [
        {
            name: 'Gyorselérés',
            links: [
                { name: 'Gmail', url: 'https://mail.google.com', iconType: 'favicon' },
                { name: 'Youtube', url: 'https://youtube.com', iconType: 'favicon' },
                { name: 'Github', url: 'https://github.com', iconType: 'favicon' }
            ]
        }
    ],
    currentView: 'calendar',
    kanban: {
        todo: [{ id: '1', text: 'Üdv az WolfHome Kanban-on! 🐺', priority: 'medium' }],
        progress: [],
        done: []
    },
    newsFeeds: [
        { name: 'Telex', url: 'https://telex.hu/rss' },
        { name: 'HVG', url: 'https://hvg.hu/rss' },
        { name: '24.hu', url: 'https://24.hu/feed/' }
    ],
    showNewsImages: true,
    newsCount: 15
};

// Application state
export let config = { ...DEFAULT_CONFIG, calendarViewMode: 'month' };

function migrateConfig(saved) {
    if (!saved) return saved;
    // Migration for links -> sections
    if (saved.links) {
        saved.sections = [{ name: 'Gyorselérés', links: saved.links }];
        delete saved.links;
    }
    // Migration for calendarUrl -> calendars array
    if (!saved.calendars || !Array.isArray(saved.calendars) || saved.calendars.length === 0) {
        if (saved.calendarUrl) {
            saved.calendars = [
                { id: 'cal_' + Date.now(), name: 'Elsődleges naptár', url: saved.calendarUrl, color: saved.accentColor || '#24a66e' }
            ];
        } else {
            saved.calendars = [];
        }
    }
    return saved;
}

/**
 * Load configuration from storage
 */
export async function loadConfig() {
    const loadImages = () => {
        try {
            const raw = localStorage.getItem('wolfhome_images');
            if (raw) return JSON.parse(raw);
        } catch (e) { }
        return {};
    };

    return new Promise((resolve) => {
        if (extAPI && extAPI.storage && extAPI.storage.sync) {
            extAPI.storage.sync.get('wolfhome_config', (result) => {
                let saved = result.wolfhome_config;
                if (!saved) {
                    const local = localStorage.getItem('wolfhome_config');
                    if (local) {
                        try { saved = JSON.parse(local); } catch (e) { }
                    }
                }
                if (saved) {
                    saved = migrateConfig(saved);
                    config = { ...config, ...saved, ...loadImages() };
                }
                resolve();
            });
        } else {
            const local = localStorage.getItem('wolfhome_config');
            if (local) {
                try {
                    let saved = JSON.parse(local);
                    saved = migrateConfig(saved);
                    config = { ...config, ...saved, ...loadImages() };
                } catch (e) { }
            }
            resolve();
        }
    });
}

/**
 * Save configuration to storage
 */
export function saveConfig() {
    const syncConfig = {};
    const imageData = {};

    for (const key of Object.keys(config)) {
        if (IMAGE_KEYS.includes(key)) {
            imageData[key] = config[key];
        } else {
            syncConfig[key] = config[key];
        }
    }

    try {
        localStorage.setItem('wolfhome_images', JSON.stringify(imageData));
    } catch (e) {
        console.warn('Kép mentése sikertelen:', e);
    }

    try {
        localStorage.setItem('wolfhome_config', JSON.stringify(syncConfig));
        if (extAPI && extAPI.storage && extAPI.storage.sync) {
            extAPI.storage.sync.set({ 'wolfhome_config': syncConfig });
        }
    } catch (e) {
        console.warn('Beállítások mentése sikertelen:', e);
    }
}
