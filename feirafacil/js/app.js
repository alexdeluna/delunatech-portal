
const STORAGE_KEY = "comprasFacil_listas_v1";
const PURCHASE_STORAGE_KEY = "comprasFacil_precos_v1";
const PURCHASES_STORAGE_KEY = "comprasFacil_compras_v1";
const PRICE_HISTORY_STORAGE_KEY = "comprasFacil_historico_precos_v1";

// Elementos da interface
const screenLists = document.getElementById("screen-lists");
const screenEditor = document.getElementById("screen-editor");

const btnNewList = document.getElementById("btn-new-list");
const btnBack = document.getElementById("btn-back");
const btnCancel = document.getElementById("btn-cancel");
const btnAddProduct = document.getElementById("btn-add-product");
const btnSaveList = document.getElementById("btn-save-list");

const editorTitle = document.getElementById("editor-title");
const listName = document.getElementById("list-name");
const productName = document.getElementById("product-name");
const productQuantity = document.getElementById("product-quantity");

const listsContainer = document.getElementById("lists-container");
const productsContainer = document.getElementById("products-container");

const listCount = document.getElementById("list-count");
const productCount = document.getElementById("product-count");
const toast = document.getElementById("toast");

const screenPurchase = document.getElementById("screen-purchase");
const btnPurchaseBack = document.getElementById("btn-purchase-back");

const purchaseTitle = document.getElementById("purchase-title");
const purchaseListName = document.getElementById("purchase-list-name");
const purchaseProductCount = document.getElementById("purchase-product-count");
const purchaseProducts = document.getElementById("purchase-products");
const purchaseTabs = [...document.querySelectorAll("[data-purchase-tab]")];
const purchasePendingCount = document.getElementById("purchase-count-pending");
const purchaseBoughtTabCount = document.getElementById("purchase-count-bought-tab");
const purchaseNotBoughtTabCount = document.getElementById("purchase-count-not-bought-tab");
const screenHistory = document.getElementById("screen-history");
const historyContainer = document.getElementById("history-container");
const btnHistory = document.getElementById("btn-history");
const btnHistoryBack = document.getElementById("btn-history-back");
const btnFinishPurchase = document.getElementById("btn-finish-purchase");

// Estado do aplicativo
let lists = [];
let currentListId = null;
let draftProducts = [];
let editingProductId = null;
let purchasePricesByList = {};
let currentPurchaseListId = null;
let purchaseRecords = [];
let priceHistory = {};
let currentPurchaseId = null;
let currentPurchaseTab = "pendentes";

// Identificador único
function createId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return Date.now().toString(36) +
    Math.random().toString(36).slice(2);
}

// Mensagens
let toastTimeout;

function showMessage(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// Navegação
function showScreen(screen) {
  screenLists.classList.remove("active");
  screenEditor.classList.remove("active");
  screenPurchase.classList.remove("active");
  screenHistory.classList.remove("active");

  screen.classList.add("active");
}

function clearProductForm() {
  productName.value = "";
  productQuantity.value = "1";

  editingProductId = null;
  btnAddProduct.textContent = "＋ Adicionar produto";

  productName.focus();
}

// Armazenamento das listas
function saveStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    return true;
  } catch (error) {
    console.error("Erro ao salvar dados:", error);
    showMessage("Não foi possível salvar os dados.");
    return false;
  }
}

function loadStorage() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);

    if (!savedData) {
      lists = [];
      return;
    }

    const parsedData = JSON.parse(savedData);

    if (!Array.isArray(parsedData)) {
      throw new Error("Formato de dados inválido.");
    }

    lists = parsedData;
  } catch (error) {
    console.error("Erro ao recuperar listas:", error);
    lists = [];
    showMessage("Não foi possível recuperar as listas.");
  }
}

// Renderização das listas
function renderLists() {
  listsContainer.replaceChildren();

  listCount.textContent =
    `${lists.length} ${lists.length === 1 ? "lista" : "listas"}`;

  if (lists.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.textContent = "🛍️";

    const title = document.createElement("h3");
    title.textContent = "Nenhuma lista cadastrada";

    const description = document.createElement("p");
    description.textContent = "Crie sua primeira lista para começar.";

    empty.append(icon, title, description);
    listsContainer.appendChild(empty);

    return;
  }

  lists.forEach(list => {
    const card = document.createElement("article");
    card.className = "list-card";

    const info = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = list.name;

    const description = document.createElement("p");
    const total = list.products.length;

    description.textContent =
      `${total} ${total === 1 ? "produto cadastrado" : "produtos cadastrados"}`;

    info.append(title, description);

    const actions = document.createElement("div");
    actions.className = "list-actions";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "btn-open";
    openButton.textContent = "Abrir";

    openButton.addEventListener("click", () => {
      openList(list.id);
    });

    const purchaseButton = document.createElement("button");
    purchaseButton.type = "button";
    purchaseButton.className = "btn-open";
    const hasPreviousPurchase = purchaseRecords.some(
      record => record.listId === list.id && record.status === "finalizada"
    );
    purchaseButton.textContent = hasPreviousPurchase ? "Comprar novamente" : "Realizar compra";

    purchaseButton.addEventListener("click", () => {
      openPurchase(list.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn-delete";
    deleteButton.textContent = "Excluir";

    deleteButton.addEventListener("click", () => {
      deleteList(list.id);
    });

    actions.append(openButton, purchaseButton, deleteButton);
    card.append(info, actions);

    listsContainer.appendChild(card);
  });
}


// Renderização dos produtos no editor
function renderProducts() {
  productsContainer.replaceChildren();

  productCount.textContent =
    `${draftProducts.length} ${draftProducts.length === 1 ? "produto" : "produtos"}`;

  if (draftProducts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-products";
    empty.textContent = "Nenhum produto adicionado.";

    productsContainer.appendChild(empty);
    return;
  }

  draftProducts.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";

    const info = document.createElement("div");
    info.className = "product-info";

    const name = document.createElement("strong");
    name.textContent = product.name;

    const quantity = document.createElement("small");
    quantity.textContent =
      `Quantidade: ${formatQuantity(product.quantity)}`;

    info.append(name, quantity);

    const actions = document.createElement("div");
    actions.className = "product-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn-edit";
    editButton.textContent = "Editar";

    editButton.addEventListener("click", () => {
      editProduct(product.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn-delete";
    deleteButton.textContent = "Excluir";

    deleteButton.addEventListener("click", () => {
      deleteProduct(product.id);
    });

    actions.append(editButton, deleteButton);
    card.append(info, actions);

    productsContainer.appendChild(card);
  });
}

function formatQuantity(value) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3
  }).format(value);
}

// Criar lista
function openNewList() {
  currentListId = null;
  draftProducts = [];

  listName.value = "";
  editorTitle.textContent = "Nova lista";

  clearProductForm();
  renderProducts();

  showScreen(screenEditor);
  listName.focus();
}

// Abrir lista existente
function openList(id) {
  const list = lists.find(item => item.id === id);

  if (!list) {
    showMessage("Lista não encontrada.");
    return;
  }

  currentListId = list.id;
  draftProducts = list.products.map(product => ({ ...product }));

  listName.value = list.name;
  editorTitle.textContent = "Editar lista";

  clearProductForm();
  renderProducts();

  showScreen(screenEditor);
}

// Adicionar produto
function addProduct() {
  const name = productName.value.trim();
  const quantityText = productQuantity.value.trim();
  const quantity = Number(quantityText);

  if (!name) {
    showMessage("Informe o nome do produto.");
    productName.focus();
    return;
  }

  if (
    !quantityText ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    showMessage("Informe uma quantidade maior que zero.");
    productQuantity.focus();
    return;
  }

  if (editingProductId) {
    const product = draftProducts.find(
      item => item.id === editingProductId
    );

    if (!product) {
      showMessage("Produto não encontrado.");
      clearProductForm();
      return;
    }

    product.name = name;
    product.quantity = quantity;

    showMessage("Produto atualizado.");
  } else {
    draftProducts.push({
      id: createId(),
      name,
      quantity
    });

    showMessage("Produto adicionado.");
  }

  clearProductForm();
  renderProducts();
}

// Editar produto
function editProduct(id) {
  const product = draftProducts.find(item => item.id === id);

  if (!product) return;

  editingProductId = id;

  productName.value = product.name;
  productQuantity.value = String(product.quantity);

  btnAddProduct.textContent = "Salvar alterações";

  productName.focus();
}

// Excluir produto

function showActionCard(title, message, onConfirm, confirmLabel = "Confirmar", tone = "warning") {
  document.querySelectorAll(".app-action-card").forEach(card => card.remove());
  const activeScreen = document.querySelector(".screen.active") || screenLists;
  const card = document.createElement("section");
  card.className = `app-action-card action-${tone}`;
  const heading = document.createElement("h3");
  heading.textContent = title;
  const body = document.createElement("p");
  body.textContent = message;
  const actions = document.createElement("div");
  actions.className = "app-action-card-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-card-cancel";
  cancel.textContent = "Cancelar";
  cancel.addEventListener("click", () => card.remove());
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "btn btn-card-confirm";
  confirm.textContent = confirmLabel;
  confirm.addEventListener("click", () => {
    card.remove();
    onConfirm();
  });
  actions.append(cancel, confirm);
  card.append(heading, body, actions);
  activeScreen.prepend(card);
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showNoticeCard(title, message, tone = "warning") {
  document.querySelectorAll(".app-action-card").forEach(card => card.remove());
  const activeScreen = document.querySelector(".screen.active") || screenLists;
  const card = document.createElement("section");
  card.className = `app-action-card action-${tone}`;
  const heading = document.createElement("h3");
  heading.textContent = title;
  const body = document.createElement("p");
  body.textContent = message;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "btn btn-card-confirm";
  close.textContent = "Entendi";
  close.addEventListener("click", () => card.remove());
  card.append(heading, body, close);
  activeScreen.prepend(card);
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function deleteProduct(id) {
  const product = draftProducts.find(item => item.id === id);
  if (!product) return;
  showActionCard(
    "Excluir produto",
    `Deseja excluir "${product.name}" desta lista?`,
    () => {
      draftProducts = draftProducts.filter(item => item.id !== id);
      if (editingProductId === id) clearProductForm();
      renderProducts();
      showMessage("Produto removido.");
    },
    "Excluir"
  );
}

// Salvar lista
function saveList() {
  const name = listName.value.trim();

  if (!name) {
    showMessage("Informe o nome da lista.");
    listName.focus();
    return;
  }

  if (editingProductId) {
    showMessage("Finalize a edição do produto antes de salvar.");
    productName.focus();
    return;
  }

  if (currentListId) {
    const index = lists.findIndex(
      list => list.id === currentListId
    );

    if (index === -1) {
      showMessage("Lista não encontrada.");
      return;
    }

    const previousList = lists[index];

    lists[index] = {
      ...previousList,
      name,
      products: draftProducts.map(product => ({ ...product })),
      updatedAt: new Date().toISOString()
    };
  } else {
    lists.push({
      id: createId(),
      name,
      products: draftProducts.map(product => ({ ...product })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  if (!saveStorage()) {
    loadStorage();
    return;
  }

  renderLists();
  returnToLists();

  showMessage("Lista salva com sucesso.");
}

// Excluir lista
function deleteList(id) {
  const list = lists.find(item => item.id === id);

  if (!list) return;

  showActionCard(
    "Excluir lista",
    `Deseja excluir "${list.name}"? As compras já registradas no histórico serão preservadas.`,
    () => {
      const previousLists = lists;
      lists = lists.filter(item => item.id !== id);
      if (!saveStorage()) {
        lists = previousLists;
        return;
      }
      renderLists();
      showMessage("Lista excluída.");
    },
    "Excluir"
  );
}

// Voltar para a tela principal
function returnToLists() {
  currentListId = null;
  draftProducts = [];

  clearProductForm();
  renderLists();

  showScreen(screenLists);
}


// Formatação monetária
function formatCurrencyFromCents(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(cents / 100);
}

// Converte a digitação em centavos
function parseCurrencyToCents(value) {
  const digits = String(value).replace(/\D/g, "");

  if (!digits) return 0;

  const cents = Number(digits);

  return Number.isSafeInteger(cents) ? cents : 0;
}

// Histórico de compras e preços
function loadPurchaseRecords() {
  try {
    const raw = localStorage.getItem(PURCHASES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    purchaseRecords = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao recuperar histórico de compras:", error);
    purchaseRecords = [];
    showMessage("Não foi possível recuperar o histórico de compras.");
  }
}

function savePurchaseRecords() {
  try {
    localStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(purchaseRecords));
    return true;
  } catch (error) {
    console.error("Erro ao salvar compras:", error);
    showMessage("Não foi possível salvar a compra.");
    return false;
  }
}

function loadPriceHistory() {
  try {
    const raw = localStorage.getItem(PRICE_HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    priceHistory = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error("Erro ao recuperar histórico de preços:", error);
    priceHistory = {};
  }
}

function savePriceHistory() {
  try {
    localStorage.setItem(PRICE_HISTORY_STORAGE_KEY, JSON.stringify(priceHistory));
    return true;
  } catch (error) {
    console.error("Erro ao salvar histórico de preços:", error);
    showMessage("Não foi possível salvar o histórico de preços.");
    return false;
  }
}

function savePurchasePrices() {
  try {
    localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(purchasePricesByList));
    return true;
  } catch (error) {
    console.error("Erro ao salvar dados antigos de compra:", error);
    showMessage("Não foi possível salvar os dados da compra.");
    return false;
  }
}

function loadPurchasePrices() {
  try {
    const saved = localStorage.getItem(PURCHASE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    purchasePricesByList = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error("Erro ao recuperar preços antigos:", error);
    purchasePricesByList = {};
  }
}

function getLegacyPrice(listId, productId) {
  const value = purchasePricesByList?.[listId]?.[productId];
  if (Number.isSafeInteger(value)) return value;
  return Number.isSafeInteger(value?.priceCents) ? value.priceCents : 0;
}

function getLastPrice(productId, listId) {
  const entries = priceHistory[productId];
  if (Array.isArray(entries) && entries.length) {
    return Number(entries[entries.length - 1].priceCents) || 0;
  }
  return getLegacyPrice(listId, productId);
}

function persistCurrentPurchase() {
  if (!currentPurchaseId) return;
  const index = purchaseRecords.findIndex(item => item.id === currentPurchaseId);
  if (index >= 0) purchaseRecords[index] = currentPurchase;
  else purchaseRecords.push(currentPurchase);
  savePurchaseRecords();
}

function createPurchaseFromList(list) {
  const now = new Date().toISOString();
  currentPurchase = {
    id: createId(),
    listId: list.id,
    listName: list.name,
    status: "em-andamento",
    createdAt: now,
    updatedAt: now,
    finalizedAt: null,
    products: list.products.map(product => ({
      productId: product.id,
      name: product.name,
      quantity: Number(product.quantity),
      previousPriceCents: getLastPrice(product.id, list.id),
      priceCents: getLastPrice(product.id, list.id),
      status: "",
      reason: "",
      otherReason: ""
    }))
  };
  currentPurchaseId = currentPurchase.id;
  currentPurchaseListId = list.id;
  currentPurchaseTab = "pendentes";
  purchaseRecords.push(currentPurchase);
  if (!savePurchaseRecords()) {
    purchaseRecords = purchaseRecords.filter(item => item.id !== currentPurchaseId);
    currentPurchase = null;
    currentPurchaseId = null;
    return;
  }
  showPurchaseScreen("Realizar compra");
}

function openPurchase(id) {
  const list = lists.find(item => item.id === id);
  if (!list) {
    showMessage("Lista não encontrada.");
    return;
  }
  createPurchaseFromList(list);
}

function showPurchaseScreen(title) {
  if (!currentPurchase) return;
  purchaseTitle.textContent = title;
  purchaseListName.textContent = currentPurchase.listName;
  renderPurchaseProducts();
  showScreen(screenPurchase);
}

function updatePurchaseSummary() {
  const summary = document.querySelector("#screen-purchase .purchase-summary");
  if (!summary || !currentPurchase) return;
  let total = 0;
  let bought = 0;
  let unavailable = 0;
  let notBought = 0;
  currentPurchase.products.forEach(product => {
    if (product.status === "comprado") {
      bought++;
      total += product.priceCents * product.quantity;
    } else if (product.status === "indisponivel") unavailable++;
    else if (product.status === "nao-comprado") notBought++;
  });
  summary.querySelector(".purchase-total-value").textContent = formatCurrencyFromCents(Math.round(total));
  summary.querySelector(".purchase-count-bought").textContent = `Comprados: ${bought}`;
  summary.querySelector(".purchase-count-unavailable").textContent = `Indisponíveis: ${unavailable}`;
  summary.querySelector(".purchase-count-not-bought").textContent = `Não comprados: ${notBought}`;
}

function renderPurchaseProducts() {
  purchaseProducts.replaceChildren();
  if (!currentPurchase) return;
  const allProducts = currentPurchase.products;
  const pending = allProducts.filter(product => !product.status || product.status === "aguardando-motivo");
  const boughtProducts = allProducts.filter(product => product.status === "comprado");
  const notBoughtProducts = allProducts.filter(product => product.status === "indisponivel" || product.status === "nao-comprado");
  purchasePendingCount.textContent = pending.length;
  purchaseBoughtTabCount.textContent = boughtProducts.length;
  purchaseNotBoughtTabCount.textContent = notBoughtProducts.length;
  purchaseTabs.forEach(tab => {
    const active = tab.dataset.purchaseTab === currentPurchaseTab;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  const products = currentPurchaseTab === "pendentes" ? pending
    : currentPurchaseTab === "comprados" ? boughtProducts : notBoughtProducts;
  purchaseProductCount.textContent = `${products.length} ${products.length === 1 ? "produto" : "produtos"}`;

  if (!products.length) {
    const empty = document.createElement("div");
    empty.className = "purchase-empty";
    empty.textContent = currentPurchaseTab === "pendentes"
      ? "Todos os produtos já foram classificados."
      : currentPurchaseTab === "comprados"
        ? "Nenhum produto comprado ainda."
        : "Nenhum produto marcado como não comprado.";
    purchaseProducts.appendChild(empty);
  }

  const statusOptions = [
    { value: "comprado", label: "Comprado", icon: "✓" },
    { value: "indisponivel", label: "Indisponível", icon: "−" },
    { value: "nao-comprado", label: "Não comprado", icon: "×" }
  ];
  const reasonOptions = [
    { value: "caro", label: "Preço muito alto" },
    { value: "marca", label: "Marca não agradou" },
    { value: "qualidade", label: "Qualidade insatisfatória" },
    { value: "substituto", label: "Escolhi outro produto" },
    { value: "desisti", label: "Desisti da compra" },
    { value: "outro", label: "Outro motivo" }
  ];

  products.forEach((product, index) => {
    if (currentPurchaseTab === "nao-comprados") {
      const compactCard = document.createElement("article");
      compactCard.className = "purchase-product-card purchase-not-bought-card";
      const productName = document.createElement("strong");
      productName.className = "purchase-not-bought-name";
      productName.textContent = product.name;
      const details = document.createElement("div");
      details.className = "purchase-not-bought-details";
      const quantityText = document.createElement("span");
      quantityText.textContent = `Quantidade: ${product.quantity}`;
      const priceText = document.createElement("span");
      priceText.textContent = `Preço: ${formatCurrencyFromCents(Number(product.priceCents) || 0)}`;
      const reasonText = document.createElement("span");
      reasonText.className = "purchase-not-bought-reason";
      const selectedReason = reasonOptions.find(option => option.value === product.reason);
      const reasonLabel = selectedReason
        ? selectedReason.label === "Outro motivo" && product.otherReason
          ? `Outro: ${product.otherReason}`
          : selectedReason.label
        : product.status === "indisponivel" ? "Indisponível" : "Motivo não informado";
      reasonText.textContent = `Motivo: ${reasonLabel}`;
      details.append(quantityText, priceText, reasonText);
      const restoreButton = document.createElement("button");
      restoreButton.type = "button";
      restoreButton.className = "purchase-restore-button";
      restoreButton.textContent = "Restaurar item";
      restoreButton.setAttribute("aria-label", `Restaurar ${product.name} para pendentes`);
      restoreButton.addEventListener("click", () => {
        product.status = "";
        product.reason = "";
        product.otherReason = "";
        currentPurchase.updatedAt = new Date().toISOString();
        persistCurrentPurchase();
        renderPurchaseProducts();
        updatePurchaseSummary();
      });
      compactCard.append(productName, details, restoreButton);
      purchaseProducts.appendChild(compactCard);
      return;
    }

    const card = document.createElement("article");
    card.className = "purchase-product-card";
    const info = document.createElement("div");
    info.className = "purchase-product-info";
    const name = document.createElement("strong");
    name.textContent = product.name;
    const quantity = document.createElement("small");
    quantity.textContent = "Quantidade nesta compra";
    const quantityInput = document.createElement("input");
    quantityInput.className = "purchase-quantity-input";
    quantityInput.type = "number";
    quantityInput.min = "0.001";
    quantityInput.step = "any";
    quantityInput.inputMode = "decimal";
    quantityInput.value = String(product.quantity);
    quantityInput.setAttribute("aria-label", `Quantidade de ${product.name} nesta compra`);
    const applyQuantityChange = (restoreInvalid = false) => {
      const rawValue = String(quantityInput.value).trim().replace(",", ".");
      const nextQuantity = Number(rawValue);
      if (!rawValue || !Number.isFinite(nextQuantity) || nextQuantity <= 0) {
        if (restoreInvalid) {
          quantityInput.value = String(product.quantity);
          showMessage("Informe uma quantidade maior que zero.");
        }
        return;
      }
      if (nextQuantity === product.quantity) return;
      product.quantity = nextQuantity;
      currentPurchase.updatedAt = new Date().toISOString();
      persistCurrentPurchase();
      updateSubtotal();
      updatePurchaseSummary();
    };
    // Atualiza durante a digitação, sem esperar blur/change (especialmente útil no celular).
    quantityInput.addEventListener("input", () => applyQuantityChange(false));
    quantityInput.addEventListener("change", () => applyQuantityChange(true));
    quantityInput.addEventListener("blur", () => applyQuantityChange(true));
    info.append(name, quantity, quantityInput);

    const previousPrice = document.createElement("small");
    previousPrice.className = "purchase-previous-price";
    const referencePrice = Number(product.previousPriceCents) || 0;
    previousPrice.textContent = referencePrice > 0
      ? `Preço da compra anterior: ${formatCurrencyFromCents(referencePrice)}`
      : "Ainda não há preço anterior registrado.";

    const priceComparison = document.createElement("div");
    priceComparison.className = "purchase-price-comparison";
    const updatePriceComparison = () => {
      priceComparison.replaceChildren();
      if (!currentPurchase.sourcePurchaseId || referencePrice <= 0 || !product.priceCents) {
        priceComparison.hidden = true;
        return;
      }
      priceComparison.hidden = false;
      const difference = product.priceCents - referencePrice;
      const amount = document.createElement("strong");
      const detail = document.createElement("small");
      if (difference > 0) {
        priceComparison.className = "purchase-price-comparison is-higher";
        amount.textContent = "Mais caro";
        detail.textContent = `Aumento de ${formatCurrencyFromCents(difference)} por unidade`;
      } else if (difference < 0) {
        priceComparison.className = "purchase-price-comparison is-lower";
        amount.textContent = "Mais barato";
        detail.textContent = `Redução de ${formatCurrencyFromCents(Math.abs(difference))} por unidade`;
      } else {
        priceComparison.className = "purchase-price-comparison is-equal";
        amount.textContent = "Mesmo preço";
        detail.textContent = "Sem alteração em relação à compra anterior";
      }
      priceComparison.append(amount, detail);
    };
    priceComparison.hidden = true;

    const priceLabel = document.createElement("label");
    priceLabel.className = "purchase-price-label";
    priceLabel.textContent = "Preço unitário desta compra";
    const priceInput = document.createElement("input");
    priceInput.className = "purchase-price-input";
    priceInput.type = "text";
    priceInput.inputMode = "numeric";
    priceInput.autocomplete = "off";
    priceInput.placeholder = "R$ 0,00";
    priceInput.value = product.priceCents ? formatCurrencyFromCents(product.priceCents) : "";
    priceInput.setAttribute("aria-label", `Preço unitário de ${product.name}`);

    const subtotal = document.createElement("div");
    subtotal.className = "purchase-item-subtotal";
    const updateSubtotal = () => {
      subtotal.textContent = `Subtotal: ${formatCurrencyFromCents(Math.round(product.priceCents * product.quantity))}`;
    };
    priceInput.addEventListener("input", () => {
      product.priceCents = parseCurrencyToCents(priceInput.value);
      priceInput.value = product.priceCents ? formatCurrencyFromCents(product.priceCents) : "";
      currentPurchase.updatedAt = new Date().toISOString();
      persistCurrentPurchase();
      updateSubtotal();
      updatePriceComparison();
      updatePurchaseSummary();
    });
    updateSubtotal();
    updatePriceComparison();

    const statusLabel = document.createElement("div");
    statusLabel.className = "purchase-status-label";
    statusLabel.textContent = "Situação da compra";
    const statusGroup = document.createElement("div");
    statusGroup.className = "purchase-choice-group purchase-status-group";
    statusGroup.setAttribute("role", "group");
    statusGroup.setAttribute("aria-label", `Situação de ${product.name}`);

    const reasonWrapper = document.createElement("div");
    reasonWrapper.className = "purchase-reason-wrapper";
    reasonWrapper.hidden = product.status !== "nao-comprado" && product.status !== "aguardando-motivo";
    const reasonLabel = document.createElement("div");
    reasonLabel.className = "purchase-reason-label";
    reasonLabel.textContent = "Por que não comprou?";
    const reasonGroup = document.createElement("div");
    reasonGroup.className = "purchase-choice-group purchase-reason-group";
    reasonGroup.setAttribute("role", "group");
    reasonGroup.setAttribute("aria-label", `Motivo de não comprar ${product.name}`);
    const otherReason = document.createElement("input");
    otherReason.className = "purchase-other-reason";
    otherReason.type = "text";
    otherReason.maxLength = 160;
    otherReason.placeholder = "Descreva o motivo";
    otherReason.value = product.otherReason || "";
    otherReason.hidden = product.reason !== "outro";

    function updateChoiceButtons(group, selectedValue) {
      [...group.querySelectorAll("button")].forEach(button => {
        const selected = button.dataset.value === selectedValue;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    }

    statusOptions.forEach(option => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `purchase-choice-button status-${option.value}`;
      button.dataset.value = option.value;
      const icon = document.createElement("span");
      icon.className = "purchase-choice-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = option.icon;
      const label = document.createElement("span");
      label.textContent = option.label;
      button.append(icon, label);
      button.addEventListener("click", () => {
        currentPurchaseTab = "pendentes";
        product.status = option.value === "nao-comprado" ? "aguardando-motivo" : option.value;
        if (product.status !== "aguardando-motivo") {
          product.reason = "";
          product.otherReason = "";
          otherReason.value = "";
          otherReason.hidden = true;
        }
        reasonWrapper.hidden = product.status !== "aguardando-motivo" && product.status !== "nao-comprado";
        updateChoiceButtons(statusGroup, product.status);
        updateChoiceButtons(reasonGroup, product.reason);
        currentPurchase.updatedAt = new Date().toISOString();
        persistCurrentPurchase();
        renderPurchaseProducts();
      });
      statusGroup.appendChild(button);
    });

    reasonOptions.forEach(option => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "purchase-choice-button purchase-reason-button";
      button.dataset.value = option.value;
      button.textContent = option.label;
      button.addEventListener("click", () => {
        currentPurchaseTab = "pendentes";
        product.reason = option.value;
        if (option.value !== "outro") {
          product.otherReason = "";
          otherReason.value = "";
        }
        otherReason.hidden = option.value !== "outro";
        if (option.value !== "outro") {
          product.status = "nao-comprado";
        } else {
          product.status = "aguardando-motivo";
        }
        updateChoiceButtons(reasonGroup, product.reason);
        currentPurchase.updatedAt = new Date().toISOString();
        persistCurrentPurchase();
        renderPurchaseProducts();
      });
      reasonGroup.appendChild(button);
    });

    otherReason.addEventListener("input", () => {
      product.otherReason = otherReason.value;
      if (product.reason === "outro" && otherReason.value.trim()) {
        product.status = "nao-comprado";
      }
      currentPurchase.updatedAt = new Date().toISOString();
      persistCurrentPurchase();
    });
    updateChoiceButtons(statusGroup, product.status);
    updateChoiceButtons(reasonGroup, product.reason);
    reasonWrapper.append(reasonLabel, reasonGroup, otherReason);
    card.append(info, previousPrice, priceLabel, priceInput, subtotal, priceComparison, statusLabel, statusGroup, reasonWrapper);
    purchaseProducts.appendChild(card);
  });

  updatePurchaseSummary();
}

function validatePurchase() {
  const issues = [];
  currentPurchase.products.forEach(product => {
    if (!product.status) issues.push(`${product.name}: selecione a situação.`);
    else if (product.status === "comprado" && (!Number.isSafeInteger(product.priceCents) || product.priceCents <= 0)) {
      issues.push(`${product.name}: informe o preço unitário.`);
    } else if (product.status === "nao-comprado") {
      if (!product.reason) issues.push(`${product.name}: selecione o motivo de não comprar.`);
      else if (product.reason === "outro" && !product.otherReason.trim()) issues.push(`${product.name}: descreva o outro motivo.`);
    }
  });
  return issues;
}

function calculatePurchaseTotals(purchase) {
  const bought = purchase.products.filter(item => item.status === "comprado");
  const unavailable = purchase.products.filter(item => item.status === "indisponivel").length;
  const notBought = purchase.products.filter(item => item.status === "nao-comprado").length;
  const total = bought.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  return { bought: bought.length, unavailable, notBought, total: Math.round(total) };
}

function finishPurchase() {
  if (!currentPurchase) return;
  const issues = validatePurchase();
  if (issues.length) {
    showNoticeCard(
      "Revise a compra antes de finalizar",
      issues.slice(0, 8).join(" • ") + (issues.length > 8 ? ` • e mais ${issues.length - 8} pendência(s).` : ""),
      "warning"
    );
    return;
  }
  const totals = calculatePurchaseTotals(currentPurchase);
  showActionCard(
    "Confirmar finalização",
    `Comprados: ${totals.bought} | Indisponíveis: ${totals.unavailable} | Não comprados: ${totals.notBought} | Total: ${formatCurrencyFromCents(totals.total)}. Ao confirmar, esta compra será registrada no histórico.`,
    () => finalizeCurrentPurchase(),
    "Finalizar",
    "success"
  );
}

function finalizeCurrentPurchase() {
  if (!currentPurchase) return;
  const previous = purchaseRecords.find(item => item.id === currentPurchase.id);
  const finalizedAt = new Date().toISOString();
  currentPurchase.status = "finalizada";
  currentPurchase.finalizedAt = finalizedAt;
  currentPurchase.updatedAt = finalizedAt;
  persistCurrentPurchase();

  // Atualiza o histórico de preços sem alterar os preços registrados em compras anteriores.
  currentPurchase.products.filter(item => item.status === "comprado").forEach(item => {
    if (!Array.isArray(priceHistory[item.productId])) priceHistory[item.productId] = [];
    priceHistory[item.productId] = priceHistory[item.productId].filter(entry => entry.purchaseId !== currentPurchase.id);
    priceHistory[item.productId].push({
      purchaseId: currentPurchase.id,
      listId: currentPurchase.listId,
      priceCents: item.priceCents,
      date: finalizedAt
    });
  });
  if (!savePriceHistory()) {
    currentPurchase.status = "em-andamento";
    currentPurchase.finalizedAt = null;
    if (previous) persistCurrentPurchase();
    return;
  }
  currentPurchaseId = null;
  currentPurchase = null;
  currentPurchaseListId = null;
  renderHistory();
  showScreen(screenHistory);
  showMessage("Compra finalizada e registrada no histórico.");
}

function reopenPurchase(id) {
  const record = purchaseRecords.find(item => item.id === id);
  if (!record || record.status !== "finalizada") return;
  showActionCard(
    "Reabrir compra",
    `Deseja reabrir "${record.listName}" para editar preços, quantidades e situações? O registro anterior será atualizado quando você finalizar novamente.`,
    () => {
      currentPurchase = JSON.parse(JSON.stringify(record));
      currentPurchase.status = "em-andamento";
      currentPurchase.updatedAt = new Date().toISOString();
      currentPurchaseId = currentPurchase.id;
      currentPurchaseListId = currentPurchase.listId;
      currentPurchaseTab = currentPurchase.products.some(product => !product.status) ? "pendentes" : "comprados";
      persistCurrentPurchase();
      showPurchaseScreen("Reabrir compra");
    },
    "Reabrir",
    "info"
  );
}

function renderHistory() {
  historyContainer.replaceChildren();
  const finalized = purchaseRecords
    .filter(item => item.status === "finalizada")
    .sort((a, b) => String(b.finalizedAt).localeCompare(String(a.finalizedAt)));

  if (!finalized.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<h3>Nenhuma compra finalizada</h3><p>As compras concluídas aparecerão aqui.</p>";
    historyContainer.appendChild(empty);
    return;
  }

  finalized.forEach(record => {
    const totals = calculatePurchaseTotals(record);
    const card = document.createElement("article");
    card.className = "history-card history-card-modern";

    const heading = document.createElement("div");
    heading.className = "history-card-heading";
    const title = document.createElement("h3");
    title.textContent = record.listName;
    const date = document.createElement("small");
    date.textContent = `Finalizada em ${new Date(record.finalizedAt).toLocaleString("pt-BR")}`;
    heading.append(title, date);

    const overview = document.createElement("div");
    overview.className = "history-overview";
    const totalBlock = document.createElement("div");
    totalBlock.className = "history-total-block";
    const totalCaption = document.createElement("small");
    totalCaption.textContent = "Total da compra";
    const total = document.createElement("strong");
    total.className = "history-total";
    total.textContent = formatCurrencyFromCents(totals.total);
    totalBlock.append(totalCaption, total);

    const stats = document.createElement("div");
    stats.className = "history-stats";
    [
      [`${record.products.length}`, "Produtos"],
      [`${totals.bought}`, "Comprados"],
      [`${totals.unavailable + totals.notBought}`, "Não adquiridos"]
    ].forEach(([value, label]) => {
      const stat = document.createElement("div");
      stat.className = "history-stat";
      const number = document.createElement("strong");
      number.textContent = value;
      const caption = document.createElement("small");
      caption.textContent = label;
      stat.append(number, caption);
      stats.appendChild(stat);
    });
    overview.append(totalBlock, stats);

    const details = document.createElement("details");
    details.className = "history-details";
    const summary = document.createElement("summary");
    summary.textContent = `Consultar produtos (${record.products.length})`;
    const detailList = document.createElement("div");
    detailList.className = "history-product-list";
    record.products.forEach(product => {
      const item = document.createElement("div");
      item.className = "history-product-item";
      const productMain = document.createElement("div");
      productMain.className = "history-product-main";
      const name = document.createElement("strong");
      name.textContent = product.name;
      const meta = document.createElement("small");
      const statusLabel = product.status === "comprado" ? "Comprado"
        : product.status === "indisponivel" ? "Indisponível" : "Não comprado";
      meta.textContent = `${formatQuantity(product.quantity)} · ${statusLabel}`;
      productMain.append(name, meta);

      const value = document.createElement("strong");
      value.className = "history-product-value";
      value.textContent = product.status === "comprado"
        ? formatCurrencyFromCents(product.priceCents)
        : "Não adquirido";
      item.append(productMain, value);

      if (product.status === "nao-comprado" || product.status === "indisponivel") {
        const reasonNames = {
          caro: "Preço muito alto",
          marca: "Marca não agradou",
          qualidade: "Qualidade insatisfatória",
          substituto: "Escolhi outro produto",
          desisti: "Desisti da compra",
          outro: product.otherReason || "Outro motivo"
        };
        const reason = document.createElement("small");
        reason.className = "history-product-reason";
        reason.textContent = product.status === "indisponivel"
          ? "Motivo: Indisponível"
          : `Motivo: ${reasonNames[product.reason] || product.reason || "Não informado"}`;
        item.appendChild(reason);
      }
      detailList.appendChild(item);
    });
    details.append(summary, detailList);

    const actions = document.createElement("div");
    actions.className = "history-actions";
    const reopen = document.createElement("button");
    reopen.type = "button";
    reopen.className = "btn btn-secondary history-action-secondary";
    reopen.textContent = "Reabrir compra";
    reopen.addEventListener("click", () => reopenPurchase(record.id));

    const buyAgain = document.createElement("button");
    buyAgain.type = "button";
    buyAgain.className = "btn btn-primary";
    buyAgain.textContent = "Comprar novamente";
    buyAgain.addEventListener("click", () => createPurchaseAgain(record.id));

    actions.append(reopen, buyAgain);
    card.append(heading, overview, details, actions);
    historyContainer.appendChild(card);
  });
}

function createPurchaseAgain(id) {
  const source = purchaseRecords.find(item => item.id === id && item.status === "finalizada");
  if (!source) return;

  showActionCard(
    "Comprar novamente",
    `Será criada uma nova compra baseada em "${source.listName}". Os produtos e quantidades serão copiados, os preços atuais começarão zerados e a compra anterior permanecerá intacta. Deseja continuar?`,
    () => {
      const now = new Date().toISOString();
      const nextPurchase = {
        id: createId(),
        listId: source.listId,
        listName: source.listName,
        status: "em-andamento",
        createdAt: now,
        updatedAt: now,
        finalizedAt: null,
        sourcePurchaseId: source.id,
        products: source.products.map(product => {
          const referencePrice = product.status === "comprado"
            ? Number(product.priceCents) || 0
            : Number(product.previousPriceCents) || 0;
          return {
            productId: product.productId,
            name: product.name,
            quantity: Number(product.quantity) || 1,
            previousPriceCents: referencePrice,
            priceCents: 0,
            status: "",
            reason: "",
            otherReason: ""
          };
        })
      };
      currentPurchase = nextPurchase;
      currentPurchaseId = nextPurchase.id;
      currentPurchaseListId = nextPurchase.listId;
      currentPurchaseTab = "pendentes";
      purchaseRecords.push(nextPurchase);
      if (!savePurchaseRecords()) {
        purchaseRecords = purchaseRecords.filter(item => item.id !== nextPurchase.id);
        currentPurchase = null;
        currentPurchaseId = null;
        currentPurchaseListId = null;
        return;
      }
      showPurchaseScreen("Comprar novamente");
      showMessage("Nova compra criada. Os preços anteriores estão disponíveis como referência.");
    },
    "Criar nova compra",
    "info"
  );
}

function openHistory() {
  renderHistory();
  showScreen(screenHistory);
}

// Eventos
purchaseTabs.forEach(tab => tab.addEventListener("click", () => {
  currentPurchaseTab = tab.dataset.purchaseTab;
  renderPurchaseProducts();
}));
btnNewList.addEventListener("click", openNewList);
btnBack.addEventListener("click", returnToLists);
btnCancel.addEventListener("click", returnToLists);
// Fluxo de teclado no cadastro: nome -> quantidade -> adicionar.
productQuantity.value = productQuantity.value || "1";
productName.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (!productName.value.trim()) {
    showMessage("Informe o nome do produto.");
    productName.focus();
    return;
  }
  if (!productQuantity.value) productQuantity.value = "1";
  productQuantity.focus();
  productQuantity.select();
});
productQuantity.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (!productQuantity.value) productQuantity.value = "1";
  addProduct();
});

btnAddProduct.addEventListener("click", addProduct);
btnSaveList.addEventListener("click", saveList);
btnPurchaseBack.addEventListener("click", () => {
  if (currentPurchase && currentPurchase.status === "em-andamento") {
    persistCurrentPurchase();
  }
  currentPurchase = null;
  currentPurchaseId = null;
  currentPurchaseListId = null;
  returnToLists();
});
btnFinishPurchase.addEventListener("click", finishPurchase);
btnHistory.addEventListener("click", openHistory);
btnHistoryBack.addEventListener("click", () => {
  renderLists();
  showScreen(screenLists);
});

// Inicialização
loadStorage();
loadPurchasePrices();
loadPurchaseRecords();
loadPriceHistory();
renderLists();
showScreen(screenLists);
