import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const loginView = $("login-view");
const dashboardView = $("dashboard-view");
const loginForm = $("login-form");
const loginMessage = $("login-message");
const appForm = $("app-form");
const formMessage = $("form-message");
const appList = $("app-list");
const appCount = $("app-count");
const logoutButton = $("logout-button");
const saveButton = $("save-app-button");
let appsCache = [];
let currentUser = null;
let authCheckRunning = false;

function message(element, text, type = "") {
  element.textContent = text;
  element.className = `message${type ? ` ${type}` : ""}`;
}

function friendlyError(error) {
  const code = error?.code || "";
  const map = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/invalid-email": "Informe um endereço de e-mail válido.",
    "auth/user-disabled": "Esta conta foi desativada no Firebase Authentication.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde e tente novamente.",
    "auth/network-request-failed": "Falha de conexão. Verifique a internet.",
    "permission-denied": "Acesso negado pelas regras do Firestore. Confira a autorização administrativa.",
    "unavailable": "O Firestore está temporariamente indisponível. Tente novamente."
  };
  return map[code] || `Não foi possível concluir a operação${code ? ` (${code})` : ""}. Confira o Console do navegador para detalhes.`;
}

async function isAdmin(user) {
  const ref = doc(db, "administradores", user.uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return false;
  const data = snapshot.data();
  return data.ativo === true && data.perfil === "principal";
}

function showLogin(text = "") {
  loginView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
  logoutButton.classList.add("hidden");
  if (text) message(loginMessage, text, "error");
}

function showDashboard() {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
  message(loginMessage, "");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button[type='submit']");
  button.disabled = true;
  message(loginMessage, "Verificando credenciais e autorização…");
  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      $("email").value.trim(),
      $("password").value
    );
    const authorized = await isAdmin(credential.user);
    if (!authorized) {
      await signOut(auth);
      showLogin("Esta conta não tem autorização administrativa.");
      return;
    }
    currentUser = credential.user;
    showDashboard();
    await loadApps();
  } catch (error) {
    console.error("Falha no login administrativo:", error);
    showLogin(friendlyError(error));
  } finally {
    button.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    currentUser = null;
    appsCache = [];
    resetForm();
    showLogin("Sessão encerrada.");
  } catch (error) {
    console.error("Falha ao sair:", error);
    alert(friendlyError(error));
  }
});

onAuthStateChanged(auth, async (user) => {
  if (authCheckRunning) return;
  authCheckRunning = true;
  try {
    if (!user) {
      currentUser = null;
      showLogin();
      return;
    }
    const authorized = await isAdmin(user);
    if (!authorized) {
      await signOut(auth);
      currentUser = null;
      showLogin("Esta conta não tem autorização administrativa.");
      return;
    }
    currentUser = user;
    showDashboard();
    await loadApps();
  } catch (error) {
    console.error("Falha ao validar a sessão administrativa:", error);
    showLogin(friendlyError(error));
  } finally {
    authCheckRunning = false;
  }
});

async function loadApps() {
  appList.innerHTML = '<p class="empty">Carregando aplicativos…</p>';
  appCount.textContent = "Consultando Firestore…";
  try {
    const snapshot = await getDocs(collection(db, "aplicacoes"));
    appsCache = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0) || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
    renderApps();
  } catch (error) {
    console.error("Falha ao carregar aplicações:", error);
    appList.innerHTML = `<p class="empty">${escapeHtml(friendlyError(error))}</p>`;
    appCount.textContent = "Não foi possível carregar o catálogo.";
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function renderApps() {
  const search = $("app-search").value.trim().toLocaleLowerCase("pt-BR");
  const filtered = appsCache.filter((app) => `${app.nome || ""} ${app.categoria || ""}`.toLocaleLowerCase("pt-BR").includes(search));
  appCount.textContent = `${appsCache.length} cadastrado(s) · ${appsCache.filter((app) => app.publicado === true).length} publicado(s)`;
  if (!filtered.length) {
    appList.innerHTML = `<p class="empty">${appsCache.length ? "Nenhum aplicativo corresponde à busca." : "Nenhum aplicativo cadastrado. Use o formulário para criar o primeiro."}</p>`;
    return;
  }
  appList.innerHTML = filtered.map((app) => {
    const publishedClass = app.publicado === true ? "published" : "hidden-pill";
    const publishedText = app.publicado === true ? "Publicado" : "Oculto";
    const statusText = app.status === "disponivel" ? "Disponível" : app.status === "suspenso" ? "Suspenso" : "Em breve";
    return `<article class="app-item">
      <div class="app-item-top"><div><h3>${escapeHtml(app.nome || "Sem nome")}</h3><p class="app-meta">${escapeHtml(app.categoria || "Sem categoria")} · ${escapeHtml(statusText)} · Ordem ${Number(app.ordem) || 0}</p></div><span class="pill ${publishedClass}">${publishedText}</span></div>
      <p>${escapeHtml(app.descricao || "Sem descrição")}</p>
      <div class="item-actions"><button class="btn secondary small" type="button" data-action="edit" data-id="${escapeHtml(app.id)}">Editar</button><button class="btn secondary small" type="button" data-action="toggle" data-id="${escapeHtml(app.id)}">${app.publicado === true ? "Ocultar" : "Publicar"}</button><button class="btn danger small" type="button" data-action="delete" data-id="${escapeHtml(app.id)}">Excluir</button></div>
    </article>`;
  }).join("");
}

$("app-search").addEventListener("input", renderApps);
$("new-app-button").addEventListener("click", () => {
  resetForm();
  $("app-name").focus();
  $("editor-card").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("cancel-edit-button").addEventListener("click", resetForm);

function resetForm() {
  appForm.reset();
  $("app-id").value = "";
  $("app-order").value = String((appsCache.length + 1) * 10);
  $("app-published").checked = false;
  $("app-featured").checked = false;
  $("form-title").textContent = "Cadastrar aplicativo";
  saveButton.textContent = "Salvar aplicativo";
  $("cancel-edit-button").classList.add("hidden");
  message(formMessage, "");
}

function editApp(app) {
  $("app-id").value = app.id;
  $("app-name").value = app.nome || "";
  $("app-description").value = app.descricao || "";
  $("app-category").value = app.categoria || "Gestão";
  $("app-status").value = app.status || "em breve";
  $("app-url").value = app.url || "";
  $("app-icon").value = app.icone || "";
  $("app-order").value = String(Number(app.ordem) || 0);
  $("app-published").checked = app.publicado === true;
  $("app-featured").checked = app.destaque === true;
  $("form-title").textContent = "Editar aplicativo";
  saveButton.textContent = "Salvar alterações";
  $("cancel-edit-button").classList.remove("hidden");
  message(formMessage, "Editando o aplicativo selecionado.");
  $("editor-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

appList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const app = appsCache.find((item) => item.id === button.dataset.id);
  if (!app) return;
  if (button.dataset.action === "edit") {
    editApp(app);
    return;
  }
  if (button.dataset.action === "toggle") {
    const next = app.publicado !== true;
    const verb = next ? "publicar" : "ocultar";
    if (!confirm(`Deseja ${verb} o aplicativo “${app.nome}”?`)) return;
    button.disabled = true;
    try {
      await updateDoc(doc(db, "aplicacoes", app.id), { publicado: next, atualizadoEm: serverTimestamp() });
      await loadApps();
    } catch (error) {
      console.error(`Falha ao ${verb} aplicativo:`, error);
      alert(friendlyError(error));
    } finally {
      button.disabled = false;
    }
    return;
  }
  if (button.dataset.action === "delete") {
    if (!confirm(`Excluir permanentemente “${app.nome}”? Esta ação não pode ser desfeita.`)) return;
    button.disabled = true;
    try {
      await deleteDoc(doc(db, "aplicacoes", app.id));
      if ($("app-id").value === app.id) resetForm();
      await loadApps();
    } catch (error) {
      console.error("Falha ao excluir aplicativo:", error);
      alert(friendlyError(error));
    } finally {
      button.disabled = false;
    }
  }
});

appForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) {
    message(formMessage, "Sua sessão não está ativa. Entre novamente.", "error");
    return;
  }
  const rawUrl = $("app-url").value.trim();
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "https:") throw new Error("URL insegura");
    } catch {
      message(formMessage, "Informe uma URL válida iniciada por https:// ou deixe o campo vazio.", "error");
      return;
    }
  }
  const order = Number($("app-order").value);
  if (!Number.isInteger(order) || order < 0) {
    message(formMessage, "A ordem deve ser um número inteiro igual ou maior que zero.", "error");
    return;
  }
  const data = {
    nome: $("app-name").value.trim(),
    descricao: $("app-description").value.trim(),
    categoria: $("app-category").value,
    status: $("app-status").value,
    url: rawUrl,
    icone: $("app-icon").value.trim(),
    ordem: order,
    publicado: $("app-published").checked,
    destaque: $("app-featured").checked,
    atualizadoEm: serverTimestamp()
  };
  if (!data.nome || !data.descricao) {
    message(formMessage, "Preencha o nome e a descrição.", "error");
    return;
  }
  saveButton.disabled = true;
  message(formMessage, "Salvando no Firestore…");
  try {
    const id = $("app-id").value;
    if (id) {
      await updateDoc(doc(db, "aplicacoes", id), data);
      message(formMessage, "Aplicativo atualizado.", "success");
    } else {
      data.criadoEm = serverTimestamp();
      await addDoc(collection(db, "aplicacoes"), data);
      message(formMessage, "Aplicativo cadastrado.", "success");
    }
    await loadApps();
    resetForm();
    message(formMessage, id ? "Aplicativo atualizado." : "Aplicativo cadastrado.", "success");
  } catch (error) {
    console.error("Falha ao salvar aplicativo:", error);
    message(formMessage, friendlyError(error), "error");
  } finally {
    saveButton.disabled = false;
  }
});

resetForm();
