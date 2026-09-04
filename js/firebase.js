/**
 * firebase.js
 * -----------------------------------------------------------------------
 * Inicialización centralizada de Firebase (App, Auth, Firestore).
 * Todos los demás módulos importan las instancias `auth` y `db` desde aquí
 * en lugar de inicializar Firebase por su cuenta.
 * -----------------------------------------------------------------------
 */
import { firebaseConfig } from "./config.js";

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// App principal (sesión del usuario autenticado en la UI).
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// App secundaria: se usa exclusivamente para que un administrador pueda
// crear cuentas de nuevos usuarios (Operador/Administrador) sin que la
// sesión del administrador actual se cierre o sea reemplazada por la del
// usuario recién creado (limitación conocida de Firebase Auth en cliente).
export function getSecondaryAuth() {
  const name = "secondary";
  const existing = getApps().find((a) => a.name === name);
  const secondaryApp = existing || initializeApp(firebaseConfig, name);
  return getAuth(secondaryApp);
}

// Re-exportamos utilidades de Firestore/Auth para que el resto de los
// módulos solo necesiten importar desde "./firebase.js".
export {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  Timestamp,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
};
