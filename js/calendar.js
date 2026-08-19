/**
 * WolfHome Calendar Module
 */
import { config, saveConfig } from './config.js';
import { tag, createLucideIcon, extAPI } from './utils.js';
import { namedayDB, getNameday } from './nameday-db.js';
export { getNameday };

export function loadCachedEvents() {
    try {
        const cached = localStorage.getItem('gcal_cached_events');
        if (cached) {
            const events = JSON.parse(cached);
            renderCalendarGrid(events, true); // true = offline/cached mode
            return true;
        }
    } catch (e) {
        console.warn("Nem sikerült betölteni a gyorsítótárazott naptáreseményeket:", e);
    }
    return false;
}

// --- iCal (ICS) Parser & Recurring Event Expander ---

function parseIcsDate(val) {
    if (!val) return null;
    const m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
    if (!m) return null;
    const [, y, mon, d, h, min, s, z] = m;
    if (h !== undefined) {
        const iso = `${y}-${mon}-${d}T${h}:${min}:${s}${z ? 'Z' : ''}`;
        return { dateTime: iso };
    } else {
        const dateStr = `${y}-${mon}-${d}`;
        return { date: dateStr };
    }
}

export function parseICS(icsText, startRange, endRange, calendarMeta = {}) {
    const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    
    const events = [];
    let currentEvent = null;
    const defaultColor = calendarMeta.color || config.accentColor || '#24a66e';
    const calendarName = calendarMeta.name || '';
    
    for (const line of lines) {
        if (!line.trim()) continue;
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        
        const rawKey = line.substring(0, colonIdx);
        const value = line.substring(colonIdx + 1);
        const key = rawKey.split(';')[0].trim().toUpperCase();
        
        if (key === 'BEGIN' && value.trim().toUpperCase() === 'VEVENT') {
            currentEvent = { 
                exdates: [],
                color: defaultColor,
                calendarName: calendarName
            };
        } else if (key === 'END' && value.trim().toUpperCase() === 'VEVENT') {
            if (currentEvent && currentEvent.start) {
                // Biztosítsuk, hogy mindig legyen érvényes végdátum (ha hiányzik, legyen azonos a kezdővel)
                if (!currentEvent.end) {
                    currentEvent.end = { ...currentEvent.start };
                }
                events.push(currentEvent);
            }
            currentEvent = null;
        } else if (currentEvent) {
            if (key === 'SUMMARY') {
                currentEvent.summary = value
                    .replace(/\\,/g, ',')
                    .replace(/\\;/g, ';')
                    .replace(/\\n/g, '\n')
                    .replace(/\\/g, '');
            } else if (key === 'LOCATION') {
                currentEvent.location = value
                    .replace(/\\,/g, ',')
                    .replace(/\\;/g, ';')
                    .replace(/\\n/g, ' ')
                    .replace(/\\/g, '');
            } else if (key === 'DESCRIPTION') {
                currentEvent.description = value
                    .replace(/\\,/g, ',')
                    .replace(/\\;/g, ';')
                    .replace(/\\n/g, '\n')
                    .replace(/\\/g, '');
            } else if (key === 'DTSTART') {
                currentEvent.start = parseIcsDate(value);
            } else if (key === 'DTEND') {
                currentEvent.end = parseIcsDate(value);
            } else if (key === 'RRULE') {
                currentEvent.rrule = value;
            } else if (key === 'EXDATE') {
                const dates = value.split(',');
                for (const d of dates) {
                    const parsed = parseIcsDate(d);
                    if (parsed) {
                        currentEvent.exdates.push(parsed.date || parsed.dateTime.split('T')[0]);
                    }
                }
            } else if (key === 'UID') {
                currentEvent.id = value;
            }
        }
    }
    
    const expandedEvents = [];
    const minTime = startRange.getTime();
    const maxTime = endRange.getTime();
    
    for (const event of events) {
        if (!event.rrule) {
            // Nem ismétlődő események: Csak azokat tartsuk meg, amik a megtekintett időtartamba esnek!
            const startDt = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date + 'T00:00:00');
            const endDt = event.end.dateTime ? new Date(event.end.dateTime) : new Date(event.end.date + 'T23:59:59');
            
            if (endDt.getTime() >= minTime && startDt.getTime() <= maxTime) {
                expandedEvents.push(event);
            }
            continue;
        }
        
        const rules = {};
        const parts = event.rrule.split(';');
        for (const p of parts) {
            const eqIdx = p.indexOf('=');
            if (eqIdx !== -1) {
                rules[p.substring(0, eqIdx).toUpperCase()] = p.substring(eqIdx + 1);
            }
        }
        
        const freq = rules.FREQ;
        if (!freq) {
            expandedEvents.push(event);
            continue;
        }
        
        const interval = parseInt(rules.INTERVAL || '1');
        
        let untilTime = Infinity;
        if (rules.UNTIL) {
            const parsedUntil = parseIcsDate(rules.UNTIL);
            if (parsedUntil) {
                const d = parsedUntil.dateTime ? new Date(parsedUntil.dateTime) : new Date(parsedUntil.date + 'T23:59:59');
                untilTime = d.getTime();
            }
        }
        
        let count = parseInt(rules.COUNT || '999');
        
        const startDt = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date + 'T00:00:00');
        const endDt = event.end.dateTime ? new Date(event.end.dateTime) : new Date(event.end.date + 'T00:00:00');
        const durationMs = endDt.getTime() - startDt.getTime();
        
        let currentStart = new Date(startDt.getTime());
        let instancesGenerated = 0;
        let iterations = 0;
        const maxIterations = 500;
        
        while (currentStart.getTime() <= untilTime && instancesGenerated < count && iterations < maxIterations) {
            iterations++;
            
            const instanceCheckStr = `${currentStart.getFullYear()}-${String(currentStart.getMonth() + 1).padStart(2, '0')}-${String(currentStart.getDate()).padStart(2, '0')}`;
            
            if (!event.exdates.includes(instanceCheckStr)) {
                if (currentStart.getTime() + durationMs >= minTime && currentStart.getTime() <= maxTime) {
                    const instStart = event.start.date 
                        ? { date: instanceCheckStr }
                        : { dateTime: currentStart.toISOString() };
                    
                    const instEndDt = new Date(currentStart.getTime() + durationMs);
                    const instEndStr = `${instEndDt.getFullYear()}-${String(instEndDt.getMonth() + 1).padStart(2, '0')}-${String(instEndDt.getDate()).padStart(2, '0')}`;
                    const instEnd = event.end.date
                        ? { date: instEndStr }
                        : { dateTime: instEndDt.toISOString() };
                        
                    expandedEvents.push({
                        id: `${event.id || event.summary}_${instanceCheckStr}`,
                        summary: event.summary,
                        location: event.location,
                        description: event.description,
                        color: event.color,
                        calendarName: event.calendarName,
                        start: instStart,
                        end: instEnd
                    });
                }
                instancesGenerated++;
            }
            
            if (freq === 'DAILY') {
                currentStart.setDate(currentStart.getDate() + interval);
            } else if (freq === 'WEEKLY') {
                currentStart.setDate(currentStart.getDate() + 7 * interval);
            } else if (freq === 'MONTHLY') {
                currentStart.setMonth(currentStart.getMonth() + interval);
            } else if (freq === 'YEARLY') {
                currentStart.setFullYear(currentStart.getFullYear() + interval);
            } else {
                break;
            }
            
            if (currentStart.getTime() > maxTime) {
                break;
            }
        }
    }
    
    return expandedEvents;
}

export function getActiveCalendars() {
    if (config.calendars && Array.isArray(config.calendars) && config.calendars.length > 0) {
        return config.calendars.filter(c => c && c.url && c.url.trim() !== '');
    }
    if (config.calendarUrl) {
        return [{ id: 'default', name: 'Elsődleges naptár', url: config.calendarUrl, color: config.accentColor || '#24a66e' }];
    }
    return [];
}

export function updateAuthStatusUI(isSynced) {
    const authBtn = document.getElementById('auth-btn');
    if (!authBtn) return;

    if (isSynced) {
        authBtn.classList.remove('text-amber-500', 'animate-pulse', 'text-slate-400');
        authBtn.classList.add('text-accent');
        authBtn.title = "Google Naptár szinkronizálva (Kattints a frissítéshez)";
    } else {
        authBtn.classList.remove('text-slate-400', 'text-accent');
        authBtn.classList.add('text-amber-500', 'animate-pulse');
        authBtn.title = "Nincs Google Naptár kapcsolat (Kattints a beállításhoz)";
    }
}

export function openCalendarSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.click();
        document.querySelector('.settings-tab-btn[data-tab="personal"]')?.click();
        setTimeout(() => {
            const input = document.getElementById('setting-calendar-url') || document.getElementById('new-calendar-url');
            if (input) {
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                input.classList.add('border-accent', 'ring-2', 'ring-accent/20');
                setTimeout(() => {
                    input.classList.remove('border-accent', 'ring-2', 'ring-accent/20');
                }, 2000);
            }
        }, 150);
    }
}

export async function requestCalendarPermission() {
    const api = typeof browser !== 'undefined' ? browser : typeof chrome !== 'undefined' ? chrome : null;
    if (api && api.permissions) {
        try {
            return await api.permissions.request({ origins: ["https://calendar.google.com/"] });
        } catch (e) {
            console.warn("Engedélykérési hiba:", e);
        }
    }
    return false;
}

export async function checkAuth() {
    // Kényszerítsük a régi, hibás gyorsítótár ürítését egyszer
    if (localStorage.getItem('gcal_cache_version') !== 'v6') {
        localStorage.removeItem('gcal_cached_events');
        localStorage.removeItem('gcal_cached_time');
        localStorage.setItem('gcal_cache_version', 'v6');
    }

    loadCachedEvents();

    const activeCalendars = getActiveCalendars();
    if (activeCalendars.length === 0) {
        showAuthButton();
        return;
    }

    try {
        await fetchAllCalendarEvents(activeCalendars);
        updateAuthStatusUI(true);
    } catch (error) {
        console.warn("Naptár betöltési hiba:", error);
        updateAuthStatusUI(false);
    }
}

async function fetchSingleIcal(url) {
    const hasSendMessage = extAPI && extAPI.runtime && extAPI.runtime.sendMessage;

    if (!hasSendMessage) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Letöltési hiba: ${response.status}`);
        return await response.text();
    }

    return new Promise((resolve, reject) => {
        extAPI.runtime.sendMessage({ action: 'fetchIcal', url: url }, (response) => {
            if (extAPI.runtime.lastError) {
                reject(new Error(extAPI.runtime.lastError.message));
                return;
            }
            if (response && response.success) {
                resolve(response.text);
            } else {
                reject(new Error(response ? response.error : "Ismeretlen hiba a háttérben."));
            }
        });
    });
}

async function fetchAllCalendarEvents(calendars) {
    const startRange = new Date(currentViewDate.getTime() - 60 * 24 * 60 * 60 * 1000);
    const endRange = new Date(currentViewDate.getTime() + 60 * 24 * 60 * 60 * 1000);

    const promises = calendars.map(async (cal) => {
        try {
            const icsText = await fetchSingleIcal(cal.url);
            return parseICS(icsText, startRange, endRange, cal);
        } catch (err) {
            console.warn(`Naptár betöltési hiba (${cal.name || cal.url}):`, err);
            return [];
        }
    });

    const results = await Promise.allSettled(promises);
    const allEvents = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value);

    if (allEvents.length > 0 || calendars.length > 0) {
        localStorage.setItem('gcal_cached_events', JSON.stringify(allEvents));
        localStorage.setItem('gcal_cached_time', Date.now().toString());

        renderCalendarGrid(allEvents, false);
        document.getElementById('events-list')?.classList.remove('hidden');
        document.getElementById('calendar-placeholder')?.classList.add('hidden');
        if (window.lucide) window.lucide.createIcons();
    } else {
        showAuthButton();
    }
}

function showAuthButton() {
    updateAuthStatusUI(false);

    const hasCache = loadCachedEvents();
    if (!hasCache) {
        document.getElementById('events-list')?.classList.add('hidden');
        document.getElementById('calendar-placeholder')?.classList.remove('hidden');

        const placeholder = document.getElementById('calendar-placeholder');
        if (placeholder) {
            placeholder.innerHTML = `
                <div class="flex flex-col items-center justify-center space-y-4 text-center p-8 max-w-sm mx-auto h-full">
                    <i data-lucide="calendar-days" class="w-16 h-16 text-slate-600 opacity-40"></i>
                    <h3 class="text-lg font-bold text-slate-300">Nincs Google Naptár kapcsolat</h3>
                    <p class="text-xs text-slate-500">Másold be a Google Naptárad <b>Titkos iCal címét</b> a beállításokban a naptár szinkronizálásához.</p>
                    <button id="calendar-setup-btn" class="px-4 py-2 bg-accent/20 text-accent border border-accent/30 rounded-xl hover:bg-accent/30 transition-all text-xs font-bold uppercase tracking-widest cursor-pointer">
                        Beállítás megnyitása
                    </button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            
            document.getElementById('calendar-setup-btn')?.addEventListener('click', async () => {
                await requestCalendarPermission();
                openCalendarSettings();
            });
        }
    }
}

export function renderCalendarGrid(events, isOffline = false) {
    const list = document.getElementById('events-list');
    if (!list) return;
    list.textContent = '';
    const now = new Date();
    const viewMode = config.calendarViewMode || 'month';
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const monthName = currentViewDate.toLocaleDateString('hu-HU', { month: 'long', year: 'numeric' });

    // Kijelző jelvény offline/lejárt munkamenethez
    const offlineBadge = isOffline ? tag('button', {
        className: "flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full hover:bg-amber-500/20 text-amber-400 transition-all cursor-pointer animate-pulse",
        onclick: openCalendarSettings,
        title: "A szinkronizáció megszakadt. Kattints a beállítások megnyitásához!"
    }, [
        createLucideIcon('refresh-cw-off', 'w-3 h-3'),
        tag('span', { className: "text-xs font-bold uppercase tracking-wider", textContent: "Kapcsolat megszakadt" })
    ]) : null;

    const headerChildren = [
        tag('h2', { className: "text-2xl font-bold tracking-tight uppercase text-white/90", textContent: viewMode === 'month' ? monthName : "Következő 2 hét" }),
        tag('div', { className: "flex gap-1 items-center" }, [
            tag('button', { className: "p-1.5 bg-black/30 border border-white/10 rounded-lg hover:bg-black/50 hover:text-accent transition-all cursor-pointer", onclick: prevMonth, title: "Előző hónap" }, [createLucideIcon('chevron-left', 'w-4 h-4')]),
            tag('button', { className: "px-2.5 py-1.5 bg-black/30 border border-white/10 rounded-lg hover:bg-black/50 hover:text-accent text-xs font-bold uppercase tracking-wider text-slate-300 transition-all cursor-pointer", onclick: goToToday, title: "Ugrás a mai napra" }, ["Ma"]),
            tag('button', { className: "p-1.5 bg-black/30 border border-white/10 rounded-lg hover:bg-black/50 hover:text-accent transition-all cursor-pointer", onclick: nextMonth, title: "Következő hónap" }, [createLucideIcon('chevron-right', 'w-4 h-4')]),
            tag('button', {
                className: `ml-2 px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-lg transition-all cursor-pointer ${viewMode === 'month' ? 'bg-black/30 border border-white/10 text-slate-400 hover:bg-black/50' : 'bg-accent/20 text-accent border border-accent/30'}`,
                textContent: viewMode === 'month' ? "Havi" : "2 hetes",
                onclick: () => { config.calendarViewMode = viewMode === 'month' ? 'biweekly' : 'month'; saveConfig(); renderCalendarGrid(events, isOffline); }
            }),
            tag('button', {
                id: "auth-btn",
                className: "ml-2 p-1.5 bg-black/30 border border-white/10 rounded-lg hover:bg-black/50 hover:text-accent text-slate-400 transition-all cursor-pointer",
                title: "Google Naptár szinkronizálása"
            }, [createLucideIcon('refresh-cw', 'w-4 h-4')])
        ])
    ];

    if (offlineBadge) {
        headerChildren.push(offlineBadge);
    }

    const header = tag('div', { className: "flex items-center justify-between mb-8" }, [
        tag('div', { className: "flex items-center gap-4 flex-wrap" }, headerChildren),
        tag('button', {
            className: "flex items-center gap-2 px-3 py-1.5 bg-black/30 border border-white/10 rounded-full hover:bg-black/50 transition-all cursor-pointer",
            onclick: () => window.open('https://calendar.google.com/calendar/u/0/r/eventedit', '_blank'),
            title: "Új esemény hozzáadása"
        }, [
            tag('div', { className: "w-2.5 h-2.5 bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" }),
            tag('span', { className: "text-xs font-bold text-slate-400 uppercase tracking-widest", textContent: "Új esemény" })
        ])
    ]);

    const dayLabels = tag('div', { className: "grid grid-cols-7 gap-2 mb-4" },
        ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map(d => tag('div', { className: "text-center text-xs font-black text-slate-600 uppercase tracking-widest", textContent: d }))
    );

    const grid = tag('div', { className: "grid grid-cols-7 gap-2" });
    let calendarDays = [];
    if (viewMode === 'month') {
        const first = new Date(year, month, 1);
        const offset = (first.getDay() || 7) - 1;
        const lastPrev = new Date(year, month, 0).getDate();
        for (let i = offset - 1; i >= 0; i--) calendarDays.push({ date: new Date(year, month - 1, lastPrev - i), currentMonth: false });
        for (let i = 1; i <= new Date(year, month + 1, 0).getDate(); i++) calendarDays.push({ date: new Date(year, month, i), currentMonth: true });
        const rem = calendarDays.length % 7;
        if (rem !== 0) {
            const padDays = 7 - rem;
            for (let i = 1; i <= padDays; i++) calendarDays.push({ date: new Date(year, month + 1, i), currentMonth: false });
        }
    } else {
        const start = new Date(); const d = start.getDay() || 7; start.setDate(start.getDate() - (d - 1));
        for (let i = 0; i < 14; i++) { const dt = new Date(start); dt.setDate(dt.getDate() + i); calendarDays.push({ date: dt, currentMonth: true }); }
    }

    // Slot Assignment logic
    const eventSlots = new Map();
    const dayOccupancy = calendarDays.map(() => []);

    calendarDays.forEach((dayObj, dayIdx) => {
        const d = dayObj.date;
        const check = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayEvents = events.filter(e => {
            let s, en;
            if (e.start.date) { s = e.start.date; en = e.end.date; }
            else {
                const startDt = new Date(e.start.dateTime);
                const endDt = new Date(e.end.dateTime);
                s = `${startDt.getFullYear()}-${String(startDt.getMonth() + 1).padStart(2, '0')}-${String(startDt.getDate()).padStart(2, '0')}`;
                en = `${endDt.getFullYear()}-${String(endDt.getMonth() + 1).padStart(2, '0')}-${String(endDt.getDate()).padStart(2, '0')}`;
                if (endDt.getHours() === 0 && endDt.getMinutes() === 0 && endDt.getSeconds() === 0 && startDt.toDateString() !== endDt.toDateString()) {
                    const prev = new Date(endDt.getTime() - 1000);
                    en = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
                }
            }
            if (e.start.date) return check >= s && check < en;
            return check >= s && check <= en;
        }).sort((a, b) => {
            if (!a.start.dateTime && b.start.dateTime) return -1;
            if (a.start.dateTime && !b.start.dateTime) return 1;
            return (a.start.dateTime || a.start.date).localeCompare(b.start.dateTime || b.start.date);
        });

        dayEvents.forEach(e => {
            const eventId = e.id || e.summary;
            if (eventSlots.has(eventId)) {
                dayOccupancy[dayIdx].push(eventSlots.get(eventId));
            } else {
                let slot = 0;
                while (dayOccupancy[dayIdx].includes(slot)) slot++;
                eventSlots.set(eventId, slot);
                dayOccupancy[dayIdx].push(slot);
            }
        });
    });

    calendarDays.forEach(({ date: currentDate, currentMonth }, index) => {
        const d = currentDate;
        const check = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const dayEvents = events.filter(e => {
            let s, en;
            if (e.start.date) { s = e.start.date; en = e.end.date; }
            else {
                const startDt = new Date(e.start.dateTime);
                const endDt = new Date(e.end.dateTime);
                s = `${startDt.getFullYear()}-${String(startDt.getMonth() + 1).padStart(2, '0')}-${String(startDt.getDate()).padStart(2, '0')}`;
                en = `${endDt.getFullYear()}-${String(endDt.getMonth() + 1).padStart(2, '0')}-${String(endDt.getDate()).padStart(2, '0')}`;
                if (endDt.getHours() === 0 && endDt.getMinutes() === 0 && endDt.getSeconds() === 0 && startDt.toDateString() !== endDt.toDateString()) {
                    const prev = new Date(endDt.getTime() - 1000);
                    en = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
                }
            }
            if (e.start.date) return check >= s && check < en;
            return check >= s && check <= en;
        }).sort((a, b) => {
            if (!a.start.dateTime && b.start.dateTime) return -1;
            if (a.start.dateTime && !b.start.dateTime) return 1;
            return (a.start.dateTime || a.start.date).localeCompare(b.start.dateTime || b.start.date);
        });

        const isToday = check === todayStr;
        const indicators = tag('div', { className: "flex flex-col gap-1 mt-1 relative z-10 -mx-2" });

        const maxSlots = 3;
        const slotsToRender = new Array(maxSlots).fill(null);
        dayEvents.forEach(e => {
            const slot = eventSlots.get(e.id || e.summary);
            if (slot < maxSlots) slotsToRender[slot] = e;
        });

        slotsToRender.forEach((e, slotIdx) => {
            if (!e) {
                indicators.appendChild(tag('div', { className: "h-5 mb-0.5 opacity-0" }));
                return;
            }

            let s, en;
            if (e.start.date) { s = e.start.date; en = e.end.date; }
            else {
                const startDt = new Date(e.start.dateTime);
                const endDt = new Date(e.end.dateTime);
                s = `${startDt.getFullYear()}-${String(startDt.getMonth() + 1).padStart(2, '0')}-${String(startDt.getDate()).padStart(2, '0')}`;
                en = `${endDt.getFullYear()}-${String(endDt.getMonth() + 1).padStart(2, '0')}-${String(endDt.getDate()).padStart(2, '0')}`;
                if (endDt.getHours() === 0 && endDt.getMinutes() === 0 && endDt.getSeconds() === 0 && startDt.toDateString() !== endDt.toDateString()) {
                    const prev = new Date(endDt.getTime() - 1000);
                    en = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
                }
            }

            let lastDay = en;
            if (e.start.date) {
                const ed = new Date(en + 'T00:00:00');
                ed.setDate(ed.getDate() - 1);
                lastDay = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}`;
            }

            const isFirst = check === s;
            const isLast = check === lastDay;
            let isPast = false;
            if (e.end.dateTime) isPast = new Date(e.end.dateTime) < now;
            else isPast = new Date(en + 'T00:00:00') < now;

            const isFirstVisible = isFirst || index % 7 === 0;
            const eventColor = e.color || 'var(--accent)';
            const borderStyle = isFirst && !isPast ? `border-color: ${eventColor};` : '';
            const bgStyle = isPast ? '' : `background-color: ${eventColor}; opacity: 0.35;`;

            const ind = tag('div', {
                className: `relative h-5 flex items-center mb-0.5 transition-all
                ${isFirst ? 'ml-2 rounded-l-md border-l-2' : 'ml-0 rounded-l-none'} 
                ${isLast ? 'mr-2 rounded-r-md' : 'mr-0 rounded-r-none'} 
                ${isPast && isFirst ? 'border-slate-500/50' : ''} 
                overflow-hidden z-10 w-full`,
                style: borderStyle
            });

            ind.appendChild(tag('div', {
                className: `absolute inset-0 z-0 ${isPast ? 'bg-slate-500 opacity-20' : ''}`,
                style: bgStyle
            }));

            if (isFirstVisible) {
                ind.appendChild(tag('p', {
                    className: "text-xs leading-tight text-white font-bold truncate px-1.5 z-20 relative",
                    textContent: e.summary
                }));
            } else {
                ind.appendChild(tag('p', {
                    className: "text-xs leading-tight opacity-0 truncate px-1.5 z-20 relative select-none",
                    textContent: "."
                }));
            }
            indicators.appendChild(ind);
        });

        const isTodayStyle = isToday ? "background-color: rgba(36, 166, 110, 0.05)" : "";

        const dayNumber = tag('span', { className: `text-xs font-black ${isToday ? 'text-accent' : 'text-slate-500'}`, textContent: currentDate.getDate() });
        const cellHeaderChildren = [dayNumber];

        if (config.showNamedays !== false) {
            const nameDayText = getNameday(currentDate.getMonth(), currentDate.getDate(), currentDate.getFullYear());
            if (nameDayText) {
                cellHeaderChildren.push(tag('span', {
                    className: "text-xs text-slate-600 font-medium ml-auto select-none truncate max-w-[70%]",
                    textContent: nameDayText,
                    title: nameDayText
                }));
            }
        }

        const cellHeader = tag('div', { className: 'flex justify-between items-center w-full' }, cellHeaderChildren);

        // Fix: always navigate to the date's Google Calendar view, never use undefined htmlLink
        const cell = tag('a', {
            href: `https://calendar.google.com/calendar/u/0/r/day/${currentDate.getFullYear()}/${currentDate.getMonth() + 1}/${currentDate.getDate()}`,
            target: "_blank",
            style: isTodayStyle,
            className: `h-24 w-full rounded-xl border ${isToday ? 'border-accent' : 'border-white/[0.05] bg-white/[0.02]'} ${!currentMonth ? 'opacity-30 grayscale' : ''} p-2 flex flex-col hover:bg-white/5 transition-all cursor-pointer overflow-hidden relative`
        }, [cellHeader, indicators]);

        const wrapper = tag('div', { className: "relative group" }, [cell]);
        if (dayEvents.length > 0) {
            const isRight = (index % 7) >= 4;
            const card = tag('div', {
                className: `absolute ${isRight ? 'right-full mr-2' : 'left-full ml-2'} top-0 w-80 glass p-4 rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-2xl border border-white/10 ${isRight ? '-translate-x-2' : 'translate-x-2'} group-hover:translate-x-0`
            }, [
                tag('h5', { className: "text-sm font-bold text-accent mb-3 flex items-center justify-between", textContent: currentDate.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'short' }) }),
                tag('div', { className: "space-y-3 max-h-72 overflow-y-auto no-scrollbar" }, dayEvents.map(e => tag('div', { 
                    className: "space-y-1 pl-3 transition-all",
                    style: `border-left: 3px solid ${e.color || 'var(--accent)'};`
                }, [
                    tag('div', { className: "flex justify-between items-start gap-2" }, [
                        tag('div', { className: "flex flex-col min-w-0" }, [
                            tag('span', { className: "text-xs font-bold text-white leading-tight", textContent: e.summary }),
                            e.calendarName ? tag('span', { 
                                className: "text-[10px] font-bold tracking-wider uppercase mt-0.5", 
                                style: `color: ${e.color || 'var(--accent)'};`, 
                                textContent: e.calendarName 
                            }) : null
                        ]),
                        tag('span', { className: "text-[11px] text-slate-400 font-mono whitespace-nowrap shrink-0", textContent: e.start.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : 'Egész nap' })
                    ]),
                    e.location ? tag('div', { className: "flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5" }, [
                        createLucideIcon('map-pin', 'w-3 h-3 text-slate-500 shrink-0'),
                        tag('span', { className: "truncate", textContent: e.location })
                    ]) : null,
                    e.description ? tag('p', { className: "text-[11px] text-slate-400 line-clamp-2 leading-relaxed pt-0.5 opacity-80", textContent: e.description.slice(0, 120) }) : null
                ])))
            ]);
            wrapper.appendChild(card);
        }
        grid.appendChild(wrapper);
    });

    list.appendChild(header);
    list.appendChild(dayLabels);
    list.appendChild(grid);
    if (window.lucide) window.lucide.createIcons();

    const activeCalendars = getActiveCalendars();
    if (activeCalendars.length > 0) {
        updateAuthStatusUI(!isOffline);
    } else {
        updateAuthStatusUI(false);
    }
}

export function goToToday() {
    currentViewDate = new Date();
    checkAuth();
}

export function prevMonth() {
    currentViewDate.setDate(1);
    currentViewDate.setMonth(currentViewDate.getMonth() - 1);
    checkAuth();
}

export function nextMonth() {
    currentViewDate.setDate(1);
    currentViewDate.setMonth(currentViewDate.getMonth() + 1);
    checkAuth();
}

