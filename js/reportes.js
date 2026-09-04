/**
 * reportes.js
 * -----------------------------------------------------------------------
 * Centro de Reportes: permite seleccionar cualquier módulo operativo,
 * filtrar por rango de fechas y generar un reporte imprimible/exportable
 * (Excel/PDF) con formato institucional, además de un "Resumen General"
 * consolidado de todos los módulos para un rango de fechas dado.
 * -----------------------------------------------------------------------
 */
import { COLLECTIONS } from "./config.js";
import { subscribeCollection } from "./data.js";
import { createHistorial, formatDate, toDate, exportToExcel, exportToPDF, printElement, printHeaderHTML, printFooterHTML } from "./ui.js";

const REPORTS = {
  pacientes: {
    label: "Pacientes",
    collection: COLLECTIONS.PACIENTES,
    dateField: "fecha",
    columns: [
      { key: "fecha", label: "Fecha/Hora", format: (r) => formatDate(r.fecha, true) },
      { key: "categoriaEdad", label: "Categoría" },
      { key: "genero", label: "Género" },
      { key: "motivo", label: "Motivo / Diagnóstico" },
      { key: "ubicacion", label: "Ubicación" },
      { key: "responsable", label: "Responsable" },
    ],
  },
  traslados: {
    label: "Traslados",
    collection: COLLECTIONS.TRASLADOS,
    dateField: "fecha",
    columns: [
      { key: "fecha", label: "Fecha/Hora", format: (r) => formatDate(r.fecha, true) },
      { key: "tipo", label: "Tipo" },
      { key: "centroDestino", label: "Centro destino" },
      { key: "unidad", label: "Unidad" },
      { key: "responsable", label: "Responsable" },
    ],
  },
  fallecidos: {
    label: "Fallecidos",
    collection: COLLECTIONS.FALLECIDOS,
    dateField: "fecha",
    columns: [
      { key: "fecha", label: "Fecha/Hora", format: (r) => formatDate(r.fecha, true) },
      { key: "datosControl", label: "Datos de control" },
      { key: "causaPresunta", label: "Causa presunta" },
      { key: "responsable", label: "Responsable" },
    ],
  },
  guardias: {
    label: "Guardias de Prevención",
    collection: COLLECTIONS.GUARDIAS,
    dateField: "fecha",
    columns: [
      { key: "fecha", label: "Fecha", format: (r) => formatDate(r.fecha) },
      { key: "parroquia", label: "Parroquia" },
      { key: "lugar", label: "Lugar / Sector" },
      { key: "cantidadPersonas", label: "Personas" },
      { key: "responsable", label: "Responsable" },
    ],
  },
  combustible: {
    label: "Despacho de Combustible",
    collection: COLLECTIONS.DESPACHOS_COMBUSTIBLE,
    dateField: "fecha",
    columns: [
      { key: "fecha", label: "Fecha", format: (r) => formatDate(r.fecha) },
      { key: "institucionNombre", label: "Institución" },
      { key: "litros", label: "Litros" },
      { key: "unidadVehicular", label: "Unidad" },
      { key: "responsable", label: "Responsable" },
    ],
  },
  educacion: {
    label: "Educación y Gestión de Riesgo",
    collection: COLLECTIONS.EDUCACION,
    dateField: "fecha",
    columns: [
      { key: "fecha", label: "Fecha", format: (r) => formatDate(r.fecha) },
      { key: "nombre", label: "Institución / Comunidad" },
      { key: "poblacionBeneficiada", label: "Población" },
      { key: "tema", label: "Tema" },
      { key: "responsable", label: "Responsable" },
    ],
  },
  entradasInventario: {
    label: "Inventario — Entradas",
    collection: COLLECTIONS.ENTRADAS_INVENTARIO,
    dateField: "fecha",
    columns: [
      { key: "fecha", label: "Fecha", format: (r) => formatDate(r.fecha) },
      { key: "insumoNombre", label: "Insumo" },
      { key: "cantidad", label: "Cantidad" },
      { key: "almacenDestino", label: "Destino" },
      { key: "responsable", label: "Responsable" },
    ],
  },
  transferenciasInventario: {
    label: "Inventario — Transferencias",
    collection: COLLECTIONS.TRANSFERENCIAS_INVENTARIO,
    dateField: "fecha",
    columns: [
      { key: "fecha", label: "Fecha", format: (r) => formatDate(r.fecha) },
      { key: "insumoNombre", label: "Insumo" },
      { key: "stockOrigen", label: "Origen" },
      { key: "stockDestino", label: "Destino" },
      { key: "cantidad", label: "Cantidad" },
      { key: "responsable", label: "Responsable" },
    ],
  },
};

const dataCache = {}; // collectionName -> rows[]
let currentHistorial = null;
let initialized = false;

function ensureSubscribed(collectionName, dateField) {
  if (dataCache[collectionName]) return;
  dataCache[collectionName] = [];
  subscribeCollection(collectionName, dateField, (rows) => {
    dataCache[collectionName] = rows;
    if (currentHistorial) currentHistorial.render();
    renderResumenGeneral();
  });
}

function renderReport(key) {
  const cfg = REPORTS[key];
  const root = document.getElementById("reportes-tabla-container");
  if (!cfg || !root) return;
  ensureSubscribed(cfg.collection, cfg.dateField);
  currentHistorial = createHistorial({
    root,
    title: `Reporte: ${cfg.label}`,
    columns: cfg.columns,
    dateField: cfg.dateField,
    getRows: () => dataCache[cfg.collection] || [],
    isAdmin: () => false, // los reportes son de solo consulta (sin editar/eliminar desde este panel)
    exportFileName: `Reporte_${cfg.label}`,
  });
}

function renderResumenGeneral() {
  const root = document.getElementById("reportes-resumen-general");
  if (!root) return;
  const desde = document.getElementById("resumen-desde")?.value;
  const hasta = document.getElementById("resumen-hasta")?.value;
  const desdeD = desde ? new Date(desde + "T00:00:00") : null;
  const hastaD = hasta ? new Date(hasta + "T23:59:59") : null;

  const filas = Object.entries(REPORTS).map(([key, cfg]) => {
    const rows = dataCache[cfg.collection] || [];
    const filtered = rows.filter((r) => {
      const d = toDate(r[cfg.dateField]);
      if (!d) return false;
      if (desdeD && d < desdeD) return false;
      if (hastaD && d > hastaD) return false;
      return true;
    });
    const totalUnidades =
      key === "combustible" ? filtered.reduce((s, r) => s + (Number(r.litros) || 0), 0) : filtered.length;
    return { key, label: cfg.label, cantidad: filtered.length, unidad: key === "combustible" ? `${totalUnidades} L` : `${filtered.length} registro(s)` };
  });

  root.innerHTML = `
    <div class="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div class="print-header hidden">${printHeaderHTML("Resumen General de Operaciones")}</div>
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-slate-600">
          <tr><th class="text-left px-4 py-2">Módulo</th><th class="text-left px-4 py-2">Total del periodo</th></tr>
        </thead>
        <tbody>
          ${filas.map((f) => `<tr class="border-t border-slate-100"><td class="px-4 py-2">${f.label}</td><td class="px-4 py-2 font-semibold">${f.unidad}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="print-footer hidden">${printFooterHTML()}</div>
    </div>`;

  const exportBtn = document.getElementById("btn-resumen-print");
  if (exportBtn) exportBtn.onclick = () => printElement(root, "Resumen General de Operaciones");
  const xlsxBtn = document.getElementById("btn-resumen-xlsx");
  if (xlsxBtn)
    xlsxBtn.onclick = () =>
      exportToExcel("Resumen_General", [
        { key: "label", label: "Módulo" },
        { key: "unidad", label: "Total del periodo" },
      ], filas);
  const pdfBtn = document.getElementById("btn-resumen-pdf");
  if (pdfBtn)
    pdfBtn.onclick = () =>
      exportToPDF("Resumen_General", [
        { key: "label", label: "Módulo" },
        { key: "unidad", label: "Total del periodo" },
      ], filas);
}

export function initReportes() {
  const select = document.getElementById("reportes-select-modulo");
  if (select) {
    select.innerHTML = Object.entries(REPORTS).map(([key, cfg]) => `<option value="${key}">${cfg.label}</option>`).join("");
    select.addEventListener("change", () => renderReport(select.value));
  }

  if (!initialized) {
    initialized = true;
    Object.values(REPORTS).forEach((cfg) => ensureSubscribed(cfg.collection, cfg.dateField));
    document.getElementById("resumen-desde")?.addEventListener("change", renderResumenGeneral);
    document.getElementById("resumen-hasta")?.addEventListener("change", renderResumenGeneral);
  }

  renderReport(select ? select.value : "pacientes");
  renderResumenGeneral();
}
