/**
 * WolfHome Utility Functions
 */

export const extAPI = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);

/**
 * Helper to create Lucide icons
 */
export function createLucideIcon(iconName, classes = "") {
    const i = document.createElement('i');
    i.setAttribute('data-lucide', iconName);
    if (classes) i.className = classes;
    return i;
}

/**
 * Helper for safe DOM manipulation via tag generation
 */
export function tag(name, attrs = {}, children = []) {
    const el = document.createElement(name);
    for (const [key, val] of Object.entries(attrs)) {
        if (key === 'className') el.className = val;
        else if (key === 'textContent') el.textContent = val;
        else if (key.startsWith('on') && typeof val === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), val);
        } else {
            el.setAttribute(key, val);
        }
    }
    for (const child of children) {
        if (typeof child === 'string') el.appendChild(document.createTextNode(child));
        else if (child) el.appendChild(child);
    }
    return el;
}

/**
 * Compress image using Canvas to fit within localStorage and load quickly
 */
export function compressImage(dataUrl, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
            resolve(dataUrl);
        };
        img.src = dataUrl;
    });
}

