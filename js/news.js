/**
 * WolfHome News Module
 */
import { config, saveConfig } from './config.js';
import { tag, createLucideIcon } from './utils.js';

/**
 * Fetch news from RSS feeds
 */
export async function fetchNews() {
    const grid = document.getElementById('news-grid');
    if (!grid) return;

    // Show loading state
    grid.innerHTML = '';
    grid.appendChild(tag('div', { className: 'col-span-full flex flex-col items-center justify-center h-64 text-slate-500 space-y-4 opacity-40 animate-pulse' }, [
        createLucideIcon('newspaper', 'w-16 h-16'),
        tag('p', { className: 'text-sm font-light uppercase tracking-widest', textContent: 'Hírek frissítése...' })
    ]));
    if (window.lucide) window.lucide.createIcons();

    let allArticles = [];
    const feeds = config.newsFeeds || [];

    try {
        const promises = feeds.map(feed =>
            fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'ok') {
                        return data.items.map(item => ({
                            ...item,
                            source: feed.name,
                            timestamp: new Date(item.pubDate).getTime()
                        }));
                    }
                    return [];
                })
                .catch(() => [])
        );

        const results = await Promise.all(promises);
        allArticles = results.flat().sort((a, b) => b.timestamp - a.timestamp);

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

        const closedLinks = closed.map(item => item.link);
        const filteredArticles = allArticles.filter(item => !closedLinks.includes(item.link));

        const count = config.newsCount || 15;
        renderNews(filteredArticles.slice(0, count));
    } catch (e) {
        grid.innerHTML = '';
        grid.appendChild(tag('p', { className: 'col-span-full text-center text-slate-500 py-10', textContent: 'Hiba történt a hírek betöltésekor.' }));
    }
}

/**
 * Render news articles to the grid
 */
export function renderNews(articles) {
    const grid = document.getElementById('news-grid');
    if (!grid || !articles.length) return;

    grid.textContent = '';
    articles.forEach(article => {
        const dateStr = new Date(article.timestamp).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

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
                    loading: 'lazy'
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
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Render news feed list in settings
 */
export function renderNewsFeedsSettings() {
    const list = document.getElementById('news-feeds-list');
    if (!list) return;
    list.innerHTML = '';

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
                    fetchNews();
                }
            }, [createLucideIcon('trash-2', 'w-3 h-3')])
        ]);
        list.appendChild(item);
    });
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Hide an article and save to configuration
 */
export function hideArticle(link) {
    if (!config.closedNews) {
        config.closedNews = [];
    }
    const closedLinks = config.closedNews.map(item => typeof item === 'string' ? item : item.link);
    if (!closedLinks.includes(link)) {
        config.closedNews.push({ link, timestamp: Date.now() });
        saveConfig();
        fetchNews();
        updateRestoreNewsVisibility();
    }
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
