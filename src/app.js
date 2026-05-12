import { DAYS, calculateDemandResult } from "./calculations.js";
import { appliancePresets, categories } from "./presets.js";

const STORAGE_KEY = "home-energy-studio-customers-v3";
const allDayIds = DAYS.map((day) => day.id);

const defaultConfig = {
  diversityFactor: 0.75,
  appliances: [],
};

const steps = [
  { id: "customers", label: "Customers", icon: "users" },
  { id: "activity", label: "Appliances", icon: "plug" },
  { id: "results", label: "Results", icon: "chart" },
];

let state = loadState();
let pendingReset = false;
const app = document.querySelector("#app");

function scrollToPageTop() {
  const jumpToTop = () => window.scrollTo(0, 0);
  jumpToTop();
  requestAnimationFrame(jumpToTop);
  requestAnimationFrame(() => requestAnimationFrame(jumpToTop));
  setTimeout(jumpToTop, 120);
}

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

function getTotalApplianceQuantity(appliances) {
  if (!Array.isArray(appliances)) return 0;
  return appliances.reduce((sum, appliance) => sum + (Number(appliance.quantity) || 0), 0);
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
              ${icon(step.icon)}
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
          <h2>${icon("users")} Add customer profile before configuring appliances.</h2>
          <p class="muted">Each customer keeps their own appliance list, schedule, hours, and power settings.</p>
        </div>
        <div class="customer-create-form">
          ${field("Customer name", "customerNameDraft", state.customerNameDraft, "text", "Name or house label")}
          <button class="primary" data-action="add-customer">${icon("plus")} Add customer</button>
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
  const totalAppliances = getTotalApplianceQuantity(customer.appliances);

  return `
    <article class="customer-card ${isActive ? "selected" : ""}">
      <button class="customer-select" data-select-customer="${customer.id}">
        <span>${isActive ? "Selected" : "Tap to select"}</span>
        <strong>${icon("home")} ${escapeHtml(customer.name)}</strong>
        <small>${totalAppliances} appliances • ${number(result.weeklyKWh)} kWh/week • updated ${formatDate(customer.updatedAt)}</small>
      </button>
      <button class="secondary" data-open-customer="${customer.id}">${icon("settings")} Configure</button>
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
          <h2>${icon("home")} ${escapeHtml(activeCustomer()?.name || "No customer selected")}</h2>
        </div>
        <div class="active-customer-stats">
          <span><strong>${getTotalApplianceQuantity(config.appliances)}</strong> appliances</span>
          <span><strong>${number(result.weeklyKWh)}</strong> kWh/week</span>
          <button class="secondary" data-action="customers">${icon("users")} Change customer</button>
        </div>
      </section>
      <div class="grid-two wide-right">
        <section class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Appliance library</p>
              <h2>${icon("plug")} Add appliances to the activity schedule.</h2>
            </div>
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
            <p class="helper-text">How much of the connected load may run at the same time. Use 1 for worst case.</p>
          </div>
        </section>
        <section class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Daily activity</p>
              <h2>${icon("calendar")} ${getTotalApplianceQuantity(config.appliances)} loads, ${number(result.weeklyKWh)} kWh/week</h2>
            </div>
            <button class="secondary" data-action="clear-appliances" ${activeCustomer() && config.appliances.length ? "" : "disabled"}>${icon("trash")} Clear all</button>
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
        ${smallField("Duty", appliance.id, "dutyCycle", appliance.dutyCycle, "step=\"0.05\" max=\"1\"", "Actual running ratio. 1 = full time.")}
      </div>
      <div class="day-toggle-row" aria-label="Active days for ${escapeHtml(appliance.name)}">
        ${DAYS.map(
          (day) => `
            <button type="button" class="day-toggle ${appliance.activeDays.includes(day.id) ? "selected" : ""}" data-day="${day.id}" data-day-appliance="${appliance.id}">
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
        <h2>${icon("chart")} Weekly usage by category</h2>
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
          <div><dt>Appliance count</dt><dd>${getTotalApplianceQuantity(config.appliances)} selected loads</dd></div>
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
      <button class="danger-small ${pendingReset ? "confirming" : ""}" data-action="${pendingReset ? "confirm-reset" : "reset"}">
        ${pendingReset ? "Confirm clear all" : "Reset all"}
      </button>
      <div>
      ${pendingReset ? '<button class="secondary compact-action" data-action="cancel-reset">Cancel</button>' : ""}
        <button class="secondary" data-action="home" ${state.currentStep === 0 ? "disabled" : ""}>Back to home</button>
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

function smallField(label, applianceId, key, value, attrs = "", help = "") {
  return `
    <label>
      <span>${label}</span>
      <input data-appliance="${applianceId}" data-key="${key}" type="number" value="${value}" min="0" ${key === "name" ? 'data-defer-update="true"' : ""} ${attrs} />
      ${help ? `<small class="field-help">${help}</small>` : ""}
    </label>
  `;
}

function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

function icon(name) {
  const paths = {
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8Z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    home: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.08A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.08A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.08A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9c.35.14.7.35 1 .6.3.3.45.7.4 1.1V11a2 2 0 1 1 0 4h-.08a1.7 1.7 0 0 0-1.32 0Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
    scroll: '<path d="M8 3h8a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="m12 17 2-2"/><path d="m12 17-2-2"/>',
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
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
    button.addEventListener("click", (event) => {
      event.preventDefault();
      toggleApplianceDay(button.dataset.dayAppliance, button.dataset.day);
    });
  });
}

function handleAction(action) {
  if (action !== "reset" && action !== "confirm-reset" && action !== "cancel-reset") {
    pendingReset = false;
  }

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
    const nextStep = state.currentStep === steps.length - 1 ? 1 : state.currentStep + 1;
    const shouldScrollToTop = state.currentStep === 1;
    setState({ currentStep: nextStep });
    if (shouldScrollToTop) {
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, 0)));
      });
      setTimeout(() => window.scrollTo(0, 0), 100);
    }
  }
  if (action === "customers") {
    setState({ currentStep: 0 });
  }
  if (action === "home") {
    setState({ currentStep: 0 });
  }
  if (action === "reset") {
    pendingReset = true;
    render();
  }
  if (action === "cancel-reset") {
    pendingReset = false;
    render();
  }
  if (action === "confirm-reset") {
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    pendingReset = false;
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
