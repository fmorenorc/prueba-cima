const API_BASE = "https://cima.aemps.es/cima/rest";
const MIN_QUERY_LENGTH = 2;
const SUGGESTION_LIMIT = 8;
const MAX_RESULTS = 30;

const form = document.querySelector("#search-form");
const typeSelect = document.querySelector("#search-type");
const valueInput = document.querySelector("#search-value");
const searchButton = document.querySelector("#search-button");
const statusEl = document.querySelector("#status");
const resultsEl = document.querySelector("#results");
const template = document.querySelector("#medicine-card-template");
const datalist = document.querySelector("#search-suggestions");

const labels = {
  nombre: "Nombre comercial",
  principioActivo: "Principio activo",
  atc: "Código ATC",
};

const paramCandidates = {
  nombre: ["nombre"],
  principioActivo: ["pactivos", "principioActivo", "pactivo"],
  atc: ["atc", "atccode", "codATC"],
};

// Cache en memoria para evitar repetir consultas iguales.
const responseCache = new Map();
let suggestionsDebounce;
let lastSearchKey = "";

function setStatus(message) {
  statusEl.textContent = message;
}

function toArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.resultados)) return raw.resultados;
  if (Array.isArray(raw?.medicamentos)) return raw.medicamentos;
  return [];
}

function cleanValue(value) {
  if (value == null) return "—";
  if (Array.isArray(value)) {
    const flattened = value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return item?.nombre ?? item?.descripcion ?? item?.codigo ?? "";
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");

    return flattened || "—";
  }

  return String(value).trim() || "—";
}

function getValue(obj, keys) {
  for (const key of keys) {
    const candidate = cleanValue(obj?.[key]);
    if (candidate !== "—") return candidate;
  }
  return "—";
}

async function fetchMedicines(type, value) {
  const normalizedValue = value.trim();
  const normalizedKey = `${type}:${normalizedValue.toLowerCase()}`;

  if (responseCache.has(normalizedKey)) {
    return responseCache.get(normalizedKey);
  }

  const params = paramCandidates[type] ?? [type];
  let lastError;

  for (const param of params) {
    const url = `${API_BASE}/medicamentos?${new URLSearchParams({ [param]: normalizedValue })}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`Error ${response.status} en parámetro ${param}`);
        continue;
      }

      const data = await response.json();
      const meds = toArray(data);
      if (meds.length > 0) {
        responseCache.set(normalizedKey, meds);
        return meds;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;

  responseCache.set(normalizedKey, []);
  return [];
}

function buildDocLinks(medicine) {
  const docs = Array.isArray(medicine.docs)
    ? medicine.docs
    : Array.isArray(medicine.documentos)
      ? medicine.documentos
      : [];

  const normalized = docs
    .map((doc) => ({
      title: cleanValue(doc?.tipo ?? doc?.descripcion ?? "Documento"),
      href: doc?.url ?? doc?.urlHtml ?? doc?.urlPdf,
    }))
    .filter((doc) => doc.href);

  const fallback = [
    { title: "Ficha técnica", href: medicine?.fichaTecnica ?? medicine?.urlFt },
    { title: "Prospecto", href: medicine?.prospecto ?? medicine?.urlProspecto },
  ].filter((doc) => doc.href);

  const deduplicated = [];
  const seen = new Set();

  [...normalized, ...fallback].forEach((doc) => {
    if (!seen.has(doc.href)) {
      seen.add(doc.href);
      deduplicated.push(doc);
    }
  });

  return deduplicated;
}

function buildMetaItems(medicine) {
  return [
    ["Nombre del medicamento", getValue(medicine, ["nombre", "ncom"])],
    ["Principio activo", getValue(medicine, ["pactivos", "principioActivo"])],
    ["Laboratorio titular", getValue(medicine, ["labtitular", "lab_titular"])],
    ["Vía de administración", getValue(medicine, ["viasAdministracion", "viaAdministracion"])],
    ["Código ATC", getValue(medicine, ["atc", "atccode", "codigoATC"])],
    ["Número de registro", getValue(medicine, ["nregistro"])],
  ];
}

function cardForMedicine(medicine) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector(".medicine-name").textContent = getValue(medicine, ["nombre", "ncom"]);

  const dl = node.querySelector(".medicine-meta");
  buildMetaItems(medicine).forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;

    const dd = document.createElement("dd");
    dd.textContent = value;

    dl.append(dt, dd);
  });

  const docsContainer = node.querySelector(".docs");
  const links = buildDocLinks(medicine);

  const preferredLinks = [
    links.find((link) => /ficha/i.test(link.title)) ?? null,
    links.find((link) => /prospecto/i.test(link.title)) ?? null,
  ].filter(Boolean);

  if (preferredLinks.length === 0) {
    const msg = document.createElement("p");
    msg.textContent = "No hay enlaces oficiales de ficha técnica o prospecto disponibles.";
    docsContainer.append(msg);
  }

  preferredLinks.forEach((doc) => {
    const link = document.createElement("a");
    link.className = "doc-link";
    link.href = doc.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = /ficha/i.test(doc.title) ? "Ficha técnica" : "Prospecto";
    docsContainer.append(link);
  });

  return node;
}

function renderEmptyState(message) {
  resultsEl.textContent = "";
  const block = document.createElement("div");
  block.className = "empty-state";
  block.textContent = message;
  resultsEl.append(block);
}

function renderResults(medicines) {
  resultsEl.textContent = "";

  if (medicines.length === 0) {
    setStatus("No se han encontrado medicamentos para esa búsqueda.");
    renderEmptyState("Prueba con un término más específico o cambia el tipo de búsqueda.");
    return;
  }

  const shown = medicines.slice(0, MAX_RESULTS);
  setStatus(`Se han encontrado ${medicines.length} medicamento(s). Mostrando ${shown.length}.`);

  const fragment = document.createDocumentFragment();
  shown.forEach((medicine) => fragment.append(cardForMedicine(medicine)));
  resultsEl.append(fragment);
}

async function performSearch(type, value) {
  const queryText = value.trim();
  if (queryText.length < MIN_QUERY_LENGTH) {
    setStatus(`Introduce al menos ${MIN_QUERY_LENGTH} caracteres para buscar.`);
    renderEmptyState("El término de búsqueda es demasiado corto.");
    return;
  }

  const currentKey = `${type}:${queryText.toLowerCase()}`;
  if (currentKey === lastSearchKey && resultsEl.childElementCount > 0) {
    setStatus("Ya estás viendo los resultados más recientes para esta búsqueda.");
    return;
  }

  setStatus(`Buscando por ${labels[type]}...`);
  resultsEl.textContent = "";
  searchButton.disabled = true;

  try {
    const medicines = await fetchMedicines(type, queryText);
    lastSearchKey = currentKey;
    renderResults(medicines);
  } catch (error) {
    setStatus(`No se ha podido consultar la API de CIMA (${error.message}).`);
    renderEmptyState("Error temporal de conexión con CIMA. Inténtalo de nuevo en unos segundos.");
  } finally {
    searchButton.disabled = false;
  }
}

async function updateSuggestions() {
  clearTimeout(suggestionsDebounce);

  const type = typeSelect.value;
  const value = valueInput.value.trim();
  if (value.length < MIN_QUERY_LENGTH) {
    datalist.textContent = "";
    return;
  }

  suggestionsDebounce = setTimeout(async () => {
    try {
      const medicines = await fetchMedicines(type, value);
      const suggestions = medicines
        .map((medicine) => getValue(medicine, ["nombre", "ncom"]))
        .filter((item, index, arr) => item !== "—" && arr.indexOf(item) === index)
        .slice(0, SUGGESTION_LIMIT);

      datalist.textContent = "";
      suggestions.forEach((suggestion) => {
        const option = document.createElement("option");
        option.value = suggestion;
        datalist.append(option);
      });
    } catch {
      datalist.textContent = "";
    }
  }, 300);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await performSearch(typeSelect.value, valueInput.value);
});

valueInput.addEventListener("input", updateSuggestions);

typeSelect.addEventListener("change", () => {
  valueInput.value = "";
  datalist.textContent = "";
  lastSearchKey = "";
  resultsEl.textContent = "";
  setStatus("");
});
