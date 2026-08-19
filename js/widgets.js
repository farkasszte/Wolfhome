/**
 * WolfHome Widgets Module
 */
import { config } from './config.js';
import { createLucideIcon, tag } from './utils.js';
import { namedayDB, getNameday } from './nameday-db.js';

let lastDateKey = '';

/**
 * Update the clock and date display
 */
export function updateTime() {
    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');
    if (!clockEl || !dateEl) return;

    const now = new Date();
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    if (lastDateKey && lastDateKey !== dateKey) {
        // Date changed while the page was running (e.g. past midnight)
        updateNameday();
        window.dispatchEvent(new CustomEvent('wolfhome:daychange', { detail: { date: now } }));
    }
    lastDateKey = dateKey;

    const options = { hour: '2-digit', minute: '2-digit', hour12: false };
    if (config.showSeconds !== false) options.second = '2-digit';
    
    clockEl.textContent = now.toLocaleTimeString('hu-HU', options);
    dateEl.textContent = now.toLocaleDateString('hu-HU', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        weekday: 'long' 
    });
}

/**
 * Update the nameday display
 */
export async function updateNameday() {
    const namedayEl = document.getElementById('nameday');
    if (!namedayEl) return;

    const now = new Date();
    const localName = getNameday(now.getMonth(), now.getDate(), now.getFullYear());
    if (localName) {
        namedayEl.textContent = localName;
    }

    try {
        const response = await fetch('https://nameday.abalin.net/api/V2/today?country=hu&timezone=Europe/Budapest');
        const data = await response.json();
        if (data && data.success && data.data && data.data.hu) {
            namedayEl.textContent = data.data.hu;
            return;
        }
    } catch (e) {
        console.warn("Abalin API nem elérhető, helyi adatbázis aktív:", e);
    }
}

const WEATHER_TRANSLATIONS = {
    // WWO codes
    113: 'Derült, napos',
    116: 'Változóan felhős',
    119: 'Felhős',
    122: 'Borult',
    143: 'Párás',
    176: 'Helyenként eső',
    179: 'Helyenként havazás',
    182: 'Helyenként havas eső',
    185: 'Helyenként ónos szitálás',
    200: 'Zivatar lehetséges',
    227: 'Hófúvás',
    230: 'Hóvihar',
    248: 'Köd',
    260: 'Fagyos köd',
    263: 'Helyenként szitálás',
    266: 'Gyenge szitálás',
    281: 'Ónos szitálás',
    284: 'Erős ónos szitálás',
    293: 'Helyenként gyenge eső',
    296: 'Gyenge eső',
    299: 'Időnként mérsékelt eső',
    302: 'Mérsékelt eső',
    305: 'Időnként heves eső',
    308: 'Heves esőzés',
    311: 'Gyenge ónos eső',
    314: 'Mérsékelt vagy heves ónos eső',
    317: 'Gyenge havas eső',
    320: 'Mérsékelt vagy heves havas eső',
    323: 'Helyenként gyenge havazás',
    326: 'Gyenge havazás',
    329: 'Helyenként mérsékelt havazás',
    332: 'Mérsékelt havazás',
    335: 'Helyenként heves havazás',
    338: 'Heves havazás',
    350: 'Jégdara',
    353: 'Gyenge zápor',
    356: 'Záporeső',
    359: 'Felhőszakadás',
    362: 'Gyenge havas zápor',
    365: 'Havas zápor',
    368: 'Gyenge hózápor',
    371: 'Hózápor',
    374: 'Gyenge jégdara zápor',
    377: 'Jégdara zápor',
    386: 'Helyenként zivatar',
    389: 'Zivatar, viharos eső',
    392: 'Helyenként hózivatar',
    395: 'Heves hózivatar',

    // WMO standard codes
    0: 'Derült égbolt',
    1: 'Túlnyomóan derült',
    2: 'Változóan felhős',
    3: 'Borult',
    45: 'Köd',
    48: 'Zúzmarás köd',
    51: 'Gyenge szitálás',
    53: 'Mérsékelt szitálás',
    55: 'Sűrű szitálás',
    56: 'Gyenge ónos szitálás',
    57: 'Sűrű ónos szitálás',
    61: 'Gyenge eső',
    63: 'Mérsékelt eső',
    65: 'Heves eső',
    66: 'Gyenge ónos eső',
    67: 'Heves ónos eső',
    71: 'Gyenge havazás',
    73: 'Mérsékelt havazás',
    75: 'Heves havazás',
    77: 'Hószemcsék',
    80: 'Gyenge zápor',
    81: 'Mérsékelt zápor',
    82: 'Heves zápor',
    85: 'Gyenge hózápor',
    86: 'Heves hózápor',
    95: 'Zivatar',
    96: 'Zivatar jégdarával',
    99: 'Heves zivatar jégdarával'
};

const WEATHER_TEXT_TRANSLATIONS = {
    'clear': 'Derült, tiszta',
    'sunny': 'Napos',
    'partly cloudy': 'Változóan felhős',
    'cloudy': 'Felhős',
    'overcast': 'Borult',
    'mist': 'Párás',
    'fog': 'Köd',
    'freezing fog': 'Fagyos köd',
    'patchy rain possible': 'Helyenként eső lehetséges',
    'patchy rain nearby': 'Helyenként eső a közelben',
    'patchy snow possible': 'Helyenként havazás lehetséges',
    'patchy snow nearby': 'Helyenként havazás a közelben',
    'patchy sleet possible': 'Helyenként havas eső lehetséges',
    'patchy sleet nearby': 'Helyenként havas eső a közelben',
    'patchy freezing drizzle possible': 'Helyenként ónos szitálás lehetséges',
    'patchy freezing drizzle nearby': 'Helyenként ónos szitálás a közelben',
    'thundery outbreaks possible': 'Zivatar lehetséges',
    'thundery outbreaks nearby': 'Zivatar a közelben',
    'blowing snow': 'Hófúvás',
    'blizzard': 'Hóvihar',
    'patchy light drizzle': 'Helyenként gyenge szitálás',
    'light drizzle': 'Gyenge szitálás',
    'freezing drizzle': 'Ónos szitálás',
    'heavy freezing drizzle': 'Erős ónos szitálás',
    'patchy light rain': 'Helyenként gyenge eső',
    'light rain': 'Gyenge eső',
    'moderate rain at times': 'Időnként mérsékelt eső',
    'moderate rain': 'Mérsékelt eső',
    'heavy rain at times': 'Időnként heves eső',
    'heavy rain': 'Heves esőzés',
    'light freezing rain': 'Gyenge ónos eső',
    'moderate or heavy freezing rain': 'Mérsékelt vagy heves ónos eső',
    'light sleet': 'Gyenge havas eső',
    'moderate or heavy sleet': 'Mérsékelt vagy heves havas eső',
    'patchy light snow': 'Helyenként gyenge havazás',
    'light snow': 'Gyenge havazás',
    'patchy moderate snow': 'Helyenként mérsékelt havazás',
    'moderate snow': 'Mérsékelt havazás',
    'patchy heavy snow': 'Helyenként heves havazás',
    'heavy snow': 'Heves havazás',
    'ice pellets': 'Jégdara',
    'light rain shower': 'Gyenge zápor',
    'moderate or heavy rain shower': 'Záporeső',
    'torrential rain shower': 'Felhőszakadás',
    'light sleet showers': 'Gyenge havas zápor',
    'moderate or heavy sleet showers': 'Havas zápor',
    'light snow showers': 'Gyenge hózápor',
    'moderate or heavy snow showers': 'Hózápor',
    'light showers of ice pellets': 'Gyenge jégdara zápor',
    'moderate or heavy showers of ice pellets': 'Jégdara zápor',
    'patchy light rain with thunder': 'Helyenként zivatar',
    'moderate or heavy rain with thunder': 'Zivatar, viharos eső',
    'patchy light snow with thunder': 'Helyenként hózivatar',
    'moderate or heavy snow with thunder': 'Heves hózivatar'
};

export function getWeatherDescription(item) {
    if (!item) return '';
    const code = parseInt(item.weatherCode, 10);
    const huFromApi = item.lang_hu?.[0]?.value?.trim();
    const enDesc = item.weatherDesc?.[0]?.value?.trim() || '';

    // Prefer code mapping for uniform, accurate Hungarian names
    if (!isNaN(code) && WEATHER_TRANSLATIONS[code]) {
        return WEATHER_TRANSLATIONS[code];
    }

    // Check english text translation mapping
    const rawText = (huFromApi || enDesc).toLowerCase().trim();
    if (rawText && WEATHER_TEXT_TRANSLATIONS[rawText]) {
        return WEATHER_TEXT_TRANSLATIONS[rawText];
    }

    // Check if API provided Hungarian text that is not identical to English
    if (huFromApi && huFromApi !== enDesc) {
        return huFromApi;
    }

    return enDesc || huFromApi || 'Változékony';
}

export function getWeatherIconName(code) {
    const c = parseInt(code, 10);
    if (c === 113 || c === 0 || c === 1) return 'sun';
    if (c === 116 || c === 2) return 'cloud-sun';
    if (c === 119 || c === 122 || c === 3) return 'cloud';
    if ([143, 248, 260, 45, 48].includes(c)) return 'cloud-fog';
    if ([176, 263, 266, 293, 296, 299, 302, 305, 308, 51, 53, 55, 61, 63, 65].includes(c)) return 'cloud-rain';
    if ([179, 182, 185, 281, 284, 311, 314, 317, 320, 350, 374, 377, 56, 57, 66, 67].includes(c)) return 'cloud-hail';
    if ([200, 386, 389, 392, 395, 95, 96, 99].includes(c)) return 'cloud-lightning';
    if ([227, 230, 323, 326, 329, 332, 335, 338, 368, 371, 71, 73, 75, 77, 85, 86].includes(c)) return 'snowflake';
    if ([353, 356, 359, 362, 365, 80, 81, 82].includes(c)) return 'cloud-drizzle';
    return 'cloud';
}

function formatStaleTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
}

function renderWeatherData(data, isStale = false, timestamp = 0) {
    const tempEl = document.getElementById('temp');
    const weatherDescEl = document.getElementById('weather-desc');
    const weatherIconEl = document.getElementById('weather-icon');
    const sunriseEl = document.getElementById('sunrise-time');
    const sunsetEl = document.getElementById('sunset-time');

    if (!tempEl || !weatherDescEl || !data?.current_condition?.[0]) return;

    const current = data.current_condition[0];
    tempEl.textContent = `${current.temp_C} °C`;
    const desc = getWeatherDescription(current);
    
    const detectedCity = config.city || data.nearest_area?.[0]?.areaName?.[0]?.value || 'Időjárás';
    const weatherCityEl = document.getElementById('weather-city');
    if (weatherCityEl) {
        weatherCityEl.textContent = detectedCity;
    }

    if (isStale && timestamp) {
        const timeStr = formatStaleTime(timestamp);
        weatherDescEl.textContent = `${desc} ⚠️`;
        weatherDescEl.title = `Elavult adat. Utolsó frissítés: ${timeStr}`;
    } else {
        weatherDescEl.textContent = desc;
        weatherDescEl.removeAttribute('title');
    }

    const iconName = getWeatherIconName(current.weatherCode);
    if (weatherIconEl) {
        weatherIconEl.innerHTML = '';
        weatherIconEl.appendChild(createLucideIcon(iconName, "w-10 h-10 text-slate-300"));
    }

    const weatherLink = document.getElementById('weather-link');
    if (weatherLink) {
        let targetCity = config.city;
        if (data.nearest_area?.[0]) {
            const area = data.nearest_area[0];
            const lat = parseFloat(area.latitude);
            const lon = parseFloat(area.longitude);
            if (!isNaN(lat) && !isNaN(lon)) {
                const CITIES = [
                    { name: "Budapest", lat: 47.4979, lon: 19.0402 },
                    { name: "Debrecen", lat: 47.5316, lon: 21.6273 },
                    { name: "Győr", lat: 47.6875, lon: 17.6504 },
                    { name: "Miskolc", lat: 48.1035, lon: 20.7784 },
                    { name: "Pécs", lat: 46.0727, lon: 18.2323 },
                    { name: "Siófok", lat: 46.9062, lon: 18.0580 },
                    { name: "Szeged", lat: 46.2530, lon: 20.1414 }
                ];
                let minDistance = Infinity;
                let closest = CITIES[0].name;
                for (const city of CITIES) {
                    const dist = Math.sqrt(Math.pow(lat - city.lat, 2) + Math.pow(lon - city.lon, 2));
                    if (dist < minDistance) {
                        minDistance = dist;
                        closest = city.name;
                    }
                }
                targetCity = closest;
            }
        }
        weatherLink.href = `https://www.idokep.hu/idojaras/${targetCity || 'Budapest'}`;
    }

    if (data.weather?.[0]?.astronomy?.[0]) {
        const astro = data.weather[0].astronomy[0];
        const to24h = (timeStr) => {
            if (!timeStr) return "--:--";
            const [time, modifier] = timeStr.split(' ');
            let [hours, minutes] = time.split(':');
            if (hours === '12') hours = '00';
            if (modifier && modifier.toUpperCase() === 'PM') hours = (parseInt(hours, 10) + 12).toString();
            return `${hours.padStart(2, '0')}:${minutes}`;
        };
        if (sunriseEl) sunriseEl.textContent = to24h(astro.sunrise);
        if (sunsetEl) sunsetEl.textContent = to24h(astro.sunset);
    }

    // Render 3-Day Forecast Tooltip
    if (data.weather) {
        renderForecast(data.weather, detectedCity);
    }

    if (window.lucide) window.lucide.createIcons();
}

/**
 * Fetch and display weather information
 */
export async function fetchWeather() {
    const tempEl = document.getElementById('temp');
    const weatherDescEl = document.getElementById('weather-desc');
    if (!tempEl || !weatherDescEl) return;

    // Load from cache first for instant render
    let cached = null;
    try {
        const raw = localStorage.getItem('wolfhome_weather_cache');
        if (raw) cached = JSON.parse(raw);
    } catch (e) {
        // ignore cache parse error
    }

    const currentCity = config.city || 'Szeged';
    if (cached && cached.data && cached.city === currentCity) {
        const age = Date.now() - (cached.timestamp || 0);
        const isStale = age > 2 * 60 * 60 * 1000; // > 2 hours
        if (age < 12 * 60 * 60 * 1000) { // < 12 hours
            renderWeatherData(cached.data, isStale, cached.timestamp);
        }
    }

    try {
        const queryCity = config.city ? encodeURIComponent(config.city) : '';
        const response = await fetch(`https://wttr.in/${queryCity}?format=j1&lang=hu`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        // Cache fresh response
        localStorage.setItem('wolfhome_weather_cache', JSON.stringify({
            data,
            timestamp: Date.now(),
            city: currentCity
        }));

        renderWeatherData(data, false);
    } catch (error) {
        console.warn("Időjárás frissítés sikertelen:", error);
        if (cached && cached.data && cached.city === currentCity) {
            const age = Date.now() - (cached.timestamp || 0);
            if (age < 12 * 60 * 60 * 1000) {
                renderWeatherData(cached.data, true, cached.timestamp);
                return;
            }
        }
        if (tempEl) tempEl.textContent = "-- °C";
        if (weatherDescEl) {
            weatherDescEl.textContent = "Időjárás nem elérhető";
            weatherDescEl.removeAttribute('title');
        }
    }
}

/**
 * Render 3-day forecast into hover tooltip
 */
function renderForecast(weatherDays, cityName) {
    const card = document.getElementById('weather-forecast-card');
    const daysContainer = document.getElementById('forecast-days');
    const forecastCity = document.getElementById('forecast-city');
    if (!card || !daysContainer || !weatherDays || !weatherDays.length) return;

    if (forecastCity) forecastCity.textContent = cityName;
    daysContainer.innerHTML = '';

    const dayLabels = ['Ma', 'Holnap', 'Holnapután'];

    weatherDays.slice(0, 3).forEach((day, idx) => {
        const dateObj = new Date(day.date + 'T12:00:00');
        let dayName = dayLabels[idx];
        if (!dayName) {
            dayName = dateObj.toLocaleDateString('hu-HU', { weekday: 'short' });
        }

        const middayHourly = day.hourly?.[4] || day.hourly?.[Math.floor(day.hourly.length / 2)] || {};
        const code = middayHourly.weatherCode || day.hourly?.[0]?.weatherCode || '119';
        const iconName = getWeatherIconName(code);
        const desc = getWeatherDescription(middayHourly);

        const rainChance = Math.max(...(day.hourly || []).map(h => parseInt(h.chanceofrain || 0, 10)), 0);
        const maxWind = Math.max(...(day.hourly || []).map(h => parseInt(h.windspeedKmph || 0, 10)), 0);

        const col = tag('div', { className: "flex flex-col items-center p-2 rounded-xl bg-white/[0.03] border border-white/[0.05]" }, [
            tag('span', { className: "text-xs font-bold uppercase tracking-wider text-slate-400 mb-1", textContent: dayName }),
            tag('div', { className: "my-1 flex items-center justify-center text-slate-300" }, [
                createLucideIcon(iconName, "w-6 h-6")
            ]),
            tag('div', { className: "flex items-baseline gap-1 mt-1 text-xs" }, [
                tag('span', { className: "font-bold text-accent", textContent: `${day.maxtempC}°` }),
                tag('span', { className: "text-slate-500 text-xs", textContent: `${day.mintempC}°` })
            ]),
            tag('span', { className: "text-xs text-slate-400 leading-tight mt-1 line-clamp-2 text-center", textContent: desc, title: desc }),
            tag('div', { className: "flex flex-col items-center gap-1 mt-2 pt-1.5 border-t border-white/5 text-xs text-slate-400 w-full" }, [
                tag('div', { className: "flex items-center justify-center gap-1", title: "Csapadék valószínűsége" }, [
                    createLucideIcon('umbrella', "w-3.5 h-3.5 text-blue-400"),
                    tag('span', { textContent: `${rainChance}%` })
                ]),
                tag('div', { className: "flex items-center justify-center gap-1", title: "Várható maximális szélsebesség" }, [
                    createLucideIcon('wind', "w-3.5 h-3.5 text-slate-400"),
                    tag('span', { textContent: `${maxWind} km/h` })
                ])
            ])
        ]);

        daysContainer.appendChild(col);
    });

    card.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Update currency exchange rates
 */
export async function updateExchangeRates() {
    const eurEl = document.getElementById('eur-rate');
    const usdEl = document.getElementById('usd-rate');
    const ratesContainer = eurEl?.closest('a');
    if (!eurEl || !usdEl) return;

    // Load from cache first
    let cached = null;
    try {
        const raw = localStorage.getItem('wolfhome_rates_cache');
        if (raw) cached = JSON.parse(raw);
    } catch (e) {
        // ignore
    }

    if (cached && cached.eur && cached.usd) {
        eurEl.textContent = cached.eur;
        usdEl.textContent = cached.usd;
    }

    try {
        const response = await fetch('https://open.er-api.com/v6/latest/HUF');
        const data = await response.json();
        if (data && data.result === 'success' && data.rates) {
            const eurToHuf = (1 / data.rates.EUR).toFixed(1);
            const usdToHuf = (1 / data.rates.USD).toFixed(1);
            eurEl.textContent = eurToHuf;
            usdEl.textContent = usdToHuf;
            if (ratesContainer) ratesContainer.removeAttribute('title');

            localStorage.setItem('wolfhome_rates_cache', JSON.stringify({
                eur: eurToHuf,
                usd: usdToHuf,
                timestamp: Date.now()
            }));
            return;
        }
        throw new Error("API invalid response");
    } catch (error) {
        console.warn("Árfolyam frissítés hiba:", error);
        if (cached && cached.eur && cached.usd) {
            const age = Date.now() - (cached.timestamp || 0);
            if (age < 24 * 60 * 60 * 1000) {
                const timeStr = formatStaleTime(cached.timestamp);
                if (ratesContainer) ratesContainer.title = `Elavult árfolyam. Utolsó adat: ${timeStr}`;
                return;
            }
        }
        eurEl.textContent = "---";
        usdEl.textContent = "---";
        if (ratesContainer) ratesContainer.removeAttribute('title');
    }
}
