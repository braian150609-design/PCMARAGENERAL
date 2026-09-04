/**
 * inspeccion.js
 * -----------------------------------------------------------------------
 * Módulo de Gestión de Riesgo (Inspección).
 * -----------------------------------------------------------------------
 */
import { COLLECTIONS } from "./config.js";
import { createCrudModule } from "./moduleFactory.js";
import { formatDate } from "./ui.js";

let moduleRef = null;

export function initInspeccion() {
  moduleRef = createCrudModule({
    collectionName: COLLECTIONS.INSPECCIONES,
    form: document.getElementById("form-inspeccion"),
    historialRoot: document.getElementById("historial-inspeccion"),
    dateField: "fecha",
    historialTitle: "Historial de Gestión de Riesgo (Inspección)",
    firmas: ["Inspector", "Director"],
    columns: [
      { key: "fecha", label: "Fecha", format: (r) => formatDate(r.fecha) },
      { key: "institucion", label: "Institución" },
      { key: "solicitante", label: "Solicitante" },
      { key: "cedulaRif", label: "C.I. / RIF" },
      { key: "responsable", label: "Responsable" },
    ],
  });
  return moduleRef;
}

export function getInspeccionModule() {
  return moduleRef;
}
