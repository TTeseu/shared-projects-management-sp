const MUNICIPALITIES = [
  "CANAS",
  "POTIM",
  "TREMEMBÉ",
  "TAUBATÉ",
  "SÃO SEBASTIÃO",
  "SÃO JOSÉ DOS CAMPOS",
  "SANTA BRANCA",
  "ROSEIRA",
  "PINDAMONHANGABA",
  "MONTEIRO LOBATO",
  "LORENA",
  "JAMBEIRO",
  "JACAREÍ",
  "GUARATINGUETÁ",
  "CRUZEIRO",
  "CARAGUATATUBA",
  "CACHOEIRA PAULISTA",
  "CAÇAPAVA",
  "APARECIDA",
  "SUZANO",
  "SALESÓPOLIS",
  "POÁ",
  "MOGI DAS CRUZES",
  "ITAQUAQUECETUBA",
  "GUARULHOS",
  "GUARAREMA",
  "FERRAZ DE VASCONCELOS",
  "BIRITIBA MIRIM",
];

const TYPES = ["Ocupação de postes novos", "Regularização", "Desocupação"];
const OPINIONS = ["ISR", "DSR"];
const STATUSES = ["Concluído", "Negado", "Aguardando"];
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const DENIAL_REASONS = [
  "Não encaminhou a documentação pendente",
  "Não encaminhou a documentação retificada",
];

const STORAGE_KEYS = {
  companies: "spmsp.companies.v1",
  projects: "spmsp.projects.v1",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const state = {
  companies: loadArray(STORAGE_KEYS.companies),
  projects: loadArray(STORAGE_KEYS.projects),
  currentSection: "occupation",
  batchRowId: 0,
  pendingDenyId: null,
};

const remoteSync = {
  enabled: location.protocol === "http:" || location.protocol === "https:",
  ready: false,
  timer: null,
  saving: false,
};

const sectionCopy = {
  occupation: {
    title: "Ocupação/Regularização",
    subtitle: "Projetos concluídos de ocupação e regularização.",
  },
  vacancy: {
    title: "Desocupação",
    subtitle: "Projetos concluídos de desocupação com prazo de 90 dias.",
  },
  waiting: {
    title: "Aguardando",
    subtitle: "Projetos aguardando resposta com prazo de 10 dias corridos.",
  },
  denied: {
    title: "Negados",
    subtitle: "Projetos negados com motivo registrado.",
  },
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  populateSelects();
  bindNavigation();
  bindCompanyForm();
  bindProjectForms();
  bindQueryControls();
  bindModals();
  bindUtilityActions();
  addBatchRow();
  renderAll();
  refreshIcons();
  loadRemoteData();
}

function loadArray(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEYS.companies, JSON.stringify(state.companies));
  localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(state.projects));
  scheduleRemoteSave();
}

async function loadRemoteData() {
  if (!remoteSync.enabled) return;
  try {
    const response = await fetch("/api/data", { cache: "no-store" });
    if (!response.ok) throw new Error("Banco indisponível.");
    const data = await response.json();
    if (Array.isArray(data.companies) && Array.isArray(data.projects)) {
      state.companies = data.companies;
      state.projects = data.projects;
      localStorage.setItem(STORAGE_KEYS.companies, JSON.stringify(state.companies));
      localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(state.projects));
      renderAll();
    }
    remoteSync.ready = true;
  } catch (error) {
    remoteSync.ready = false;
    showToast("Banco Neon indisponível. Usando dados locais neste navegador.", "warning");
  }
}

function scheduleRemoteSave() {
  if (!remoteSync.enabled || !remoteSync.ready) return;
  clearTimeout(remoteSync.timer);
  remoteSync.timer = setTimeout(saveRemoteData, 350);
}

async function saveRemoteData() {
  if (remoteSync.saving) {
    scheduleRemoteSave();
    return;
  }
  remoteSync.saving = true;
  try {
    const response = await fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companies: state.companies, projects: state.projects }),
    });
    if (!response.ok) throw new Error("Falha ao salvar no banco.");
  } catch (error) {
    showToast("Não foi possível sincronizar com o Neon agora.", "warning");
  } finally {
    remoteSync.saving = false;
  }
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function populateSelects() {
  const cityTargets = [
    "#singleCity",
    "#batchSharedCity",
    "#editCity",
    "#filterCity",
  ];
  cityTargets.forEach((selector) => fillSelect($(selector), MUNICIPALITIES, selector.includes("filter") ? "Todos" : "Selecione"));

  ["#singleType", "#batchType", "#editType"].forEach((selector) =>
    fillSelect($(selector), TYPES, selector.includes("filter") ? "Todos" : "Selecione")
  );
  fillSelect($("#filterType"), ["Ocupação de postes novos", "Regularização"], "Todos");
  ["#singleOpinion", "#batchOpinion", "#editOpinion", "#filterOpinion"].forEach((selector) =>
    fillSelect($(selector), OPINIONS, selector.includes("filter") ? "Todos" : "Selecione")
  );
  ["#singleStatus", "#batchStatus", "#editStatus"].forEach((selector) =>
    fillSelect($(selector), STATUSES, selector.includes("filter") ? "Todos" : "Selecione")
  );
  ["#singleMonth", "#batchMonth", "#editMonth", "#filterMonth"].forEach((selector) =>
    fillSelect($(selector), MONTHS, selector.includes("filter") ? "Todos" : "Selecione")
  );
  fillSelect($("#editReason"), DENIAL_REASONS, "Selecione");
  fillSelect($("#denyReason"), DENIAL_REASONS, "Selecione");
  fillSelect($("#singleReason"), DENIAL_REASONS, "Selecione");
  fillSelect($("#batchReason"), DENIAL_REASONS, "Selecione");
  fillSelect($("#filterReason"), DENIAL_REASONS, "Todos");
  setDefaultCadastroOpinions();
}

function fillSelect(select, values, placeholder) {
  if (!select) return;
  select.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  select.appendChild(first);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function setDefaultCadastroOpinions() {
  const singleOpinion = $("#singleOpinion");
  const batchOpinion = $("#batchOpinion");
  if (singleOpinion && !singleOpinion.value) singleOpinion.value = "ISR";
  if (batchOpinion && !batchOpinion.value) batchOpinion.value = "ISR";
}

function bindNavigation() {
  $$("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      $$("[data-tab]").forEach((item) => item.classList.remove("active"));
      $$(".tab-panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      $(`#${button.dataset.tab}`).classList.add("active");
      updateBreadcrumb(button.dataset.tab);
      renderAll();
    });
  });

  $$(".subtab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".subtab").forEach((item) => item.classList.remove("active"));
      $$(".register-mode").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      $(`#${button.dataset.registerMode}-register`).classList.add("active");
    });
  });

  $$(".query-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentSection = button.dataset.section;
      $$(".query-tab").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderProjectTable();
    });
  });

  $$("[data-dashboard-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.dashboardAction;
      if (action === "register") {
        activateTab("project-register");
      } else if (action === "import") {
        activateTab("project-query");
        $("#projectImportInput")?.click();
      } else if (action === "waiting") {
        activateTab("project-query");
        setQuerySection("waiting");
      } else if (action === "vacancy") {
        activateTab("project-query");
        setQuerySection("vacancy");
      } else if (action === "companies") {
        activateTab("company-db");
      }
      refreshIcons();
    });
  });
}

function setQuerySection(section) {
  state.currentSection = section;
  $$(".query-tab").forEach((item) => item.classList.toggle("active", item.dataset.section === section));
  renderQueryView();
}

function bindCompanyForm() {
  $("#companyName").addEventListener("blur", (event) => {
    event.target.value = uppercaseCompanyName(event.target.value);
  });
  $("#companyPointValue").addEventListener("input", (event) => {
    event.target.value = maskPointValue(event.target.value);
  });

  $("#companyForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const id = $("#companyEditId").value;
    const name = uppercaseCompanyName($("#companyName").value);
    const partner = $("#companyPartner").value.trim();
    const pointValue = parseMoney($("#companyPointValue").value);

    if (!name || !partner || !Number.isFinite(pointValue) || pointValue <= 0) {
      showToast("Preencha nome, parceiro e valor do ponto válido.", "error");
      return;
    }

    const duplicate = state.companies.find(
      (company) => normalize(company.name) === normalize(name) && company.id !== id
    );
    if (duplicate) {
      showToast("Já existe uma empresa com esse nome.", "error");
      return;
    }

    if (id) {
      const company = state.companies.find((item) => item.id === id);
      if (company) {
        company.name = name;
        company.partner = partner;
        company.pointValue = pointValue;
        company.updatedAt = new Date().toISOString();
      }
      syncProjectsWithCompany(id);
      showToast("Empresa atualizada.", "success");
    } else {
      state.companies.push({
        id: uid("company"),
        name,
        partner,
        pointValue,
        createdAt: new Date().toISOString(),
      });
      showToast("Empresa cadastrada.", "success");
    }

    saveData();
    resetCompanyForm();
    renderAll();
  });

  $("#cancelCompanyEditBtn").addEventListener("click", resetCompanyForm);
  $("#companySearch").addEventListener("input", renderCompaniesTable);
  $("#companyImportInput").addEventListener("change", importCompanies);
  $("#companyExportBtn").addEventListener("click", exportCompanies);
}

function syncProjectsWithCompany(companyId) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) return;
  state.projects.forEach((project) => {
    if (project.companyId === companyId) {
      project.companyName = company.name;
      project.partner = company.partner;
      project.pointValue = company.pointValue;
      project.multipliedValue = calculateMultiplied(company.pointValue, project.poles);
      project.updatedAt = new Date().toISOString();
    }
  });
}

function resetCompanyForm() {
  $("#companyForm").reset();
  $("#companyEditId").value = "";
  $("#cancelCompanyEditBtn").classList.add("hidden");
}

function bindProjectForms() {
  setupCompanyAutocomplete("single");
  setupCompanyAutocomplete("batch");
  setupCompanyAutocomplete("edit");

  ["#singleType", "#singleStatus"].forEach((selector) =>
    $(selector).addEventListener("change", () => {
      updateMainDateLabel("single");
      toggleReasonField("single");
    })
  );
  ["#batchType", "#batchStatus"].forEach((selector) =>
    $(selector).addEventListener("change", () => {
      updateMainDateLabel("batch");
      toggleReasonField("batch");
    })
  );
  ["#editType", "#editStatus"].forEach((selector) =>
    $(selector).addEventListener("change", () => {
      updateMainDateLabel("edit");
      toggleEditConditionalFields();
    })
  );

  ["#singlePoles", "#singleCompany"].forEach((selector) =>
    $(selector).addEventListener("input", () => updateCalculatedValue("single"))
  );
  ["#batchCompany", "#batchPointValue"].forEach((selector) =>
    $(selector).addEventListener("input", updateBatchCalculatedValues)
  );
  ["#editPoles", "#editCompany"].forEach((selector) =>
    $(selector).addEventListener("input", () => updateCalculatedValue("edit"))
  );
  ["#singleOrder", "#editOrder"].forEach((selector) =>
    $(selector)?.addEventListener("input", (event) => sanitizeDigitsInput(event.target))
  );

  $("#singleProjectForm").addEventListener("submit", submitSingleProject);
  $("#singleProjectForm").addEventListener("reset", () => {
    setTimeout(() => {
      updateMainDateLabel("single");
      toggleReasonField("single");
      updateCalculatedValue("single");
      setDefaultCadastroOpinions();
    }, 0);
  });

  $("#sameCityToggle").addEventListener("change", updateBatchCityMode);
  $("#addBatchRowBtn").addEventListener("click", () => addBatchRow());
  $("#batchProjectForm").addEventListener("submit", submitBatchProjects);
}

function setupCompanyAutocomplete(prefix) {
  const companyInput = $(`#${prefix}Company`);
  if (!companyInput) return;
  companyInput.classList.add("company-autocomplete-input");

  const field = companyInput.closest(".field");
  if (field && !field.querySelector(".company-autocomplete-menu")) {
    field.classList.add("company-autocomplete");
    const menu = document.createElement("div");
    menu.className = "company-autocomplete-menu hidden";
    menu.dataset.companyMenu = prefix;
    field.appendChild(menu);
  }

  companyInput.addEventListener("input", () => {
    applyCompanyInput(prefix);
    renderCompanyAutocomplete(prefix);
  });
  companyInput.addEventListener("focus", () => renderCompanyAutocomplete(prefix));
  companyInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideCompanyAutocomplete(prefix);
  });
  document.addEventListener("click", (event) => {
    if (!field?.contains(event.target)) hideCompanyAutocomplete(prefix);
  });
}

function applyCompanyInput(prefix) {
  const companyInput = $(`#${prefix}Company`);
  const company = findCompanyByName(companyInput.value);
  const partner = $(`#${prefix}Partner`);
  const pointValue = $(`#${prefix}PointValue`);
  if (company) {
    partner.value = company.partner;
    pointValue.value = formatMoney(company.pointValue);
  } else {
    partner.value = "";
    pointValue.value = "";
  }
  updateCalculatedValue(prefix);
  if (prefix === "batch") updateBatchCalculatedValues();
}

function renderCompanyAutocomplete(prefix) {
  const input = $(`#${prefix}Company`);
  const menu = $(`[data-company-menu="${prefix}"]`);
  if (!input || !menu) return;

  const term = normalize(input.value);
  const matches = state.companies
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .filter((company) => {
      const haystack = normalize(`${company.name} ${company.partner} ${formatMoney(company.pointValue)}`);
      return !term || haystack.includes(term);
    })
    .slice(0, 8);

  if (!matches.length) {
    menu.innerHTML = `<div class="company-autocomplete-empty">Nenhuma empresa encontrada.</div>`;
    menu.classList.remove("hidden");
    return;
  }

  menu.innerHTML = matches
    .map(
      (company) => `
        <button type="button" class="company-option" data-company-id="${company.id}">
          <span>${escapeHtml(company.name)}</span>
          <small>${escapeHtml(company.partner)} | ${formatMoney(company.pointValue)}</small>
        </button>
      `
    )
    .join("");

  $$(".company-option", menu).forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      const company = state.companies.find((item) => item.id === button.dataset.companyId);
      if (!company) return;
      input.value = company.name;
      applyCompanyInput(prefix);
      hideCompanyAutocomplete(prefix);
    });
  });
  menu.classList.remove("hidden");
}

function hideCompanyAutocomplete(prefix) {
  const menu = $(`[data-company-menu="${prefix}"]`);
  if (menu) menu.classList.add("hidden");
}

function setupProjectCompanyFilterAutocomplete() {
  const input = $("#filterCompany");
  const field = input?.closest(".field");
  if (!input || !field) return;
  field.classList.add("company-autocomplete");
  if (!field.querySelector('[data-filter-company-menu="true"]')) {
    const menu = document.createElement("div");
    menu.className = "company-autocomplete-menu hidden";
    menu.dataset.filterCompanyMenu = "true";
    field.appendChild(menu);
  }
  input.addEventListener("input", renderProjectCompanyFilterAutocomplete);
  input.addEventListener("focus", renderProjectCompanyFilterAutocomplete);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideProjectCompanyFilterAutocomplete();
  });
  document.addEventListener("click", (event) => {
    if (!field.contains(event.target)) hideProjectCompanyFilterAutocomplete();
  });
}

function renderProjectCompanyFilterAutocomplete() {
  const input = $("#filterCompany");
  const menu = $('[data-filter-company-menu="true"]');
  if (!input || !menu) return;
  const term = normalize(input.value);
  const names = Array.from(new Set(state.projects.map((project) => project.companyName).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .filter((name) => !term || normalize(name).includes(term))
    .slice(0, 8);

  if (!names.length) {
    menu.innerHTML = `<div class="company-autocomplete-empty">Nenhuma empresa com projeto encontrada.</div>`;
    menu.classList.remove("hidden");
    return;
  }

  menu.innerHTML = names
    .map((name) => {
      const count = state.projects.filter((project) => project.companyName === name).length;
      return `
        <button type="button" class="company-option" data-filter-company="${escapeAttr(name)}">
          <span>${escapeHtml(name)}</span>
          <small>${count} projeto${count === 1 ? "" : "s"}</small>
        </button>
      `;
    })
    .join("");

  $$("[data-filter-company]", menu).forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      input.value = button.dataset.filterCompany;
      hideProjectCompanyFilterAutocomplete();
      renderQueryView();
    });
  });
  menu.classList.remove("hidden");
}

function hideProjectCompanyFilterAutocomplete() {
  const menu = $('[data-filter-company-menu="true"]');
  if (menu) menu.classList.add("hidden");
}

function updateMainDateLabel(prefix) {
  const type = $(`#${prefix}Type`)?.value;
  const status = $(`#${prefix}Status`)?.value;
  const label = $(`#${prefix}MainDateLabel`);
  if (!label) return;
  label.textContent = getDateLabel(resolveDateKind(type, status));
}

function toggleReasonField(prefix) {
  const status = $(`#${prefix}Status`)?.value;
  const field = $(`#${prefix}ReasonField`);
  if (field) field.classList.toggle("hidden", status !== "Negado");
}

function resolveDateKind(type, status) {
  if (status === "Aguardando") return "notification";
  if (type === "Desocupação") return "request";
  return "letter";
}

function getDateLabel(kind) {
  if (kind === "notification") return "Data do envio da notificação";
  if (kind === "request") return "Data de solicitação";
  return "Data do envio da carta";
}

function submitSingleProject(event) {
  event.preventDefault();
  const project = collectProjectFromPrefix("single");
  const errors = validateProject(project);
  if (errors.length) {
    showToast(errors[0], "error");
    return;
  }

  askConfirmation("Confirma que todas as informações estão corretas?").then((confirmed) => {
    if (!confirmed) return;
    state.projects.push(project);
    saveData();
    $("#singleProjectForm").reset();
    updateMainDateLabel("single");
    updateCalculatedValue("single");
    setDefaultCadastroOpinions();
    renderAll();
    activateTab("project-query");
    showToast("Projeto salvo e enviado para consulta.", "success");
  });
}

function collectProjectFromPrefix(prefix) {
  const company = findCompanyByName($(`#${prefix}Company`).value);
  const type = $(`#${prefix}Type`).value;
  const status = $(`#${prefix}Status`).value;
  const poles = Number($(`#${prefix}Poles`).value);
  const dateKind = resolveDateKind(type, status);

  return {
    id: uid("project"),
    companyId: company?.id || "",
    companyName: company?.name || $(`#${prefix}Company`).value.trim(),
    partner: company?.partner || $(`#${prefix}Partner`).value.trim(),
    pointValue: company?.pointValue || parseMoney($(`#${prefix}PointValue`).value),
    order: $(`#${prefix}Order`).value.trim(),
    letter: $(`#${prefix}Letter`).value.trim(),
    city: $(`#${prefix}City`).value,
    type,
    opinion: $(`#${prefix}Opinion`).value,
    status,
    dateKind,
    mainDate: $(`#${prefix}MainDate`).value,
    month: $(`#${prefix}Month`).value,
    poles,
    multipliedValue: calculateMultiplied(company?.pointValue || parseMoney($(`#${prefix}PointValue`).value), poles),
    denialReason: status === "Negado" ? $(`#${prefix}Reason`).value : "",
    vacancyLetterDate: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function submitBatchProjects(event) {
  event.preventDefault();
  const company = findCompanyByName($("#batchCompany").value);
  const shared = {
    company,
    type: $("#batchType").value,
    opinion: $("#batchOpinion").value,
    status: $("#batchStatus").value,
    dateKind: resolveDateKind($("#batchType").value, $("#batchStatus").value),
    mainDate: $("#batchMainDate").value,
    month: $("#batchMonth").value,
    sameCity: $("#sameCityToggle").checked,
    sharedCity: $("#batchSharedCity").value,
    denialReason: $("#batchStatus").value === "Negado" ? $("#batchReason").value : "",
  };

  const rows = collectBatchRows();
  if (!company) {
    showToast("Selecione uma empresa cadastrada para o lote.", "error");
    return;
  }
  if (!shared.type || !shared.opinion || !shared.status || !shared.mainDate || !shared.month) {
    showToast("Preencha todos os campos comuns do lote.", "error");
    return;
  }
  if (shared.sameCity && !shared.sharedCity) {
    showToast("Selecione o município do lote.", "error");
    return;
  }
  if (!rows.length) {
    showToast("Adicione pelo menos uma linha ao lote.", "error");
    return;
  }

  const projects = rows.map((row) => ({
    id: uid("project"),
    companyId: company.id,
    companyName: company.name,
    partner: company.partner,
    pointValue: company.pointValue,
    order: row.order,
    letter: row.letter,
    city: shared.sameCity ? shared.sharedCity : row.city,
    type: shared.type,
    opinion: shared.opinion,
    status: shared.status,
    dateKind: shared.dateKind,
    mainDate: shared.mainDate,
    month: shared.month,
    poles: row.poles,
    multipliedValue: calculateMultiplied(company.pointValue, row.poles),
    denialReason: shared.status === "Negado" ? shared.denialReason : "",
    vacancyLetterDate: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  const errors = projects.flatMap((project) => validateProject(project));
  if (errors.length) {
    showToast(errors[0], "error");
    return;
  }

  askConfirmation("Confirma que todas as informações estão corretas?").then((confirmed) => {
    if (!confirmed) return;
    state.projects.push(...projects);
    saveData();
    $("#batchProjectForm").reset();
    $("#batchRowsBody").innerHTML = "";
    addBatchRow();
    updateBatchCityMode();
    updateMainDateLabel("batch");
    toggleReasonField("batch");
    setDefaultCadastroOpinions();
    renderAll();
    activateTab("project-query");
    showToast(`${projects.length} projeto(s) salvo(s) e enviados para consulta.`, "success");
  });
}

function addBatchRow(data = {}) {
  state.batchRowId += 1;
  const tr = document.createElement("tr");
  tr.dataset.rowId = String(state.batchRowId);
  tr.innerHTML = `
    <td><input class="batch-order" inputmode="numeric" pattern="[0-9]*" value="${escapeAttr(data.order || "")}" required /></td>
    <td><input class="batch-letter" value="${escapeAttr(data.letter || "")}" required /></td>
    <td><input class="batch-poles" type="number" min="1" step="1" value="${escapeAttr(data.poles || "")}" required /></td>
    <td class="batch-city-col"><select class="batch-city"></select></td>
    <td><input class="batch-total" readonly /></td>
    <td>
      <div class="table-actions">
        <button class="ghost icon-only remove-batch-row" type="button" aria-label="Remover linha"><i data-lucide="trash-2"></i></button>
      </div>
    </td>
  `;
  $("#batchRowsBody").appendChild(tr);
  fillSelect($(".batch-city", tr), MUNICIPALITIES, "Selecione");
  $(".batch-city", tr).value = data.city || "";
  $(".batch-order", tr).addEventListener("input", (event) => sanitizeDigitsInput(event.target));
  $(".batch-poles", tr).addEventListener("input", updateBatchCalculatedValues);
  $(".remove-batch-row", tr).addEventListener("click", () => {
    tr.remove();
    updateBatchCalculatedValues();
  });
  updateBatchCityMode();
  updateBatchCalculatedValues();
  refreshIcons();
}

function collectBatchRows() {
  return $$("#batchRowsBody tr").map((tr) => ({
    order: $(".batch-order", tr).value.trim(),
    letter: $(".batch-letter", tr).value.trim(),
    poles: Number($(".batch-poles", tr).value),
    city: $(".batch-city", tr).value,
  }));
}

function updateBatchCityMode() {
  const sameCity = $("#sameCityToggle").checked;
  $("#batchSharedCityField").classList.toggle("hidden", !sameCity);
  $$(".batch-city-col").forEach((cell) => cell.classList.toggle("hidden", sameCity));
}

function updateBatchCalculatedValues() {
  const company = findCompanyByName($("#batchCompany").value);
  $$("#batchRowsBody tr").forEach((tr) => {
    const poles = Number($(".batch-poles", tr).value);
    $(".batch-total", tr).value = company && poles > 0 ? formatMoney(calculateMultiplied(company.pointValue, poles)) : "";
  });
}

function updateCalculatedValue(prefix) {
  const company = findCompanyByName($(`#${prefix}Company`)?.value || "");
  const poles = Number($(`#${prefix}Poles`)?.value || 0);
  const target = $(`#${prefix}Multiplied`);
  const display = $(`#${prefix}MultipliedDisplay`);
  const value = company && poles > 0 ? formatMoney(calculateMultiplied(company.pointValue, poles)) : "";
  if (target) {
    target.value = value;
  }
  if (display) {
    display.textContent = value || formatMoney(0);
  }
}

function validateProject(project, companyLookup = findCompanyByName) {
  const errors = [];
  if (!project.companyName || !companyLookup(project.companyName)) errors.push("Selecione uma empresa cadastrada.");
  if (!project.partner) errors.push("Parceiro é obrigatório.");
  if (!Number.isFinite(project.pointValue) || project.pointValue <= 0) errors.push("Valor do ponto inválido.");
  if (!project.order) errors.push("Ordem de venda é obrigatória.");
  if (project.order && !/^\d+$/.test(project.order)) errors.push("Ordem de venda deve conter somente números.");
  if (!project.letter) errors.push("Carta é obrigatória.");
  if (!MUNICIPALITIES.includes(project.city)) errors.push("Selecione um município da lista oficial.");
  if (!TYPES.includes(project.type)) errors.push("Selecione um tipo válido.");
  if (!OPINIONS.includes(project.opinion)) errors.push("Selecione ISR ou DSR no parecer.");
  if (!STATUSES.includes(project.status)) errors.push("Selecione um status válido.");
  if (!project.mainDate) errors.push(`${getDateLabel(project.dateKind)} é obrigatória.`);
  if (!MONTHS.includes(project.month)) errors.push("Selecione um mês de referência válido.");
  if (!Number.isInteger(project.poles) || project.poles <= 0) errors.push("Quantidade de postes deve ser um número inteiro maior que zero.");
  if (project.status === "Negado" && !DENIAL_REASONS.includes(project.denialReason)) {
    errors.push("Informe o motivo da negativa.");
  }
  return errors;
}

function bindQueryControls() {
  const filterIds = [
    "filterCompany",
    "filterOrder",
    "filterLetter",
    "filterCity",
    "filterType",
    "filterOpinion",
    "filterMonth",
    "filterYear",
    "filterReason",
    "filterFinalized",
    "filterAlerts",
  ];
  filterIds.forEach((id) => {
    const element = $(`#${id}`);
    if (element) {
      element.addEventListener("input", renderQueryView);
      element.addEventListener("change", renderQueryView);
    }
  });
  $("#clearFiltersBtn").addEventListener("click", () => {
    filterIds.forEach((id) => {
      const element = $(`#${id}`);
      if (!element) return;
      if (element.type === "checkbox") element.checked = false;
      else element.value = "";
    });
    renderQueryView();
  });
  $("#projectImportInput").addEventListener("change", importProjects);
  $("#projectExportBtn").addEventListener("click", exportProjects);
  setupProjectCompanyFilterAutocomplete();
}

function bindModals() {
  $("#closeEditProjectBtn").addEventListener("click", closeProjectEditor);
  $("#editProjectModal").addEventListener("click", (event) => {
    if (event.target.id === "editProjectModal") closeProjectEditor();
  });
  $("#editProjectForm").addEventListener("submit", submitProjectEdit);
  $("#denyCancelBtn").addEventListener("click", closeDenyModal);
  $("#denyConfirmBtn").addEventListener("click", confirmDenyProject);
}

function bindUtilityActions() {
  $("#seedSampleBtn").addEventListener("click", seedDemoData);
  $("#clearDataBtn").addEventListener("click", () => {
    askConfirmation("Deseja apagar todos os dados salvos neste navegador?").then((confirmed) => {
      if (!confirmed) return;
      state.companies = [];
      state.projects = [];
      saveData();
      renderAll();
      showToast("Dados locais apagados.", "success");
    });
  });
}

function renderAll() {
  renderCompanyOptions();
  renderCompaniesTable();
  renderCompanyCount();
  renderYearFilter();
  renderDashboard();
  renderQueryView();
  refreshIcons();
}

function renderQueryView() {
  renderSummaryCards();
  renderProjectTable();
}

function renderCompanyOptions() {
  const datalist = $("#companyOptions");
  if (!datalist) return;
  datalist.innerHTML = "";
  state.companies
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .forEach((company) => {
      const option = document.createElement("option");
      option.value = company.name;
      option.label = `${company.partner} | ${formatMoney(company.pointValue)}`;
      datalist.appendChild(option);
    });
}

function renderCompanyCount() {
  const text = `${state.companies.length} empresa${state.companies.length === 1 ? "" : "s"} cadastrada${state.companies.length === 1 ? "" : "s"}`;
  $("#companyCountLabel").textContent = text;
  const registerCount = $("#companyCountNumber");
  const companyDbCount = $("#companyDbCountNumber");
  if (registerCount) registerCount.textContent = state.companies.length;
  if (companyDbCount) companyDbCount.textContent = state.companies.length;
}

function renderDashboard() {
  const activeProjects = state.projects.filter((project) => getProjectSection(project) === "occupation");
  const vacancyProjects = state.projects.filter((project) => getProjectSection(project) === "vacancy");
  const waitingProjects = state.projects.filter((project) => getProjectSection(project) === "waiting");
  const deniedProjects = state.projects.filter((project) => getProjectSection(project) === "denied");
  const completedProjects = state.projects.filter((project) => project.status === "Concluído");
  const waitingAlerts = state.projects
    .filter((project) => project.status === "Aguardando" && daysElapsed(project.mainDate) >= 7)
    .sort((a, b) => daysElapsed(b.mainDate) - daysElapsed(a.mainDate));
  const vacancyAlerts = state.projects
    .filter((project) => project.type === "Desocupação" && project.status === "Concluído" && !project.vacancyLetterDate && daysElapsed(project.mainDate) >= 70)
    .sort((a, b) => daysElapsed(b.mainDate) - daysElapsed(a.mainDate));
  const latest = state.projects
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 5);

  setText("#dashActiveBilling", formatMoney(sumProjectsBy(() => true, activeProjects)));
  setText("#dashVacancyExit", formatMoney(sumProjectsBy(() => true, vacancyProjects)));
  setText("#dashActiveCount", activeProjects.length);
  setText("#dashVacancyCount", vacancyProjects.length);
  setText("#dashWaitingCount", waitingProjects.length);
  setText("#dashCompletedCount", completedProjects.length);
  setText("#dashWaitingAlertCount", waitingAlerts.length);
  setText("#dashVacancyAlertCount", vacancyAlerts.length);
  setText("#dashTotalProjects", state.projects.length);

  renderDashboardCharts({ activeProjects, vacancyProjects, waitingProjects, deniedProjects });
  renderDashboardAlertTable("#dashWaitingAlertsTable", waitingAlerts, "waiting");
  renderDashboardAlertTable("#dashVacancyAlertsTable", vacancyAlerts, "vacancy");

  const latestBody = $("#dashLatestProjects");
  if (latestBody) {
    latestBody.innerHTML = latest.length
      ? latest
          .map(
            (project) => `
              <tr>
                <td>${escapeHtml(project.companyName)}</td>
                <td>${typeBadge(project.type)}</td>
                <td>${statusBadge(project.status)}</td>
                <td>${escapeHtml(project.city)}</td>
                <td>${formatDate(project.mainDate)}</td>
                <td>${formatMoney(project.multipliedValue)}</td>
                <td><i data-lucide="more-vertical"></i></td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="6"><div class="empty-state">Nenhum projeto cadastrado ainda.</div></td></tr>`;
  }
}

function renderDashboardCharts({ activeProjects, vacancyProjects, waitingProjects, deniedProjects }) {
  const statusSegments = [
    {
      label: "Ocupação de postes novos",
      value: activeProjects.filter((project) => project.type === "Ocupação de postes novos").length,
      tone: "green",
      color: "#55C878",
    },
    {
      label: "Regularização",
      value: activeProjects.filter((project) => project.type === "Regularização").length,
      tone: "blue",
      color: "#60A5FA",
    },
    { label: "Desocupação", value: vacancyProjects.length, tone: "purple", color: "#7C5CFF" },
    { label: "Aguardando", value: waitingProjects.length, tone: "amber", color: "#F59E0B" },
    { label: "Negado", value: deniedProjects.length, tone: "red", color: "#EF4444" },
  ];
  renderStatusDonut(statusSegments);
  renderTypeBars();
  renderMonthlyChart();
}

function renderStatusDonut(segments) {
  const donut = $("#dashStatusDonut");
  const legend = $("#dashStatusLegend");
  if (!donut || !legend) return;
  const total = state.projects.length;
  let start = 0;
  const gradient = total
    ? segments
        .map((segment) => {
          const degrees = (segment.value / total) * 360;
          const piece = `${segment.color} ${start}deg ${start + degrees}deg`;
          start += degrees;
          return piece;
        })
        .join(", ")
    : "rgba(52, 69, 84, 0.8) 0deg 360deg";
  donut.style.background = `conic-gradient(${gradient})`;
  legend.innerHTML = segments
    .map((segment) => {
      const percent = total ? Math.round((segment.value / total) * 100) : 0;
      return `
        <span>
          <b class="dot ${segment.tone}"></b>
          ${escapeHtml(segment.label)}
          <strong>${segment.value} (${percent}%)</strong>
        </span>
      `;
    })
    .join("");
}

function renderTypeBars() {
  const container = $("#dashTypeBars");
  if (!container) return;
  const rows = TYPES.map((type) => {
    const projects = state.projects.filter((project) => project.type === type);
    const total = Math.max(projects.length, 1);
    const segments = [
      { tone: "green", value: projects.filter((project) => getProjectSection(project) === "occupation").length },
      { tone: "amber", value: projects.filter((project) => getProjectSection(project) === "waiting").length },
      { tone: "blue", value: projects.filter((project) => getProjectSection(project) === "vacancy").length },
      { tone: "red", value: projects.filter((project) => getProjectSection(project) === "denied").length },
    ];
    return `
      <div class="type-bar-row">
        <span>${escapeHtml(type)}</span>
        <div class="stacked-bar" aria-label="${escapeHtml(type)}">
          ${segments
            .map((segment) => `<i class="${segment.tone}" style="width:${(segment.value / total) * 100}%"></i>`)
            .join("")}
        </div>
        <strong>${projects.length}</strong>
      </div>
    `;
  });
  container.innerHTML = rows.join("");
}

function renderMonthlyChart() {
  const container = $("#dashMonthlyChart");
  if (!container) return;
  const months = getLastSixMonths();
  const counts = months.map((month) => ({
    ...month,
    count: state.projects.filter((project) => project.mainDate?.slice(0, 7) === month.key).length,
  }));
  const max = Math.max(...counts.map((item) => item.count), 1);
  container.innerHTML = counts
    .map(
      (item) => `
        <div class="month-column">
          <strong>${item.count}</strong>
          <span style="height:${Math.max(12, (item.count / max) * 116)}px"></span>
          <small>${item.label}</small>
        </div>
      `
    )
    .join("");
}

function renderDashboardAlertTable(selector, projects, kind) {
  const body = $(selector);
  if (!body) return;
  if (!projects.length) {
    body.innerHTML = `<tr><td colspan="4"><div class="empty-state">Nenhum alerta no momento.</div></td></tr>`;
    return;
  }
  body.innerHTML = projects
    .slice(0, 5)
    .map((project) => {
      const days = daysElapsed(project.mainDate);
      return `
        <tr>
          <td>${escapeHtml(project.companyName)}</td>
          <td>${escapeHtml(project.type)}</td>
          <td>${formatDate(project.mainDate)}</td>
          <td><strong class="${kind === "waiting" ? "text-amber" : "text-red"}">${days}</strong></td>
        </tr>
      `;
    })
    .join("");
}

function getLastSixMonths() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: formatter.format(date).replace(".", ""),
    };
  });
}

function renderAlertList(selector, projects, getCountLabel) {
  const container = $(selector);
  if (!container) return;
  container.innerHTML = projects.length
    ? projects
        .slice(0, 8)
        .map(
          (project) => `
            <article class="alert-item">
              <div>
                <strong>${escapeHtml(project.companyName)}</strong>
                <span>${escapeHtml(project.order)} | ${escapeHtml(project.city)} | ${escapeHtml(project.month)}</span>
              </div>
              <small>${escapeHtml(getCountLabel(project))}</small>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state">Nenhum alerta no momento.</div>`;
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function renderCompaniesTable() {
  const body = $("#companiesTableBody");
  const search = normalize($("#companySearch").value || "");
  const companies = state.companies
    .filter((company) => {
      const haystack = normalize(`${company.name} ${company.partner} ${formatMoney(company.pointValue)}`);
      return !search || haystack.includes(search);
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  if (!companies.length) {
    body.innerHTML = `<tr><td colspan="4"><div class="empty-state">Nenhuma empresa cadastrada.</div></td></tr>`;
    return;
  }

  body.innerHTML = companies
    .map(
      (company) => `
      <tr>
        <td>${escapeHtml(company.name)}</td>
        <td>${escapeHtml(company.partner)}</td>
        <td>${formatMoney(company.pointValue)}</td>
        <td>
          <div class="table-actions">
            <button class="secondary icon-text" type="button" data-edit-company="${company.id}"><i data-lucide="pencil"></i>Editar</button>
            <button class="ghost icon-only" type="button" data-delete-company="${company.id}" aria-label="Excluir empresa"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");

  $$("[data-edit-company]").forEach((button) =>
    button.addEventListener("click", () => startCompanyEdit(button.dataset.editCompany))
  );
  $$("[data-delete-company]").forEach((button) =>
    button.addEventListener("click", () => deleteCompany(button.dataset.deleteCompany))
  );
  refreshIcons();
}

function startCompanyEdit(id) {
  const company = state.companies.find((item) => item.id === id);
  if (!company) return;
  activateTab("company-db");
  $("#companyEditId").value = company.id;
  $("#companyName").value = company.name;
  $("#companyPartner").value = company.partner;
  $("#companyPointValue").value = formatNumberForInput(company.pointValue);
  $("#cancelCompanyEditBtn").classList.remove("hidden");
}

function deleteCompany(id) {
  const inUse = state.projects.some((project) => project.companyId === id);
  const message = inUse
    ? "Esta empresa está vinculada a projetos. Excluir mesmo assim? Os projetos existentes serão mantidos com os dados atuais."
    : "Deseja excluir esta empresa?";
  askConfirmation(message).then((confirmed) => {
    if (!confirmed) return;
    state.companies = state.companies.filter((company) => company.id !== id);
    saveData();
    renderAll();
    showToast("Empresa excluída.", "success");
  });
}

function renderSummaryCards() {
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentYear = String(now.getFullYear());
  const filteredProjects = getFilteredProjects();
  const allTotals = {
    all: state.projects.length,
    waiting: state.projects.filter((project) => getProjectSection(project) === "waiting").length,
    denied: state.projects.filter((project) => getProjectSection(project) === "denied").length,
    completed: state.projects.filter((project) => project.status === "Concluído").length,
    month: state.projects.filter((project) => project.mainDate?.slice(0, 7) === `${currentYear}-${currentMonth}`).length,
  };
  const totals = {
    all: filteredProjects.length,
    occupation: filteredProjects.filter((project) => getProjectSection(project) === "occupation").length,
    vacancy: filteredProjects.filter((project) => getProjectSection(project) === "vacancy").length,
    waiting: filteredProjects.filter((project) => getProjectSection(project) === "waiting").length,
    denied: filteredProjects.filter((project) => getProjectSection(project) === "denied").length,
    alerts: filteredProjects.filter((project) => getProjectMeta(project).hasAlert).length,
  };
  const values = {
    activeBilling: sumProjectsBy((project) => getProjectSection(project) === "occupation", filteredProjects),
    vacancyExit: sumProjectsBy((project) => getProjectSection(project) === "vacancy", filteredProjects),
    waiting: sumProjectsBy((project) => getProjectSection(project) === "waiting", filteredProjects),
    denied: sumProjectsBy((project) => getProjectSection(project) === "denied", filteredProjects),
  };
  const completedPercent = allTotals.all ? Math.round((allTotals.completed / allTotals.all) * 100) : 0;

  const monthProjectCount = $("#monthProjectCount");
  const completedProjectCount = $("#completedProjectCount");
  const completedProjectPercent = $("#completedProjectPercent");
  const waitingProjectCount = $("#waitingProjectCount");
  const deniedProjectCount = $("#deniedProjectCount");
  if (monthProjectCount) monthProjectCount.textContent = allTotals.month;
  if (completedProjectCount) completedProjectCount.textContent = allTotals.completed;
  if (completedProjectPercent) completedProjectPercent.textContent = `${completedPercent}% do total`;
  if (waitingProjectCount) waitingProjectCount.textContent = allTotals.waiting;
  if (deniedProjectCount) deniedProjectCount.textContent = allTotals.denied;

  $("#summaryCards").innerHTML = [
    ["Faturamento ativo", formatMoney(values.activeBilling), "Ocupação e regularização", "green", "wallet"],
    ["Saída por desocupação", formatMoney(values.vacancyExit), "Valor que sairá do faturamento", "purple", "log-out"],
    ["Valor aguardando", formatMoney(values.waiting), "Projetos com prazo em aberto", "amber", "clock-3"],
    ["Valor negado", formatMoney(values.denied), "Projetos negados", "red", "ban"],
    ["Total de projetos", totals.all, `${totals.alerts} alerta(s) ativo(s)`, "teal", "folder-kanban"],
  ]
    .map(
      ([label, value, helper, tone, icon]) => `
      <article class="summary-card ${tone} ${String(value).includes("R$") ? "money" : ""}">
        <div>
          <span>${label}</span>
          <strong>${value}</strong>
          <small>${helper}</small>
        </div>
        <i data-lucide="${icon}"></i>
      </article>
    `
    )
    .join("");

  $$(".query-tab").forEach((button) => {
    const count = totals[button.dataset.section] || 0;
    $("span", button).textContent = count;
  });
}

function sumProjectsBy(predicate, projects = state.projects) {
  return projects
    .filter(predicate)
    .reduce((sum, project) => sum + Number(project.multipliedValue || 0), 0);
}

function renderYearFilter() {
  const select = $("#filterYear");
  const current = select.value;
  const years = Array.from(new Set(state.projects.map(getProjectYear).filter(Boolean))).sort();
  select.innerHTML = `<option value="">Todos</option>${years.map((year) => `<option value="${year}">${year}</option>`).join("")}`;
  if (years.includes(current)) select.value = current;
}

function renderProjectTable() {
  const copy = sectionCopy[state.currentSection];
  $("#querySectionTitle").textContent = copy.title;
  $("#querySectionSubtitle").textContent = copy.subtitle;
  const projects = getFilteredProjects().filter((project) => getProjectSection(project) === state.currentSection);
  renderProjectHead();
  renderProjectRows(projects);
  refreshIcons();
}

function renderProjectHead() {
  const columns = {
    occupation: [
      "Empresa",
      "Parceiro",
      "Ordem",
      "Carta",
      "Município",
      "Tipo",
      "Parecer",
      "Status",
      "Data do envio da carta",
      "Mês",
      "Postes",
      "Valor multiplicado",
      "Ações",
    ],
    vacancy: [
      "Empresa",
      "Ordem",
      "Carta",
      "Município",
      "Data de solicitação",
      "Contagem 90 dias",
      "Alerta/Status",
      "Data do envio da carta",
      "Valor multiplicado",
      "Ações",
    ],
    waiting: [
      "Empresa",
      "Ordem",
      "Carta",
      "Município",
      "Tipo",
      "Data do envio da notificação",
      "Contagem 10 dias",
      "Alerta",
      "Valor multiplicado",
      "Ações",
    ],
    denied: [
      "Empresa",
      "Parceiro",
      "Ordem",
      "Carta",
      "Município",
      "Tipo",
      "Parecer",
      "Data",
      "Motivo da negativa",
      "Valor multiplicado",
      "Ações",
    ],
  };
  $("#projectsTableHead").innerHTML = `<tr>${columns[state.currentSection].map((column) => `<th>${column}</th>`).join("")}</tr>`;
}

function renderProjectRows(projects) {
  const body = $("#projectsTableBody");
  if (!projects.length) {
    body.innerHTML = `<tr><td colspan="13"><div class="empty-state">Nenhum projeto encontrado para esta janela.</div></td></tr>`;
    return;
  }

  body.innerHTML = projects.map((project) => renderProjectRow(project)).join("");

  $$("[data-edit-project]").forEach((button) =>
    button.addEventListener("click", () => openProjectEditor(button.dataset.editProject))
  );
  $$("[data-delete-project]").forEach((button) =>
    button.addEventListener("click", () => deleteProject(button.dataset.deleteProject))
  );
  $$("[data-deny-project]").forEach((button) =>
    button.addEventListener("click", () => openDenyModal(button.dataset.denyProject))
  );
  $$("[data-vacancy-letter]").forEach((input) => {
    input.addEventListener("blur", () => setVacancyLetterDate(input.dataset.vacancyLetter, input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
    });
  });
}

function renderProjectRow(project) {
  const meta = getProjectMeta(project);
  const rowClass = meta.hasAlert ? "alert-row" : "";
  const actions = `
    <div class="table-actions">
      <button class="secondary icon-text" type="button" data-edit-project="${project.id}"><i data-lucide="pencil"></i>Editar</button>
      <button class="ghost icon-only" type="button" data-delete-project="${project.id}" aria-label="Excluir projeto"><i data-lucide="trash-2"></i></button>
    </div>
  `;

  if (state.currentSection === "vacancy") {
    return `
      <tr class="${rowClass}">
        <td>${escapeHtml(project.companyName)}</td>
        <td>${escapeHtml(project.order)}</td>
        <td>${escapeHtml(project.letter)}</td>
        <td>${escapeHtml(project.city)}</td>
        <td>${formatDate(project.mainDate)}</td>
        <td>${escapeHtml(meta.countLabel)}</td>
        <td>${meta.statusBadge}</td>
        <td><input type="date" min="2000-01-01" max="2099-12-31" value="${project.vacancyLetterDate || ""}" data-vacancy-letter="${project.id}" aria-label="Data do envio da carta" /></td>
        <td>${formatMoney(project.multipliedValue)}</td>
        <td>${actions}</td>
      </tr>
    `;
  }

  if (state.currentSection === "waiting") {
    return `
      <tr class="${rowClass}">
        <td>${escapeHtml(project.companyName)}</td>
        <td>${escapeHtml(project.order)}</td>
        <td>${escapeHtml(project.letter)}</td>
        <td>${escapeHtml(project.city)}</td>
        <td>${typeBadge(project.type)}</td>
        <td>${formatDate(project.mainDate)}</td>
        <td>${escapeHtml(meta.countLabel)}</td>
        <td>${meta.statusBadge}</td>
        <td>${formatMoney(project.multipliedValue)}</td>
        <td>
          <div class="table-actions">
            <button class="danger icon-text" type="button" data-deny-project="${project.id}"><i data-lucide="ban"></i>Negar</button>
            <button class="secondary icon-text" type="button" data-edit-project="${project.id}"><i data-lucide="pencil"></i>Editar</button>
            <button class="ghost icon-only" type="button" data-delete-project="${project.id}" aria-label="Excluir projeto"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `;
  }

  if (state.currentSection === "denied") {
    return `
      <tr class="${rowClass}">
        <td>${escapeHtml(project.companyName)}</td>
        <td>${escapeHtml(project.partner)}</td>
        <td>${escapeHtml(project.order)}</td>
        <td>${escapeHtml(project.letter)}</td>
        <td>${escapeHtml(project.city)}</td>
        <td>${typeBadge(project.type)}</td>
        <td>${escapeHtml(project.opinion)}</td>
        <td>${formatDate(project.mainDate)}</td>
        <td>${escapeHtml(project.denialReason || "-")}</td>
        <td>${formatMoney(project.multipliedValue)}</td>
        <td>${actions}</td>
      </tr>
    `;
  }

  return `
    <tr class="${rowClass}">
      <td>${escapeHtml(project.companyName)}</td>
      <td>${escapeHtml(project.partner)}</td>
      <td>${escapeHtml(project.order)}</td>
      <td>${escapeHtml(project.letter)}</td>
      <td>${escapeHtml(project.city)}</td>
      <td>${typeBadge(project.type)}</td>
      <td>${escapeHtml(project.opinion)}</td>
      <td>${statusBadge(project.status)}</td>
      <td>${formatDate(project.mainDate)}</td>
      <td>${escapeHtml(project.month)}</td>
      <td>${project.poles}</td>
      <td>${formatMoney(project.multipliedValue)}</td>
      <td>${actions}</td>
    </tr>
  `;
}

function getFilteredProjects() {
  const filters = {
    company: normalize($("#filterCompany").value),
    order: normalize($("#filterOrder").value),
    letter: normalize($("#filterLetter").value),
    city: $("#filterCity").value,
    type: $("#filterType").value,
    opinion: $("#filterOpinion").value,
    status: "",
    month: $("#filterMonth").value,
    year: $("#filterYear").value,
    reason: $("#filterReason").value,
    finalized: $("#filterFinalized").checked,
    alerts: $("#filterAlerts").checked,
  };

  return state.projects.filter((project) => {
    const meta = getProjectMeta(project);
    const haystack = normalize(
      [
        project.companyName,
        project.partner,
        project.order,
        project.letter,
        project.city,
        project.type,
        project.opinion,
        project.status,
        getDateLabel(project.dateKind),
        project.mainDate,
        formatDate(project.mainDate),
        project.month,
        project.poles,
        formatMoney(project.multipliedValue),
        getProjectYear(project),
        project.denialReason,
        project.vacancyLetterDate,
        meta.countLabel,
      ].join(" ")
    );

    if (filters.company && !normalize(project.companyName).includes(filters.company)) return false;
    if (filters.order && !normalize(project.order).includes(filters.order)) return false;
    if (filters.letter && !normalize(project.letter).includes(filters.letter)) return false;
    if (filters.city && project.city !== filters.city) return false;
    if (filters.type && project.type !== filters.type) return false;
    if (filters.opinion && project.opinion !== filters.opinion) return false;
    if (filters.status && project.status !== filters.status) return false;
    if (filters.month && project.month !== filters.month) return false;
    if (filters.year && getProjectYear(project) !== filters.year) return false;
    if (filters.reason && project.denialReason !== filters.reason) return false;
    if (filters.finalized && !meta.isFinalized) return false;
    if (filters.alerts && !meta.hasAlert) return false;
    return true;
  });
}

function getProjectSection(project) {
  if (project.status === "Aguardando") return "waiting";
  if (project.status === "Negado") return "denied";
  if (project.type === "Desocupação" && project.status === "Concluído") return "vacancy";
  return "occupation";
}

function getProjectMeta(project) {
  if (project.status === "Aguardando") {
    const elapsed = daysElapsed(project.mainDate);
    const hit = elapsed >= 10;
    return {
      countLabel: elapsed < 0 ? "Data futura" : `${elapsed} de 10 dias`,
      hasAlert: hit,
      isFinalized: false,
      statusBadge: hit ? badge("Prazo de 10 dias atingido", "red") : badge("Em contagem", "amber"),
    };
  }

  if (project.type === "Desocupação" && project.status === "Concluído") {
    const finalized = Boolean(project.vacancyLetterDate);
    const elapsed = daysElapsed(project.mainDate);
    const alert = !finalized && elapsed >= 70;
    return {
      countLabel: finalized ? "Contagem encerrada" : elapsed < 0 ? "Data futura" : `${elapsed} de 90 dias`,
      hasAlert: alert,
      isFinalized: finalized,
      statusBadge: finalized
        ? badge("Finalizado", "blue")
        : alert
          ? badge("Projeto próximo de atingir o prazo de 90 dias.", "red")
          : badge("Em contagem", "amber"),
    };
  }

  return {
    countLabel: "",
    hasAlert: false,
    isFinalized: false,
    statusBadge: statusBadge(project.status),
  };
}

function getProjectYear(project) {
  return project.mainDate ? project.mainDate.slice(0, 4) : "";
}

function openProjectEditor(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  $("#editProjectId").value = project.id;
  $("#editCompany").value = project.companyName;
  $("#editPartner").value = project.partner;
  $("#editPointValue").value = formatMoney(project.pointValue);
  $("#editOrder").value = project.order;
  $("#editLetter").value = project.letter;
  $("#editCity").value = project.city;
  $("#editType").value = project.type;
  $("#editOpinion").value = project.opinion;
  $("#editStatus").value = project.status;
  $("#editMainDate").value = project.mainDate;
  $("#editMonth").value = project.month;
  $("#editPoles").value = project.poles;
  $("#editMultiplied").value = formatMoney(project.multipliedValue);
  $("#editReason").value = project.denialReason || "";
  $("#editVacancyLetterDate").value = project.vacancyLetterDate || "";
  updateMainDateLabel("edit");
  toggleEditConditionalFields();
  openModal("editProjectModal");
}

function closeProjectEditor() {
  closeModal("editProjectModal");
}

function toggleEditConditionalFields() {
  const type = $("#editType").value;
  const status = $("#editStatus").value;
  $("#editVacancyLetterField").classList.toggle("hidden", !(type === "Desocupação" && status === "Concluído"));
  $("#editReasonField").classList.toggle("hidden", status !== "Negado");
}

function submitProjectEdit(event) {
  event.preventDefault();
  const id = $("#editProjectId").value;
  const original = state.projects.find((item) => item.id === id);
  const company = findCompanyByName($("#editCompany").value);
  if (!original || !company) {
    showToast("Selecione uma empresa cadastrada.", "error");
    return;
  }

  const type = $("#editType").value;
  const status = $("#editStatus").value;
  const poles = Number($("#editPoles").value);
  const updated = {
    ...original,
    companyId: company.id,
    companyName: company.name,
    partner: company.partner,
    pointValue: company.pointValue,
    order: $("#editOrder").value.trim(),
    letter: $("#editLetter").value.trim(),
    city: $("#editCity").value,
    type,
    opinion: $("#editOpinion").value,
    status,
    dateKind: resolveDateKind(type, status),
    mainDate: $("#editMainDate").value,
    month: $("#editMonth").value,
    poles,
    multipliedValue: calculateMultiplied(company.pointValue, poles),
    denialReason: status === "Negado" ? $("#editReason").value : "",
    vacancyLetterDate: type === "Desocupação" && status === "Concluído" ? $("#editVacancyLetterDate").value : "",
    updatedAt: new Date().toISOString(),
  };

  const errors = validateProject(updated);
  if (errors.length) {
    showToast(errors[0], "error");
    return;
  }

  Object.assign(original, updated);
  saveData();
  closeProjectEditor();
  renderAll();
  showToast("Projeto atualizado.", "success");
}

function deleteProject(id) {
  askConfirmation("Deseja excluir este projeto?").then((confirmed) => {
    if (!confirmed) return;
    state.projects = state.projects.filter((project) => project.id !== id);
    saveData();
    renderAll();
    showToast("Projeto excluído.", "success");
  });
}

function setVacancyLetterDate(id, value) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  if (value && !isAllowedBusinessDate(value)) {
    showToast("Informe uma data com ano válido entre 2000 e 2099.", "error");
    renderAll();
    return;
  }
  project.vacancyLetterDate = value;
  project.updatedAt = new Date().toISOString();
  saveData();
  renderAll();
  showToast(value ? "Desocupação finalizada." : "Contagem reativada.", value ? "success" : "warning");
}

function isAllowedBusinessDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2099;
}

function openDenyModal(id) {
  state.pendingDenyId = id;
  $("#denyReason").value = "";
  openModal("denyModal");
}

function closeDenyModal() {
  state.pendingDenyId = null;
  closeModal("denyModal");
}

function confirmDenyProject() {
  const reason = $("#denyReason").value;
  if (!DENIAL_REASONS.includes(reason)) {
    showToast("Informe o motivo da negativa.", "error");
    return;
  }
  const project = state.projects.find((item) => item.id === state.pendingDenyId);
  if (!project) return;
  project.status = "Negado";
  project.denialReason = reason;
  project.dateKind = resolveDateKind(project.type, project.status);
  project.updatedAt = new Date().toISOString();
  saveData();
  closeDenyModal();
  state.currentSection = "denied";
  $$(".query-tab").forEach((button) => button.classList.toggle("active", button.dataset.section === "denied"));
  renderAll();
  showToast("Projeto movido para Negados.", "success");
}

function activateTab(tabId) {
  $$("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
  $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
  updateBreadcrumb(tabId);
}

function updateBreadcrumb(tabId) {
  const labels = {
    dashboard: "Dashboard",
    "project-register": "Cadastro de Projetos",
    "project-query": "Consulta de Projetos",
    "company-db": "Banco de Empresas",
  };
  const target = $("#breadcrumbCurrent");
  if (target) target.textContent = labels[tabId] || "Cadastro de Projetos";
}

function findCompanyByName(name) {
  return state.companies.find((company) => normalize(company.name) === normalize(name || ""));
}

function findCompanyByNameIn(companies, name) {
  return companies.find((company) => normalize(company.name) === normalize(name || ""));
}

function calculateMultiplied(pointValue, poles) {
  return Number((Number(pointValue || 0) * Number(poles || 0)).toFixed(2));
}

function parseMoney(value) {
  if (typeof value === "number") return value;
  const clean = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function uppercaseCompanyName(value) {
  return String(value || "").trim().toLocaleUpperCase("pt-BR");
}

function sanitizeDigitsInput(input) {
  input.value = String(input.value || "").replace(/\D/g, "");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatNumberForInput(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseLocalDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function daysElapsed(value) {
  const date = parseLocalDate(value);
  if (!date) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today - date) / 86400000);
}

function formatDate(value) {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString("pt-BR") : "-";
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function statusBadge(status) {
  if (status === "Concluído") return badge("Concluído", "blue");
  if (status === "Aguardando") return badge("Aguardando", "amber");
  if (status === "Negado") return badge("Negado", "red");
  return badge(status || "-", "neutral");
}

function typeBadge(type) {
  if (type === "Ocupação de postes novos") return badge(type, "green");
  if (type === "Regularização") return badge(type, "amber");
  if (type === "Desocupação") return badge(type, "red");
  return badge(type || "-", "neutral");
}

function badge(text, tone) {
  return `<span class="badge ${tone}">${escapeHtml(text)}</span>`;
}

function maskPointValue(value) {
  const raw = String(value || "");
  if (raw.includes(",")) {
    const [integer = "", decimal = ""] = raw.split(",");
    const cleanInteger = integer.replace(/\D/g, "").slice(0, 2);
    const cleanDecimal = decimal.replace(/\D/g, "").slice(0, 2);
    return cleanDecimal ? `${cleanInteger},${cleanDecimal}` : cleanInteger;
  }
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)},${digits.slice(2)}`;
}

function askConfirmation(message, title = "Confirmação") {
  return new Promise((resolve) => {
    $("#confirmTitle").textContent = title;
    $("#confirmMessage").textContent = message;
    openModal("confirmModal");

    const cleanup = (value) => {
      $("#confirmOkBtn").removeEventListener("click", onOk);
      $("#confirmCancelBtn").removeEventListener("click", onCancel);
      closeModal("confirmModal");
      resolve(value);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    $("#confirmOkBtn").addEventListener("click", onOk);
    $("#confirmCancelBtn").addEventListener("click", onCancel);
  });
}

function openModal(id) {
  const modal = $(`#${id}`);
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  refreshIcons();
}

function closeModal(id) {
  const modal = $(`#${id}`);
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${type === "error" ? "circle-alert" : type === "warning" ? "triangle-alert" : "check-circle"}"></i><span>${escapeHtml(message)}</span>`;
  $("#toastArea").appendChild(toast);
  refreshIcons();
  setTimeout(() => toast.remove(), 4200);
}

function importCompanies(event) {
  readCsvFile(event.target.files[0]).then((rows) => {
    event.target.value = "";
    if (!rows.length) {
      showToast("Arquivo sem linhas para importar.", "error");
      return;
    }

    const imported = [];
    const errors = [];
    rows.forEach((row, index) => {
      const name = uppercaseCompanyName(getCsvValue(row, ["nome da empresa", "empresa"]));
      const partner = getCsvValue(row, ["numero do parceiro", "número do parceiro", "parceiro"]);
      const pointValue = parseMoney(getCsvValue(row, ["valor do ponto", "valor ponto"]));
      if (!name || !partner || !Number.isFinite(pointValue) || pointValue <= 0) {
        errors.push(`Linha ${index + 2}: empresa, parceiro ou valor do ponto inválido.`);
        return;
      }
      imported.push({ name, partner, pointValue });
    });

    if (errors.length) {
      showToast(errors[0], "error");
      return;
    }

    imported.forEach((item) => {
      const existing = findCompanyByName(item.name);
      if (existing) {
        existing.partner = item.partner;
        existing.pointValue = item.pointValue;
        existing.updatedAt = new Date().toISOString();
        syncProjectsWithCompany(existing.id);
      } else {
        state.companies.push({
          id: uid("company"),
          ...item,
          createdAt: new Date().toISOString(),
        });
      }
    });
    saveData();
    renderAll();
    showToast(`${imported.length} empresa(s) importada(s).`, "success");
  });
}

function exportCompanies() {
  const rows = state.companies.map((company) => ({
    "Nome da empresa": company.name,
    "Número do parceiro": company.partner,
    "Valor do ponto": formatNumberForInput(company.pointValue),
  }));
  downloadCsv("empresas-sp.csv", rows);
}

function importProjects(event) {
  readCsvFile(event.target.files[0]).then((rows) => {
    event.target.value = "";
    if (!rows.length) {
      showToast("Arquivo sem linhas para importar.", "error");
      return;
    }

    const imported = [];
    const errors = [];
    const importStartedAt = Date.now();
    const originalCompanyCount = state.companies.length;
    const workingCompanies = state.companies.map((company) => ({ ...company }));

    rows.forEach((row, index) => {
      const lineNumber = index + 2;
      const companyName = uppercaseCompanyName(getCsvValue(row, ["empresa", "nome da empresa"]));
      const partner = getCsvValue(row, ["parceiro", "número do parceiro", "numero do parceiro"]);
      const rowPointValue = parseMoney(
        getCsvValue(row, ["valor do ponto", "valor ponto", "valor", "ponto", "valor da empresa", "valor do ponto da empresa"])
      );
      let company = findCompanyByNameIn(workingCompanies, companyName);

      if (!company) {
        if (!companyName || !partner || !Number.isFinite(rowPointValue) || rowPointValue <= 0) {
          errors.push(`Linha ${lineNumber}: empresa nova precisa de Empresa, Parceiro e Valor do ponto.`);
          return;
        }
        company = {
          id: uid("company"),
          name: companyName,
          partner,
          pointValue: rowPointValue,
          createdAt: new Date(importStartedAt + index).toISOString(),
        };
        workingCompanies.push(company);
      }

      const type = normalizeImportedType(getCsvValue(row, ["tipo"]));
      const denialReason = normalizeFromList(
        getCsvValue(row, ["observação/motivo da negativa", "observacao/motivo da negativa", "motivo da negativa"]),
        DENIAL_REASONS
      );
      const status = normalizeImportedStatus(getCsvValue(row, ["status"]), denialReason);
      const dateKind = resolveDateKind(type, status);
      const mainDate = resolveImportedMainDate(row, type, status);
      const poles = parseCsvInteger(getCsvValue(row, ["quantidade de postes", "postes", "qtd postes"]));
      const pointValue = company.pointValue;
      const project = {
        id: uid("project"),
        companyId: company.id,
        companyName: company.name,
        partner: company.partner,
        pointValue,
        order: getCsvValue(row, ["ordem de venda", "ordem"]).replace(/\D/g, ""),
        letter: getCsvValue(row, ["carta"]),
        city: normalizeFromList(getCsvValue(row, ["município", "municipio"]), MUNICIPALITIES),
        type,
        opinion: normalizeFromList(getCsvValue(row, ["parecer"]), OPINIONS) || "ISR",
        status,
        dateKind,
        mainDate,
        month: normalizeFromList(getCsvValue(row, ["mês de referência", "mes de referencia", "mês", "mes"]), MONTHS),
        poles,
        multipliedValue: calculateMultiplied(pointValue, poles),
        denialReason,
        vacancyLetterDate: resolveImportedVacancyLetterDate(row, type),
        createdAt: new Date(importStartedAt + index).toISOString(),
        updatedAt: new Date(importStartedAt + index).toISOString(),
      };

      const rowErrors = validateProject(project, (name) => findCompanyByNameIn(workingCompanies, name));
      if (rowErrors.length) {
        errors.push(`Linha ${lineNumber}: ${rowErrors[0]}`);
        return;
      }
      imported.push(project);
    });

    if (errors.length) {
      showToast(errors[0], "error");
      return;
    }

    state.companies = workingCompanies;
    state.projects.push(...imported);
    saveData();
    renderAll();
    showToast(
      `${imported.length} projeto(s) importado(s). ${workingCompanies.length - originalCompanyCount} empresa(s) criada(s) automaticamente.`,
      "success"
    );
  });
}

function resolveImportedMainDate(row, type, status) {
  if (status === "Aguardando") {
    return (
      normalizeCsvDate(
        getCsvValue(row, [
          "data do envio da notificação",
          "data do envio da notificacao",
          "data do envio da carta",
          "data principal",
          "data",
        ])
      ) ||
      ""
    );
  }
  if (type === "Desocupação") {
    return (
      normalizeCsvDate(getCsvValue(row, ["data de solicitação", "data de solicitacao", "data da solicitação", "data da solicitacao", "data solicitacao", "data principal", "data"])) ||
      ""
    );
  }
  return normalizeCsvDate(getCsvValue(row, ["data do envio da carta", "data principal", "data"])) || "";
}

function resolveImportedVacancyLetterDate(row, type) {
  if (type !== "Desocupação") return "";
  return (
    normalizeCsvDate(
      getCsvValue(row, [
        "data do envio da carta desocupação",
        "data do envio da carta desocupacao",
        "data finalização",
        "data finalizacao",
        "data do envio da carta",
      ])
    ) || ""
  );
}

function normalizeImportedType(value) {
  const exact = normalizeFromList(value, TYPES);
  if (exact) return exact;
  const clean = normalize(value);
  if (clean.includes("desocup")) return "Desocupação";
  if (clean.includes("regular")) return "Regularização";
  if (clean.includes("ocup")) return "Ocupação de postes novos";
  return value;
}

function normalizeImportedStatus(value, denialReason) {
  const exact = normalizeFromList(value, STATUSES);
  if (exact) return exact;
  const clean = normalize(value);
  if (clean.includes("neg")) return "Negado";
  if (clean.includes("aguard")) return "Aguardando";
  if (clean.includes("concl")) return "Concluído";
  if (denialReason) return "Negado";
  return "Concluído";
}

function normalizeFromList(value, list) {
  const clean = normalize(value);
  if (!clean) return "";
  return list.find((item) => normalize(item) === clean) || "";
}

function parseCsvInteger(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? Number(digits) : NaN;
}

function exportProjects() {
  const headers = [
    "Ordem de venda",
    "Empresa",
    "Tipo",
    "Mês de referência",
    "Parecer",
    "Parceiro",
    "Valor",
    "Multiplicação ponto",
    "Carta",
    "Município",
    "Data de solicitação",
    "Data do envio da carta",
    "Postes",
  ];
  const rows = state.projects.map((project) => {
    const isVacancy = project.type === "Desocupação";
    return {
      "Ordem de venda": project.order,
      Empresa: project.companyName,
      Tipo: project.type,
      "Mês de referência": project.month,
      Parecer: project.opinion,
      Parceiro: project.partner,
      Valor: formatNumberForInput(project.pointValue),
      "Multiplicação ponto": formatNumberForInput(project.multipliedValue),
      Carta: project.letter,
      Município: project.city,
      ...(isVacancy ? { "Data de solicitação": project.mainDate } : {}),
      "Data do envio da carta": isVacancy ? project.vacancyLetterDate : project.mainDate,
      Postes: project.poles,
    };
  });
  downloadCsv("projetos-sp.csv", rows, headers);
}

function readCsvFile(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve([]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(parseCsv(String(reader.result || "")));
    reader.onerror = () => {
      showToast("Não foi possível ler o arquivo.", "error");
      resolve([]);
    };
    reader.readAsText(file, "utf-8");
  });
}

function parseCsv(text) {
  const delimiter = chooseDelimiter(text);
  const rows = [];
  let current = "";
  let row = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map((header) => keyify(header));
  return rows.slice(1).map((cells) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = (cells[index] || "").trim();
    });
    return item;
  });
}

function chooseDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

function getCsvValue(row, aliases) {
  for (const alias of aliases) {
    const value = row[keyify(alias)];
    if (value !== undefined && value !== "") return value.trim();
  }
  return "";
}

function keyify(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeCsvDate(value) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function downloadCsv(filename, rows, requestedHeaders) {
  const headers = requestedHeaders || (rows.length ? Object.keys(rows[0]) : ["Sem dados"]);
  const lines = [
    headers.map(csvCell).join(";"),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(";")),
  ];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function seedDemoData() {
  if (state.companies.length || state.projects.length) {
    askConfirmation("Adicionar dados de demonstração aos dados existentes?").then((confirmed) => {
      if (confirmed) addDemoData();
    });
    return;
  }
  addDemoData();
}

function addDemoData() {
  const companies = [
    { id: uid("company"), name: "Alfa Fibra SP", partner: "300145", pointValue: 10 },
    { id: uid("company"), name: "Conecta Vale", partner: "300287", pointValue: 12.5 },
    { id: uid("company"), name: "Litoral Net", partner: "300399", pointValue: 8.75 },
  ];
  state.companies.push(...companies);

  const today = new Date();
  const dateAgo = (days) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  state.projects.push(
    makeDemoProject(companies[0], {
      order: "OV-2026-001",
      letter: "CT-104",
      city: "TAUBATÉ",
      type: "Ocupação de postes novos",
      status: "Concluído",
      mainDate: "2026-02-10",
      month: "Fevereiro",
      poles: 5,
    }),
    makeDemoProject(companies[1], {
      order: "OV-2026-022",
      letter: "CT-210",
      city: "SÃO JOSÉ DOS CAMPOS",
      type: "Desocupação",
      status: "Concluído",
      mainDate: dateAgo(74),
      month: "Abril",
      poles: 8,
    }),
    makeDemoProject(companies[2], {
      order: "OV-2026-041",
      letter: "NT-044",
      city: "CARAGUATATUBA",
      type: "Regularização",
      status: "Aguardando",
      mainDate: dateAgo(11),
      month: "Junho",
      poles: 3,
    })
  );
  saveData();
  renderAll();
  showToast("Dados de demonstração adicionados.", "success");
}

function makeDemoProject(company, overrides) {
  return {
    id: uid("project"),
    companyId: company.id,
    companyName: company.name,
    partner: company.partner,
    pointValue: company.pointValue,
    order: overrides.order,
    letter: overrides.letter,
    city: overrides.city,
    type: overrides.type,
    opinion: "ISR",
    status: overrides.status,
    dateKind: resolveDateKind(overrides.type, overrides.status),
    mainDate: overrides.mainDate,
    month: overrides.month,
    poles: overrides.poles,
    multipliedValue: calculateMultiplied(company.pointValue, overrides.poles),
    denialReason: "",
    vacancyLetterDate: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
