/**
 * emergencias.js
 * -----------------------------------------------------------------------
 * Módulo Unificado de Operaciones de Emergencia: agrupa las tres
 * sub-secciones que alimentan las estadísticas diarias del sistema:
 *   - Pacientes
 *   - Traslados
 *   - Fallecidos
 * -----------------------------------------------------------------------
 */
import { COLLECTIONS } from "./config.js";
import { createCrudModule } from "./moduleFactory.js";
import { formatDate } from "./ui.js";

let modules = null;

export function initEmergencias() {
  // Sub-pestañas internas del módulo unificado.
  const tabs = document.querySelectorAll("#view-emergencias .subtab-btn");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#view-emergencias .subtab-panel").forEach((p) => p.classList.add("hidden"));
      document.getElementById(`panel-${btn.dataset.subtab}`).classList.remove("hidden");
      tabs.forEach((b) => b.classList.toggle("subtab-active", b === btn));
    });
  });

  const pacientes = createCrudModule({
    collectionName: COLLECTIONS.PACIENTES,
    form: document.getElementById("form-pacientes"),
    historialRoot: document.getElementById("historial-pacientes"),
    dateField: "fecha",
    historialTitle: "Historial de Pacientes Atendidos",
    columns: [
      { key: "fecha", label: "Fecha/Hora", format: (r) => formatDate(r.fecha, true) },
      { key: "categoriaEdad", label: "Categoría" },
      { key: "genero", label: "Género" },
      { key: "motivo", label: "Motivo / Diagnóstico" },
      { key: "ubicacion", label: "Ubicación" },
      { key: "responsable", label: "Responsable" },
    ],
  });

  const traslados = createCrudModule({
    collectionName: COLLECTIONS.TRASLADOS,
    form: document.getElementById("form-traslados"),
    historialRoot: document.getElementById("historial-traslados"),
    dateField: "fecha",
    historialTitle: "Historial de Traslados",
    columns: [
      { key: "fecha", label: "Fecha/Hora", format: (r) => formatDate(r.fecha, true) },
      { key: "tipo", label: "Tipo" },
      { key: "centroDestino", label: "Centro destino" },
      { key: "unidad", label: "Unidad" },
      { key: "personalABordo", label: "Personal a bordo" },
      { key: "responsable", label: "Responsable" },
    ],
  });

  const fallecidos = createCrudModule({
    collectionName: COLLECTIONS.FALLECIDOS,
    form: document.getElementById("form-fallecidos"),
    historialRoot: document.getElementById("historial-fallecidos"),
    dateField: "fecha",
    historialTitle: "Historial de Fallecidos",
    columns: [
      { key: "fecha", label: "Fecha/Hora", format: (r) => formatDate(r.fecha, true) },
      { key: "datosControl", label: "Datos de control" },
      { key: "causaPresunta", label: "Causa presunta" },
      { key: "ubicacion", label: "Ubicación" },
      { key: "responsable", label: "Responsable" },
    ],
  });

  // Mostrar/ocultar campo "Centro de destino" según el tipo de traslado.
  const tipoTraslado = document.getElementById("traslado-tipo");
  const centroWrap = document.getElementById("traslado-centro-wrap");
  if (tipoTraslado && centroWrap) {
    const toggle = () => centroWrap.classList.toggle("hidden", tipoTraslado.value !== "Interhospitalario");
    tipoTraslado.addEventListener("change", toggle);
    toggle();
  }

  modules = { pacientes, traslados, fallecidos };
  return modules;
}

export function getEmergenciasModules() {
  return modules;
}
