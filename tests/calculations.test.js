import test from "node:test";
import assert from "node:assert/strict";

import {
  DAYS,
  calculateApplianceEnergy,
  calculateDemandResult,
} from "../src/calculations.js";

test("calculates appliance energy for one active day", () => {
  const kwh = calculateApplianceEnergy({
    quantity: 2,
    wattage: 1200,
    hoursPerDay: 3,
    dutyCycle: 0.5,
  });

  assert.equal(kwh, 3.6);
});

test("calculates house demand by selected appliance activity days", () => {
  const result = calculateDemandResult({
    appliances: [
      {
        id: "ac-1",
        presetId: "air-conditioner",
        name: "Air-conditioner",
        category: "Cooling",
        quantity: 2,
        wattage: 1200,
        hoursPerDay: 8,
        dutyCycle: 0.65,
        activeDays: ["mon", "tue", "wed", "thu", "fri"],
      },
      {
        id: "dryer-1",
        presetId: "dryer",
        name: "Dryer",
        category: "Laundry",
        quantity: 1,
        wattage: 2200,
        hoursPerDay: 1,
        dutyCycle: 1,
        activeDays: ["sat"],
      },
    ],
    diversityFactor: 0.75,
  });

  assert.equal(result.weeklyKWh, 64.6);
  assert.equal(result.averageDailyKWh, 9.23);
  assert.equal(result.busiestDay.id, "mon");
  assert.equal(result.busiestDay.kWh, 12.48);
  assert.equal(result.estimatedPeakKW, 1.8);
  assert.deepEqual(
    result.dailyTotals.map((day) => [day.id, day.kWh]),
    DAYS.map((day) => [day.id, day.id === "sat" ? 2.2 : day.id === "sun" ? 0 : 12.48]),
  );
});

test("groups demand by category across the weekly schedule", () => {
  const result = calculateDemandResult({
    appliances: [
      {
        id: "lights",
        presetId: "lighting",
        name: "Lighting",
        category: "Lighting",
        quantity: 10,
        wattage: 9,
        hoursPerDay: 6,
        dutyCycle: 1,
        activeDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      },
      {
        id: "washer",
        presetId: "washing-machine",
        name: "Washer",
        category: "Laundry",
        quantity: 1,
        wattage: 500,
        hoursPerDay: 1,
        dutyCycle: 0.8,
        activeDays: ["sun"],
      },
    ],
    diversityFactor: 1,
  });

  assert.deepEqual(result.categoryBreakdown, [
    { category: "Lighting", weeklyKWh: 3.78, percent: 90.4 },
    { category: "Laundry", weeklyKWh: 0.4, percent: 9.6 },
  ]);
});

test("handles empty schedules without invalid numbers", () => {
  const result = calculateDemandResult({
    appliances: [],
    diversityFactor: 1,
  });

  assert.equal(result.weeklyKWh, 0);
  assert.equal(result.averageDailyKWh, 0);
  assert.equal(result.estimatedPeakKW, 0);
  assert.equal(result.busiestDay.kWh, 0);
  assert.equal(result.categoryBreakdown.length, 0);
});
