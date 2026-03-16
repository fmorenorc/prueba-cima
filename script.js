const API_BASE = "https://cima.aemps.es/cima/rest";

const form = document.querySelector("#search-form");
const typeSelect = document.querySelector("#search-type");
const valueInput = document.querySelector("#search-value");
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

const setStatus = (message) => {
  statusEl.textContent = message;
};

const toArray = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.resultados)) return raw.resultados;
  if (Array.isArray(raw?.medicamentos)) return raw.medicamentos;
  return [];
};

const getValue = (obj, keys) => keys.map((k) => obj?.[k]).find(Boolean) ?? "—";

async function queryMedicines(type, value) {
  const params = paramCandidates[type] ?? [type];
  let lastError;

  for (const param of params) {
    const url = `${API_BASE}/medicamentos?${new URLSearchParams({ [param]: value })}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`Error ${response.status} en ${param}`);
        continue;
      }

      const data = await response.json();
      const meds = toArray(data);
      if (meds.length > 0) return meds;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return [];
}

function buildDocLinks(medicine) {
  const docs = medicine.docs ?? medicine.documentos ?? [];

  const normalized = docs.map((doc) => ({
    title: doc?.tipo ?? doc?.descripcion ?? "Documento",
    href: doc?.url ?? doc?.urlHtml ?? doc?.urlPdf,
  }));

  const fallback = [
    { title: "Ficha técnica", href: medicine?.fichaTecnica ?? medicine?.urlFt },
    { title: "Prospecto", href: medicine?.prospecto ?? medicine?.urlProspecto },
  ];

  return [...normalized, ...fallback].filter((doc) => doc.href);
}

function cardForMedicine(medicine) {
  const node = template.content.firstElementChild.cloneNode(true);

  node.querySelector(".medicine-name").textContent = getValue(medicine, ["nombre", "ncom"]);

  const meta = [
    ["Nº registro", getValue(medicine, ["nregistro"] )],
    ["Principio activo", getValue(medicine, ["pactivos", "principioActivo"])],
    ["Lab titular", getValue(medicine, ["labtitular", "lab_titular"])],
    ["Vía", getValue(medicine, ["viasAdministracion", "viaAdministracion"])],
    ["ATC", getValue(medicine, ["atc", "atccode"])],
  ];

  const dl = node.querySelector(".medicine-meta");
  meta.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  });

  const docsContainer = node.querySelector(".docs");
  const links = buildDocLinks(medicine);

  if (links.length === 0) {
    const msg = document.createElement("p");
    msg.textContent = "No hay documentos disponibles para este medicamento.";
    docsContainer.append(msg);
  }

  links.forEach((doc) => {
    const link = document.createElement("a");
    link.className = "doc-link";
    link.href = doc.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = doc.title;
    docsContainer.append(link);
  });

  return node;
}

function renderResults(medicines) {
  resultsEl.textContent = "";

  if (medicines.length === 0) {
    setStatus("No se han encontrado medicamentos para la búsqueda.");
    return;
  }

  setStatus(`Se han encontrado ${medicines.length} medicamento(s).`);

  const fragment = document.createDocumentFragment();
  medicines.forEach((medicine) => fragment.append(cardForMedicine(medicine)));
  resultsEl.append(fragment);
}

let suggestDebounce;

async function updateSuggestions() {
  clearTimeout(suggestDebounce);
  const text = valueInput.value.trim();
  const type = typeSelect.value;

  if (text.length < 2) {
    datalist.textContent = "";
    return;
  }

  suggestDebounce = setTimeout(async () => {
    try {
      const meds = await queryMedicines(type, text);
      const suggestions = meds
        .map((m) => getValue(m, ["nombre", "ncom"]))
        .filter((name, idx, arr) => name !== "—" && arr.indexOf(name) === idx)
        .slice(0, 8);

      datalist.textContent = "";
      suggestions.forEach((item) => {
        const option = document.createElement("option");
        option.value = item;
        datalist.append(option);
      });
    } catch {
      datalist.textContent = "";
    }
  }, 350);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const type = typeSelect.value;
  const value = valueInput.value.trim();

  if (!value) return;

  setStatus(`Buscando por ${labels[type]}...`);
  resultsEl.textContent = "";

  try {
    const medicines = await queryMedicines(type, value);
    renderResults(medicines);
  } catch (error) {
    setStatus(`No se ha podido consultar la API de CIMA (${error.message}).`);
  }
});

valueInput.addEventListener("input", updateSuggestions);
typeSelect.addEventListener("change", () => {
  valueInput.value = "";
  datalist.textContent = "";
  setStatus("");
  resultsEl.textContent = "";
});
