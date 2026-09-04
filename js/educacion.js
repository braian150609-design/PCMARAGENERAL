/**
 * educacion.js
 * -----------------------------------------------------------------------
 * Módulo de Educación y Gestión de Riesgo.
 * -----------------------------------------------------------------------
 */
import { COLLECTIONS } from "./config.js";
import { createCrudModule } from "./moduleFactory.js";
import { formatDate } from "./ui.js";

let moduleRef = null;

export function initEducacion() {
  moduleRef = createCrudModule({
    collectionName: COLLECTIONS.EDUCACION,
    form: document.getElementById("form-educacion"),
    historialRoot: document.getElementById("historial-educacion"),
    dateField: "fecha",
    historialTitle: "Historial de Educación y Gestión de Riesgo",
    columns: [
      { key: "fecha", label: "Fecha", format: (r) => formatDate(r.fecha) },
      { key: "tipoInstitucion", label: "Tipo" },
      { key: "nombre", label: "Institución / Comunidad" },
      { key: "poblacionBeneficiada", label: "Población beneficiada" },
      { key: "tema", label: "Tema impartido" },
      { key: "simulacro", label: "Simulacro" },
      { key: "responsable", label: "Responsable" },
    ],
    beforeSave: (data) => {
      data.poblacionBeneficiada = Number(data.poblacionBeneficiada) || 0;
      return data;
    },
  });
  return moduleRef;
}

export function getEducacionModule() {
  return moduleRef;
}
