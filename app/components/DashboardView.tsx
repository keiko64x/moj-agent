'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  CALENDAR_HOUR_COUNT,
  CALENDAR_HOUR_START,
  FALLBACK_CITY,
  FALLBACK_COORDS,
  correctAncientTreeList,
  fetchInitialAncientTrees,
  fetchRandomAncientTree,
  fetchWeatherByCoords,
  fetchWeeklyActivityPlan,
  formatDistanceKm,
  formatUpdatedAt,
  getCurrentDateTime,
  getNearestMedicalPharmacies,
  reverseGeocodeCity,
  runAncientTreeGateProtocol,
  type AncientTree,
  type DateTimeData,
  type NearbyMedicalPharmacy,
  type WeatherData,
  type WeeklyActivityPlan,
} from '@/app/lib/dashboard-data';

const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const BRAND_SLOGAN =
  'Agentosław Reaktowski — Twój sztuczny inteligent za jeden uśmiech. Daj mi misje!';

type UserLocation = {
  lat: number;
  lon: number;
  city: string;
};

function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: string | number }) {
  return (
    <div
      className="dashboard-skeleton"
      style={{ height, width, borderRadius: 8, marginBottom: 10 }}
    />
  );
}

function shortDayLabel(dateKey: string): { weekday: string; dayNum: string } {
  const date = new Date(`${dateKey}T12:00:00`);
  return {
    weekday: date.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', ''),
    dayNum: String(date.getDate()),
  };
}

function padHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

const CALENDAR_HOURS = Array.from(
  { length: CALENDAR_HOUR_COUNT },
  (_, i) => CALENDAR_HOUR_START + i,
);
const CAL_ROW_H_PX = 32;

function resolveUserLocation(): Promise<UserLocation> {
  return new Promise((resolve) => {
    const fallback: UserLocation = {
      lat: FALLBACK_COORDS.lat,
      lon: FALLBACK_COORDS.lon,
      city: FALLBACK_CITY,
    };

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(fallback);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        try {
          const city = await reverseGeocodeCity(lat, lon);
          resolve({ lat, lon, city });
        } catch {
          resolve({ lat, lon, city: FALLBACK_CITY });
        }
      },
      () => resolve(fallback),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

export default function DashboardView() {
  const [dateTime, setDateTime] = useState<DateTimeData | null>(null);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [weather, setWeather] = useState<WeatherData | { error: string } | null>(null);
  const [weekPlan, setWeekPlan] = useState<WeeklyActivityPlan | { error: string } | null>(null);
  const [pharmacies, setPharmacies] = useState<NearbyMedicalPharmacy[]>([]);
  const [trees, setTrees] = useState<AncientTree[]>([]);
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(true);
  const [treesLoading, setTreesLoading] = useState(true);
  const [drawingTree, setDrawingTree] = useState(false);
  const [treesError, setTreesError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [supabaseHealth, setSupabaseHealth] = useState<{
    ok: boolean;
    configured: boolean;
    message: string;
  } | null>(null);
  const treesRef = useRef<AncientTree[]>([]);
  const locationRef = useRef<UserLocation | null>(null);

  treesRef.current = trees;
  locationRef.current = location;

  const loadWeatherAndPlan = useCallback(async (loc: UserLocation) => {
    const [weatherData, planData] = await Promise.all([
      fetchWeatherByCoords(loc.lat, loc.lon, loc.city),
      fetchWeeklyActivityPlan(loc.lat, loc.lon, loc.city),
    ]);
    setWeather(weatherData);
    setWeekPlan(planData);
    setPharmacies(getNearestMedicalPharmacies(loc.lat, loc.lon, 3));
    setWeatherUpdatedAt(new Date());
  }, []);

  const loadTrees = useCallback(async () => {
    setTreesLoading(true);
    setTreesError(null);
    try {
      const data = correctAncientTreeList(await fetchInitialAncientTrees(3));
      setTrees(data);
      if (data.length === 0) {
        setTreesError('Nie udało się pobrać drzew z Wikipedii');
      }
    } catch {
      setTreesError('Błąd podczas pobierania drzew');
    } finally {
      setTreesLoading(false);
    }
  }, []);

  const drawRandomTree = useCallback(async () => {
    setDrawingTree(true);
    setTreesError(null);
    try {
      const excludeTitles = treesRef.current.map((tree) => tree.title);
      const result = await fetchRandomAncientTree(excludeTitles);
      if ('error' in result) {
        setTreesError(result.error);
        return;
      }
      const gate = runAncientTreeGateProtocol({
        title: result.title,
        extract: result.summary,
      });
      if (!gate.ok) {
        setTreesError(`Odrzucono wpadkę: ${gate.reason}`);
        return;
      }
      setTrees((prev) => correctAncientTreeList([result, ...prev]).slice(0, 3));
    } catch {
      setTreesError('Błąd podczas losowania drzewa');
    } finally {
      setDrawingTree(false);
    }
  }, []);

  const loadAll = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      setDateTime(getCurrentDateTime());

      let loc = locationRef.current;
      if (!loc || !isManual) {
        setLocating(true);
        loc = await resolveUserLocation();
        setLocation(loc);
        locationRef.current = loc;
        setLocating(false);
      }

      await Promise.all([loadWeatherAndPlan(loc), loadTrees()]);

      setLoading(false);
      setRefreshing(false);
    },
    [loadTrees, loadWeatherAndPlan],
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    void fetch('/api/supabase/health')
      .then((r) => r.json())
      .then((data: { ok: boolean; configured: boolean; message: string }) => {
        setSupabaseHealth({
          ok: data.ok,
          configured: data.configured,
          message: data.message,
        });
      })
      .catch(() => {
        setSupabaseHealth({
          ok: false,
          configured: false,
          message: 'Nie udało się sprawdzić Supabase',
        });
      });
  }, []);

  useEffect(() => {
    const weatherTimer = setInterval(() => {
      const loc = locationRef.current;
      if (loc) void loadWeatherAndPlan(loc);
    }, WEATHER_REFRESH_MS);

    return () => clearInterval(weatherTimer);
  }, [loadWeatherAndPlan]);

  const showWeatherLoading = loading || locating;

  return (
    <main className="dashboard-main">
      <div className="dashboard-header">
        <div>
          {dateTime ? (
            <p className="dashboard-greeting">
              🌅 {dateTime.greeting}! Dziś: {dateTime.dayOfWeek}, {dateTime.dateTime}
            </p>
          ) : (
            <Skeleton height={18} width="55%" />
          )}
          <h1 className="dashboard-title dashboard-brand-slogan">{BRAND_SLOGAN}</h1>
        </div>
        <button
          type="button"
          className="dashboard-refresh"
          onClick={() => loadAll(true)}
          disabled={refreshing}
          aria-label="Odśwież dane"
        >
          {refreshing ? '⏳' : '🔄'}
        </button>
      </div>

      <div className="dashboard-stack">
        <section className="dashboard-panel dashboard-panel-supabase dashboard-fade-in">
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">🗄️ Pamięć w chmurze (Supabase)</h2>
            <span className="dashboard-updated">Lekcja 5 · W1</span>
          </div>
          {!supabaseHealth ? (
            <Skeleton height={18} width="70%" />
          ) : (
            <>
              <p className="dashboard-meta">
                {supabaseHealth.ok
                  ? '✅ Baza podłączona — rozmowy mogą żyć poza przeglądarką'
                  : supabaseHealth.configured
                    ? '⚠️ Klucze są, ale tabele niekompletne — uruchom schema.sql'
                    : '⏳ Dodaj klucze Supabase w .env.local i utwórz tabele'}
              </p>
              <p className="dashboard-meta">{supabaseHealth.message}</p>
              <a className="dashboard-supabase-link" href="/setup">
                Otwórz kreator setup →
              </a>
            </>
          )}
        </section>

        <section className="dashboard-panel dashboard-panel-weather dashboard-fade-in">
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">🌤️ Pogoda dzisiaj</h2>
            {weatherUpdatedAt && (
              <span className="dashboard-updated">
                Ostatnia aktualizacja: {formatUpdatedAt(weatherUpdatedAt)}
              </span>
            )}
          </div>
          {showWeatherLoading ? (
            <>
              <Skeleton height={22} width="40%" />
              <Skeleton height={36} width="30%" />
              <Skeleton height={16} />
            </>
          ) : weather && 'error' in weather ? (
            <p className="dashboard-error">{weather.error}</p>
          ) : weather ? (
            <div className="dashboard-weather-layout">
              <div className="dashboard-weather-now">
                <p className="dashboard-city">{weather.city}</p>
                <p className="dashboard-hero-value">
                  {weather.emoji} {weather.temperature}
                </p>
                <p className="dashboard-meta">{weather.description}</p>
                <p className="dashboard-meta">
                  Wiatr {weather.windSpeed} · Wilgotność {weather.humidity}
                </p>
              </div>
              <div className="dashboard-temp-extremes">
                <div className="dashboard-temp-extreme dashboard-temp-high">
                  <span className="dashboard-temp-extreme-label">Najwyższa dziś</span>
                  <span className="dashboard-temp-extreme-value">{weather.todayHigh}</span>
                  <span className="dashboard-temp-extreme-hour">o {weather.todayHighHour}</span>
                </div>
                <div className="dashboard-temp-extreme dashboard-temp-low">
                  <span className="dashboard-temp-extreme-label">Najniższa dziś</span>
                  <span className="dashboard-temp-extreme-value">{weather.todayLow}</span>
                  <span className="dashboard-temp-extreme-hour">o {weather.todayLowHour}</span>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="dashboard-panel dashboard-panel-weekplan dashboard-fade-in dashboard-fade-in-delay-1">
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">📅 Tydzień: spacer vs komputerowanie</h2>
            {weekPlan && !('error' in weekPlan) && (
              <span className="dashboard-updated">Plan dla: {weekPlan.city} · 6:00–22:00</span>
            )}
          </div>

          <div className="dashboard-cal-legend">
            <span className="dashboard-cal-key dashboard-cal-key-spacer">🚶 Spacer (&gt;24°C, słonecznie)</span>
            <span className="dashboard-cal-key dashboard-cal-key-komputer">
              💻 Komputerowanie (&lt;24°C lub deszcz)
            </span>
            <span className="dashboard-cal-weather-keys" aria-hidden>
              ☀️ słońce · ⛅ pochmurno · 🌧️ deszcz · ⛈️ burza
            </span>
          </div>

          {showWeatherLoading ? (
            <>
              <Skeleton height={220} />
            </>
          ) : weekPlan && 'error' in weekPlan ? (
            <p className="dashboard-error">{weekPlan.error}</p>
          ) : weekPlan ? (
            <div
              className="dashboard-calendar"
              role="table"
              aria-label="Kalendarz aktywności tygodnia"
              style={
                {
                  '--cal-rows': String(CALENDAR_HOUR_COUNT),
                  '--cal-row-h': `${CAL_ROW_H_PX}px`,
                } as CSSProperties
              }
            >
              <div className="dashboard-cal-head-row" role="row">
                <div className="dashboard-cal-time-gutter dashboard-cal-time-gutter-head" aria-hidden />
                {weekPlan.days.map((day) => {
                  const { weekday, dayNum } = shortDayLabel(day.date);
                  return (
                    <div key={day.date} className="dashboard-cal-day-head" role="columnheader">
                      <span className="dashboard-cal-weekday">{weekday}</span>
                      <span className="dashboard-cal-daynum">{dayNum}</span>
                    </div>
                  );
                })}
              </div>

              <div className="dashboard-cal-body-row">
                <div className="dashboard-cal-time-axis" aria-hidden>
                  {CALENDAR_HOURS.map((hour) => (
                    <div key={hour} className="dashboard-cal-time-tick">
                      {padHourLabel(hour)}
                    </div>
                  ))}
                </div>

                <div className="dashboard-cal-days">
                  {weekPlan.days.map((day) => (
                    <div key={day.date} className="dashboard-cal-day-track" role="cell">
                      {day.slots.map((slot) => {
                        const span = Math.max(1, slot.toHourNum - slot.fromHourNum);
                        const top = (slot.fromHourNum - CALENDAR_HOUR_START) * CAL_ROW_H_PX;
                        const height = span * CAL_ROW_H_PX - 4;
                        const tempLabel =
                          slot.minTemp === slot.maxTemp
                            ? `${slot.minTemp}°`
                            : `${slot.minTemp}–${slot.maxTemp}°`;
                        return (
                          <div
                            key={`${day.date}-${slot.fromHour}-${slot.kind}`}
                            className={`dashboard-cal-block dashboard-cal-block-${slot.kind}${
                              span <= 1 ? ' dashboard-cal-block-compact' : ''
                            }`}
                            style={{ top, height }}
                            title={`${slot.fromHour}–${slot.toHour} · ${slot.weatherLabel} · ${
                              slot.kind === 'spacer' ? 'Spacer' : 'Komputerowanie'
                            }`}
                          >
                            <span className="dashboard-cal-block-emoji" aria-hidden>
                              {slot.emoji}
                            </span>
                            <span className="dashboard-cal-block-label">
                              {slot.kind === 'spacer' ? 'Spacer' : 'PC'}
                            </span>
                            <span className="dashboard-cal-block-weather">{slot.weatherLabel}</span>
                            <span className="dashboard-cal-block-temp">{tempLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="dashboard-panel dashboard-panel-herb dashboard-fade-in dashboard-fade-in-delay-2">
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">🌿 Zioło na receptę</h2>
            {location && (
              <span className="dashboard-updated">
                3 najbliższe apteki · {location.city}
              </span>
            )}
          </div>

          {showWeatherLoading ? (
            <>
              <Skeleton height={100} />
              <Skeleton height={100} />
              <Skeleton height={100} />
            </>
          ) : pharmacies.length === 0 ? (
            <p className="dashboard-error">Brak aptek w bazie dla tej lokalizacji</p>
          ) : (
            <div className="dashboard-pharmacy-list">
              {pharmacies.map((pharmacy, index) => (
                <article key={pharmacy.id} className="dashboard-pharmacy">
                  <div className="dashboard-pharmacy-top">
                    <span className="dashboard-pharmacy-rank">#{index + 1}</span>
                    <div className="dashboard-pharmacy-identity">
                      <h3 className="dashboard-pharmacy-name">{pharmacy.name}</h3>
                      <p className="dashboard-pharmacy-address">{pharmacy.address}</p>
                      <p className="dashboard-pharmacy-meta">
                        {formatDistanceKm(pharmacy.distanceKm)} · źródła:{' '}
                        {pharmacy.sources.join(', ')}
                      </p>
                    </div>
                    <a
                      className="dashboard-route-btn"
                      href={pharmacy.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      🗺️ Pokaż trasę
                    </a>
                  </div>

                  <div className="dashboard-pharmacy-strongest">
                    <span className="dashboard-pharmacy-strongest-label">Najmocniejsze w aptece</span>
                    <strong>
                      {pharmacy.strongest.name} · {pharmacy.strongest.thcLabel} ·{' '}
                      {pharmacy.strongest.priceLabel}
                    </strong>
                  </div>

                  <ul className="dashboard-strain-list">
                    {pharmacy.strains
                      .slice()
                      .sort((a, b) => b.thcPercent - a.thcPercent)
                      .map((strain) => (
                        <li key={`${pharmacy.id}-${strain.name}`} className="dashboard-strain">
                          <span className="dashboard-strain-name">{strain.name}</span>
                          <span className="dashboard-strain-thc">{strain.thcLabel}</span>
                          <span className="dashboard-strain-price">{strain.priceLabel}</span>
                        </li>
                      ))}
                  </ul>
                </article>
              ))}
            </div>
          )}

          <p className="dashboard-score-disclaimer">
            Tylko na receptę (Rpw) · ceny i dostępność orientacyjne (gdziepolek / ktomalek) — zawsze
            potwierdź w aptece
          </p>
        </section>

        <section className="dashboard-panel dashboard-panel-trees dashboard-fade-in dashboard-fade-in-delay-3">
          <div className="dashboard-trees-header">
            <h2 className="dashboard-panel-title">🌳 Prastare olbrzymy</h2>
            <button
              type="button"
              className="dashboard-draw-tree"
              onClick={drawRandomTree}
              disabled={drawingTree || treesLoading}
            >
              {drawingTree ? '⏳ Losuję…' : '🎲 Losuj drzewo'}
            </button>
          </div>

          {treesLoading ? (
            <>
              <Skeleton height={72} />
              <Skeleton height={72} />
              <Skeleton height={72} />
            </>
          ) : treesError && trees.length === 0 ? (
            <p className="dashboard-error">{treesError}</p>
          ) : (
            <>
              {treesError && <p className="dashboard-error">{treesError}</p>}
              <ol className="dashboard-tree-list">
                {trees.map((tree, index) => (
                  <li
                    key={`${tree.id}-${index}`}
                    className={`dashboard-tree-item${index === 0 ? ' dashboard-tree-item-top' : ''}`}
                  >
                    <span className="dashboard-tree-rank">#{index + 1}</span>
                    {tree.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tree.thumbnail}
                        alt=""
                        className="dashboard-tree-thumb"
                      />
                    )}
                    <div className="dashboard-tree-body">
                      <a
                        href={tree.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dashboard-tree-title"
                      >
                        {tree.title}
                      </a>
                      {(tree.speciesHint || tree.ageHint) && (
                        <div className="dashboard-tree-tags">
                          {tree.speciesHint && (
                            <span className="dashboard-tree-tag">{tree.speciesHint}</span>
                          )}
                          {tree.ageHint && (
                            <span className="dashboard-tree-tag">{tree.ageHint}</span>
                          )}
                        </div>
                      )}
                      <p className="dashboard-tree-summary">{tree.summary}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
