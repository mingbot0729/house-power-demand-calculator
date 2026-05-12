/**
 * @typedef {Object} AppliancePreset
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {number} wattage
 * @property {number} hoursPerDay
 * @property {number} dutyCycle
 * @property {string} note
 */

export const appliancePresets = [
  {
    id: "lighting",
    name: "LED lighting",
    category: "Lighting",
    wattage: 9,
    hoursPerDay: 6,
    dutyCycle: 1,
    note: "Per lamp or downlight point",
  },
  {
    id: "refrigerator",
    name: "Refrigerator",
    category: "Kitchen",
    wattage: 180,
    hoursPerDay: 24,
    dutyCycle: 1,
    note: "Compressor cycles during the day",
  },
  {
    id: "air-conditioner",
    name: "Air-conditioner",
    category: "Cooling",
    wattage: 1200,
    hoursPerDay: 8,
    dutyCycle: 1,
    note: "Typical split unit estimate",
  },
  {
    id: "water-heater",
    name: "Water heater",
    category: "Water Heating",
    wattage: 3000,
    hoursPerDay: 1,
    dutyCycle: 1,
    note: "Instant or storage heater session",
  },
  {
    id: "washing-machine",
    name: "Washing machine",
    category: "Laundry",
    wattage: 500,
    hoursPerDay: 0.8,
    dutyCycle: 1,
    note: "Average wash cycle",
  },
  {
    id: "dryer",
    name: "Dryer",
    category: "Laundry",
    wattage: 2200,
    hoursPerDay: 0.8,
    dutyCycle: 1,
    note: "Heat-pump models may be lower",
  },
  {
    id: "oven",
    name: "Oven",
    category: "Kitchen",
    wattage: 2400,
    hoursPerDay: 0.7,
    dutyCycle: 1,
    note: "Heating elements cycle after preheat",
  },
  {
    id: "induction-hob",
    name: "Induction hob",
    category: "Kitchen",
    wattage: 1800,
    hoursPerDay: 1,
    dutyCycle: 1,
    note: "Per active cooking zone",
  },
  {
    id: "television",
    name: "Television",
    category: "Entertainment",
    wattage: 120,
    hoursPerDay: 5,
    dutyCycle: 1,
    note: "Modern LED TV",
  },
  {
    id: "router",
    name: "Router and modem",
    category: "Always On",
    wattage: 20,
    hoursPerDay: 24,
    dutyCycle: 1,
    note: "Network equipment",
  },
  {
    id: "computer",
    name: "Computer workstation",
    category: "Office",
    wattage: 250,
    hoursPerDay: 6,
    dutyCycle: 1,
    note: "Desktop or monitor setup",
  },
  {
    id: "fan",
    name: "Ceiling fan",
    category: "Cooling",
    wattage: 65,
    hoursPerDay: 8,
    dutyCycle: 1,
    note: "Per fan",
  },
  {
    id: "ev-charger",
    name: "EV charger",
    category: "Mobility",
    wattage: 7400,
    hoursPerDay: 2,
    dutyCycle: 1,
    note: "Single-phase home charging",
  },
  {
    id: "custom",
    name: "Custom appliance",
    category: "Custom",
    wattage: 100,
    hoursPerDay: 1,
    dutyCycle: 1,
    note: "Enter the nameplate or measured value",
  },
];

export const categories = [...new Set(appliancePresets.map((preset) => preset.category))];
