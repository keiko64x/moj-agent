const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: 'bezchmurnie',
  1: 'przeważnie bezchmurnie',
  2: 'częściowo pochmurno',
  3: 'pochmurno',
  45: 'mgła',
  48: 'szronowa mgła',
  51: 'mżawka',
  53: 'mżawka umiarkowana',
  55: 'mżawka intensywna',
  61: 'deszcz słaby',
  63: 'deszcz umiarkowany',
  65: 'deszcz intensywny',
  71: 'śnieg słaby',
  73: 'śnieg umiarkowany',
  75: 'śnieg intensywny',
  80: 'przelotne opady słabe',
  81: 'przelotne opady umiarkowane',
  82: 'przelotne opady intensywne',
  95: 'burza',
};

export function describeWeatherCode(code: number): string {
  return WEATHER_DESCRIPTIONS[code] ?? 'warunki zmienne';
}

export type ShortSleeveSlot = {
  date: string;
  dayOfWeek: string;
  fromHour: string;
  toHour: string;
  minTemp: number;
  maxTemp: number;
};

/** Łączy godziny 25–39°C w przedziały (np. 11:00–16:00). */
export function findShortSleeveWindows(
  times: string[],
  temperatures: number[],
): { slots: ShortSleeveSlot[]; maxTempOverall: number; daysAnalyzed: number } {
  type Point = { date: string; hour: number; temp: number };
  const points: Point[] = [];
  let maxTempOverall = -Infinity;

  for (let i = 0; i < times.length; i++) {
    const temp = temperatures[i];
    if (typeof temp !== 'number' || !Number.isFinite(temp)) continue;
    maxTempOverall = Math.max(maxTempOverall, temp);

    const [datePart, timePart] = times[i].split('T');
    const hour = Number((timePart ?? '0').slice(0, 2));
    points.push({ date: datePart, hour, temp });
  }

  const slots: ShortSleeveSlot[] = [];
  let run: Point[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const first = run[0];
    const last = run[run.length - 1];
    const temps = run.map((p) => p.temp);
    const dayOfWeek = new Date(`${first.date}T12:00:00`).toLocaleDateString('pl-PL', {
      weekday: 'long',
    });
    slots.push({
      date: first.date,
      dayOfWeek,
      fromHour: `${String(first.hour).padStart(2, '0')}:00`,
      toHour: `${String(last.hour).padStart(2, '0')}:00`,
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
    });
    run = [];
  };

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const inRange = p.temp >= 25 && p.temp <= 39;
    if (!inRange) {
      flush();
      continue;
    }

    if (run.length === 0) {
      run.push(p);
      continue;
    }

    const prev = run[run.length - 1];
    const consecutive =
      prev.date === p.date && p.hour === prev.hour + 1;
    if (consecutive) {
      run.push(p);
    } else {
      flush();
      run.push(p);
    }
  }
  flush();

  const uniqueDays = new Set(points.map((p) => p.date));
  return {
    slots,
    maxTempOverall: maxTempOverall === -Infinity ? 0 : maxTempOverall,
    daysAnalyzed: uniqueDays.size,
  };
}

