// Tailwind Configuration
if (typeof tailwind !== 'undefined') {
    tailwind.config = {
        darkMode: 'class',
        theme: {
            extend: {
                colors: {
                    accent: 'var(--accent)',
                }
            }
        }
    }
}

// Theme Lock (Ensures dark mode is always on)
function lockTheme() {
    if (!document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.add('dark');
    }
}
setInterval(lockTheme, 100);
lockTheme();
