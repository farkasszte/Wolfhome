/**
 * WolfHome Widgets Module
 */
import { config } from './config.js';
import { createLucideIcon, tag } from './utils.js';
import { namedayDB } from './nameday-db.js';

/**
 * Update the clock and date display
 */
export function updateTime() {
    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');
    if (!clockEl || !dateEl) return;

    const now = new Date();
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

    try {
        const response = await fetch('https://nameday.abalin.net/api/V2/today?country=hu');
        const data = await response.json();
        if (data && data.success && data.data && data.data.hu) {
            namedayEl.textContent = data.data.hu;
            return;
        }
        throw new Error("API response error");
    } catch (e) {
        console.warn("Abalin API hiba, fallback a helyi listára:", e);
        const now = new Date();
        const m = now.getMonth() + 1;
        const d = now.getDate();
        if (namedayDB[m]) {
            namedayEl.textContent = namedayDB[m][d - 1];
        }
    }
}

/**
 * Fetch and display weather information
 */
export async function fetchWeather() {
    const tempEl = document.getElementById('temp');
    const weatherDescEl = document.getElementById('weather-desc');
    const weatherIconEl = document.getElementById('weather-icon');
    const sunriseEl = document.getElementById('sunrise-time');
    const sunsetEl = document.getElementById('sunset-time');

    if (!tempEl || !weatherDescEl) return;

    try {
        const response = await fetch(`https://wttr.in/${config.city}?format=j1&lang=hu`);
        const data = await response.json();
        const current = data.current_condition[0];
        
        tempEl.textContent = `${current.temp_C} °C`;
        const desc = current.lang_hu?.[0]?.value || current.weatherDesc[0].value;
        
        const weatherCityEl = document.getElementById('weather-city');
        if (weatherCityEl) {
            weatherCityEl.textContent = config.city;
        }
        weatherDescEl.textContent = desc;

        const code = parseInt(current.weatherCode);
        let iconName = 'cloud';
        if (code === 113) iconName = 'sun';
        else if (code <= 119) iconName = 'cloud-sun';
        else if ([176, 263, 266, 293, 296, 299, 302, 305, 308].includes(code)) iconName = 'cloud-rain';
        else if ([227, 230, 323, 326, 329, 332, 335, 338].includes(code)) iconName = 'snowflake';

        weatherIconEl.innerHTML = '';
        weatherIconEl.appendChild(createLucideIcon(iconName, "w-10 h-10 text-slate-400"));

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
            weatherLink.href = `https://www.idokep.hu/idojaras/${targetCity}`;
        }

        if (data.weather?.[0]?.astronomy?.[0]) {
            const astro = data.weather[0].astronomy[0];
            const to24h = (timeStr) => {
                if (!timeStr) return "--:--";
                const [time, modifier] = timeStr.split(' ');
                let [hours, minutes] = time.split(':');
                if (hours === '12') hours = '00';
                if (modifier === 'PM') hours = (parseInt(hours, 10) + 12).toString();
                return `${hours.padStart(2, '0')}:${minutes}`;
            };
            if (sunriseEl) sunriseEl.textContent = to24h(astro.sunrise);
            if (sunsetEl) sunsetEl.textContent = to24h(astro.sunset);
        }
        if (window.lucide) window.lucide.createIcons();
    } catch (error) {
        if (tempEl) tempEl.textContent = "-- °C";
        if (weatherDescEl) weatherDescEl.textContent = "Időjárás nem elérhető";
        console.error("Időjárás hiba:", error);
    }
}

/**
 * Update currency exchange rates
 */
export async function updateExchangeRates() {
    const eurEl = document.getElementById('eur-rate');
    const usdEl = document.getElementById('usd-rate');
    if (!eurEl || !usdEl) return;

    try {
        const response = await fetch('https://open.er-api.com/v6/latest/HUF');
        const data = await response.json();
        if (data && data.result === 'success' && data.rates) {
            const eurToHuf = 1 / data.rates.EUR;
            const usdToHuf = 1 / data.rates.USD;
            eurEl.textContent = eurToHuf.toFixed(1);
            usdEl.textContent = usdToHuf.toFixed(1);
        }
    } catch (error) {
        eurEl.textContent = "---";
        usdEl.textContent = "---";
    }
}
