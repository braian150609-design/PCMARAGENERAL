/**
 * combustible.js
 * -----------------------------------------------------------------------
 * Módulo de Despacho de Combustible. La institución se selecciona desde el
 * catálogo maestro (catalogos.js) mediante un <select> bloqueado — nunca
 * como texto libre — para evitar duplicidad o errores de tipeo.
 * -----------------------------------------------------------------------
 */
import { COLLECTIONS } from "./config.js";
import { createCrudModule } from "./moduleFactory.js";
import { formatDate, toast } from "./ui.js";

let moduleRef = null;

export function initCombustible() {
  const form = document.getElementById("form-combustible");

  moduleRef = createCrudModule({
    collectionName: COLLECTIONS.DESPACHOS_COMBUSTIBLE,
    form,
    historialRoot: document.getElementById("historial-combustible"),
    dateField: "fecha",
    historialTitle: "Historial de Despachos de Combustible",
    columns: [
      { key: "fecha", label: "Fecha", format: (r) => formatDate(r.fecha) },
      { key: "institucionNombre", label: "Institución" },
      { key: "litros", label: "Litros" },
      { key: "unidadVehicular", label: "Unidad / Placa" },
      { key: "responsable", label: "Responsable" },
    ],
    beforeSave: (data) => {
      const select = form.elements["institucionId"];
      const opt = select.options[select.selectedIndex];
      if (!opt || !opt.value) {
        toast("Debe seleccionar una institución del catálogo.", "error");
        return null;
      }
      data.institucionNombre = opt.dataset.nombre;
      data.litros = Number(data.litros) || 0;
      return data;
    },
  });

  return moduleRef;
}

export function getCombustibleModule() {
  return moduleRef;
}
