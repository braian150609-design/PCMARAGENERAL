/**
 * guardias.js
 * -----------------------------------------------------------------------
 * Módulo de Guardias de Prevención.
 * -----------------------------------------------------------------------
 */
import { COLLECTIONS } from "./config.js";
import { createCrudModule } from "./moduleFactory.js";
import { formatDate } from "./ui.js";

let moduleRef = null;

export function initGuardias() {
  moduleRef = createCrudModule({
    collectionName: COLLECTIONS.GUARDIAS,
    form: document.getElementById("form-guardias"),
    historialRoot: document.getElementById("historial-guardias"),
    dateField: "fecha",
    historialTitle: "Historial de Guardias de Prevención",
    columns: [
      { key: "fecha", label: "Fecha", format: (r) => formatDate(r.fecha) },
      { key: "parroquia", label: "Parroquia" },
      { key: "lugar", label: "Lugar / Sector" },
      { key: "cantidadPersonas", label: "Personas atendidas" },
      { key: "descripcion", label: "Actividad" },
      { key: "responsable", label: "Responsable" },
    ],
    beforeSave: (data) => {
      data.cantidadPersonas = Number(data.cantidadPersonas) || 0;
      return data;
    },
  });
  return moduleRef;
}

export function getGuardiasModule() {
  return moduleRef;
}
