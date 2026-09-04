/**
 * config.js
 * -----------------------------------------------------------------------
 * Configuración central de la aplicación.
 *
 * IMPORTANTE: Reemplace los valores de `firebaseConfig` con las credenciales
 * reales de su proyecto de Firebase (Firebase Console → Configuración del
 * proyecto → Tus apps → SDK de Firebase). Sin esto, la aplicación no podrá
 * conectarse a Authentication ni a Firestore.
 * -----------------------------------------------------------------------
 */

// Configuración del proyecto Firebase (reemplazar con datos reales).
export const firebaseConfig = {
  apiKey: "REEMPLAZAR_API_KEY",
  authDomain: "REEMPLAZAR.firebaseapp.com",
  projectId: "REEMPLAZAR_PROJECT_ID",
  storageBucket: "REEMPLAZAR.appspot.com",
  messagingSenderId: "REEMPLAZAR_SENDER_ID",
  appId: "REEMPLAZAR_APP_ID",
};

// Roles soportados por el sistema.
export const ROLES = {
  ADMIN: "admin",
  OPERADOR: "operador",
};

// Nombres de colecciones de Firestore (única fuente de verdad para evitar
// errores de tipeo en el resto de los módulos).
export const COLLECTIONS = {
  USUARIOS: "usuarios",
  PACIENTES: "pacientes",
  TRASLADOS: "traslados",
  FALLECIDOS: "fallecidos",
  GUARDIAS: "guardias",
  INSTITUCIONES: "instituciones",
  DESPACHOS_COMBUSTIBLE: "despachosCombustible",
  HIDRO_LECTURAS: "hidroLecturas",
  CONFIG: "config",
  EDUCACION: "educacionRiesgo",
  CATEGORIAS_INSUMOS: "categoriasInsumos",
  INSUMOS: "insumos",
  INSUMO_STOCK: "insumoStock",
  ENTRADAS_INVENTARIO: "entradasInventario",
  TRANSFERENCIAS_INVENTARIO: "transferenciasInventario",
};

// Almacenes / ubicaciones de inventario independientes entre sí.
export const ALMACENES = ["Depósito", "Módulo", "Oficina", "Ambulancia"];

// Categorías fijas del catálogo maestro de instituciones para el módulo de
// combustible (evita duplicidad y errores de tipeo).
export const CATEGORIAS_INSTITUCIONES = [
  "Organismos de seguridad",
  "Hospitales / Centros de salud",
  "Entes municipales",
  "Entes estadales / nacionales",
  "Organismos de socorro",
  "Otros",
];

// Umbrales por defecto del nivel del Río Limón (metros). Pueden ser
// sobrescritos por el documento config/hidrometeorologia en Firestore desde
// la interfaz de administración.
export const UMBRALES_HIDRO_DEFAULT = {
  normal: 2.0,
  advertencia: 3.0,
  alerta: 4.0,
  // Endpoint/API externo opcional para consultar el nivel de forma
  // automática. Se deja vacío por defecto; el admin puede configurarlo
  // desde el módulo de Hidrometeorología.
  apiEndpoint: "",
  apiKey: "",
};

// Datos institucionales usados en encabezados de pantalla e impresión.
export const INSTITUCION = {
  nombre: "Protección Civil y Administración de Desastres",
  sistema: "Sistema Integral de Gestión Operativa",
  lema: "Prevenir para proteger",
};
