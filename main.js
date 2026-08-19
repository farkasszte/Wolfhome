/**
 * WolfHome Main Entry Point
 */
import { config, loadConfig, saveConfig } from './js/config.js';
import { updateBackground, debouncedBgUpdate, updateBackgroundActionsVisibility } from './js/background.js';
import { updateTime, updateNameday, fetchWeather, updateExchangeRates } from './js/widgets.js';
import { renderLinks, showLinkModal, saveLink, deleteLink, closeLinkModal } from './js/links.js';
import { renderKanban, openKanbanModal, saveKanbanModal, closeKanbanModal, deleteKanbanCard, setKanbanSearchQuery } from './js/kanban.js';
import { fetchNews, renderNewsFeedsSettings, updateRestoreNewsVisibility } from './js/news.js';
import { checkAuth, openCalendarSettings, requestCalendarPermission, loadCachedEvents } from './js/calendar.js';
import { toggleFocusMode, createCustomSelect, getIsFocusMode } from './js/ui.js';
import { checkExtensionEnvironment, exportConfig, importConfig } from './js/storage-actions.js';
import { compressImage, createLucideIcon, tag } from './js/utils.js';

let originalConfig = null;
let csIconType = null;

async function init() {
    document.documentElement.classList.add('dark');

    await loadConfig();

    if (config.accentColor) {
        const hex = config.accentColor;
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            document.documentElement.style.setProperty('--accent', hex);
            document.documentElement.style.setProperty('--accent-rgb', `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`);
        }
    }

    // Start timers
    updateTime();
    setInterval(updateTime, 1000);

    updateNameday();
    fetchWeather();
    updateExchangeRates();

    setInterval(fetchWeather, 30 * 60 * 1000);
    setInterval(updateExchangeRates, 6 * 60 * 60 * 1000);

    // Midnight rollover listener
    window.addEventListener('wolfhome:daychange', () => {
        checkAuth();
        fetchWeather();
    });

    // Initial renders
    renderLinks();
    renderKanban();
    fetchNews();
    checkAuth();

    // Background logic
    const now = Date.now();
    const lastUpdate = config.lastBgUpdate || 0;
    const freq = config.bgRefreshFreq || 'load';
    let shouldRefresh = false;

    if (freq === 'load') shouldRefresh = true;
    else if (freq === 'hour' && now - lastUpdate > 3600000) shouldRefresh = true;
    else if (freq === 'day' && now - lastUpdate > 86400000) shouldRefresh = true;
    else if (freq === 'manual' && lastUpdate === 0) shouldRefresh = true;

    updateBackground(shouldRefresh);

    // Setup remaining UI
    setupEventListeners();
    checkExtensionEnvironment();
}

function renderCalendarsSettings() {
    const list = document.getElementById('settings-calendars-list');
    if (!list) return;
    list.innerHTML = '';

    const calendars = config.calendars || [];
    if (calendars.length === 0) {
        list.appendChild(tag('p', { className: 'text-xs text-slate-500 py-2 italic', textContent: 'Nincs még naptár hozzáadva.' }));
        return;
    }

    calendars.forEach((cal, index) => {
        const item = tag('div', { className: 'flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 gap-2' }, [
            tag('div', { className: 'flex items-center gap-2.5 min-w-0 flex-1' }, [
                tag('div', { className: 'w-3 h-3 rounded-full shrink-0 shadow-sm', style: `background-color: ${cal.color || 'var(--accent)'};` }),
                tag('div', { className: 'flex flex-col min-w-0' }, [
                    tag('span', { className: 'text-xs font-bold text-white truncate', textContent: cal.name || 'Névtelen naptár' }),
                    tag('span', { className: 'text-[11px] text-slate-500 truncate', textContent: cal.url })
                ])
            ]),
            tag('button', {
                className: 'p-1.5 hover:text-red-400 text-slate-400 transition-colors cursor-pointer shrink-0',
                title: 'Naptár törlése',
                onclick: () => {
                    config.calendars.splice(index, 1);
                    saveConfig();
                    renderCalendarsSettings();
                    checkAuth();
                }
            }, [createLucideIcon('trash-2', 'w-3.5 h-3.5')])
        ]);
        list.appendChild(item);
    });
    if (window.lucide) window.lucide.createIcons();
}

function setupEventListeners() {
    // Link Modal
    document.getElementById('close-modal-btn')?.addEventListener('click', closeLinkModal);
    document.getElementById('save-link-btn')?.addEventListener('click', saveLink);
    document.getElementById('delete-link-btn')?.addEventListener('click', deleteLink);

    csIconType = createCustomSelect('setting-icon-type');
    document.getElementById('setting-icon-type')?.addEventListener('change', (e) => {
        document.getElementById('custom-icon-group').classList.toggle('hidden', e.target.value !== 'custom');
    });

    // Calendar Auth / Refresh
    document.addEventListener('click', async (e) => {
        const authBtn = e.target.closest('#auth-btn');
        if (authBtn) {
            const hasCalendars = config.calendars && config.calendars.some(c => c && c.url);
            if (hasCalendars || config.calendarUrl) {
                await requestCalendarPermission();
                checkAuth();
            } else {
                openCalendarSettings();
            }
        }
    });

    // Storage
    document.getElementById('export-btn')?.addEventListener('click', exportConfig);
    document.querySelectorAll('.import-btn').forEach(btn => {
        btn.addEventListener('click', () => document.getElementById('import-input').click());
    });
    document.getElementById('import-input')?.addEventListener('change', importConfig);

    // Toggles
    document.getElementById('lock-toggle-btn')?.addEventListener('click', () => {
        config.isLocked = config.isLocked === false;
        saveConfig();
        renderLinks();
    });
    document.getElementById('focus-toggle-btn')?.addEventListener('click', toggleFocusMode);

    // Settings Modal
    const settingsBtn = document.getElementById('settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsContent = document.getElementById('settings-content');

    if (settingsBtn && settingsContent) {
        // Build custom dropdowns once
        const csType = createCustomSelect('setting-bg-type');
        const csFit = createCustomSelect('setting-bg-fit');
        const csRefresh = createCustomSelect('setting-bg-refresh');

        // Tab Switching Logic
        const tabBtns = document.querySelectorAll('.settings-tab-btn');
        const sections = document.querySelectorAll('.settings-section');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.tab;

                tabBtns.forEach(b => b.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));

                btn.classList.add('active');
                document.getElementById(`settings-${target}`).classList.add('active');
            });
        });

        settingsBtn.addEventListener('click', () => {
            // Fill settings fields
            document.getElementById('setting-accent-color').value = config.accentColor || '#24a66e';
            document.getElementById('setting-city').value = config.city || 'Szeged';
            document.getElementById('setting-show-groups').checked = config.showGroups !== false;
            document.getElementById('setting-new-tab').checked = config.openInNewTab !== false;
            document.getElementById('setting-show-seconds').checked = config.showSeconds !== false;
            document.getElementById('setting-show-namedays').checked = config.showNamedays !== false;
            document.getElementById('setting-show-link-tooltips').checked = config.showLinkTooltips === true;
            document.getElementById('setting-border-radius').value = config.iconBorderRadius ?? 12;
            document.getElementById('setting-kreta-url').value = config.kretaUrl || '';

            document.getElementById('setting-bg-type').value = config.bgType || 'none';
            document.getElementById('setting-bg-color').value = config.bgColor || '#000000';
            document.getElementById('setting-bg-unsplash').value = config.bgUnsplashQuery || 'nature';
            document.getElementById('setting-bg-fit').value = config.bgFitMode || 'cover';
            document.getElementById('setting-bg-refresh').value = config.bgRefreshFreq || 'load';
            document.getElementById('setting-bg-brightness').value = config.bgBrightness ?? 0;
            document.getElementById('brightness-display').textContent = `${config.bgBrightness ?? 0}%`;
            document.getElementById('setting-bg-blur').value = config.bgBlur ?? 0;
            document.getElementById('blur-display').textContent = `${config.bgBlur ?? 0}px`;

            document.getElementById('setting-bg-gradient-1').value = config.bgGradientStart || '#1a2a6c';
            document.getElementById('setting-bg-gradient-2').value = config.bgGradientEnd || '#b21f1f';
            document.getElementById('setting-bg-gradient-angle').value = config.bgGradientAngle || 135;
            document.getElementById('angle-display').textContent = `${config.bgGradientAngle || 135}°`;

            document.getElementById('setting-news-images').checked = config.showNewsImages !== false;
            document.getElementById('setting-news-count').value = config.newsCount || 15;
            document.getElementById('news-count-display').textContent = config.newsCount || 15;

            // Sync triggers
            csType?.sync();
            csFit?.sync();
            csRefresh?.sync();

            updateSettingsVisibility();
            renderCalendarsSettings();
            renderNewsFeedsSettings();
            updateRestoreNewsVisibility();
            originalConfig = JSON.parse(JSON.stringify(config));
            config.currentView = 'settings';
            saveConfig();
            updateViewUI();
        });

        const closeActions = () => {
            config.currentView = 'calendar';
            saveConfig();
            updateViewUI();
        };

        closeSettingsBtn?.addEventListener('click', closeActions);
        document.getElementById('close-settings-footer-btn')?.addEventListener('click', closeActions);

        document.getElementById('cancel-settings-btn')?.addEventListener('click', () => {
            if (originalConfig) {
                Object.assign(config, originalConfig);
                saveConfig();
                updateBackground(true);
                updateTime();
                renderLinks();
                fetchWeather();
                checkAuth();
                config.currentView = 'calendar';
                saveConfig();
                updateViewUI();
            }
        });
    }

    // Setting inputs event listeners
    document.getElementById('setting-accent-color')?.addEventListener('input', (e) => {
        const hex = e.target.value;
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            document.documentElement.style.setProperty('--accent', hex);
            document.documentElement.style.setProperty('--accent-rgb', `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`);
        }
    });
    document.getElementById('setting-accent-color')?.addEventListener('change', (e) => {
        config.accentColor = e.target.value;
        saveConfig();
    });

    document.getElementById('setting-bg-type')?.addEventListener('change', (e) => {
        config.bgType = e.target.value;
        if (config.bgType === 'none' || config.bgType === 'color' || config.bgType === 'gradient') {
            config.bgCachedImage = '';
        }
        updateSettingsVisibility();
        saveConfig();
        updateBackground(true);
    });

    document.getElementById('setting-bg-refresh')?.addEventListener('change', (e) => {
        config.bgRefreshFreq = e.target.value; saveConfig();
    });

    document.getElementById('setting-bg-color')?.addEventListener('input', (e) => {
        config.bgColor = e.target.value; debouncedBgUpdate(true);
    });
    document.getElementById('setting-bg-color')?.addEventListener('change', () => saveConfig());

    document.getElementById('setting-bg-gradient-1')?.addEventListener('input', (e) => {
        config.bgGradientStart = e.target.value; debouncedBgUpdate(true);
    });
    document.getElementById('setting-bg-gradient-1')?.addEventListener('change', () => saveConfig());

    document.getElementById('setting-bg-gradient-2')?.addEventListener('input', (e) => {
        config.bgGradientEnd = e.target.value; debouncedBgUpdate(true);
    });
    document.getElementById('setting-bg-gradient-2')?.addEventListener('change', () => saveConfig());

    document.getElementById('setting-bg-gradient-angle')?.addEventListener('input', (e) => {
        config.bgGradientAngle = parseInt(e.target.value);
        document.getElementById('angle-display').textContent = `${e.target.value}°`;
        debouncedBgUpdate(true);
    });
    document.getElementById('setting-bg-gradient-angle')?.addEventListener('change', () => saveConfig());

    document.getElementById('setting-bg-unsplash')?.addEventListener('change', (e) => {
        config.bgUnsplashQuery = e.target.value; saveConfig(); updateBackground(true);
    });

    document.getElementById('setting-bg-fit')?.addEventListener('change', (e) => {
        config.bgFitMode = e.target.value; saveConfig(); updateBackground(false);
    });

    document.getElementById('setting-bg-upload')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                config.bgImage = await compressImage(event.target.result);
                config.bgType = 'upload';
                saveConfig();
                
                const typeEl = document.getElementById('setting-bg-type');
                if (typeEl) {
                    typeEl.value = 'upload';
                    if (typeEl.customSelect) typeEl.customSelect.sync();
                }
                updateSettingsVisibility();
                updateBackground(true);
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('lock-bg-btn')?.addEventListener('click', () => {
        if (config.bgType === 'unsplash' && config.bgCachedImage) {
            config.bgType = 'upload';
            config.bgImage = config.bgCachedImage;
            saveConfig();
            
            const typeEl = document.getElementById('setting-bg-type');
            if (typeEl) {
                typeEl.value = 'upload';
                if (typeEl.customSelect) typeEl.customSelect.sync();
            }
            updateSettingsVisibility();
            updateBackground(false);
            alert("Háttérkép rögzítve a saját képek közé!");
        } else {
            alert("Csak véletlenszerű Unsplash háttérkép rögzíthető!");
        }
    });

    document.getElementById('download-bg-btn')?.addEventListener('click', () => {
        const bgLayer = document.getElementById('bg-layer');
        if (!bgLayer) return;
        const bgImg = bgLayer.style.backgroundImage;
        if (bgImg && bgImg !== 'none') {
            const matches = bgImg.match(/^url\((['"]?)(.*)\1\)$/);
            const url = matches ? matches[2] : null;
            if (url) {
                const a = document.createElement('a');
                a.href = url;
                a.download = `wolfhome_background_${Date.now()}.png`;
                a.click();
            } else {
                alert("Nem sikerült lekérni a háttérkép hivatkozását!");
            }
        } else {
            alert("Nincs letölthető háttérkép!");
        }
    });

    document.getElementById('refresh-bg-btn')?.addEventListener('click', () => updateBackground(true));
    document.getElementById('refresh-bg-btn-settings')?.addEventListener('click', () => updateBackground(true));

    document.getElementById('setting-bg-brightness')?.addEventListener('input', (e) => {
        config.bgBrightness = parseInt(e.target.value);
        document.getElementById('brightness-display').textContent = `${e.target.value}%`;
        updateBackground(false);
    });
    document.getElementById('setting-bg-brightness')?.addEventListener('change', () => saveConfig());

    document.getElementById('setting-bg-blur')?.addEventListener('input', (e) => {
        config.bgBlur = parseInt(e.target.value);
        document.getElementById('blur-display').textContent = `${e.target.value}px`;
        updateBackground(false);
    });
    document.getElementById('setting-bg-blur')?.addEventListener('change', () => saveConfig());

    document.getElementById('setting-city')?.addEventListener('change', (e) => {
        config.city = e.target.value.trim() || 'Szeged'; saveConfig(); fetchWeather();
    });

    document.getElementById('setting-calendar-url')?.addEventListener('change', async (e) => {
        config.calendarUrl = e.target.value.trim();
        saveConfig();
        if (config.calendarUrl) {
            await requestCalendarPermission();
        }
        checkAuth();
    });

    document.getElementById('setting-kreta-url')?.addEventListener('change', (e) => {
        let val = e.target.value.trim();
        if (val && !val.startsWith('http://') && !val.startsWith('https://')) {
            val = 'https://' + val;
        }
        config.kretaUrl = val || '';
        saveConfig();
        if (config.currentView === 'timetable') {
            const iframe = document.getElementById('timetable-iframe');
            if (iframe) iframe.src = config.kretaUrl + '/Orarend/TanariOrarend';
        }
    });

    document.getElementById('setting-show-groups')?.addEventListener('change', (e) => {
        config.showGroups = e.target.checked; saveConfig(); renderLinks();
    });

    document.getElementById('setting-new-tab')?.addEventListener('change', (e) => {
        config.openInNewTab = e.target.checked; saveConfig(); renderLinks();
    });

    document.getElementById('setting-show-seconds')?.addEventListener('change', (e) => {
        config.showSeconds = e.target.checked; saveConfig(); updateTime();
    });

    document.getElementById('setting-show-namedays')?.addEventListener('change', (e) => {
        config.showNamedays = e.target.checked;
        saveConfig();
        loadCachedEvents();
    });

    document.getElementById('setting-show-link-tooltips')?.addEventListener('change', (e) => {
        config.showLinkTooltips = e.target.checked;
        saveConfig();
        renderLinks();
    });

    document.getElementById('add-calendar-btn')?.addEventListener('click', async () => {
        const nameEl = document.getElementById('new-calendar-name');
        const urlEl = document.getElementById('new-calendar-url');
        const colorEl = document.getElementById('new-calendar-color');
        const name = nameEl.value.trim() || 'Naptár';
        const url = urlEl.value.trim();
        const color = colorEl.value || config.accentColor || '#24a66e';

        if (url) {
            if (!config.calendars) config.calendars = [];
            config.calendars.push({
                id: 'cal_' + Date.now(),
                name,
                url,
                color
            });
            nameEl.value = '';
            urlEl.value = '';
            saveConfig();
            renderCalendarsSettings();
            await requestCalendarPermission();
            checkAuth();
        } else {
            alert("Kérlek add meg a naptár iCal URL címét!");
        }
    });

    document.getElementById('setting-border-radius')?.addEventListener('input', (e) => {
        config.iconBorderRadius = parseInt(e.target.value); saveConfig(); renderLinks();
    });

    document.getElementById('setting-news-images')?.addEventListener('change', (e) => {
        config.showNewsImages = e.target.checked; saveConfig(); fetchNews();
    });

    document.getElementById('setting-news-count')?.addEventListener('input', (e) => {
        config.newsCount = parseInt(e.target.value);
        document.getElementById('news-count-display').textContent = e.target.value;
    });
    document.getElementById('setting-news-count')?.addEventListener('change', () => {
        saveConfig(); fetchNews();
    });

    document.getElementById('restore-closed-news-btn')?.addEventListener('click', () => {
        config.closedNews = [];
        saveConfig();
        fetchNews();
        updateRestoreNewsVisibility();
    });

    document.getElementById('add-feed-btn')?.addEventListener('click', () => {
        const nameEl = document.getElementById('new-feed-name');
        const urlEl = document.getElementById('new-feed-url');
        const name = nameEl.value.trim();
        const url = urlEl.value.trim();

        if (name && url) {
            if (!config.newsFeeds) config.newsFeeds = [];
            config.newsFeeds.push({ name, url });
            nameEl.value = '';
            urlEl.value = '';
            saveConfig();
            renderNewsFeedsSettings();
            fetchNews();
        }
    });

    // View Switching
    const viewCalBtn = document.getElementById('view-calendar-btn');
    const viewKanBtn = document.getElementById('view-kanban-btn');
    const viewNewsBtn = document.getElementById('view-news-btn');
    const viewTimetableBtn = document.getElementById('view-timetable-btn');

    const calContent = document.getElementById('calendar-content');
    const kanContent = document.getElementById('kanban-content');
    const newsContent = document.getElementById('news-content');
    const timetableContent = document.getElementById('timetable-content');

    const updateViewUI = () => {
        const view = config.currentView || 'calendar';
        const focus = getIsFocusMode();
        calContent?.classList.toggle('hidden', focus || view !== 'calendar');
        kanContent?.classList.toggle('hidden', focus || view !== 'kanban');
        newsContent?.classList.toggle('hidden', focus || view !== 'news');
        timetableContent?.classList.toggle('hidden', focus || view !== 'timetable');
        document.getElementById('settings-content')?.classList.toggle('hidden', focus || view !== 'settings');

        [viewCalBtn, viewKanBtn, viewNewsBtn, viewTimetableBtn, settingsBtn].forEach(btn => {
            if (!btn) return;
            btn.classList.remove('text-accent', 'bg-white/10');
            btn.classList.add('text-slate-500');
        });

        let activeBtn = viewCalBtn;
        if (view === 'kanban') activeBtn = viewKanBtn;
        if (view === 'news') activeBtn = viewNewsBtn;
        if (view === 'timetable') activeBtn = viewTimetableBtn;
        if (view === 'settings') activeBtn = settingsBtn;

        if (activeBtn) {
            activeBtn.classList.remove('text-slate-500');
            activeBtn.classList.add('text-accent', 'bg-white/10');
        }
    };

    viewCalBtn?.addEventListener('click', () => { config.currentView = 'calendar'; saveConfig(); updateViewUI(); });
    viewKanBtn?.addEventListener('click', () => { config.currentView = 'kanban'; saveConfig(); updateViewUI(); renderKanban(); });
    viewNewsBtn?.addEventListener('click', () => { config.currentView = 'news'; saveConfig(); updateViewUI(); fetchNews(); });
    viewTimetableBtn?.addEventListener('click', () => { 
        config.currentView = 'timetable'; 
        saveConfig(); 
        updateViewUI(); 
        const iframe = document.getElementById('timetable-iframe');
        if (iframe) {
            iframe.src = config.kretaUrl ? (config.kretaUrl + '/Orarend/TanariOrarend') : 'about:blank';
        }
    });

    updateViewUI();

    // Kanban Actions & Modal Listeners
    document.getElementById('kanban-search-input')?.addEventListener('input', (e) => {
        setKanbanSearchQuery(e.target.value);
    });
    document.getElementById('add-kanban-card-btn')?.addEventListener('click', () => openKanbanModal());
    document.getElementById('close-kanban-modal-btn')?.addEventListener('click', closeKanbanModal);
    document.getElementById('save-kanban-modal-btn')?.addEventListener('click', saveKanbanModal);
    document.getElementById('delete-kanban-modal-btn')?.addEventListener('click', () => {
        if (confirm("Biztosan törlöd ezt a feladatot?")) {
            const priorityInput = document.getElementById('kanban-selected-priority');
            // We use the active card ID in kanban.js
            deleteKanbanCard();
        }
    });

    document.querySelectorAll('.kanban-priority-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.kanban-priority-option').forEach(b => b.classList.remove('active-priority'));
            btn.classList.add('active-priority');
            const priorityInput = document.getElementById('kanban-selected-priority');
            if (priorityInput) priorityInput.value = btn.dataset.priority;
        });
    });

    document.getElementById('refresh-news-btn')?.addEventListener('click', () => fetchNews());

    if (window.lucide) window.lucide.createIcons();
}

function updateSettingsVisibility() {
    const typeEl = document.getElementById('setting-bg-type');
    if (!typeEl) return;

    const type = typeEl.value;
    document.getElementById('bg-color-group')?.classList.toggle('hidden', type !== 'color');
    document.getElementById('bg-gradient-group')?.classList.toggle('hidden', type !== 'gradient');
    document.getElementById('bg-upload-group')?.classList.toggle('hidden', type !== 'upload');
    document.getElementById('bg-unsplash-group')?.classList.toggle('hidden', type !== 'unsplash');
    document.getElementById('bg-refresh-group')?.classList.toggle('hidden', type !== 'unsplash');
    document.getElementById('bg-fit-group')?.classList.toggle('hidden', type === 'none' || type === 'color' || type === 'gradient');

    const effectsGroup = document.getElementById('bg-effects-group');
    if (effectsGroup) effectsGroup.classList.toggle('hidden', type === 'none');

    updateBackgroundActionsVisibility(type !== 'none');
}

// Initial Run
document.addEventListener('DOMContentLoaded', init);
