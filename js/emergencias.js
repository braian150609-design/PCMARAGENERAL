/**
 * emergencias.js
 * -----------------------------------------------------------------------
 * Módulo Unificado de Operaciones de Emergencia: agrupa las tres
 * sub-secciones que alimentan las estadísticas diarias del sistema:
 *   - Lista Diaria de Pacientes (reemplaza el antiguo registro individual
 *     de pacientes: se agregan a una lista del día y se imprime un
 *     documento formal con el conteo de niños/adolescentes/adultos más
 *     traslados y fallecidos del mismo día, firmado por el Jefe de
 *     Departamento y el Director).
 *   - Traslados (con cédula, edad y nombre del paciente trasladado).
 *   - Fallecidos.
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
    historialTitle: "Lista Diaria de Pacientes Atendidos",
    firmas: ["Jefe de Departamento", "Director"],
    columns: [
      { key: "fecha", label: "Fecha", format: (r) => formatDate(r.fecha) },
      { key: "categoriaEdad", label: "Categoría" },
      { key: "genero", label: "Género" },
      { key: "responsable", label: "Responsable" },
    ],
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
  setupListaDiaria(modules);
  setupInsumosUsados();
  return modules;
}

export function getEmergenciasModules() {
  return modules;
}

/* ---------------------------------------------------------------------- */
/* Lista Diaria de Pacientes: generación del documento imprimible          */
/* ---------------------------------------------------------------------- */
function setupListaDiaria({ pacientes, traslados, fallecidos }) {
  const fechaInput = document.getElementById("lista-diaria-fecha");
  const btn = document.getElementById("btn-imprimir-lista-diaria");
  if (!fechaInput || !btn) return;

  // en-CA produce YYYY-MM-DD en hora LOCAL (evita el corrimiento UTC).
  fechaInput.value = new Date().toLocaleDateString("en-CA");

  btn.addEventListener("click", () => {
    const dateStr = fechaInput.value;
    if (!dateStr) {
      toast("Seleccione la fecha de la lista a generar.", "error");
      return;
    }
    const sameDay = (row) => toDate(row.fecha)?.toLocaleDateString("en-CA") === dateStr;

    const pacientesDia = pacientes.getRows().filter(sameDay);
    const trasladosDia = traslados.getRows().filter(sameDay);
    const fallecidosDia = fallecidos.getRows().filter(sameDay);
    const insumosDia = insumosUsados.filter((r) => r.motivo === MOTIVO_USO_DIARIO && sameDay(r));

    const counts = {
      ninos: pacientesDia.filter((p) => p.categoriaEdad === "Niño").length,
      adolescentes: pacientesDia.filter((p) => p.categoriaEdad === "Adolescente").length,
      adultos: pacientesDia.filter((p) => p.categoriaEdad === "Adulto").length,
      traslados: trasladosDia.length,
      fallecidos: fallecidosDia.length,
    };

    const fechaFmt = new Date(dateStr + "T00:00:00").toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    printAdHoc(
      `Lista Diaria de Pacientes — ${fechaFmt}`,
      buildListaDiariaBodyHTML(fechaFmt, pacientesDia, counts, insumosDia),
      ["Jefe de Departamento", "Director"]
    );
  });
}

const cellStyle = "border:1px solid #cbd5e1;padding:5px 7px;";
const headStyle = `${cellStyle}background:#f1f5f9;font-weight:bold;`;

function buildListaDiariaBodyHTML(fechaFmt, pacientesDia, counts, insumosDia = []) {
  const rows =
    pacientesDia
      .map(
        (p, i) => `
      <tr>
        <td style="${cellStyle}">${i + 1}</td>
        <td style="${cellStyle}">${escapeHTML(p.categoriaEdad)}</td>
        <td style="${cellStyle}">${escapeHTML(p.genero)}</td>
        <td style="${cellStyle}">${escapeHTML(p.responsable)}</td>
      </tr>`
      )
      .join("") ||
    `<tr><td colspan="4" style="${cellStyle}text-align:center;color:#94a3b8;">Sin pacientes registrados en esta fecha.</td></tr>`;

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
      <p style="text-align:center;font-size:11px;margin:0 0 14px;color:#475569;">Fecha: ${fechaFmt}</p>

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
            <td style="${cellStyle}">${counts.ninos}</td>
            <td style="${cellStyle}">${counts.adolescentes}</td>
            <td style="${cellStyle}">${counts.adultos}</td>
            <td style="${cellStyle}">${counts.traslados}</td>
            <td style="${cellStyle}">${counts.fallecidos}</td>
          </tr>
        </tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <thead>
          <tr>
            <th style="${headStyle}">#</th>
            <th style="${headStyle}">Categoría</th>
            <th style="${headStyle}">Género</th>
            <th style="${headStyle}">Responsable</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
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
