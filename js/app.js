/**
 * DeLunaTech — Catálogo público conectado ao Cloud Firestore.
 * JavaScript puro, sem frameworks.
 */
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", iniciarPortal);

async function iniciarPortal() {
  const grade = document.getElementById("app-grid");
  const pesquisa = document.getElementById("search-apps");
  const filtro = document.getElementById("filter-category");
  const contador = document.getElementById("catalog-count");
  const ano = document.getElementById("current-year");

  if (!grade || !pesquisa || !filtro || !contador) {
    console.error("DeLunaTech: elementos do catálogo não encontrados. Confira o index.html.");
    return;
  }

  if (ano) ano.textContent = new Date().getFullYear();

  let lista = [];
  try {
    // A consulta inclui o filtro exigido pelas regras de segurança do Firestore.
    const consulta = query(collection(db, "aplicacoes"), where("publicado", "==", true));
    const snapshot = await getDocs(consulta);

    lista = snapshot.docs
      .map((documento) => {
        const dados = documento.data();
        return {
          id: documento.id,
          nome: typeof dados.nome === "string" ? dados.nome : "",
          categoria: typeof dados.categoria === "string" ? dados.categoria : "Outros",
          descricao: typeof dados.descricao === "string" ? dados.descricao : "",
          icone: typeof dados.icone === "string" ? dados.icone : "",
          status: typeof dados.status === "string" ? dados.status : "em breve",
          url: typeof dados.url === "string" ? dados.url : "",
          destaque: dados.destaque === true,
          ordem: Number.isFinite(Number(dados.ordem)) ? Number(dados.ordem) : 9999
        };
      })
      .filter((app) => app.nome && app.descricao && app.categoria)
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
  } catch (error) {
    console.error("DeLunaTech: falha ao carregar o catálogo do Firestore.", error);
    grade.replaceChildren();
    const mensagem = document.createElement("p");
    mensagem.className = "empty-message";
    mensagem.textContent = "Não foi possível carregar as aplicações. Tente novamente mais tarde.";
    grade.appendChild(mensagem);
    contador.textContent = "Catálogo indisponível";
    grade.setAttribute("aria-busy", "false");
    return;
  }

  preencherCategorias(lista, filtro);
  renderizarCatalogo();
  pesquisa.addEventListener("input", renderizarCatalogo);
  filtro.addEventListener("change", renderizarCatalogo);

  function preencherCategorias(aplicacoesValidas, seletor) {
    const categorias = [...new Set(aplicacoesValidas.map((app) => app.categoria.trim()))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    categorias.forEach((categoria) => {
      const opcao = document.createElement("option");
      opcao.value = categoria;
      opcao.textContent = categoria;
      seletor.appendChild(opcao);
    });
  }

  function renderizarCatalogo() {
    const termo = normalizar(pesquisa.value);
    const categoriaSelecionada = filtro.value;
    const resultados = lista.filter((app) => {
      const textoPesquisa = normalizar(`${app.nome} ${app.categoria} ${app.descricao}`);
      return textoPesquisa.includes(termo) &&
        (categoriaSelecionada === "todas" || app.categoria === categoriaSelecionada);
    });

    grade.replaceChildren();
    contador.textContent = resultados.length === 1 ? "1 aplicação" : `${resultados.length} aplicações`;

    if (resultados.length === 0) {
      const mensagem = document.createElement("p");
      mensagem.className = "empty-message";
      mensagem.textContent = lista.length
        ? "Nenhuma aplicação encontrada. Tente outro termo ou categoria."
        : "Nenhuma aplicação está disponível no catálogo no momento.";
      grade.appendChild(mensagem);
      grade.setAttribute("aria-busy", "false");
      return;
    }

    resultados.forEach((app) => grade.appendChild(criarCartao(app)));
    grade.setAttribute("aria-busy", "false");
  }

  function criarCartao(app) {
    const cartao = document.createElement("article");
    cartao.className = "app-card";

    const topo = document.createElement("div");
    topo.className = "app-card-top";

    const icone = document.createElement("div");
    icone.className = "app-icon";
    icone.textContent = app.icone || iniciais(app.nome);
    icone.setAttribute("aria-hidden", "true");

    const categoria = document.createElement("span");
    categoria.className = "app-category";
    categoria.textContent = app.categoria;
    topo.append(icone, categoria);

    const titulo = document.createElement("h3");
    titulo.textContent = app.nome;

    const descricao = document.createElement("p");
    descricao.className = "app-description";
    descricao.textContent = app.descricao;

    const status = document.createElement("span");
    status.className = "app-status";

    const botao = document.createElement("a");
    botao.className = "app-action";
    const disponivel = app.status === "disponivel" && urlSegura(app.url);

    if (disponivel) {
      status.classList.add("status-ready");
      status.textContent = "Disponível para teste";
      botao.href = app.url;
      botao.target = "_blank";
      botao.rel = "noopener noreferrer";
      botao.append(document.createTextNode("Testar aplicação"), criarSeta());
      botao.setAttribute("aria-label", `Testar ${app.nome} em uma nova aba`);
    } else {
      status.classList.add("status-soon");
      status.textContent = app.status === "suspenso" ? "Temporariamente indisponível" : "Em preparação";
      botao.classList.add("is-disabled");
      botao.href = "#aplicacoes";
      botao.setAttribute("aria-disabled", "true");
      botao.append(document.createTextNode("Indisponível no momento"), criarSeta());
      botao.addEventListener("click", (evento) => evento.preventDefault());
    }

    cartao.append(topo, titulo, descricao, status, botao);
    return cartao;
  }

  function criarSeta() {
    const seta = document.createElement("span");
    seta.textContent = "→";
    seta.setAttribute("aria-hidden", "true");
    return seta;
  }

  function iniciais(nome) {
    return nome.split(/\s+/).slice(0, 2).map((parte) => parte.charAt(0)).join("").toUpperCase();
  }

  function normalizar(valor) {
    return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  }

  function urlSegura(valor) {
    try {
      const endereco = new URL(valor);
      return endereco.protocol === "https:" && endereco.hostname.length > 0;
    } catch {
      return false;
    }
  }
}
