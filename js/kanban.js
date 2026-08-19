/**
 * WolfHome Kanban Module
 */
import { config, saveConfig } from './config.js';
import { tag, createLucideIcon } from './utils.js';

/**
 * Render the Kanban board columns and cards
 */
let activeEditingCardId = null;
let activeEditingColId = 'todo';
let kanbanFilterQuery = '';

export function setKanbanSearchQuery(query) {
    kanbanFilterQuery = (query || '').toLowerCase().trim();
    renderKanban();
}

const PRIORITY_CONFIG = {
    high: { label: 'Sürgős', badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    medium: { label: 'Közepes', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    low: { label: 'Alacsony', badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    none: { label: 'Nincs', badgeClass: 'hidden' }
};

/**
 * Render the Kanban board columns and cards
 */
export function renderKanban() {
    const cols = ['todo', 'progress', 'done'];
    cols.forEach(colId => {
        const container = document.getElementById(`kanban-${colId}`);
        const countEl = document.getElementById(`kanban-${colId}-count`);
        if (!container) return;
        container.innerHTML = '';

        const allCards = config.kanban[colId] || [];
        const cards = kanbanFilterQuery 
            ? allCards.filter(c => (c.text || '').toLowerCase().includes(kanbanFilterQuery))
            : allCards;

        if (countEl) {
            countEl.textContent = kanbanFilterQuery ? `${cards.length}/${allCards.length}` : allCards.length;
        }

        cards.forEach(card => {
            const priority = card.priority || 'none';
            const pConf = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.none;

            const priorityBadge = priority !== 'none' ? tag('span', {
                className: `text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${pConf.badgeClass}`,
                textContent: pConf.label
            }) : null;

            const el = tag('div', {
                className: "kanban-item group cursor-grab active:cursor-grabbing space-y-2",
                id: `kanban-card-${card.id}`
            }, [
                tag('div', { className: "flex justify-between items-start gap-2" }, [
                    tag('p', { className: "text-sm text-slate-200 leading-relaxed break-words flex-1", textContent: card.text }),
                    tag('div', { className: "flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" }, [
                        tag('button', {
                            className: "p-1 hover:text-accent transition-colors cursor-pointer",
                            title: "Szerkesztés",
                            onclick: (e) => { e.stopPropagation(); openKanbanModal(card.id, colId); }
                        }, [createLucideIcon('edit-2', 'w-3.5 h-3.5')]),
                        tag('button', {
                            className: "p-1 hover:text-red-400 transition-colors cursor-pointer",
                            title: "Törlés",
                            onclick: (e) => { e.stopPropagation(); deleteKanbanCard(card.id, colId); }
                        }, [createLucideIcon('trash-2', 'w-3.5 h-3.5')])
                    ])
                ]),
                priorityBadge ? tag('div', { className: "flex items-center pt-1" }, [priorityBadge]) : null
            ].filter(Boolean));

            container.appendChild(el);
        });

        // Initialize Sortable for each column
        if (window.Sortable) {
            new window.Sortable(container, {
                group: 'kanban',
                animation: 150,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                onEnd: (evt) => {
                    const fromCol = evt.from.id.replace('kanban-', '');
                    const toCol = evt.to.id.replace('kanban-', '');
                    const cardId = evt.item.id.replace('kanban-card-', '');

                    // Move card in data
                    const cardIndex = config.kanban[fromCol].findIndex(c => c.id === cardId);
                    if (cardIndex > -1) {
                        const [card] = config.kanban[fromCol].splice(cardIndex, 1);
                        config.kanban[toCol].splice(evt.newIndex, 0, card);
                        saveConfig();
                        updateKanbanCounters();
                    }
                }
            });
        }
    });
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Update Kanban column card count badges
 */
export function updateKanbanCounters() {
    ['todo', 'progress', 'done'].forEach(colId => {
        const countEl = document.getElementById(`kanban-${colId}-count`);
        if (countEl) {
            countEl.textContent = (config.kanban[colId] || []).length;
        }
    });
}

/**
 * Open the Kanban add/edit modal
 */
export function openKanbanModal(cardId = null, colId = 'todo') {
    activeEditingCardId = cardId;
    activeEditingColId = colId;

    const modal = document.getElementById('kanban-modal');
    const textInput = document.getElementById('kanban-card-text');
    const deleteBtn = document.getElementById('delete-kanban-modal-btn');
    const titleEl = document.getElementById('kanban-modal-title');

    let currentText = '';
    let currentPriority = 'none';

    if (cardId) {
        const card = (config.kanban[colId] || []).find(c => c.id === cardId);
        if (card) {
            currentText = card.text || '';
            currentPriority = card.priority || 'none';
        }
        if (titleEl) titleEl.textContent = 'Feladat szerkesztése';
        if (deleteBtn) deleteBtn.classList.remove('hidden');
    } else {
        if (titleEl) titleEl.textContent = 'Új feladat hozzáadása';
        if (deleteBtn) deleteBtn.classList.add('hidden');
    }

    if (textInput) {
        textInput.value = currentText;
        setTimeout(() => textInput.focus(), 50);
    }

    // Set priority radios/buttons
    document.querySelectorAll('.kanban-priority-option').forEach(opt => {
        const val = opt.dataset.priority;
        opt.classList.toggle('active-priority', val === currentPriority);
    });

    const priorityInput = document.getElementById('kanban-selected-priority');
    if (priorityInput) priorityInput.value = currentPriority;

    if (modal) modal.classList.remove('hidden');
}

/**
 * Save Kanban modal data
 */
export function saveKanbanModal() {
    const textInput = document.getElementById('kanban-card-text');
    const priorityInput = document.getElementById('kanban-selected-priority');
    const text = textInput ? textInput.value.trim() : '';
    const priority = priorityInput ? priorityInput.value : 'none';

    if (!text) {
        alert("Kérlek adj meg egy feladat leírást!");
        return;
    }

    if (activeEditingCardId) {
        const card = (config.kanban[activeEditingColId] || []).find(c => c.id === activeEditingCardId);
        if (card) {
            card.text = text;
            card.priority = priority;
        }
    } else {
        if (!config.kanban.todo) config.kanban.todo = [];
        config.kanban.todo.push({
            id: Date.now().toString(),
            text,
            priority
        });
    }

    saveConfig();
    renderKanban();
    closeKanbanModal();
}

/**
 * Close the Kanban modal
 */
export function closeKanbanModal() {
    const modal = document.getElementById('kanban-modal');
    if (modal) modal.classList.add('hidden');
    activeEditingCardId = null;
}

/**
 * Delete a Kanban card
 */
export function deleteKanbanCard(cardId, colId) {
    if (confirm("Biztosan törlöd ezt a feladatot?")) {
        config.kanban[colId] = config.kanban[colId].filter(c => c.id !== cardId);
        saveConfig();
        renderKanban();
        closeKanbanModal();
    }
}

