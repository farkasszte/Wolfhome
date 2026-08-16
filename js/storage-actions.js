/**
 * WolfHome Storage Actions
 */
import { config, saveConfig, IMAGE_KEYS } from './config.js';
import { extAPI, tag } from './utils.js';

/**
 * Check if running in a proper extension environment
 */
export function checkExtensionEnvironment() {
    if (!extAPI || !extAPI.runtime || !extAPI.runtime.id) {
        const warning = tag('div', { 
            className: "fixed bottom-4 right-4 bg-red-600 text-white px-6 py-3 rounded-xl shadow-2xl text-xs font-bold animate-pulse z-[100]", 
            textContent: "FIGYELEM: A naptár és szinkronizáció csak kiegészítőként betöltve működik!" 
        });
        document.body.appendChild(warning);
    }
}

/**
 * Export current configuration to a JSON file
 */
export function exportConfig() {
    // Exclude large image data from export to keep the backup file small
    const exportData = { ...config };
    IMAGE_KEYS.forEach(key => delete exportData[key]);
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = `wolfhome_backup_${new Date().toISOString().split('T')[0]}.json`; 
    a.click(); 
    URL.revokeObjectURL(url);
}

/**
 * Import configuration from a JSON file
 */
export function importConfig(e) {
    const file = e.target.files[0]; 
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            if (imported.sections && confirm("Feltöltöd a mentést?")) { 
                Object.assign(config, imported);
                saveConfig(); 
                location.reload(); 
            }
        } catch (error) { 
            alert("Hiba: " + error.message); 
        }
    };
    reader.readAsText(file);
}
