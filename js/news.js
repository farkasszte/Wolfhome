/**
 * WolfHome News Module
 */
import { config, saveConfig } from './config.js';
import { tag, createLucideIcon, refreshLucideIcons, extAPI, sendExtensionMessage } from './utils.js';

let cachedNewsArticles = null;

/**
 * Safely decodes HTML entities in text
 */
function decodeHtmlEntities(str) {
    if (!str || !str.includes('&')) return str || '';
    try {
        const doc = new DOMParser().parseFromString(str, 'text/html');
        return doc.documentElement.textContent || '';
    } catch {
        return str
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'");
    }
}

/**
 * Format article publication date
 */
function formatArticleDate(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
        return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('hu-HU', { month: '2-digit', day: '2-digit' }) + ' ' +
           d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Parse raw RSS / Atom XML string into article objects
 */
export function parseFeedXml(xmlText, feed) {
    if (!xmlText || typeof xmlText !== 'string') return [];

    let doc;
    try {
        const parser = new DOMParser();
        doc = parser.parseFromString(xmlText, 'text/xml');
        if (doc.querySelector('parsererror')) {
            // Sanitize unescaped ampersands which frequently break XML parsers
            const sanitized = xmlText.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
            doc = parser.parseFromString(sanitized, 'text/xml');
        }
    } catch (e) {
        console.warn('[News] XML értelmezési hiba:', e);
        return [];
    }

    if (!doc || doc.querySelector('parsererror')) {
        console.warn('[News] Érvénytelen RSS/Atom XML formátum:', feed?.url);
        return [];
    }

    // Detect RSS vs Atom
    let items = Array.from(doc.querySelectorAll('item'));
    const isAtom = items.length === 0 && doc.querySelectorAll('entry').length > 0;
    if (isAtom) {
        items = Array.from(doc.querySelectorAll('entry'));
    }

    const defaultSource = feed?.name || doc.querySelector('channel > title, feed > title')?.textContent?.trim() || 'Hírek';

    return items.map(item => {
        // 1. Title
        const rawTitle = item.querySelector('title')?.textContent || '';
        const title = decodeHtmlEntities(rawTitle.trim());

        // 2. Link
        let link = '';
        if (isAtom) {
            const linkEl = item.querySelector('link[rel="alternate"]') || item.querySelector('link');
            link = linkEl?.getAttribute('href') || linkEl?.textContent?.trim() || '';
        } else {
            const linkEl = item.querySelector('link');
            link = linkEl?.textContent?.trim() || linkEl?.getAttribute('href') || '';
        }
        if (!link) {
            const guidEl = item.querySelector('guid, id');
            const guid = guidEl?.textContent?.trim() || '';
            if (guid.startsWith('http')) link = guid;
        }

        // 3. Date & Timestamp
        const dateStr = item.querySelector('pubDate, published, updated, dc\\:date, date')?.textContent?.trim() || '';
        let timestamp = dateStr ? new Date(dateStr).getTime() : Date.now();
        if (isNaN(timestamp)) timestamp = Date.now();

        // 4. Description & Content
        const descEl = item.querySelector('description, summary');
        const description = descEl?.textContent?.trim() || '';
        const contentEl = item.getElementsByTagName('content:encoded')[0] || 
                          item.getElementsByTagNameNS('*', 'encoded')[0] || 
                          item.querySelector('content');
        const content = contentEl?.textContent?.trim() || '';

        // 5. Image extraction
        let imageUrl = '';
        // 5a. Enclosure tag
        const enclosures = item.querySelectorAll('enclosure');
        for (const enc of enclosures) {
            const u = enc.getAttribute('url') || enc.getAttribute('thumbnail');
            const type = enc.getAttribute('type') || '';
            if (u && (type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif)/i.test(u) || !type)) {
                imageUrl = u;
                break;
            }
        }
        // 5b. Media tags (content, thumbnail)
        if (!imageUrl) {
            const mediaEls = [
                ...Array.from(item.getElementsByTagName('media:content')),
                ...Array.from(item.getElementsByTagNameNS('*', 'content')),
                ...Array.from(item.getElementsByTagName('media:thumbnail')),
                ...Array.from(item.getElementsByTagNameNS('*', 'thumbnail'))
            ];
            for (const media of mediaEls) {
                const u = media.getAttribute('url');
                const medium = media.getAttribute('medium');
                const type = media.getAttribute('type') || '';
                if (u && (medium === 'image' || type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif)/i.test(u) || (!medium && !type))) {
                    imageUrl = u;
                    break;
                }
            }
        }
        // 5c. Itunes image or generic image tags
        if (!imageUrl) {
            const itunesImg = item.getElementsByTagName('itunes:image')[0] || item.getElementsByTagNameNS('*', 'image')[0];
            const href = itunesImg?.getAttribute('href') || itunesImg?.getAttribute('url');
            if (href) imageUrl = href;
        }
        // 5d. img tags in HTML content / description
        if (!imageUrl) {
            const combinedHtml = (description || '') + ' ' + (content || '');
            const imgMatch = combinedHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
            if (imgMatch && imgMatch[1]) {
                imageUrl = imgMatch[1];
            }
        }

        return {
            title,
            link,
            pubDate: dateStr,
            timestamp,
            description,
            content,
            thumbnail: imageUrl,
            enclosure: imageUrl ? { link: imageUrl } : null,
            source: defaultSource
        };
    }).filter(article => article.title && article.link);
}

/**
 * Fetch raw feed XML with multiple fallbacks:
 * 1. Extension background message (bypasses CORS in browser extension)
 * 2. Direct fetch with timeout (fastest if CORS allowed or in extension page)
 * 3. Public CORS proxies (fallback for standalone / dev web testing)
 */
async function fetchFeedText(url) {
    // 1. Try extension background worker first (bypasses CORS in browser extension)
    try {
        const response = await sendExtensionMessage({ action: 'fetchFeed', url });
        if (response && response.success && response.text) {
            return response.text;
        }
        if (response && response.error) {
            console.warn(`[News] Háttér lekérési hiba (${url}):`, response.error);
        }
    } catch (extErr) {
        console.warn(`[News] Háttér lekérés meghiúsult (${url}):`, extErr.message);
    }

    // 2. Direct fetch with timeout (fallback for open CORS feeds or standalone)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            const text = await res.text();
            if (text && text.trim().length > 0) return text;
        }
    } catch (directErr) {
        console.warn(`[News] Közvetlen fetch sikertelen (${url}):`, directErr.message);
    }

    throw new Error(`Nem sikerült betölteni a hírforrást: ${url}`);
}

/**
 * Filter and render articles using current configuration
 */
function filterAndRenderArticles() {
    if (!cachedNewsArticles) return;

    const ONE_DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    let closed = config.closedNews || [];

    // Migrate legacy formats and filter out items older than 24h
    closed = closed.map(item => {
        if (typeof item === 'string') {
            return { link: item, timestamp: now };
        }
        return item;
    }).filter(item => (now - item.timestamp) < ONE_DAY);

    config.closedNews = closed;
    saveConfig();

    const closedSet = new Set(closed.map(item => item.link));
    const filteredArticles = cachedNewsArticles.filter(item => !closedSet.has(item.link));

    const count = config.newsCount || 15;
    renderNews(filteredArticles.slice(0, count));
}

/**
 * Fetch news from RSS feeds
 */
export async function fetchNews(forceRefresh = false) {
    const grid = document.getElementById('news-grid');
    if (!grid) return;

    // Use cached articles if already available and not forced
    if (cachedNewsArticles && !forceRefresh) {
        filterAndRenderArticles();
        return;
    }

    // Show loading state
    grid.replaceChildren();
    grid.appendChild(tag('div', { className: 'col-span-full flex flex-col items-center justify-center h-64 text-slate-500 space-y-4 opacity-40 animate-pulse' }, [
        createLucideIcon('newspaper', 'w-16 h-16'),
        tag('p', { className: 'text-sm font-light uppercase tracking-widest', textContent: 'Hírek frissítése...' })
    ]));
    refreshLucideIcons();

    const feeds = config.newsFeeds || [];
    if (!feeds.length) {
        grid.replaceChildren();
        grid.appendChild(tag('p', { className: 'col-span-full text-center text-slate-500 py-10', textContent: 'Nincsenek beállított hírforrások.' }));
        return;
    }

    try {
        const promises = feeds.map(async feed => {
            try {
                const xmlText = await fetchFeedText(feed.url);
                return parseFeedXml(xmlText, feed);
            } catch (err) {
                console.warn(`[News] Hiba a hírforrás betöltésekor (${feed.name || feed.url}):`, err.message);
                return [];
            }
        });

        const results = await Promise.allSettled(promises);
        const articles = results
            .filter(r => r.status === 'fulfilled')
            .flatMap(r => r.value);

        cachedNewsArticles = articles.sort((a, b) => b.timestamp - a.timestamp);
        filterAndRenderArticles();
    } catch (e) {
        console.error('[News] Hiba történt a hírek betöltésekor:', e);
        grid.replaceChildren();
        grid.appendChild(tag('p', { className: 'col-span-full text-center text-slate-500 py-10', textContent: 'Hiba történt a hírek betöltésekor.' }));
    }
}

/**
 * Render news articles to the grid
 */
export function renderNews(articles) {
    const grid = document.getElementById('news-grid');
    if (!grid) return;

    grid.replaceChildren();

    if (!articles || !articles.length) {
        grid.appendChild(tag('div', { className: 'col-span-full flex flex-col items-center justify-center py-16 text-slate-500 space-y-2' }, [
            createLucideIcon('inbox', 'w-10 h-10 opacity-40'),
            tag('p', { className: 'text-sm font-medium', textContent: 'Nincsenek megjeleníthető hírek.' })
        ]));
        refreshLucideIcons();
        return;
    }

    articles.forEach(article => {
        const dateStr = formatArticleDate(article.timestamp);

        // Smarter image extraction
        let imageUrl = article.enclosure?.link || article.thumbnail;
        if (!imageUrl && config.showNewsImages !== false) {
            const html = (article.description || '') + (article.content || '');
            const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
            if (imgMatch && imgMatch[1]) imageUrl = imgMatch[1];
        }

        const closeBtn = tag('button', {
            className: 'absolute top-3 right-3 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-black/45 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border border-white/5 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200',
            title: 'Hír elrejtése',
            onclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                hideArticle(article.link);
            }
        }, [
            createLucideIcon('x', 'w-3 h-3')
        ]);

        const card = tag('a', {
            href: article.link,
            target: '_blank',
            className: 'news-card group relative'
        }, [
            closeBtn,
            (config.showNewsImages !== false && imageUrl) ?
                tag('img', {
                    src: imageUrl,
                    className: 'news-card-img',
                    loading: 'lazy',
                    onerror: (e) => { e.target.style.display = 'none'; }
                }) :
                (config.showNewsImages !== false ? tag('div', { className: 'news-card-img flex items-center justify-center opacity-20' }, [
                    createLucideIcon('image', 'w-8 h-8')
                ]) : null),
            tag('div', { className: 'news-card-content' }, [
                tag('div', { className: 'flex justify-between items-baseline mb-3' }, [
                    tag('span', { className: 'news-card-source !mb-0', textContent: article.source }),
                    tag('span', { className: 'text-xs text-slate-500 font-medium tracking-wide', textContent: dateStr })
                ]),
                tag('h4', { className: 'news-card-title !mb-0', textContent: article.title })
            ])
        ]);
        grid.appendChild(card);
    });
    refreshLucideIcons();
}

/**
 * Render news feed list in settings
 */
export function renderNewsFeedsSettings() {
    const list = document.getElementById('news-feeds-list');
    if (!list) return;
    list.replaceChildren();

    const feeds = config.newsFeeds || [];
    feeds.forEach((feed, index) => {
        const item = tag('div', { className: 'flex items-center justify-between p-2 bg-white/5 rounded-xl border border-white/5' }, [
            tag('div', { className: 'flex flex-col' }, [
                tag('span', { className: 'text-sm font-bold text-white', textContent: feed.name }),
                tag('span', { className: 'text-xs text-slate-500 truncate max-w-[180px]', textContent: feed.url })
            ]),
            tag('button', {
                className: 'p-1 hover:text-red-400 transition-colors',
                onclick: () => {
                    config.newsFeeds.splice(index, 1);
                    saveConfig();
                    renderNewsFeedsSettings();
                    cachedNewsArticles = null;
                    fetchNews(true);
                }
            }, [createLucideIcon('trash-2', 'w-3 h-3')])
        ]);
        list.appendChild(item);
    });
    refreshLucideIcons();
}

/**
 * Hide an article and save to configuration (uses memory cache to avoid network request)
 */
export function hideArticle(link) {
    if (!config.closedNews) {
        config.closedNews = [];
    }
    const closedLinks = config.closedNews.map(item => typeof item === 'string' ? item : item.link);
    if (!closedLinks.includes(link)) {
        config.closedNews.push({ link, timestamp: Date.now() });
        saveConfig();
        filterAndRenderArticles();
        updateRestoreNewsVisibility();
    }
}

/**
 * Clear cached news articles when feeds or settings change
 */
export function invalidateNewsCache() {
    cachedNewsArticles = null;
}

/**
 * Update visibility of the restore button based on closed articles
 */
export function updateRestoreNewsVisibility() {
    const container = document.getElementById('setting-restore-news-container');
    if (!container) return;
    
    const count = (config.closedNews || []).length;
    if (count > 0) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}
