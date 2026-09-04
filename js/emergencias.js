/**
 * emergencias.js
 * -----------------------------------------------------------------------
 * Módulo Unificado de Operaciones de Emergencia: agrupa las tres
 * sub-secciones que alimentan las estadísticas diarias del sistema:
 *   - Lista Diaria de Pacientes: UNA planilla por día (no un registro por
 *     paciente). Se escriben directamente las cantidades atendidas (Niños,
 *     Adolescentes, Adultos, Traslados, Fallecidos) y el responsable del
 *     día (ej. "Doctora Isbelia"). Las cantidades de Traslados y
 *     Fallecidos aquí son un conteo manual propio de esta planilla — son
 *     independientes de los módulos de Traslados y Fallecidos (que llevan
 *     su propio registro detallado, sin relación con esta lista).
 *   - Traslados (con cédula, edad y nombre del paciente trasladado).
 *   - Fallecidos (nombre, cédula, edad, sexo, fecha, hora, lugar, causa).
 * La Lista Diaria también permite registrar los Insumos utilizados el día
 * (se descuentan del inventario como un débito — ver inventario.js — y se
 * incluyen en el documento impreso de la lista).
 * -----------------------------------------------------------------------
 */
import { COLLECTIONS } from "./config.js";
import { createCrudModule } from "./moduleFactory.js";
import { formatDate, toDate, escapeHTML, printAdHoc, toast } from "./ui.js";
import { subscribeCollection } from "./data.js";
import { registrarDebito, deleteDebito } from "./inventario.js";
import { isAdmin, getResponsableLabel } from "./auth.js";

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
    historialTitle: "Listas Diarias de Pacientes Atendidos",
    firmas: ["Jefe de Departamento", "Director"],
    columns: [
      { key: "fecha", label: "Fecha", format: (r) => formatDate(r.fecha) },
      { key: "ninos", label: "Niños" },
      { key: "adolescentes", label: "Adolescentes" },
      { key: "adultos", label: "Adultos" },
      { key: "cantidadTraslados", label: "Traslados" },
      { key: "cantidadFallecidos", label: "Fallecidos" },
      { key: "responsable", label: "Responsable del día" },
    ],
    beforeSave: (data) => {
      data.ninos = Number(data.ninos) || 0;
      data.adolescentes = Number(data.adolescentes) || 0;
      data.adultos = Number(data.adultos) || 0;
      data.cantidadTraslados = Number(data.cantidadTraslados) || 0;
      data.cantidadFallecidos = Number(data.cantidadFallecidos) || 0;
      return data;
    },
  });

  const traslados = createCrudModule({
    collectionName: COLLECTIONS.TRASLADOS,
    form: document.getElementById("form-traslados"),
    historialRoot: document.getElementById("historial-traslados"),
    dateField: "fecha",
    historialTitle: "Historial de Traslados",
    firmas: ["Médico", "Jefe de Departamento"],
    columns: [
      { key: "fecha", label: "Fecha/Hora", format: (r) => formatDate(r.fecha, true) },
      { key: "tipo", label: "Tipo" },
      { key: "nombrePaciente", label: "Nombre del paciente" },
      { key: "cedulaPaciente", label: "Cédula" },
      { key: "edadPaciente", label: "Edad" },
      { key: "centroDestino", label: "Centro destino" },
      { key: "unidad", label: "Unidad" },
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
      { key: "fecha", label: "Fecha", format: (r) => formatDate(r.fecha) },
      { key: "hora", label: "Hora" },
      { key: "nombre", label: "Nombre" },
      { key: "cedula", label: "Cédula" },
      { key: "edad", label: "Edad" },
      { key: "sexo", label: "Sexo" },
      { key: "lugar", label: "Lugar de fallecimiento" },
      { key: "causa", label: "Causa / Circunstancia" },
      { key: "responsable", label: "Responsable" },
    ],
    beforeSave: (data) => {
      data.edad = Number(data.edad) || 0;
      return data;
    },
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
  setupListaDiaria(pacientes);
  setupInsumosUsados();
  return modules;
}

export function getEmergenciasModules() {
  return modules;
}

/* ---------------------------------------------------------------------- */
/* Lista Diaria de Pacientes: impresión formal de la planilla del día      */
/* ---------------------------------------------------------------------- */
function setupListaDiaria(pacientes) {
  const fechaInput = document.getElementById("lista-diaria-fecha");
  const btn = document.getElementById("btn-imprimir-lista-diaria");
  if (!fechaInput || !btn) return;

  // en-CA produce YYYY-MM-DD en hora LOCAL (evita el corrimiento UTC).
  fechaInput.value = new Date().toLocaleDateString("en-CA");

  btn.addEventListener("click", () => {
    const dateStr = fechaInput.value;
    if (!dateStr) {
      toast("Seleccione la fecha de la lista a imprimir.", "error");
      return;
    }
    const sameDay = (row) => toDate(row.fecha)?.toLocaleDateString("en-CA") === dateStr;

    const registro = pacientes.getRows().find(sameDay);
    if (!registro) {
      toast("No hay una lista diaria guardada para esa fecha. Agréguela primero en el formulario de arriba.", "error");
      return;
    }
    const insumosDia = insumosUsados.filter((r) => r.motivo === MOTIVO_USO_DIARIO && sameDay(r));

    const fechaFmt = new Date(dateStr + "T00:00:00").toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    printAdHoc(
      `Lista Diaria de Pacientes — ${fechaFmt}`,
      buildListaDiariaBodyHTML(fechaFmt, registro, insumosDia),
      ["Jefe de Departamento", "Director"]
    );
  });
}

const cellStyle = "border:1px solid #cbd5e1;padding:5px 7px;";
const headStyle = `${cellStyle}background:#f1f5f9;font-weight:bold;`;

function buildListaDiariaBodyHTML(fechaFmt, registro, insumosDia = []) {
  const insumosRows =
    insumosDia
      .map(
        (r, i) => `
      <tr>
        <td style="${cellStyle}">${i + 1}</td>
        <td style="${cellStyle}">${escapeHTML(r.insumoNombre)}</td>
        <td style="${cellStyle}">${escapeHTML(r.almacenOrigen)}</td>
        <td style="${cellStyle}">${r.cantidad}</td>
        <td style="${cellStyle}">${escapeHTML(r.responsable)}</td>
      </tr>`
      )
      .join("") ||
    `<tr><td colspan="5" style="${cellStyle}text-align:center;color:#94a3b8;">Sin insumos utilizados registrados en esta fecha.</td></tr>`;

  return `
    <div style="padding:12px 20px 4px;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
      <h2 style="text-align:center;font-size:15px;margin:6px 0 4px;">LISTA DIARIA DE PACIENTES ATENDIDOS</h2>
      <p style="text-align:center;font-size:11px;margin:0 0 4px;color:#475569;">Fecha: ${fechaFmt}</p>
      <p style="text-align:center;font-size:11px;margin:0 0 14px;color:#475569;">Responsable del día: <strong>${escapeHTML(registro.responsable)}</strong></p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:10.5px;text-align:center;">
        <thead>
          <tr>
            <th style="${headStyle}">Niños</th>
            <th style="${headStyle}">Adolescentes</th>
            <th style="${headStyle}">Adultos</th>
            <th style="${headStyle}">Traslados</th>
            <th style="${headStyle}">Fallecidos</th>
          </tr>
        </thead>
        <tbody>
          <tr style="font-weight:bold;">
            <td style="${cellStyle}">${registro.ninos ?? 0}</td>
            <td style="${cellStyle}">${registro.adolescentes ?? 0}</td>
            <td style="${cellStyle}">${registro.adultos ?? 0}</td>
            <td style="${cellStyle}">${registro.cantidadTraslados ?? 0}</td>
            <td style="${cellStyle}">${registro.cantidadFallecidos ?? 0}</td>
          </tr>
        </tbody>
      </table>

      <h3 style="font-size:12px;margin:18px 0 6px;">Insumos utilizados</h3>
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <thead>
          <tr>
            <th style="${headStyle}">#</th>
            <th style="${headStyle}">Insumo</th>
            <th style="${headStyle}">Almacén</th>
            <th style="${headStyle}">Cantidad</th>
            <th style="${headStyle}">Responsable</th>
          </tr>
        </thead>
        <tbody>${insumosRows}</tbody>
      </table>
    </div>`;
}

/* ---------------------------------------------------------------------- */
/* Insumos utilizados el día de hoy (débito automático de inventario)      */
/* ---------------------------------------------------------------------- */
const MOTIVO_USO_DIARIO = "Uso operativo / Consumo";
let insumosUsados = [];

function setupInsumosUsados() {
  const form = document.getElementById("form-insumo-usado");
  if (!form) return;

  const fechaField = form.elements["fecha"];
  const respField = form.elements["responsable"];
  if (fechaField) fechaField.value = new Date().toLocaleDateString("en-CA");
  if (respField) respField.value = getResponsableLabel();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const insumoSelect = form.elements["insumoId"];
    const insumoOpt = insumoSelect.options[insumoSelect.selectedIndex];
    const almacen = form.elements["almacenOrigen"].value;
    const cantidad = Number(form.elements["cantidad"].value);
    const responsable = form.elements["responsable"].value.trim();
    const fecha = form.elements["fecha"].value;

    if (!insumoOpt?.value || !almacen || !cantidad || cantidad <= 0) {
      toast("Complete insumo, almacén y una cantidad válida.", "error");
      return;
    }

    try {
      await registrarDebito({
        insumoId: insumoOpt.value,
        insumoNombre: insumoOpt.dataset.nombre,
        almacen,
        cantidad,
        motivo: MOTIVO_USO_DIARIO,
        responsable,
        observaciones: "Insumo utilizado — Lista Diaria de Pacientes",
        fecha,
      });
      toast("Insumo utilizado registrado y descontado del inventario.", "success");
      form.reset();
      if (fechaField) fechaField.value = new Date().toLocaleDateString("en-CA");
      if (respField) respField.value = getResponsableLabel();
    } catch (err) {
      console.error(err);
      toast(err.message || "No se pudo registrar el insumo utilizado.", "error");
    }
  });

  subscribeCollection(COLLECTIONS.DEBITOS_INVENTARIO, "fecha", (rows) => {
    insumosUsados = rows;
    renderInsumosUsadosTable();
  });
}

function renderInsumosUsadosTable() {
  const root = document.getElementById("tabla-insumos-usados");
  if (!root) return;
  const hoy = new Date().toLocaleDateString("en-CA");
  const rows = insumosUsados.filter(
    (r) => r.motivo === MOTIVO_USO_DIARIO && toDate(r.fecha)?.toLocaleDateString("en-CA") === hoy
  );
  const admin = isAdmin();

  const countBadge = document.getElementById("insumos-usados-count");
  if (countBadge) countBadge.textContent = rows.length ? `${rows.length} hoy` : "sin registros hoy";

  root.innerHTML = `
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-slate-600">
        <tr>
          <th class="text-left font-medium px-3 py-1.5">Insumo</th>
          <th class="text-left font-medium px-3 py-1.5">Almacén</th>
          <th class="text-left font-medium px-3 py-1.5">Cantidad</th>
          <th class="text-left font-medium px-3 py-1.5">Responsable</th>
          <th class="text-left font-medium px-3 py-1.5 no-print">Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows
            .map(
              (r) => `
          <tr class="border-t border-slate-100">
            <td class="px-3 py-1.5">${escapeHTML(r.insumoNombre)}</td>
            <td class="px-3 py-1.5">${escapeHTML(r.almacenOrigen)}</td>
            <td class="px-3 py-1.5">${r.cantidad}</td>
            <td class="px-3 py-1.5">${escapeHTML(r.responsable)}</td>
            <td class="px-3 py-1.5 no-print">${admin ? `<button data-id="${r.id}" data-act="del" class="text-red-700 hover:underline">Eliminar</button>` : "—"}</td>
          </tr>`
            )
            .join("") ||
          `<tr><td colspan="5" class="px-3 py-4 text-center text-slate-400">Sin insumos utilizados registrados hoy.</td></tr>`
        }
      </tbody>
    </table>`;

  if (admin) {
    root.querySelectorAll('[data-act="del"]').forEach((btn) => {
      btn.onclick = () => deleteDebito(rows.find((r) => r.id === btn.dataset.id));
    });
  }
}
