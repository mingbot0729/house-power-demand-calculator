import { DAYS, calculateDemandResult } from "./calculations.js";
import { appliancePresets, categories } from "./presets.js";

const STORAGE_KEY = "home-energy-studio-customers-v3";
const LEGACY_STORAGE_KEY = "home-energy-studio-demand-v2";
const allDayIds = DAYS.map((day) => day.id);

const defaultConfig = {
  diversityFactor: 0.75,
  appliances: [
    makeAppliance(appliancePresets.find((preset) => preset.id === "lighting"), 24),
    makeAppliance(appliancePresets.find((preset) => preset.id === "refrigerator"), 1),
    makeAppliance(appliancePresets.find((preset) => preset.id === "air-conditioner"), 3, [
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
    ]),
    makeAppliance(appliancePresets.find((preset) => preset.id === "water-heater"), 2),
    makeAppliance(appliancePresets.find((preset) => preset.id === "router"), 1),
  ],
};

const steps = [
  { id: "customers", label: "Customers" },
  { id: "activity", label: "Appliances" },
  { id: "results", label: "Results" },
];

let state = loadState();
const app = document.querySelector("#app");

function makeAppliance(preset, quantity = 1, activeDays = allDayIds) {
  return {
    id: crypto.randomUUID(),
    presetId: preset.id,
    name: preset.name,
    category: preset.category,
    quantity,
    wattage: preset.wattage,
    hoursPerDay: preset.hoursPerDay,
    dutyCycle: preset.dutyCycle,
    activeDays,
  };
}

function createCustomer(name, config = structuredClone(defaultConfig)) {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...normalizeConfig(config),
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.customers) {
      const customers = saved.customers.map(normalizeCustomer);
      return {
        currentStep: 0,
        selectedCategory: "All",
        customerNameDraft: "",
        activeCustomerId: customers.some((item) => item.id === saved.activeCustomerId)
          ? saved.activeCustomerId
          : customers[0]?.id || null,
        customers,
      };
    }

    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (legacy?.appliances) {
      const customer = createCustomer("Saved configuration", legacy);
      return {
        currentStep: 0,
        selectedCategory: "All",
        customerNameDraft: "",
        activeCustomerId: customer.id,
        customers: [customer],
      };
    }
  } catch {
    // Fall through to a clean state.
  }

  return {
    currentStep: 0,
    selectedCategory: "All",
    customerNameDraft: "",
    activeCustomerId: null,
    customers: [],
  };
}

function normalizeCustomer(customer) {
  return {
    ...customer,
    name: customer.name || "Unnamed customer",
    updatedAt: customer.updatedAt || new Date().toISOString(),
    ...normalizeConfig(customer),
  };
}

function normalizeConfig(config) {
  return {
    diversityFactor: Number(config.diversityFactor) || defaultConfig.diversityFactor,
    appliances: normalizeSavedAppliances(config.appliances),
  };
}

function normalizeSavedAppliances(appliances) {
  if (!Array.isArray(appliances)) return structuredClone(defaultConfig.appliances);
  return appliances.map((appliance) => ({
    ...appliance,
    activeDays: Array.isArray(appliance.activeDays) ? appliance.activeDays : allDayIds,
  }));
}

function activeCustomer() {
  return state.customers.find((customer) => customer.id === state.activeCustomerId) || null;
}

function activeConfig() {
  return activeCustomer() || { ...structuredClone(defaultConfig), name: "No customer selected" };
}

function saveState() {
  const { currentStep, selectedCategory, customerNameDraft, ...savedState } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
}

function setState(updater) {
  state = typeof updater === "function" ? updater(state) : { ...state, ...updater };
  saveState();
  render();
}

function updateActiveCustomer(updater) {
  setState((current) => ({
    ...current,
    customers: current.customers.map((customer) => {
      if (customer.id !== current.activeCustomerId) return customer;
      return {
        ...customer,
        ...updater(customer),
        updatedAt: new Date().toISOString(),
      };
    }),
  }));
}

function number(value, digits = 2) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: digits,
  }).format(value || 0);
}

function render() {
  const config = activeConfig();
  const result = calculateDemandResult({
    appliances: config.appliances,
    diversityFactor: config.diversityFactor,
  });

  app.innerHTML = `
    <main class="shell">
      <header class="app-header">
        <div>
          <p class="eyebrow">Home Energy Studio</p>
          <h1>House power demand calculator</h1>
        </div>
        <div class="header-metrics" aria-label="Current estimate">
          <span><strong>${escapeHtml(activeCustomer()?.name || "No customer")}</strong> selected</span>
          <span><strong>${number(result.averageDailyKWh)}</strong> kWh avg/day</span>
          <span><strong>${number(result.estimatedPeakKW)}</strong> kW peak</span>
        </div>
      </header>
      ${renderStepper()}
      <section class="workspace">
        ${renderStep(result, config)}
      </section>
      ${renderFooter()}
    </main>
  `;

  bindEvents();
}

function renderStepper() {
  return `
    <nav class="stepper" aria-label="Consultation steps">
      ${steps
        .map(
          (step, index) => `
            <button class="step ${index === state.currentStep ? "active" : ""}" data-step="${index}">
              <span>${index + 1}</span>
              ${step.label}
            </button>
          `,
        )
        .join("")}
    </nav>
  `;
}

function renderStep(result, config) {
  if (state.currentStep === 0) return renderCustomerStep();
  if (state.currentStep === 1) return renderActivityStep(result, config);
  return renderResultsStep(result, config);
}

function renderCustomerStep() {
  return `
    <div class="customer-page">
      <section class="panel customer-create-panel">
        <div>
          <p class="eyebrow">Customer profile</p>
          <h2>Add customer profile before configuring appliances.</h2>
          <p class="muted">Each customer keeps their own appliance list, schedule, hours, and power settings.</p>
        </div>
        <div class="customer-create-form">
          ${field("Customer name", "customerNameDraft", state.customerNameDraft, "text", "Name or house label")}
          <button class="primary" data-action="add-customer">Add customer</button>
        </div>
      </section>
      <section class="panel customer-list-panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Customer list</p>
            <h2>Previously configured customer profiles</h2>
          </div>
        </div>
        <div class="customer-list">
          ${state.customers.length ? state.customers.map(renderCustomerCard).join("") : emptyState("No customers yet. Add one above to start.")}
        </div>
      </section>
    </div>
  `;
}

function renderCustomerCard(customer) {
  const result = calculateDemandResult({
    appliances: customer.appliances,
    diversityFactor: customer.diversityFactor,
  });
  const isActive = customer.id === state.activeCustomerId;

  return `
    <article class="customer-card ${isActive ? "selected" : ""}">
      <button class="customer-select" data-select-customer="${customer.id}">
        <span>${isActive ? "Selected" : "Tap to select"}</span>
        <strong>${escapeHtml(customer.name)}</strong>
        <small>${customer.appliances.length} appliances • ${number(result.weeklyKWh)} kWh/week • updated ${formatDate(customer.updatedAt)}</small>
      </button>
      <button class="secondary" data-open-customer="${customer.id}">Configure</button>
      <button class="icon-button" data-delete-customer="${customer.id}" aria-label="Delete ${escapeHtml(customer.name)}">x</button>
    </article>
  `;
}

function renderActivityStep(result, config) {
  const categoryOptions = ["All", ...categories];
  const presets = state.selectedCategory === "All"
    ? appliancePresets
    : appliancePresets.filter((preset) => preset.category === state.selectedCategory);

  return `
    <div class="activity-page">
      <section class="panel active-customer-banner">
        <div>
          <p class="eyebrow">Currently configuring</p>
          <h2>${escapeHtml(activeCustomer()?.name || "No customer selected")}</h2>
        </div>
        <div class="active-customer-stats">
          <span><strong>${config.appliances.length}</strong> appliances</span>
          <span><strong>${number(result.weeklyKWh)}</strong> kWh/week</span>
          <button class="secondary" data-action="customers">Change customer</button>
        </div>
      </section>
      <div class="grid-two wide-right">
        <section class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Appliance library</p>
              <h2>Add appliances to the activity schedule.</h2>
            </div>
            <button class="secondary" data-action="clear-appliances" ${activeCustomer() ? "" : "disabled"}>Clear</button>
          </div>
          <div class="chips">
            ${categoryOptions
              .map(
                (category) => `
                  <button class="chip ${category === state.selectedCategory ? "selected" : ""}" data-category="${category}">
                    ${category}
                  </button>
                `,
              )
              .join("")}
          </div>
          <div class="preset-grid">
            ${presets
              .map(
                (preset) => `
                  <button class="preset-card" data-add-preset="${preset.id}" ${activeCustomer() ? "" : "disabled"}>
                    <span>${preset.category}</span>
                    <strong>${preset.name}</strong>
                    <small>${preset.wattage} W default, ${preset.hoursPerDay} h/day</small>
                  </button>
                `,
              )
              .join("")}
          </div>
          <div class="demand-setting">
            ${field("Peak diversity factor", "diversityFactor", config.diversityFactor, "number", "0 to 1", "step=\"0.05\" max=\"1\"")}
          </div>
        </section>
        <section class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Daily activity</p>
              <h2>${config.appliances.length} loads, ${number(result.weeklyKWh)} kWh/week</h2>
            </div>
          </div>
          <div class="appliance-list">
            ${activeCustomer()
              ? config.appliances.length
                ? config.appliances.map(renderApplianceRow).join("")
                : emptyState("Add appliances from the library to begin.")
              : emptyState("Select or add a customer first.")}
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderApplianceRow(appliance) {
  return `
    <article class="appliance-row">
      <div class="appliance-title">
        <input data-appliance="${appliance.id}" data-key="name" value="${escapeHtml(appliance.name)}" aria-label="Appliance name" data-defer-update="true" />
        <button class="icon-button" data-remove="${appliance.id}" aria-label="Remove appliance">x</button>
      </div>
      <div class="row-grid">
        ${smallField("Qty", appliance.id, "quantity", appliance.quantity)}
        ${smallField("Watts", appliance.id, "wattage", appliance.wattage)}
        ${smallField("Hours/day", appliance.id, "hoursPerDay", appliance.hoursPerDay, "step=\"0.25\"")}
        ${smallField("Duty", appliance.id, "dutyCycle", appliance.dutyCycle, "step=\"0.05\" max=\"1\"")}
      </div>
      <div class="day-toggle-row" aria-label="Active days for ${escapeHtml(appliance.name)}">
        ${DAYS.map(
          (day) => `
            <button class="day-toggle ${appliance.activeDays.includes(day.id) ? "selected" : ""}" data-day="${day.id}" data-day-appliance="${appliance.id}">
              ${day.label}
            </button>
          `,
        ).join("")}
      </div>
    </article>
  `;
}

function renderResultsStep(result, config) {
  return `
    <div class="results-layout">
      <section class="panel hero-result">
        <p class="eyebrow">${escapeHtml(activeCustomer()?.name || "Power demand estimate")}</p>
        <h2>This house uses about ${number(result.averageDailyKWh)} kWh per day on average.</h2>
        <div class="result-cards">
          ${metricCard("Weekly energy", `${number(result.weeklyKWh)} kWh`, "Total selected activity")}
          ${metricCard("Average day", `${number(result.averageDailyKWh)} kWh`, "Weekly total divided by 7")}
          ${metricCard("Busiest day", result.busiestDay.label, `${number(result.busiestDay.kWh)} kWh`)}
          ${metricCard("Peak demand", `${number(result.estimatedPeakKW)} kW`, "With diversity factor")}
        </div>
        ${renderDailyBars(result)}
      </section>
      <section class="panel">
        <p class="eyebrow">Load breakdown</p>
        <h2>Weekly usage by category</h2>
        ${renderDonut(result)}
        <div class="breakdown-list">
          ${result.categoryBreakdown.length ? result.categoryBreakdown.map(renderBreakdownItem).join("") : emptyState("No appliance loads selected.")}
        </div>
      </section>
      <section class="panel assumptions">
        <p class="eyebrow">Visible assumptions</p>
        <h2>Editable demand inputs</h2>
        <dl>
          <div><dt>Customer</dt><dd>${escapeHtml(activeCustomer()?.name || "None selected")}</dd></div>
          <div><dt>Appliance count</dt><dd>${config.appliances.length} selected loads</dd></div>
          <div><dt>Diversity factor</dt><dd>${config.diversityFactor}</dd></div>
          <div><dt>Demand method</dt><dd>Quantity x watts x hours x duty cycle x selected days</dd></div>
          <div><dt>Peak method</dt><dd>Highest active-day connected load x diversity factor</dd></div>
        </dl>
        <p class="fine-print">Estimates are for customer discussion and planning. Confirm final electrical design from actual equipment ratings, usage patterns, and site conditions.</p>
      </section>
    </div>
  `;
}

function renderDailyBars(result) {
  const max = Math.max(...result.dailyTotals.map((day) => day.kWh), 1);
  return `
    <div class="daily-chart" aria-label="Daily power demand chart">
      ${result.dailyTotals
        .map(
          (day) => `
            <div class="daily-bar">
              <span>${day.label}</span>
              <i style="height:${Math.max(4, (day.kWh / max) * 100)}%"></i>
              <strong>${number(day.kWh, 1)}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderDonut(result) {
  let offset = 0;
  const segments = result.categoryBreakdown
    .map((item, index) => {
      const length = item.percent;
      const color = ["#2d5d55", "#d08b3e", "#456c9b", "#8d5d74", "#5f7d49", "#b84d4d"][index % 6];
      const segment = `${color} ${offset} ${offset + length}`;
      offset += length;
      return segment;
    })
    .join(", ");
  const background = segments || "#d8d2c6 0 100";

  return `<div class="donut" style="background: conic-gradient(${background})"><span>${number(result.weeklyKWh)}<small>kWh/week</small></span></div>`;
}

function renderBreakdownItem(item) {
  return `
    <div class="breakdown-item">
      <span>${item.category}</span>
      <strong>${number(item.weeklyKWh)} kWh/week</strong>
      <small>${number(item.percent, 1)}%</small>
    </div>
  `;
}

function metricCard(label, value, caption) {
  return `
    <article class="metric-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${caption}</small>
    </article>
  `;
}

function renderFooter() {
  const hasActiveCustomer = Boolean(activeCustomer());
  return `
    <footer class="footer-actions">
      <button class="secondary" data-action="reset">Reset all</button>
      <div>
        <button class="secondary" data-action="back" ${state.currentStep === 0 ? "disabled" : ""}>Back</button>
        <button class="primary" data-action="next" ${!hasActiveCustomer ? "disabled" : ""}>${state.currentStep === steps.length - 1 ? "Review again" : "Next"}</button>
      </div>
    </footer>
  `;
}

function field(label, path, value, type = "text", suffix = "", attrs = "") {
  return `
    <label class="field">
      <span>${label}</span>
      <div>
        <input data-path="${path}" type="${type}" value="${escapeHtml(value)}" ${type === "text" ? 'data-defer-update="true"' : ""} ${attrs} />
        ${suffix ? `<small>${suffix}</small>` : ""}
      </div>
    </label>
  `;
}

function smallField(label, applianceId, key, value, attrs = "") {
  return `
    <label>
      <span>${label}</span>
      <input data-appliance="${applianceId}" data-key="${key}" type="number" value="${value}" min="0" ${key === "name" ? 'data-defer-update="true"' : ""} ${attrs} />
    </label>
  `;
}

function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

function bindEvents() {
  app.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      if (Number(button.dataset.step) > 0 && !activeCustomer()) return;
      setState({ currentStep: Number(button.dataset.step) });
    });
  });

  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action));
  });

  app.querySelectorAll("[data-path]").forEach((input) => {
    input.addEventListener("input", () => updatePathSilently(input.dataset.path, input.value, input.type));
    input.addEventListener("change", () => render());
  });

  app.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => setState({ selectedCategory: button.dataset.category }));
  });

  app.querySelectorAll("[data-select-customer]").forEach((button) => {
    button.addEventListener("click", () => setState({ activeCustomerId: button.dataset.selectCustomer }));
  });

  app.querySelectorAll("[data-open-customer]").forEach((button) => {
    button.addEventListener("click", () => setState({ activeCustomerId: button.dataset.openCustomer, currentStep: 1 }));
  });

  app.querySelectorAll("[data-delete-customer]").forEach((button) => {
    button.addEventListener("click", () => deleteCustomer(button.dataset.deleteCustomer));
  });

  app.querySelectorAll("[data-add-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = appliancePresets.find((item) => item.id === button.dataset.addPreset);
      updateActiveCustomer((customer) => ({
        appliances: [...customer.appliances, makeAppliance(preset)],
      }));
    });
  });

  app.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      updateActiveCustomer((customer) => ({
        appliances: customer.appliances.filter((item) => item.id !== button.dataset.remove),
      }));
    });
  });

  app.querySelectorAll("[data-appliance]").forEach((input) => {
    input.addEventListener("input", () =>
      updateApplianceSilently(input.dataset.appliance, input.dataset.key, input.value, input.type),
    );
    input.addEventListener("change", () => render());
  });

  app.querySelectorAll("[data-day-appliance]").forEach((button) => {
    button.addEventListener("click", () => toggleApplianceDay(button.dataset.dayAppliance, button.dataset.day));
  });
}

function handleAction(action) {
  if (action === "add-customer") {
    const inputName = app.querySelector('[data-path="customerNameDraft"]')?.value || "";
    const name = (state.customerNameDraft || inputName).trim();
    if (!name) return;
    const customer = createCustomer(name);
    setState((current) => ({
      ...current,
      customerNameDraft: "",
      activeCustomerId: customer.id,
      customers: [customer, ...current.customers],
    }));
  }
  if (action === "next" && activeCustomer()) {
    setState({ currentStep: state.currentStep === steps.length - 1 ? 0 : state.currentStep + 1 });
  }
  if (action === "back") {
    setState({ currentStep: Math.max(0, state.currentStep - 1) });
  }
  if (action === "customers") {
    setState({ currentStep: 0 });
  }
  if (action === "reset") {
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    render();
  }
  if (action === "clear-appliances" && activeCustomer()) {
    updateActiveCustomer(() => ({ appliances: [] }));
  }
}

function deleteCustomer(customerId) {
  setState((current) => {
    const customers = current.customers.filter((customer) => customer.id !== customerId);
    const activeCustomerId =
      current.activeCustomerId === customerId ? customers[0]?.id || null : current.activeCustomerId;
    return {
      ...current,
      customers,
      activeCustomerId,
      currentStep: customers.length ? current.currentStep : 0,
    };
  });
}

function toggleApplianceDay(applianceId, dayId) {
  updateActiveCustomer((customer) => ({
    appliances: customer.appliances.map((appliance) => {
      if (appliance.id !== applianceId) return appliance;
      const activeDays = appliance.activeDays.includes(dayId)
        ? appliance.activeDays.filter((day) => day !== dayId)
        : [...appliance.activeDays, dayId];
      return { ...appliance, activeDays };
    }),
  }));
}

function updatePath(path, value, inputType) {
  const normalized = normalizeValue(value, inputType);

  if (path === "customerNameDraft") {
    setState({ customerNameDraft: normalized });
    return;
  }

  if (path === "diversityFactor") {
    updateActiveCustomer(() => ({ diversityFactor: normalized }));
  }
}

function updatePathSilently(path, value, inputType) {
  const normalized = normalizeValue(value, inputType);

  if (path === "customerNameDraft") {
    state = { ...state, customerNameDraft: normalized };
    return;
  }

  if (path === "diversityFactor") {
    state = {
      ...state,
      customers: state.customers.map((customer) =>
        customer.id === state.activeCustomerId
          ? { ...customer, diversityFactor: normalized, updatedAt: new Date().toISOString() }
          : customer,
      ),
    };
    saveState();
  }
}

function updateApplianceSilently(applianceId, key, value, inputType) {
  const normalized = normalizeValue(value, inputType);

  state = {
    ...state,
    customers: state.customers.map((customer) => {
      if (customer.id !== state.activeCustomerId) return customer;
      return {
        ...customer,
        updatedAt: new Date().toISOString(),
        appliances: customer.appliances.map((appliance) =>
          appliance.id === applianceId ? { ...appliance, [key]: normalized } : appliance,
        ),
      };
    }),
  };
  saveState();
}

function normalizeValue(value, inputType) {
  return inputType === "number" ? Math.max(0, Number(value) || 0) : value;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js");
  });
}

render();
