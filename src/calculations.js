export const DAYS = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

/**
 * @typedef {Object} SelectedAppliance
 * @property {string} id
 * @property {string} presetId
 * @property {string} name
 * @property {string} category
 * @property {number} quantity
 * @property {number} wattage
 * @property {number} hoursPerDay
 * @property {number} dutyCycle
 * @property {string[]} activeDays
 */

const round = (value, digits = 2) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const positive = (value) => Math.max(0, Number(value) || 0);

export function calculateApplianceEnergy(appliance) {
  return round(
    positive(appliance.quantity) *
      positive(appliance.wattage) *
      positive(appliance.hoursPerDay) *
      positive(appliance.dutyCycle) /
      1000,
  );
}

export function calculateDemandResult({ appliances, diversityFactor = 1 }) {
  const applianceRows = appliances.map((appliance) => {
    const activeDays = normalizeActiveDays(appliance.activeDays);
    const dailyKWh = calculateApplianceEnergy(appliance);
    const weeklyKWh = round(dailyKWh * activeDays.length);
    const peakKW = round(positive(appliance.quantity) * positive(appliance.wattage) / 1000);

    return {
      ...appliance,
      activeDays,
      dailyKWh,
      weeklyKWh,
      peakKW,
    };
  });

  const dailyTotals = DAYS.map((day) => {
    const activeAppliances = applianceRows.filter((appliance) =>
      appliance.activeDays.includes(day.id),
    );
    const kWh = round(
      activeAppliances.reduce((sum, appliance) => sum + appliance.dailyKWh, 0),
    );
    const rawPeakKW = round(
      activeAppliances.reduce((sum, appliance) => sum + appliance.peakKW, 0),
    );

    return {
      ...day,
      kWh,
      rawPeakKW,
      estimatedPeakKW: round(rawPeakKW * positive(diversityFactor)),
    };
  });

  const weeklyKWh = round(
    dailyTotals.reduce((sum, day) => sum + day.kWh, 0),
  );
  const averageDailyKWh = round(weeklyKWh / DAYS.length);
  const busiestDay = dailyTotals.reduce(
    (busiest, day) => (day.kWh > busiest.kWh ? day : busiest),
    dailyTotals[0],
  );
  const estimatedPeakKW = Math.max(...dailyTotals.map((day) => day.estimatedPeakKW));
  const categoryBreakdown = calculateCategoryBreakdown(applianceRows, weeklyKWh);

  return {
    weeklyKWh,
    averageDailyKWh,
    busiestDay,
    estimatedPeakKW,
    dailyTotals,
    categoryBreakdown,
    applianceRows,
  };
}

function calculateCategoryBreakdown(applianceRows, weeklyKWh) {
  const categoryMap = new Map();

  for (const appliance of applianceRows) {
    const current = categoryMap.get(appliance.category) || 0;
    categoryMap.set(appliance.category, round(current + appliance.weeklyKWh));
  }

  return [...categoryMap.entries()]
    .map(([category, categoryWeeklyKWh]) => ({
      category,
      weeklyKWh: categoryWeeklyKWh,
      percent: weeklyKWh > 0 ? round((categoryWeeklyKWh / weeklyKWh) * 100, 1) : 0,
    }))
    .sort((a, b) => b.weeklyKWh - a.weeklyKWh);
}

function normalizeActiveDays(activeDays) {
  if (!Array.isArray(activeDays)) return DAYS.map((day) => day.id);
  const validDays = new Set(DAYS.map((day) => day.id));
  return activeDays.filter((day) => validDays.has(day));
}
