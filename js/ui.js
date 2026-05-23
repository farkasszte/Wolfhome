/**
 * WolfHome UI Module
 */
import { config, saveConfig } from './config.js';

let isFocusMode = false;

function exitFocusModeOnAnyClick(e) {
    // Exit focus mode on any click when active
    toggleFocusMode();
}

export function getIsFocusMode() {
    return isFocusMode;
}

/**
 * Toggle Focus Mode (hide non-essential cards)
 */
export function toggleFocusMode() {
    isFocusMode = !isFocusMode;
    const btn = document.getElementById('focus-toggle-btn');

    // Elements to toggle visibility
    const header = document.querySelector('header.glass');
    const calendarCard = document.getElementById('calendar-content');
    const kanbanCard = document.getElementById('kanban-content');
    const newsCard = document.getElementById('news-content');
    const settingsCard = document.getElementById('settings-content');
    const timetableCard = document.getElementById('timetable-content');
    const bookmarksCard = document.getElementById('bookmarks-card');
    const controlsCard = document.getElementById('controls-card');

    if (isFocusMode) {
        [calendarCard, kanbanCard, newsCard, settingsCard, timetableCard, bookmarksCard, controlsCard].forEach(el => {
            if (el) el.classList.add('hidden');
        });
        
        // Add a global click listener on the next tick to prevent immediate trigger
        setTimeout(() => {
            document.addEventListener('click', exitFocusModeOnAnyClick);
        }, 10);
    } else {
        const view = config.currentView || 'calendar';
        if (calendarCard) calendarCard.classList.toggle('hidden', view !== 'calendar');
        if (kanbanCard) kanbanCard.classList.toggle('hidden', view !== 'kanban');
        if (newsCard) newsCard.classList.toggle('hidden', view !== 'news');
        if (settingsCard) settingsCard.classList.toggle('hidden', view !== 'settings');
        if (timetableCard) timetableCard.classList.toggle('hidden', view !== 'timetable');
        if (bookmarksCard) bookmarksCard.classList.remove('hidden');
        if (controlsCard) controlsCard.classList.remove('hidden');

        // Clean up the global click listener
        document.removeEventListener('click', exitFocusModeOnAnyClick);
    }

    // For the header, use invisible instead of hidden to preserve the grid row height
    if (header) {
        if (isFocusMode) header.classList.add('invisible', 'opacity-0');
        else header.classList.remove('invisible', 'opacity-0');
    }

    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', isFocusMode ? 'eye-off' : 'eye');
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

/**
 * Replaces a native <select> with a fully custom dropdown.
 */
export function createCustomSelect(selectId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl || selectEl.dataset.customized) return null;
    selectEl.dataset.customized = 'true';
    selectEl.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';

    const label = document.createElement('span');
    trigger.appendChild(label);
    
    // Safer way to add SVG for Mozilla audit
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "12");
    svg.setAttribute("height", "12");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.5");
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("points", "6 9 12 15 18 9");
    svg.appendChild(poly);
    trigger.appendChild(svg);

    const panel = document.createElement('div');
    panel.className = 'custom-select-panel';

    const syncTrigger = () => {
        const sel = selectEl.options[selectEl.selectedIndex];
        label.textContent = sel ? sel.text : '';
        panel.querySelectorAll('.custom-select-option').forEach(btn => {
            btn.classList.toggle('is-selected', btn.dataset.value === selectEl.value);
        });
    };

    const buildPanel = () => {
        panel.textContent = '';
        Array.from(selectEl.options).forEach(opt => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'custom-select-option';
            btn.dataset.value = opt.value;
            btn.textContent = opt.text;
            btn.addEventListener('click', () => {
                selectEl.value = opt.value;
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                syncTrigger();
                wrapper.classList.remove('open');
            });
            panel.appendChild(btn);
        });
        syncTrigger();
    };

    buildPanel();

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = wrapper.classList.contains('open');
        // Close all others
        document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
        if (!isOpen) wrapper.classList.add('open');
    });

    document.addEventListener('click', () => wrapper.classList.remove('open'));
    wrapper.addEventListener('click', e => e.stopPropagation());

    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);
    selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);
    const selectController = { sync: syncTrigger, build: buildPanel };
    selectEl.customSelect = selectController;
    return selectController;
}
