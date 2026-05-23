/**
 * WolfHome Links Module
 */
import { config, saveConfig } from './config.js';
import { tag, createLucideIcon } from './utils.js';

let editingSIndex = -1;
let editingLIndex = -1;
let csIconType = null; // Reference to custom select

/**
 * Get high-resolution icon from CDN for popular/Google services
 */
function getHighResIcon(urlStr) {
    try {
        const url = new URL(urlStr);
        const host = url.hostname.toLowerCase();
        
        const mappings = {
            'mail.google.com': 'gmail',
            'inbox.google.com': 'gmail',
            'calendar.google.com': 'google-calendar',
            'drive.google.com': 'google-drive',
            'docs.google.com': 'google-docs',
            'sheets.google.com': 'google-sheets',
            'slides.google.com': 'google-slides',
            'forms.google.com': 'google-forms',
            'keep.google.com': 'google-keep',
            'meet.google.com': 'google-meet',
            'classroom.google.com': 'google-classroom',
            'photos.google.com': 'google-photos',
            'translate.google.com': 'google-translate',
            'maps.google.com': 'google-maps',
            'google.com': 'google',
            'www.google.com': 'google',
            'youtube.com': 'youtube',
            'www.youtube.com': 'youtube',
            'gmail.com': 'gmail',
            'www.gmail.com': 'gmail',
            'github.com': 'github',
            'www.github.com': 'github',
            'facebook.com': 'facebook',
            'www.facebook.com': 'facebook',
            'instagram.com': 'instagram',
            'www.instagram.com': 'instagram',
            'twitter.com': 'twitter',
            'www.twitter.com': 'twitter',
            'x.com': 'twitter',
            'www.x.com': 'twitter',
            'discord.com': 'discord',
            'www.discord.com': 'discord',
            'spotify.com': 'spotify',
            'www.spotify.com': 'spotify',
            'reddit.com': 'reddit',
            'www.reddit.com': 'reddit',
            'netflix.com': 'netflix',
            'www.netflix.com': 'netflix',
            'pinterest.com': 'pinterest',
            'www.pinterest.com': 'pinterest',
            'linkedin.com': 'linkedin',
            'www.linkedin.com': 'linkedin'
        };

        if (mappings[host]) {
            return `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${mappings[host]}.png`;
        }

        for (const [key, value] of Object.entries(mappings)) {
            if (host.endsWith('.' + key)) {
                return `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${value}.png`;
            }
        }
    } catch (e) { }
    return null;
}

/**
 * Helper to safely extract hostname from a potentially malformed URL
 */
function getSafeHostname(urlStr) {
    try {
        return new URL(urlStr).hostname;
    } catch (e) {
        return '';
    }
}

/**
 * Render all bookmark sections and links
 */
export function renderLinks() {
    const linksGrid = document.getElementById('links-grid');
    if (!linksGrid) return;
    linksGrid.innerHTML = '';
    
    const isLocked = config.isLocked !== false;
    const lockBtn = document.getElementById('lock-toggle-btn');
    if (lockBtn) {
        lockBtn.innerHTML = '';
        lockBtn.appendChild(createLucideIcon(isLocked ? 'lock' : 'unlock', "w-4 h-4"));
        lockBtn.className = `p-2 rounded-full transition-colors ${isLocked ? 'text-slate-500 hover:bg-white/5' : 'text-accent bg-accent/10 hover:bg-accent/20'}`;
    }

    config.sections.forEach((section, sIndex) => {
        const isCollapsed = section.collapsed || false;
        const grid = tag('div', {
            className: `grid grid-cols-4 gap-3 px-1 transition-all duration-300 ${isCollapsed ? 'hidden' : ''}`,
            id: `section-grid-${sIndex}`
        });

        const showGroups = config.showGroups !== false;

        const sectionHeader = tag('div', {
            className: `flex items-center justify-between px-2 group/sec ${!showGroups ? 'hidden' : ''}`
        }, [
            tag('div', {
                className: "flex items-center gap-2 cursor-pointer flex-1",
                onclick: () => {
                    section.collapsed = !section.collapsed;
                    saveConfig();
                    renderLinks();
                }
            }, [
                tag('button', { className: `text-slate-500 hover:text-accent transition-all transform ${isCollapsed ? '-rotate-90' : ''}` }, [createLucideIcon('chevron-down', 'w-3 h-3')]),
                tag('h4', { className: "text-xs font-bold text-slate-500 tracking-[0.1em]", textContent: section.name })
            ]),
            tag('div', { className: "flex gap-2 opacity-0 group-hover/sec:opacity-100 transition-opacity" }, !isLocked ? [
                tag('button', { className: "p-1 hover:text-accent transition-colors", onclick: (e) => { e.stopPropagation(); editSectionName(sIndex); } }, [createLucideIcon('edit-2', 'w-3 h-3')]),
                tag('button', { className: "p-1 hover:text-red-400 transition-colors", onclick: (e) => { e.stopPropagation(); deleteSection(sIndex); } }, [createLucideIcon('trash-2', 'w-3 h-3')])
            ] : [])
        ]);

        const sectionDiv = tag('div', { className: "space-y-3 mb-6 section-container", "data-id": sIndex }, [sectionHeader, grid]);

        section.links.forEach((link, lIndex) => {
            const hostname = getSafeHostname(link.url) || 'link';
            const highResIcon = getHighResIcon(link.url);
            const iconUrl = link.iconType === 'custom' && link.iconUrl 
                ? link.iconUrl 
                : (highResIcon || `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`);

            const linkA = tag('a', {
                href: link.url,
                target: config.openInNewTab !== false ? "_blank" : "_self",
                className: "glass glass-card group/card w-full aspect-square flex items-center justify-center transition-all duration-300 hover:scale-[1.02] active:scale-95 border border-white/5 hover:border-accent/30 relative",
                style: `border-radius: ${config.iconBorderRadius ?? 12}px;`
            }, [
                tag('div', {
                    className: "flex items-center justify-center transition-transform group-hover/card:scale-110",
                }, [
                    tag('img', {
                        src: iconUrl,
                        className: "w-7 h-7 object-contain rounded-lg shadow-lg",
                        loading: "lazy",
                        onerror: (e) => {
                            const img = e.target;
                            if (!img.dataset.errorPhase) {
                                img.dataset.errorPhase = '1';
                                img.src = `https://www.google.com/s2/favicons?domain=${getSafeHostname(link.url) || 'link'}&sz=128`;
                            } else if (img.dataset.errorPhase === '1') {
                                img.dataset.errorPhase = '2';
                                img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
                            }
                        }
                    })
                ])
            ]);

            const linkItem = tag('div', { className: "relative group/item link-item", "data-id": lIndex }, [linkA]);

            if (!isLocked) {
                linkItem.appendChild(tag('button', {
                    className: "edit-link-btn absolute -right-1 -top-1 w-6 h-6 glass rounded-full opacity-0 group-hover/item:opacity-100 transition-all flex items-center justify-center text-slate-400 hover:text-white z-20 shadow-xl",
                    onclick: (e) => { e.preventDefault(); e.stopPropagation(); showLinkModal(sIndex, lIndex); }
                }, [createLucideIcon('edit-3', 'w-3 h-3')]));
            }
            grid.appendChild(linkItem);
        });

        if (!isLocked) {
            grid.appendChild(tag('button', {
                className: "glass glass-card w-full aspect-square flex items-center justify-center border-dashed border-white/10 hover:border-accent/50 transition-all group",
                style: `border-radius: ${config.iconBorderRadius ?? 12}px;`,
                onclick: () => showLinkModal(sIndex)
            }, [createLucideIcon('plus', 'w-6 h-6 text-slate-500 group-hover:text-accent transition-colors')]));
        }

        linksGrid.appendChild(sectionDiv);
        
        if (window.Sortable) {
            new window.Sortable(grid, {
                group: 'links', animation: 150, disabled: isLocked, draggable: '.link-item',
                onEnd: (evt) => {
                    const fromSIndex = parseInt(evt.from.id.replace('section-grid-', ''));
                    const toSIndex = parseInt(evt.to.id.replace('section-grid-', ''));
                    const link = config.sections[fromSIndex].links.splice(evt.oldIndex, 1)[0];
                    config.sections[toSIndex].links.splice(evt.newIndex, 0, link);
                    saveConfig();
                }
            });
        }
    });

    if (!isLocked && config.showGroups !== false) {
        linksGrid.appendChild(tag('div', { className: "pt-4 border-t border-white/5" }, [
            tag('button', {
                className: "w-full py-3 glass rounded-xl text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-accent hover:border-accent/20 transition-all flex items-center justify-center gap-2",
                onclick: () => {
                    const name = prompt("Szekció neve:");
                    if (name) { config.sections.push({ name, links: [], collapsed: false }); saveConfig(); renderLinks(); }
                }
            }, [createLucideIcon('folder-plus', 'w-4 h-4'), "Új Szekció"])
        ]));
    }

    if (window.Sortable) {
        new window.Sortable(linksGrid, {
            animation: 150, disabled: isLocked, handle: '.section-header', draggable: '.section-container',
            onEnd: () => {
                const newOrder = [];
                document.querySelectorAll('.section-container').forEach(el => newOrder.push(config.sections[parseInt(el.dataset.id)]));
                config.sections = newOrder;
                saveConfig();
                renderLinks();
            }
        });
    }
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Open the link editing modal
 */
export function showLinkModal(sIndex, lIndex = -1, customSelectRef = null) {
    editingSIndex = sIndex; editingLIndex = lIndex;
    if (customSelectRef) csIconType = customSelectRef;

    const modal = document.getElementById('link-modal');
    const link = lIndex > -1 ? config.sections[sIndex].links[lIndex] : { name: '', url: '', iconType: 'favicon', iconUrl: '' };

    document.getElementById('link-title-input').value = link.name;
    document.getElementById('link-url-input').value = link.url;
    document.getElementById('link-icon-url-input').value = link.iconUrl || '';
    
    const selectEl = document.getElementById('setting-icon-type');
    if (selectEl) {
        selectEl.value = link.iconType || 'favicon';
        if (selectEl.customSelect) {
            selectEl.customSelect.sync();
        }
    }
    
    document.getElementById('custom-icon-group').classList.toggle('hidden', (link.iconType || 'favicon') !== 'custom');
    
    if (csIconType) csIconType.sync();
    
    document.getElementById('delete-link-btn').classList.toggle('hidden', lIndex === -1);
    modal.classList.remove('hidden');
}

/**
 * Save link data from modal
 */
export function saveLink() {
    let name = document.getElementById('link-title-input').value.trim();
    let url = document.getElementById('link-url-input').value.trim();
    const iconType = document.getElementById('setting-icon-type').value;
    const iconUrl = document.getElementById('link-icon-url-input').value;

    if (!url) return alert('URL kötelező!');
    if (!url.startsWith('http')) url = 'https://' + url;
    if (!name) name = new URL(url).hostname.replace(/^www\./, '').split('.')[0];

    const linkData = { name, url, iconType, iconUrl };
    if (editingLIndex > -1) config.sections[editingSIndex].links[editingLIndex] = linkData;
    else config.sections[editingSIndex].links.push(linkData);

    saveConfig(); 
    renderLinks(); 
    closeLinkModal();
}

/**
 * Close the link modal
 */
export function closeLinkModal() { 
    document.getElementById('link-modal').classList.add('hidden'); 
}

/**
 * Delete a link
 */
export function deleteLink() {
    if (editingLIndex > -1) { 
        config.sections[editingSIndex].links.splice(editingLIndex, 1); 
        saveConfig(); 
        renderLinks(); 
        closeLinkModal(); 
    }
}

/**
 * Edit section name
 */
export function editSectionName(index) {
    const newName = prompt("Új név:", config.sections[index].name);
    if (newName) { config.sections[index].name = newName; saveConfig(); renderLinks(); }
}

/**
 * Delete an entire section
 */
export function deleteSection(index) {
    if (confirm(`Biztosan törlöd a(z) "${config.sections[index].name}" szekciót?`)) {
        config.sections.splice(index, 1); saveConfig(); renderLinks();
    }
}
