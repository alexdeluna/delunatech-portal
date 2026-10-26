// Autenticação local: não utiliza Firebase, servidor ou conta online.
const SESSION_KEY = 'delunatech_pix_session_v1';
let currentUser = null;
const listeners = new Set();

function notify() { listeners.forEach(fn => fn(currentUser)); }
function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
function makeUser(email) {
  const clean = normalizeEmail(email);
  return { uid: 'local_' + encodeURIComponent(clean || 'usuario'), email: clean || 'usuario local', displayName: clean.split('@')[0] || 'Usuário local' };
}
export async function configurarPersistencia() {
  try { currentUser = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { currentUser = null; } notify();
}
export async function loginEmail(email, senha) {
  if (!normalizeEmail(email) || !senha) throw { code: 'auth/invalid-credential' };
  currentUser = makeUser(email);
  localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser)); notify(); return { user: currentUser };
}
export async function criarConta(email, senha) { return loginEmail(email, senha); }
export async function loginGoogle() { throw { code: 'local-only', message: 'O aplicativo funciona somente neste dispositivo e não usa login Google.' }; }
export async function recuperarSenha() { throw { code: 'local-only', message: 'Não há recuperação de senha: os dados são mantidos somente neste dispositivo.' }; }
export async function logout() { currentUser = null; localStorage.removeItem(SESSION_KEY); notify(); }
export function usuarioAtual() { return currentUser; }
export function observarSessao(callback) { listeners.add(callback); queueMicrotask(() => callback(currentUser)); return () => listeners.delete(callback); }
export const auth = { get currentUser() { return currentUser; } };
