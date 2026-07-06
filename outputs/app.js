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

const DEFAULT_CHECKLISTS = {
  occupation:
    '<p><strong>Bom dia, prezados(a).</strong></p><p><strong>Espero que estejam bem.</strong></p><p><strong>Segue abaixo todas as informações para solicitar a análise de projeto.</strong></p><p><strong>Checklist de Ocupação</strong></p><p><strong>Entrada de Projetos:</strong></p><p><strong>Os projetos deverão ser encaminhados para o e-mail: <a href="mailto:infrarede.eletrica@edpbr.com.br">infrarede.eletrica@edpbr.com.br</a></strong></p><p><strong>Para que não haja problemas no envio dos projetos, pedimos, por gentileza, que seja encaminhado apenas um projeto por e-mail, podendo o mesmo estar compactado.</strong></p><p><strong>Pedimos também que o assunto do e-mail seja padronizado conforme abaixo:</strong></p><p><strong>PROJETO DE COMPARTILHAMENTO - (NOME DA EMPRESA) | (TRATA-SE DE REGULARIZAÇÃO OU NÃO)</strong></p><p><strong>OBS: Com relação ao ANEXO 2, as informações referentes ao município e ao questionamento se o projeto é para regularização ou não deverão ser selecionadas na célula de preenchimento. Os demais campos deverão ser preenchidos, se possível, em CAIXA ALTA.</strong></p><p><strong>Caso o envio envolva múltiplos projetos, é possível consolidá-los na mesma planilha do Anexo 2, utilizando uma linha distinta para cada projeto.</strong></p><p><strong>Fluxo de Aprovação:</strong></p><p><strong>Após a aprovação dos projetos, serão encaminhadas, através de e-mail, para os endereços cadastrados, as respectivas cartas de aprovação.</strong></p><p><strong>Caso os projetos sejam reprovados, será encaminhada uma carta de reprovação informando o motivo da reprovação.</strong></p><p><strong>Checklist dos documentos necessários:</strong></p><ul><li><strong>Memorial Descritivo digitalizado, em formato DOC ou PDF;</strong></li><li><strong>Arquivo DWG do projeto;</strong></li><li><strong>Carteira do Conselho de Classe do profissional responsável técnico, digitalizada em formato PDF;</strong></li><li><strong>Registro de Pessoa Jurídica junto ao Conselho de Classe da empresa projetista/executora do projeto, digitalizado em formato PDF;</strong></li></ul>',
  vacancy:
    '<p><strong>Bom dia, prezados(a).</strong></p><p><strong>Espero que estejam bem.</strong></p><p><strong>Segue abaixo todas as informações para projeto de desocupação.</strong></p><p><strong>Checklist de Desocupação</strong></p><p><strong>Entrada de Projetos:</strong></p><p><strong>Os projetos deverão ser encaminhados para o e-mail: <a href="mailto:infrarede.eletrica@edpbr.com.br">infrarede.eletrica@edpbr.com.br</a></strong></p><p><strong>Pedimos que o assunto do e-mail seja padronizado conforme abaixo:</strong></p><p><strong>PROJETO DE DESOCUPAÇÃO - (NOME DA EMPRESA)</strong></p><p><strong>Após o envio da solicitação, o prazo de acompanhamento será controlado conforme as regras internas do sistema.</strong></p><p><strong>Checklist dos documentos necessários:</strong></p><ul><li><strong>Ordem de venda;</strong></li><li><strong>Carta;</strong></li><li><strong>Município;</strong></li><li><strong>Data de solicitação;</strong></li><li><strong>Quantidade de postes;</strong></li></ul>',
};

const STORAGE_KEYS = {
  companies: "spmsp.companies.v1",
  projects: "spmsp.projects.v1",
  checklists: "spmsp.checklists.v1",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const state = {
  companies: loadArray(STORAGE_KEYS.companies),
  projects: loadArray(STORAGE_KEYS.projects),
  checklists: normalizeChecklists(loadObject(STORAGE_KEYS.checklists)),
  currentSection: "occupation",
  dashboardYear: "",
  batchRowId: 0,
  pendingDenyId: null,
  appStarted: false,
};

const authState = {
  user: null,
  googleClientId: "",
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

async function init() {
  const authenticated = await initAuth();
  if (authenticated) startApp();
}

function startApp() {
  if (state.appStarted) {
    renderAll();
    return;
  }
  state.appStarted = true;
  populateSelects();
  bindNavigation();
  bindCompanyForm();
  bindProjectForms();
  bindQueryControls();
  bindDashboardControls();
  bindChecklistControls();
  bindModals();
  bindUtilityActions();
  bindUserAdmin();
  addBatchRow();
  renderAll();
  refreshIcons();
  loadRemoteData();
}

async function initAuth() {
  if (!remoteSync.enabled) {
    authState.user = { name: "Administrador Local", email: "local@spmsp", role: "admin", status: "approved" };
    unlockApp();
    return true;
  }

  try {
    const [configResponse, sessionResponse] = await Promise.all([
      fetch("/api/auth?action=config", { cache: "no-store" }),
      fetch("/api/auth?action=session", { cache: "no-store" }),
    ]);
    const config = await configResponse.json();
    const session = await sessionResponse.json();
    authState.googleClientId = config.googleClientId || "";

    if (session.approved && session.user) {
      authState.user = session.user;
      unlockApp();
      return true;
    }

    renderLogin(config);
    return false;
  } catch (error) {
    setLoginMessage("Não foi possível iniciar o login. Verifique a conexão e tente novamente.");
    return false;
  }
}

function unlockApp() {
  $(".app-shell")?.classList.remove("auth-hidden");
  $("#loginScreen")?.classList.add("hidden");
  updateProfile();
}

function renderLogin(config) {
  if (!config.authEnabled || !config.googleClientId) {
    setLoginMessage("Login Google ainda não configurado. Defina GOOGLE_CLIENT_ID na Vercel.");
    return;
  }
  setLoginMessage(getLoginStatusMessage() || "Entre com sua conta Google para solicitar acesso.");
  waitForGoogle(() => {
    google.accounts.id.initialize({
      client_id: config.googleClientId,
      ux_mode: "redirect",
      login_uri: `${window.location.origin}/api/google-login`,
    });
    google.accounts.id.renderButton($("#googleSignInButton"), {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "signin_with",
      width: 280,
    });
  });
}

function getLoginStatusMessage() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("auth");
  if (!status) return "";
  params.delete("auth");
  const query = params.toString();
  const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", cleanUrl);
  if (status === "pending") return "Seu acesso foi solicitado. Aguarde aprovação do administrador.";
  if (status === "error") return "Não foi possível autenticar com Google. Tente novamente.";
  return "";
}

function waitForGoogle(callback, attempts = 0) {
  if (window.google?.accounts?.id) {
    callback();
    return;
  }
  if (attempts > 50) {
    setLoginMessage("Não foi possível carregar o botão do Google. Atualize a página.");
    return;
  }
  setTimeout(() => waitForGoogle(callback, attempts + 1), 100);
}

async function handleGoogleCredential(response) {
  setLoginMessage("Validando acesso...");
  try {
    const result = await fetch("/api/auth?action=login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential }),
    }).then((item) => item.json());

    if (!result.user) {
      setLoginMessage(result.error || "Não foi possível validar sua conta.");
      return;
    }

    if (!result.approved) {
      setLoginMessage("Seu acesso foi solicitado. Aguarde aprovação do administrador.");
      return;
    }

    authState.user = result.user;
    unlockApp();
    startApp();
  } catch (error) {
    setLoginMessage("Falha ao autenticar com Google. Tente novamente.");
  }
}

function setLoginMessage(message) {
  const target = $("#loginMessage");
  if (target) target.textContent = message;
}

function updateProfile() {
  const user = authState.user;
  if (!user) return;
  const initials = getInitials(user.name || user.email);
  setText("#profileAvatar", initials);
  setText("#profileName", user.name || user.email);
  setText("#profileRole", user.role === "admin" ? "Administrador" : "Usuário aprovado");
  $$(".admin-only").forEach((item) => item.classList.toggle("hidden", user.role !== "admin"));
}

function getInitials(value) {
  return String(value || "--")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function loadArray(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function loadObject(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function normalizeChecklists(value = {}) {
  return {
    occupation: normalizeChecklistHtml(value.occupation, DEFAULT_CHECKLISTS.occupation),
    vacancy: normalizeChecklistHtml(value.vacancy, DEFAULT_CHECKLISTS.vacancy),
  };
}

function normalizeChecklistHtml(value, fallback) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const html = /<\/?[a-z][\s\S]*>/i.test(value) ? value : plainTextToChecklistHtml(value);
  return sanitizeChecklistHtml(html);
}

function plainTextToChecklistHtml(value) {
  return String(value)
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => (line.trim() ? `<p>${linkifyEscapedText(escapeHtml(line))}</p>` : "<p><br></p>"))
    .join("");
}

function linkifyEscapedText(value) {
  return value
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      (email) => `<a href="mailto:${email}">${email}</a>`
    )
    .replace(
      /\bhttps?:\/\/[^\s<]+/gi,
      (url) => `<a href="${url}">${url}</a>`
    );
}

function sanitizeChecklistHtml(value) {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");
  const blockedTags = new Set(["script", "style", "iframe", "object", "embed", "meta", "link"]);
  template.content.querySelectorAll("*").forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (blockedTags.has(tag)) {
      element.remove();
      return;
    }
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const rawValue = attribute.value || "";
      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        return;
      }
      if ((name === "href" || name === "src") && /^\s*javascript:/i.test(rawValue)) {
        element.removeAttribute(attribute.name);
      }
    });
    if (tag === "a" && element.getAttribute("href")) {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
  });
  return template.innerHTML;
}

function saveData() {
  localStorage.setItem(STORAGE_KEYS.companies, JSON.stringify(state.companies));
  localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(state.projects));
  localStorage.setItem(STORAGE_KEYS.checklists, JSON.stringify(state.checklists));
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
      state.checklists = normalizeChecklists(data.checklists);
      localStorage.setItem(STORAGE_KEYS.companies, JSON.stringify(state.companies));
      localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(state.projects));
      localStorage.setItem(STORAGE_KEYS.checklists, JSON.stringify(state.checklists));
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
      body: JSON.stringify({ companies: state.companies, projects: state.projects, checklists: state.checklists }),
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
      togglePoleExchangeField("single");
    })
  );
  ["#batchType", "#batchStatus"].forEach((selector) =>
    $(selector).addEventListener("change", () => {
      updateMainDateLabel("batch");
      toggleReasonField("batch");
      togglePoleExchangeField("batch");
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
      togglePoleExchangeField("single");
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

function togglePoleExchangeField(prefix) {
  const status = $(`#${prefix}Status`)?.value;
  const field = $(`#${prefix}PoleExchangeField`);
  const select = $(`#${prefix}PoleExchange`);
  const visible = status === "Aguardando";
  if (field) field.classList.toggle("hidden", !visible);
  if (select && !visible) select.value = "Não";
}

function resolveDateKind(type, status) {
  if (status === "Aguardando" || status === "Negado") return "notification";
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
    poleExchange: status === "Aguardando" && $(`#${prefix}PoleExchange`)?.value === "Sim",
    denialReason: status === "Negado" ? $(`#${prefix}Reason`).value : "",
    neDate: status === "Negado" ? todayInputValue() : "",
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
    poleExchange: $("#batchStatus").value === "Aguardando" && $("#batchPoleExchange")?.value === "Sim",
    denialReason: $("#batchStatus").value === "Negado" ? $("#batchReason").value : "",
    neDate: $("#batchStatus").value === "Negado" ? todayInputValue() : "",
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
    poleExchange: shared.poleExchange,
    denialReason: shared.status === "Negado" ? shared.denialReason : "",
    neDate: shared.status === "Negado" ? shared.neDate : "",
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
    togglePoleExchangeField("batch");
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
  $$(".batch-order, .batch-letter, .batch-poles", tr).forEach((input) => {
    input.addEventListener("paste", handleBatchPaste);
  });
  $(".remove-batch-row", tr).addEventListener("click", () => {
    tr.remove();
    updateBatchCalculatedValues();
  });
  updateBatchCityMode();
  updateBatchCalculatedValues();
  refreshIcons();
}

function handleBatchPaste(event) {
  const text = event.clipboardData?.getData("text") || "";
  if (!text.includes("\t") && !/[\r\n]/.test(text)) return;
  event.preventDefault();

  const rows = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => line.split("\t"));
  if (!rows.length) return;

  const startTr = event.target.closest("tr");
  const existingRows = () => $$("#batchRowsBody tr");
  let startRowIndex = existingRows().indexOf(startTr);
  if (startRowIndex < 0) startRowIndex = 0;

  const sameCity = $("#sameCityToggle").checked;
  const columns = sameCity ? ["order", "letter", "poles"] : ["order", "letter", "poles", "city"];
  const classToColumn = {
    "batch-order": "order",
    "batch-letter": "letter",
    "batch-poles": "poles",
  };
  const startColumnName = Object.entries(classToColumn).find(([className]) => event.target.classList.contains(className))?.[1] || "order";
  const startColumnIndex = columns.indexOf(startColumnName);

  rows.forEach((cells, rowOffset) => {
    while (existingRows().length <= startRowIndex + rowOffset) addBatchRow();
    const tr = existingRows()[startRowIndex + rowOffset];
    const targetColumns = cells.length === 1 ? [startColumnName] : columns.slice(Math.max(startColumnIndex, 0));
    cells.forEach((cell, cellIndex) => {
      const column = targetColumns[cellIndex];
      if (!column) return;
      setBatchCellValue(tr, column, cell);
    });
  });
  updateBatchCalculatedValues();
  refreshIcons();
}

function setBatchCellValue(tr, column, rawValue) {
  const value = String(rawValue || "").trim();
  if (column === "order") {
    $(".batch-order", tr).value = value.replace(/\D/g, "");
  } else if (column === "letter") {
    $(".batch-letter", tr).value = value;
  } else if (column === "poles") {
    $(".batch-poles", tr).value = value.replace(/\D/g, "");
  } else if (column === "city") {
    $(".batch-city", tr).value = normalizeFromList(value, MUNICIPALITIES);
  }
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
  if (project.status === "Negado" && !project.neDate) {
    errors.push("Data transformado em NE é obrigatória para projetos negados.");
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
  $("#registerProjectImportInput")?.addEventListener("change", importProjects);
  $("#projectExportBtn").addEventListener("click", exportProjects);
  setupProjectCompanyFilterAutocomplete();
  window.addEventListener("resize", syncProjectsHorizontalScroll);
  window.addEventListener("scroll", syncProjectsHorizontalScroll, { passive: true });
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

function bindDashboardControls() {
  $("#dashboardYearFilter")?.addEventListener("change", (event) => {
    state.dashboardYear = event.target.value;
    renderDashboard();
    refreshIcons();
  });
}

function bindChecklistControls() {
  $("#saveChecklistBtn")?.addEventListener("click", saveChecklistTemplates);
  $$("[data-copy-checklist]").forEach((button) => {
    button.addEventListener("click", () => copyChecklistText(button.dataset.copyChecklist));
  });
}

function bindUserAdmin() {
  $("#logoutBtn")?.addEventListener("click", logout);
  $("#refreshUsersBtn")?.addEventListener("click", renderUsersTable);
}

async function logout() {
  if (remoteSync.enabled) {
    await fetch("/api/auth?action=logout", { method: "POST" }).catch(() => {});
  }
  location.reload();
}

function renderAll() {
  renderCompanyOptions();
  renderCompaniesTable();
  renderCompanyCount();
  renderYearFilter();
  renderDashboardYearFilter();
  renderDashboard();
  renderQueryView();
  renderChecklist();
  if (authState.user?.role === "admin") renderUsersTable();
  refreshIcons();
}

function renderQueryView() {
  renderSummaryCards();
  renderProjectTable();
}

function renderChecklist() {
  const isAdmin = authState.user?.role === "admin";
  const occupation = $("#checklistOccupationText");
  const vacancy = $("#checklistVacancyText");
  if (occupation && document.activeElement !== occupation && occupation.innerHTML !== state.checklists.occupation) {
    occupation.innerHTML = state.checklists.occupation;
  }
  if (vacancy && document.activeElement !== vacancy && vacancy.innerHTML !== state.checklists.vacancy) {
    vacancy.innerHTML = state.checklists.vacancy;
  }
  [occupation, vacancy].forEach((editor) => {
    if (!editor) return;
    editor.contentEditable = isAdmin ? "true" : "false";
    editor.classList.toggle("readonly", !isAdmin);
  });
  $$("[data-checklist-note]").forEach((note) => {
    note.textContent = isAdmin ? "Cole aqui o modelo do e-mail com formatação e salve." : "Somente administradores podem editar.";
  });
}

function saveChecklistTemplates() {
  if (authState.user?.role !== "admin") {
    showToast("Somente administradores podem salvar o checklist.", "error");
    return;
  }
  state.checklists = normalizeChecklists({
    occupation: $("#checklistOccupationText")?.innerHTML || "",
    vacancy: $("#checklistVacancyText")?.innerHTML || "",
  });
  saveData();
  renderChecklist();
  showToast("Checklist salvo com formatação.", "success");
}

async function copyChecklistText(kind) {
  const selector = kind === "vacancy" ? "#checklistVacancyText" : "#checklistOccupationText";
  const editor = $(selector);
  const html = sanitizeChecklistHtml(editor?.innerHTML || "");
  const text = editor?.innerText || "";
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    showToast("Texto formatado copiado para o e-mail.", "success");
  } catch {
    showToast("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.", "warning");
  }
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
  const dashboardProjects = getDashboardProjects();
  const activeProjects = dashboardProjects.filter((project) => getProjectSection(project) === "occupation");
  const vacancyProjects = dashboardProjects.filter((project) => getProjectSection(project) === "vacancy");
  const waitingProjects = dashboardProjects.filter((project) => getProjectSection(project) === "waiting");
  const deniedProjects = dashboardProjects.filter((project) => getProjectSection(project) === "denied");
  const completedProjects = dashboardProjects.filter((project) => project.status === "Concluído");
  const waitingAlerts = dashboardProjects
    .filter((project) => project.status === "Aguardando" && !project.poleExchange && daysElapsed(project.mainDate) >= 7)
    .sort((a, b) => daysElapsed(b.mainDate) - daysElapsed(a.mainDate));
  const vacancyAlerts = dashboardProjects
    .filter((project) => project.type === "Desocupação" && project.status === "Concluído" && !project.vacancyLetterDate && daysElapsed(project.mainDate) >= 70)
    .sort((a, b) => daysElapsed(b.mainDate) - daysElapsed(a.mainDate));
  const latest = dashboardProjects
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
  setText("#dashTotalProjects", dashboardProjects.length);

  renderDashboardCharts({ dashboardProjects, activeProjects, vacancyProjects, waitingProjects, deniedProjects });
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

function getDashboardProjects() {
  return state.dashboardYear ? state.projects.filter((project) => getProjectYear(project) === state.dashboardYear) : state.projects;
}

function renderDashboardCharts({ dashboardProjects, activeProjects, vacancyProjects, waitingProjects, deniedProjects }) {
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
  renderStatusDonut(statusSegments, dashboardProjects.length);
  renderTypeBars(dashboardProjects);
  renderMonthlyChart(dashboardProjects);
}

function renderStatusDonut(segments, total) {
  const donut = $("#dashStatusDonut");
  const legend = $("#dashStatusLegend");
  if (!donut || !legend) return;
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

function renderTypeBars(projectsSource) {
  const container = $("#dashTypeBars");
  if (!container) return;
  const rows = TYPES.map((type) => {
    const projects = projectsSource.filter((project) => project.type === type);
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

function renderMonthlyChart(projectsSource) {
  const container = $("#dashMonthlyChart");
  if (!container) return;
  const months = getDashboardMonths();
  const counts = months.map((month) => ({
    ...month,
    count: projectsSource.filter((project) => {
      const periodDate = getProjectPeriodDate(project);
      if (!periodDate) return false;
      if (month.key) return periodDate.slice(0, 7) === month.key;
      return Number(periodDate.slice(5, 7)) === month.month;
    }).length,
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

function getDashboardMonths() {
  const formatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const date = new Date(Number(state.dashboardYear || new Date().getFullYear()), index, 1);
    return {
      key: state.dashboardYear ? `${state.dashboardYear}-${String(month).padStart(2, "0")}` : "",
      month,
      label: formatter.format(date).replace(".", ""),
    };
  });
}

function renderDashboardAlertTable(selector, projects, kind) {
  const body = $(selector);
  if (!body) return;
  if (!projects.length) {
    body.innerHTML = `<tr><td colspan="4"><div class="empty-state">Nenhum alerta no momento.</div></td></tr>`;
    return;
  }
  body.innerHTML = projects
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

async function renderUsersTable() {
  const body = $("#usersTableBody");
  if (!body || authState.user?.role !== "admin") return;
  if (!remoteSync.enabled) {
    body.innerHTML = `<tr><td colspan="6"><div class="empty-state">Controle de usuários disponível somente no site publicado.</div></td></tr>`;
    return;
  }
  try {
    const response = await fetch("/api/auth?action=users", { cache: "no-store" });
    if (!response.ok) throw new Error("Falha ao carregar usuários.");
    const data = await response.json();
    const users = data.users || [];
    if (!users.length) {
      body.innerHTML = `<tr><td colspan="6"><div class="empty-state">Nenhum usuário encontrado.</div></td></tr>`;
      return;
    }
    body.innerHTML = users
      .map(
        (user) => `
          <tr>
            <td>
              <div class="user-cell">
                <span>${escapeHtml(getInitials(user.name || user.email))}</span>
                <strong>${escapeHtml(user.name || "-")}</strong>
              </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td>${userStatusBadge(user.status)}</td>
            <td>${escapeHtml(user.role === "admin" ? "Administrador" : "Usuário")}</td>
            <td>${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("pt-BR") : "-"}</td>
            <td>
              <div class="table-actions">
                ${
                  user.status !== "approved"
                    ? `<button class="secondary icon-text" type="button" data-user-approve="${escapeAttr(user.email)}"><i data-lucide="check"></i>Aprovar</button>`
                    : ""
                }
                ${
                  user.role !== "admin" && user.status === "approved"
                    ? `<button class="secondary icon-text" type="button" data-user-admin="${escapeAttr(user.email)}"><i data-lucide="shield"></i>Admin</button>`
                    : ""
                }
                ${
                  user.email !== authState.user.email
                    ? `<button class="danger icon-text" type="button" data-user-reject="${escapeAttr(user.email)}"><i data-lucide="ban"></i>Bloquear</button>`
                    : ""
                }
              </div>
            </td>
          </tr>
        `
      )
      .join("");
    $$("[data-user-approve]").forEach((button) =>
      button.addEventListener("click", () => updateUserAccess(button.dataset.userApprove, "approved", "user"))
    );
    $$("[data-user-admin]").forEach((button) =>
      button.addEventListener("click", () => updateUserAccess(button.dataset.userAdmin, "approved", "admin"))
    );
    $$("[data-user-reject]").forEach((button) =>
      button.addEventListener("click", () => updateUserAccess(button.dataset.userReject, "rejected", "user"))
    );
    refreshIcons();
  } catch (error) {
    body.innerHTML = `<tr><td colspan="6"><div class="empty-state">Não foi possível carregar usuários.</div></td></tr>`;
  }
}

function userStatusBadge(status) {
  if (status === "approved") return badge("Aprovado", "green");
  if (status === "pending") return badge("Pendente", "amber");
  if (status === "rejected") return badge("Bloqueado", "red");
  return badge(status || "-", "neutral");
}

async function updateUserAccess(email, status, role) {
  try {
    const response = await fetch("/api/auth?action=approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, status, role }),
    });
    if (!response.ok) throw new Error("Falha ao atualizar usuário.");
    showToast("Usuário atualizado.", "success");
    renderUsersTable();
  } catch (error) {
    showToast("Não foi possível atualizar o usuário.", "error");
  }
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
    month: state.projects.filter((project) => getProjectPeriodDate(project)?.slice(0, 7) === `${currentYear}-${currentMonth}`).length,
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

function renderDashboardYearFilter() {
  const select = $("#dashboardYearFilter");
  if (!select) return;
  const years = Array.from(new Set(["2025", "2026", ...state.projects.map(getProjectYear).filter(Boolean)])).sort();
  const current = state.dashboardYear;
  select.innerHTML = `<option value="">Todos</option>${years.map((year) => `<option value="${year}">${year}</option>`).join("")}`;
  if (years.includes(current)) select.value = current;
  else state.dashboardYear = "";
}

function renderProjectTable() {
  const copy = sectionCopy[state.currentSection];
  $("#querySectionTitle").textContent = copy.title;
  $("#querySectionSubtitle").textContent = copy.subtitle;
  const projects = sortProjectsByLetterDate(
    getFilteredProjects().filter((project) => getProjectSection(project) === state.currentSection),
    "desc"
  );
  const tableOptions = {
    showPoleExchange: state.currentSection === "waiting" && projects.some((project) => project.poleExchange),
  };
  renderProjectHead(tableOptions);
  renderProjectRows(projects, tableOptions);
  syncProjectsHorizontalScroll();
  refreshIcons();
}

function renderProjectHead(options = {}) {
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
      ...(options.showPoleExchange ? ["Troca de postes"] : []),
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
      "Data de notificação",
      "Data transformado em NE",
      "Motivo da negativa",
      "Valor multiplicado",
      "Ações",
    ],
  };
  const activeColumns = columns[state.currentSection];
  $("#projectsTableCols").innerHTML = activeColumns.map((column) => `<col class="col-${getProjectColumnKey(column)}" />`).join("");
  $("#projectsTableHead").innerHTML = `<tr>${activeColumns.map((column) => `<th>${column}</th>`).join("")}</tr>`;
}

function getProjectColumnKey(column) {
  const map = {
    Empresa: "company",
    Parceiro: "partner",
    Ordem: "order",
    Carta: "letter",
    Município: "city",
    Tipo: "type",
    Parecer: "opinion",
    Status: "status",
    "Data do envio da carta": "date",
    "Data de solicitação": "date",
    "Data do envio da notificação": "date",
    "Data de notificação": "date",
    "Data transformado em NE": "date",
    Data: "date",
    Mês: "month",
    Postes: "poles",
    "Valor multiplicado": "value",
    "Contagem 90 dias": "count",
    "Contagem 10 dias": "count",
    "Alerta/Status": "alert",
    Alerta: "alert",
    "Troca de postes": "status",
    "Motivo da negativa": "reason",
    Ações: "actions",
  };
  return map[column] || "default";
}

function syncProjectsHorizontalScroll() {
  const bottom = $("#projectsScrollBottom");
  const spacer = $("#projectsScrollSpacer");
  const wrap = $("#projectsTableWrap");
  const table = $("#projectsTable");
  if (!bottom || !spacer || !wrap || !table) return;

  spacer.style.width = `${table.scrollWidth}px`;
  const rect = wrap.getBoundingClientRect();
  const hasOverflow = table.scrollWidth > wrap.clientWidth + 2;
  const isVisible = rect.bottom > 90 && rect.top < window.innerHeight - 34;
  bottom.classList.toggle("active", hasOverflow && isVisible);
  if (hasOverflow && isVisible) {
    bottom.style.left = `${Math.max(8, rect.left)}px`;
    bottom.style.width = `${Math.min(rect.width, window.innerWidth - Math.max(8, rect.left) - 8)}px`;
  }
  bottom.onscroll = () => {
    if (wrap.scrollLeft !== bottom.scrollLeft) wrap.scrollLeft = bottom.scrollLeft;
  };
  wrap.onscroll = () => {
    if (bottom.scrollLeft !== wrap.scrollLeft) bottom.scrollLeft = wrap.scrollLeft;
  };
  bottom.scrollLeft = wrap.scrollLeft;
}

function renderProjectRows(projects, options = {}) {
  const body = $("#projectsTableBody");
  if (!projects.length) {
    body.innerHTML = `<tr><td colspan="13"><div class="empty-state">Nenhum projeto encontrado para esta janela.</div></td></tr>`;
    return;
  }

  body.innerHTML = projects.map((project) => renderProjectRow(project, options)).join("");

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

function renderProjectRow(project, options = {}) {
  const meta = getProjectMeta(project);
  const rowClass = meta.hasAlert ? "alert-row" : "";
  const actions = `
    <div class="table-actions">
      <button class="secondary icon-text" type="button" data-edit-project="${project.id}"><i data-lucide="pencil"></i>Editar</button>
      <button class="danger icon-text" type="button" data-delete-project="${project.id}"><i data-lucide="trash-2"></i>Excluir</button>
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
        ${options.showPoleExchange ? `<td>${project.poleExchange ? badge("Sim", "blue") : "-"}</td>` : ""}
        <td>${escapeHtml(meta.countLabel)}</td>
        <td>${meta.statusBadge}</td>
        <td>${formatMoney(project.multipliedValue)}</td>
        <td>
          <div class="table-actions">
            <button class="danger icon-text" type="button" data-deny-project="${project.id}"><i data-lucide="ban"></i>Negar</button>
            <button class="secondary icon-text" type="button" data-edit-project="${project.id}"><i data-lucide="pencil"></i>Editar</button>
            <button class="danger icon-text" type="button" data-delete-project="${project.id}"><i data-lucide="trash-2"></i>Excluir</button>
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
        <td>${formatDate(project.neDate)}</td>
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
        getProjectPeriodDate(project),
        formatDate(getProjectPeriodDate(project)),
        getProjectMonth(project),
        project.poles,
        formatMoney(project.multipliedValue),
        getProjectYear(project),
        project.denialReason,
        project.neDate,
        formatDate(project.neDate),
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
    if (filters.month && getProjectMonth(project) !== filters.month) return false;
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
    if (project.poleExchange) {
      return {
        countLabel: "Sem contagem",
        hasAlert: false,
        isFinalized: false,
        statusBadge: badge("Troca de postes", "blue"),
      };
    }
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
  const date = getProjectPeriodDate(project);
  return date ? date.slice(0, 4) : "";
}

function getProjectMonth(project) {
  if (project.type === "Desocupação" && project.status === "Concluído") {
    const date = getProjectPeriodDate(project);
    if (!date) return "";
    return MONTHS[Number(date.slice(5, 7)) - 1] || "";
  }
  return project.month || "";
}

function getProjectPeriodDate(project) {
  if (project.type === "Desocupação" && project.status === "Concluído") {
    return project.vacancyLetterDate || "";
  }
  return project.mainDate || "";
}

function getProjectLetterSortDate(project) {
  if (project.type === "Desocupação" && project.status === "Concluído") {
    return project.vacancyLetterDate || project.mainDate || "";
  }
  return project.mainDate || "";
}

function sortProjectsByLetterDate(projects, direction = "desc") {
  return projects.slice().sort((a, b) => {
    const aTime = getDateSortTime(getProjectLetterSortDate(a), direction);
    const bTime = getDateSortTime(getProjectLetterSortDate(b), direction);
    if (aTime !== bTime) return direction === "asc" ? aTime - bTime : bTime - aTime;
    return String(a.companyName || "").localeCompare(String(b.companyName || ""), "pt-BR");
  });
}

function getDateSortTime(value, direction) {
  if (!value) return direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  const time = Date.parse(`${value}T00:00:00`);
  if (Number.isNaN(time)) return direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  return time;
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
  $("#editPoleExchange").value = project.poleExchange ? "Sim" : "Não";
  $("#editReason").value = project.denialReason || "";
  $("#editNeDate").value = project.neDate || "";
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
  $("#editNeDateField").classList.toggle("hidden", status !== "Negado");
  $("#editPoleExchangeField").classList.toggle("hidden", status !== "Aguardando");
  if (status !== "Aguardando") $("#editPoleExchange").value = "Não";
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
    poleExchange: status === "Aguardando" && $("#editPoleExchange").value === "Sim",
    denialReason: status === "Negado" ? $("#editReason").value : "",
    neDate: status === "Negado" ? $("#editNeDate").value : "",
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
  project.poleExchange = false;
  project.denialReason = reason;
  project.neDate = todayInputValue();
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
    checklist: "Checklist",
    "user-admin": "Usuários",
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
  let clean = String(value || "").replace(/[^\d,.-]/g, "");
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    clean = lastComma > lastDot ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  } else if (lastComma > -1) {
    clean = clean.replace(",", ".");
  } else {
    clean = clean.replace(/\.(?=\d{3}(\D|$))/g, "");
  }
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

function todayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
  readProjectFile(event.target.files[0]).then((rows) => {
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
      const importedNeDate = resolveImportedNeDate(row, "Negado");
      const status = normalizeImportedStatus(getCsvValue(row, ["status"]), denialReason, importedNeDate);
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
        poleExchange: status === "Aguardando" && normalizeYes(getCsvValue(row, ["troca de postes", "troca postes", "troca de poste", "troca poste"])),
        denialReason,
        neDate: status === "Negado" ? importedNeDate : "",
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
  if (status === "Aguardando" || status === "Negado") {
    return (
      normalizeCsvDate(
        getCsvValue(row, [
          "data do envio da notificação",
          "data do envio da notificacao",
          "data de notificação",
          "data de notificacao",
          "data notificação",
          "data notificacao",
          "data envio notificação",
          "data envio notificacao",
          "data envio da notificação",
          "data envio da notificacao",
          "data do envio da carta",
          "data envio da carta",
          "data envio carta",
          "data envio carta / pedido cliente",
          "data do envio da carta / pedido cliente",
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
  return (
    normalizeCsvDate(
      getCsvValue(row, [
        "data do envio da carta",
        "data envio da carta",
        "data envio carta",
        "data envio carta / pedido cliente",
        "data do envio da carta / pedido cliente",
        "data principal",
        "data",
      ])
    ) || ""
  );
}

function resolveImportedNeDate(row, status) {
  if (status !== "Negado") return "";
  return (
    normalizeCsvDate(
      getCsvValue(row, [
        "data transformado em ne",
        "data transformado ne",
        "data de transformado em ne",
        "data transformação em ne",
        "data transformacao em ne",
        "data ne",
        "transformado em ne",
      ])
    ) || ""
  );
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
        "data envio da carta",
        "data envio carta",
        "data envio carta / pedido cliente",
        "data do envio da carta / pedido cliente",
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

function normalizeImportedStatus(value, denialReason, neDate = "") {
  const exact = normalizeFromList(value, STATUSES);
  if (exact) return exact;
  const clean = normalize(value);
  if (clean.includes("neg")) return "Negado";
  if (clean.includes("aguard")) return "Aguardando";
  if (clean.includes("concl")) return "Concluído";
  if (neDate) return "Negado";
  if (denialReason) return "Negado";
  return "Concluído";
}

function normalizeYes(value) {
  const clean = normalize(value);
  return ["sim", "s", "yes", "y", "true", "1"].includes(clean);
}

function normalizeFromList(value, list) {
  const clean = normalize(value);
  if (!clean) return "";
  return list.find((item) => normalize(item) === clean) || "";
}

function parseCsvInteger(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? Number(digits) : NaN;
}

function exportProjects() {
  const projects = sortProjectsByLetterDate(
    getFilteredProjects().filter((project) => getProjectSection(project) === state.currentSection),
    "asc"
  );
  const headersBySection = {
    occupation: [
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
      "Data do envio da carta",
      "Postes",
    ],
    vacancy: [
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
    ],
    waiting: [
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
      "Data de notificação",
      "Troca de postes",
      "Postes",
    ],
    denied: [
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
      "Data de notificação",
      "Data transformado em NE",
      "Motivo da negativa",
      "Postes",
    ],
  };
  const headers = headersBySection[state.currentSection] || headersBySection.occupation;
  const rows = projects.map((project) => {
    const isVacancy = project.type === "Desocupação";
    const isDenied = project.status === "Negado";
    const isWaiting = project.status === "Aguardando";
    return {
      "Ordem de venda": project.order,
      Empresa: project.companyName,
      Tipo: project.type,
      "Mês de referência": getProjectMonth(project),
      Parecer: project.opinion,
      Parceiro: project.partner,
      Valor: formatNumberForInput(project.pointValue),
      "Multiplicação ponto": formatNumberForInput(project.multipliedValue),
      Carta: project.letter,
      Município: project.city,
      ...(isVacancy ? { "Data de solicitação": project.mainDate } : {}),
      ...(isDenied || isWaiting ? { "Data de notificação": project.mainDate } : {}),
      ...(isDenied ? { "Data transformado em NE": project.neDate } : {}),
      ...(isDenied ? { "Motivo da negativa": project.denialReason || "" } : {}),
      ...(isWaiting ? { "Troca de postes": project.poleExchange ? "Sim" : "Não" } : {}),
      "Data do envio da carta": isVacancy ? project.vacancyLetterDate : isDenied || isWaiting ? "" : project.mainDate,
      Postes: project.poles,
    };
  });
  downloadCsv("projetos-sp.csv", rows, headers);
}

function readProjectFile(file) {
  if (!file) return Promise.resolve([]);
  const extension = getFileExtension(file.name);
  if (extension === "csv") return readCsvFile(file);
  if (["xlsx", "xlsm", "xlsxm"].includes(extension)) return readExcelFile(file);
  showToast("Formato inválido. Use CSV, XLSX ou XLSM.", "error");
  return Promise.resolve([]);
}

function getFileExtension(filename) {
  return String(filename || "").split(".").pop().toLowerCase();
}

function readExcelFile(file) {
  return new Promise((resolve) => {
    if (!window.XLSX) {
      showToast("Leitor Excel não carregou. Atualize a página e tente novamente.", "error");
      resolve([]);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          resolve([]);
          return;
        }
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
          defval: "",
          raw: false,
          dateNF: "dd/mm/yyyy",
        });
        resolve(rows.map(normalizeImportedRow));
      } catch (error) {
        showToast("Não foi possível ler a planilha Excel.", "error");
        resolve([]);
      }
    };
    reader.onerror = () => {
      showToast("Não foi possível ler o arquivo.", "error");
      resolve([]);
    };
    reader.readAsArrayBuffer(file);
  });
}

function normalizeImportedRow(row) {
  return Object.entries(row || {}).reduce((result, [key, value]) => {
    result[keyify(key)] = normalizeImportedCell(value);
    return result;
  }, {});
}

function normalizeImportedCell(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value ?? "").trim();
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
    if (value !== undefined && value !== "") return String(value).trim();
  }
  return "";
}

function keyify(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeCsvDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + Math.round(value) * 86400000);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (!match) return "";
  const [, day, month, rawYear] = match;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
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
