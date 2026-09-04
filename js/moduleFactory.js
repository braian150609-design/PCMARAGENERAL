/**
 * moduleFactory.js
 * -----------------------------------------------------------------------
 * Fábrica genérica para módulos operativos de tipo "formulario + historial"
 * (Pacientes, Traslados, Fallecidos, Guardias, Educación, Despachos de
 * combustible, etc.). Centraliza:
 *   - Suscripción en tiempo real a la colección de Firestore.
 *   - Alta de registros con trazabilidad (createdAt / responsable).
 *   - Edición y eliminación (solo administrador), reutilizando el mismo
 *     formulario en "modo edición".
 *   - Render del historial con filtros, impresión y exportación.
 *
 * Un Operador solo puede crear y consultar: los botones Editar/Eliminar se
 * ocultan dinámicamente cuando `isAdmin()` es falso (ver ui.js).
 * -----------------------------------------------------------------------
 */
import { subscribeCollection, createRecord, updateRecord, deleteRecord } from "./data.js";
import { createHistorial, toast, confirmDialog, formToObject, setFormValues } from "./ui.js";
import { isAdmin, getResponsableLabel } from "./auth.js";

/**
 * @param {Object} cfg
 * @param {string} cfg.collectionName
 * @param {HTMLFormElement} cfg.form
 * @param {HTMLElement} cfg.historialRoot
 * @param {Array} cfg.columns - columnas para el historial [{key,label,format?}]
 * @param {string} cfg.dateField - campo de fecha usado en el historial
 * @param {string} cfg.historialTitle
 * @param {string} [cfg.responsableFieldName='responsable'] - si el form trae su propio campo
 * @param {Function} [cfg.beforeSave] - (dataObj, formEl) => dataObj (transformación previa)
 * @param {Function} [cfg.onRowsChange] - (rows) => void, notificación externa (p.ej. dashboard)
 * @param {[string,string]} [cfg.firmas] - etiquetas de las dos firmas del pie de impresión del historial.
 */
export function createCrudModule(cfg) {
  const {
    collectionName,
    form,
    historialRoot,
    columns,
    dateField,
    historialTitle,
    responsableFieldName = "responsable",
    firmas,
    beforeSave,
    onRowsChange,
  } = cfg;

  let rows = [];
  let editingId = null;

  // Autocompletar responsable con el usuario actual si el campo existe y está vacío.
  const responsableField = form.elements[responsableFieldName];
  if (responsableField && !responsableField.value) {
    responsableField.value = getResponsableLabel();
  }

  const cancelBtn = form.querySelector('[data-role="cancel-edit"]');
  const submitBtn = form.querySelector('[type="submit"]');
  const defaultSubmitLabel = submitBtn ? submitBtn.textContent : "Guardar";

  function exitEditMode() {
    editingId = null;
    form.reset();
    form.querySelectorAll("select").forEach((s) => s.dispatchEvent(new Event("change")));
    if (responsableField) responsableField.value = getResponsableLabel();
    if (submitBtn) submitBtn.textContent = defaultSubmitLabel;
    if (cancelBtn) cancelBtn.classList.add("hidden");
  }

  if (cancelBtn) {
    cancelBtn.classList.add("hidden");
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      exitEditMode();
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let data = formToObject(form);
    if (beforeSave) data = beforeSave(data, form);
    if (!data) return; // beforeSave puede cancelar el guardado devolviendo null

    try {
      if (editingId) {
        await updateRecord(collectionName, editingId, data);
        toast("Registro actualizado correctamente.", "success");
      } else {
        await createRecord(collectionName, data);
        toast("Registro guardado correctamente.", "success");
      }
      exitEditMode();
    } catch (err) {
      console.error(err);
      if (!/Permiso denegado/.test(err.message)) toast("Ocurrió un error al guardar el registro.", "error");
    }
  });

  const historial = createHistorial({
    root: historialRoot,
    title: historialTitle,
    columns,
    dateField,
    getRows: () => rows,
    isAdmin,
    exportFileName: historialTitle,
    firmas,
    onEdit: (row) => {
      if (!row) return;
      editingId = row.id;
      setFormValues(form, row);
      // Dispara "change" en los <select> del formulario para que cualquier
      // lógica condicional dependiente (p. ej. mostrar/ocultar "Centro de
      // destino" según el tipo de traslado) se reevalúe con el valor
      // recién cargado, no solo con interacción manual del usuario.
      form.querySelectorAll("select").forEach((s) => s.dispatchEvent(new Event("change")));
      if (submitBtn) submitBtn.textContent = "Guardar cambios";
      if (cancelBtn) cancelBtn.classList.remove("hidden");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      toast("Editando registro. Realice los cambios y guarde.", "info");
    },
    onDelete: async (row) => {
      if (!row) return;
      const ok = await confirmDialog({
        title: "Eliminar registro",
        message: "Esta acción es permanente y no se puede deshacer. ¿Desea continuar?",
      });
      if (!ok) return;
      try {
        await deleteRecord(collectionName, row.id);
        toast("Registro eliminado.", "success");
      } catch (err) {
        console.error(err);
      }
    },
  });

  const unsubscribe = subscribeCollection(collectionName, dateField, (newRows) => {
    rows = newRows;
    historial.render();
    if (onRowsChange) onRowsChange(rows);
  });

  return { getRows: () => rows, unsubscribe, historial };
}
