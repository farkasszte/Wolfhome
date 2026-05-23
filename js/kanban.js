/**
 * WolfHome Kanban Module
 */
import { config, saveConfig } from './config.js';
import { tag, createLucideIcon } from './utils.js';

/**
 * Render the Kanban board columns and cards
 */
export function renderKanban() {
    const cols = ['todo', 'progress', 'done'];
    cols.forEach(colId => {
        const container = document.getElementById(`kanban-${colId}`);
        if (!container) return;
        container.innerHTML = '';

        const cards = config.kanban[colId] || [];
        cards.forEach(card => {
            const el = tag('div', {
                className: "kanban-item group",
                id: `kanban-card-${card.id}`
            }, [
                tag('div', { className: "flex justify-between items-start gap-2" }, [
                    tag('p', { className: "text-sm text-slate-200 leading-relaxed", textContent: card.text }),
                    tag('div', { className: "flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" }, [
                        tag('button', {
                            className: "p-1 hover:text-accent transition-colors",
                            onclick: (e) => { e.stopPropagation(); editKanbanCard(card.id, colId); }
                        }, [createLucideIcon('edit-2', 'w-3 h-3')]),
                        tag('button', {
                            className: "p-1 hover:text-red-400 transition-colors",
                            onclick: (e) => { e.stopPropagation(); deleteKanbanCard(card.id, colId); }
                        }, [createLucideIcon('trash-2', 'w-3 h-3')])
                    ])
                ])
            ]);
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
                    }
                }
            });
        }
    });
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Edit a Kanban card's text
 */
export function editKanbanCard(cardId, colId) {
    const card = config.kanban[colId].find(c => c.id === cardId);
    if (!card) return;
    const newText = prompt("Szerkesztés:", card.text);
    if (newText !== null && newText.trim() !== "") {
        card.text = newText.trim();
        saveConfig();
        renderKanban();
    }
}

/**
 * Delete a Kanban card
 */
export function deleteKanbanCard(cardId, colId) {
    if (confirm("Biztosan törlöd ezt a feladatot?")) {
        config.kanban[colId] = config.kanban[colId].filter(c => c.id !== cardId);
        saveConfig();
        renderKanban();
    }
}
