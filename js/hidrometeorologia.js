/**
 * hidrometeorologia.js
 * -----------------------------------------------------------------------
 * Módulo de Hidrometeorología — Monitoreo del Río Limón.
 *
 * La estadística institucional es un índice de 0 a 9 (no metros). La
 * información la nutre otra aplicación externa a través de una API: este
 * módulo NO ofrece registro manual de lecturas, solo:
 *  - Un dashboard en tiempo real (numérico + gráfico) con estados de
 *    alerta visual (Normal / Advertencia / Alerta Roja) según umbrales
 *    configurables por el administrador.
 *  - `consultarNivelExterno()`, lista para integrarse con el endpoint/API
 *    provisto por el usuario, que registra automáticamente cada lectura
 *    obtenida.
 *  - Historial de lecturas (trazabilidad) con impresión formal firmada
 *    por el Responsable y el Director.
 * -----------------------------------------------------------------------
 */
import { db, doc, getDoc, setDoc, serverTimestamp } from "./firebase.js";
import { COLLECTIONS, UMBRALES_HIDRO_DEFAULT, NIVEL_HIDRO_MIN, NIVEL_HIDRO_MAX } from "./config.js";
import { subscribeCollection, createRecord } from "./data.js";
import { createHistorial, formatDate, toast } from "./ui.js";
import { isAdmin, getCurrentUser, getResponsableLabel } from "./auth.js";

let lecturas = [];
let umbrales = { ...UMBRALES_HIDRO_DEFAULT };
let chart = null;

function calcularEstado(nivel) {
  if (nivel === null || nivel === undefined || isNaN(nivel)) return { label: "Sin datos", color: "slate" };
  if (nivel >= umbrales.alerta) return { label: "ALERTA ROJA", color: "red" };
  if (nivel >= umbrales.advertencia) return { label: "ADVERTENCIA", color: "amber" };
  return { label: "NORMAL", color: "emerald" };
}

/**
 * Función asíncrona preparada para consumir el endpoint/API externo que
 * nutre el nivel del Río Limón (índice 0-9). Se invoca desde el botón
 * "Consultar fuente externa" y, si hay un endpoint configurado, también
 * al entrar a este módulo (mejor esfuerzo, en silencio).
 */
async function consultarNivelExterno({ silent = false } = {}) {
  if (!umbrales.apiEndpoint) {
    if (!silent) toast("No hay un endpoint externo configurado. Pídale al administrador que lo configure en Ajustes.", "warning");
    return null;
  }
  try {
    const headers = umbrales.apiKey ? { Authorization: `Bearer ${umbrales.apiKey}` } : {};
    const res = await fetch(umbrales.apiEndpoint, { headers });
    if (!res.ok) throw new Error(`Respuesta HTTP ${res.status}`);
    const json = await res.json();
    const nivel = Number(json.nivel ?? json.level ?? json.value);
    if (isNaN(nivel)) throw new Error("La respuesta no contiene un nivel numérico reconocible.");
    return Math.min(NIVEL_HIDRO_MAX, Math.max(NIVEL_HIDRO_MIN, Math.round(nivel)));
  } catch (err) {
    console.error("Error consultando fuente externa de hidrometeorología:", err);
    if (!silent) toast("No se pudo consultar la fuente externa. Verifique el endpoint configurado.", "error");
    return null;
  }
}

async function registrarLectura(nivel, fuente) {
  const estado = calcularEstado(nivel);
  await createRecord(COLLECTIONS.HIDRO_LECTURAS, {
    fecha: new Date(),
    nivel,
    estado: estado.label,
    fuente,
    responsable: getResponsableLabel(),
  });
}

function renderDashboard() {
  const ultima = lecturas[0];
  const nivel = ultima ? Number(ultima.nivel) : null;
  const estado = calcularEstado(nivel);

  const nivelEl = document.getElementById("hidro-nivel-actual");
  const badgeEl = document.getElementById("hidro-estado-badge");
  const fechaEl = document.getElementById("hidro-fecha-lectura");
  if (nivelEl) nivelEl.textContent = nivel !== null ? `${nivel} / 9` : "—";
  if (fechaEl) fechaEl.textContent = ultima ? `Última lectura: ${formatDate(ultima.fecha, true)}` : "Sin lecturas registradas";

  const colorClasses = {
    emerald: "bg-emerald-100 text-emerald-800 border-emerald-300",
    amber: "bg-amber-100 text-amber-800 border-amber-300",
    red: "bg-red-100 text-red-800 border-red-300 animate-pulse",
    slate: "bg-slate-100 text-slate-600 border-slate-300",
  };
  if (badgeEl) {
    badgeEl.className = `inline-block px-4 py-1.5 rounded-full border text-sm font-bold tracking-wide ${colorClasses[estado.color]}`;
    badgeEl.textContent = estado.label;
  }

  renderChart();
}

function renderChart() {
  const canvas = document.getElementById("chart-hidro");
  if (!canvas || !window.Chart) return;
  const ultimos = [...lecturas].slice(0, 20).reverse();
  const labels = ultimos.map((l) => formatDate(l.fecha, true));
  const data = ultimos.map((l) => Number(l.nivel));

  if (chart) chart.destroy();
  chart = new window.Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Nivel del Río Limón (0-9)",
          data,
          borderColor: "#C81E1E",
          backgroundColor: "rgba(200,30,30,0.1)",
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          stepped: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          min: NIVEL_HIDRO_MIN,
          max: NIVEL_HIDRO_MAX,
          ticks: { stepSize: 1 },
          title: { display: true, text: "Nivel (0-9)" },
        },
      },
    },
  });
}

function renderUmbralesUI() {
  document.getElementById("hidro-umbral-normal-label")?.replaceChildren(document.createTextNode(`0 – ${umbrales.advertencia - 1}`));
  document.getElementById("hidro-umbral-advertencia-label")?.replaceChildren(document.createTextNode(`${umbrales.advertencia} – ${umbrales.alerta - 1}`));
  document.getElementById("hidro-umbral-alerta-label")?.replaceChildren(document.createTextNode(`${umbrales.alerta} – 9`));

  const configForm = document.getElementById("form-hidro-config");
  if (configForm) {
    configForm.elements["advertencia"].value = umbrales.advertencia;
    configForm.elements["alerta"].value = umbrales.alerta;
    configForm.elements["apiEndpoint"].value = umbrales.apiEndpoint || "";
    configForm.elements["apiKey"].value = umbrales.apiKey || "";
    configForm.classList.toggle("hidden", !isAdmin());
  }
  const configNote = document.getElementById("hidro-config-readonly-note");
  if (configNote) configNote.classList.toggle("hidden", isAdmin());
}

export function refreshHidrometeorologia() {
  renderDashboard();
  // Mejor esfuerzo: si hay endpoint configurado, intenta actualizar el
  // nivel automáticamente al entrar a la vista (la fuente la nutre otra
  // aplicación, por lo que aquí no se espera intervención manual).
  consultarNivelExterno({ silent: true }).then((nivel) => {
    if (nivel !== null) registrarLectura(nivel, "API externa");
  });
}

export async function initHidrometeorologia() {
  // Cargar configuración de umbrales/endpoint desde Firestore.
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.CONFIG, "hidrometeorologia"));
    if (snap.exists()) umbrales = { ...UMBRALES_HIDRO_DEFAULT, ...snap.data() };
  } catch (err) {
    console.error("No se pudo cargar configuración hidrometeorológica:", err);
  }
  renderUmbralesUI();

  subscribeCollection(COLLECTIONS.HIDRO_LECTURAS, "fecha", (rows) => {
    lecturas = rows;
    renderDashboard();
    historial.render();
  });

  const historial = createHistorial({
    root: document.getElementById("historial-hidro"),
    title: "Historial de Lecturas — Río Limón",
    columns: [
      { key: "fecha", label: "Fecha/Hora", format: (r) => formatDate(r.fecha, true) },
      { key: "nivel", label: "Nivel (0-9)" },
      { key: "estado", label: "Estado" },
      { key: "fuente", label: "Fuente" },
      { key: "responsable", label: "Responsable" },
    ],
    dateField: "fecha",
    getRows: () => lecturas,
    isAdmin,
    exportFileName: "Lecturas_Rio_Limon",
    firmas: ["Responsable", "Director"],
    // Las lecturas hidrometeorológicas son de solo lectura una vez
    // guardadas (registro instrumental); no se ofrece edición/eliminación
    // para preservar la integridad de la serie histórica.
  });

  document.getElementById("btn-hidro-consultar")?.addEventListener("click", async () => {
    const nivel = await consultarNivelExterno();
    if (nivel !== null) {
      await registrarLectura(nivel, "API externa");
      toast(`Nivel obtenido de la fuente externa: ${nivel} / 9.`, "success");
    }
  });

  const configForm = document.getElementById("form-hidro-config");
  if (configForm) {
    configForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!isAdmin()) return;
      umbrales = {
        ...umbrales,
        advertencia: Number(configForm.elements["advertencia"].value) || umbrales.advertencia,
        alerta: Number(configForm.elements["alerta"].value) || umbrales.alerta,
        apiEndpoint: configForm.elements["apiEndpoint"].value.trim(),
        apiKey: configForm.elements["apiKey"].value.trim(),
      };
      await setDoc(doc(db, COLLECTIONS.CONFIG, "hidrometeorologia"), {
        ...umbrales,
        updatedAt: serverTimestamp(),
        updatedBy: getCurrentUser()?.uid || null,
      });
      toast("Configuración de Hidrometeorología actualizada.", "success");
      renderUmbralesUI();
      renderDashboard();
    });
  }

  // Primer intento automático al cargar el módulo, si ya hay endpoint.
  consultarNivelExterno({ silent: true }).then((nivel) => {
    if (nivel !== null) registrarLectura(nivel, "API externa");
  });
}
