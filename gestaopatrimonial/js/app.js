import { getAssetCounts, getCollectionRows, ensureDemoSeed, deleteTestMasterData, recordAssetTransfer, recordAssetDisposal, saveReferenceRecord, saveAssetRecord, changeSectorLocation } from "./db.js";
import { prepareWorkbook, commitPreparedWorkbook } from "./importacao.js";

const $ = id => document.getElementById(id);
let currentUser = null;
let currentProfile = null;
let importIsValid = false;
let selectedAssetSearchTombamento = "";
const INSTITUTIONAL_KEY = "delunatech.gestao-patrimonial.institucional.v1";
const ISSUERS_KEY = "delunatech.gestao-patrimonial.emissores.v1";
const readLocalJson = (key, fallback) => { try { const v=JSON.parse(localStorage.getItem(key)||"null"); return v ?? fallback; } catch { return fallback; } };
const saveLocalJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
function renderIssuers() {
  const issuers=readLocalJson(ISSUERS_KEY, []), body=$("issuerTableBody"), select=$("transferIssuer");
  if(body){ body.replaceChildren(); if(!issuers.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=5;td.textContent="Nenhum emissor cadastrado.";tr.append(td);body.append(tr);} else issuers.forEach(item=>{const tr=document.createElement("tr");[item.name,item.role,item.registration||"—",item.active===false?"Inativo":"Ativo"].forEach(value=>{const td=document.createElement("td");td.textContent=value;tr.append(td)});const td=document.createElement("td"),btn=document.createElement("button");btn.type="button";btn.className="button button-secondary";btn.textContent=item.active===false?"Ativar":"Desativar";btn.addEventListener("click",()=>{item.active=item.active===false;saveLocalJson(ISSUERS_KEY,issuers);renderIssuers()});td.append(btn);tr.append(td);body.append(tr)}); }
  if(select){const old=select.value;select.replaceChildren(new Option("Selecione quem está emitindo o documento",""));issuers.filter(x=>x.active!==false).forEach(x=>select.add(new Option(`${x.name} — ${x.role}`,x.id)));if(issuers.some(x=>x.id===old&&x.active!==false))select.value=old;}
}


function formatBrazilDateTime(value) {
  if (value == null || value === "") return "Data não informada";
  let date;
  if (typeof value === "object" && value.seconds != null) date = new Date(value.seconds * 1000);
  else if (value instanceof Date) date = value;
  else date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const datePart = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timePart = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${datePart} às ${timePart}h`;
}

function setMessage(id, message, type = "") {
  const el = $(id);
  el.textContent = message;
  el.className = `message ${type}`.trim();
}

function showApp() {
  $("appView").hidden = false;
  $("sessionBox").hidden = false;
  $("sessionUser").textContent = "Demonstração local · dados neste navegador";
  ["disposalNavTab", "referenceNavTab", "sectorLocationNavTab"].forEach(id => { const tab = $(id); if (tab) tab.hidden = false; });
}

function activateView(viewId) {
  const detail = $("assetDetailModal");
  if (detail && viewId !== "assetsView") detail.hidden = true;
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== viewId);
  document.querySelectorAll(".nav-tab").forEach(b => b.classList.toggle("active", b.dataset.view === viewId));
}

async function refreshDashboard() {
  try {
    const counts = await getAssetCounts();
    $("totalAssets").textContent = counts.total;
    $("activeAssets").textContent = counts.active;
    $("retiredAssets").textContent = counts.retired;
    $("databaseStatus").textContent = counts.total === 0
      ? "A base local ainda não contém bens. Os registros criados neste navegador aparecerão aqui."
      : `Base local com ${counts.total} bens disponíveis para consulta.`;
  } catch (error) {
    $("databaseStatus").textContent = `Não foi possível consultar o banco: ${error.message}`;
  }
}

async function loadCategories() {
  const categories = await getCollectionRows("categorias");
  const select = $("categoryFilter");
  const previousValue = select.value;
  const normalizedName = value => String(value ?? "").trim().toLocaleLowerCase("pt-BR");
  const others = categories.filter(cat => normalizedName(cat.Nome_Categoria) === "outros equipamentos");
  const middle = categories
    .filter(cat => normalizedName(cat.Nome_Categoria) !== "outros equipamentos")
    .sort((a, b) => String(a.Nome_Categoria ?? "").localeCompare(String(b.Nome_Categoria ?? ""), "pt-BR", { sensitivity: "base" }));
  const ordered = [...middle, ...others];
  select.replaceChildren(new Option("Todas", ""));
  for (const cat of ordered) {
    const option = document.createElement("option");
    option.value = cat.ID_Categoria;
    option.textContent = cat.Nome_Categoria;
    select.append(option);
  }
  if ([...select.options].some(option => option.value === previousValue)) select.value = previousValue;
}

function cell(row, value) {
  const td = document.createElement("td");
  td.textContent = value ?? "";
  row.append(td);
}

async function searchAssets() {
  setMessage("assetsMessage", "Consultando bens e localização física...");
  try {
    const [assets, categories, sectors, places, floors, units, people] = await Promise.all([
      getCollectionRows("bens"), getCollectionRows("categorias"),
      getCollectionRows("setores"), getCollectionRows("locais"),
      getCollectionRows("andares"), getCollectionRows("unidades"),
      getCollectionRows("responsaveis")
    ]);
    assetAutocompleteRows = assets;
    const catMap = new Map(categories.map(x => [String(x.ID_Categoria ?? ""), x.Nome_Categoria]));
    const sectorMap = new Map(sectors.map(x => [String(x.ID_Setor ?? ""), x]));
    const placeMap = new Map(places.map(x => [String(x.ID_Local ?? ""), x]));
    const floorMap = new Map(floors.map(x => [String(x.ID_Andar ?? ""), x]));
    const unitMap = new Map(units.map(x => [String(x.ID_Unidade ?? ""), x]));
    const peopleMap = new Map(people.map(x => [String(x.ID_Responsavel ?? ""), x]));
    // Popula os filtros com os cadastros locais atuais, preservando a seleção.
    const sectorSelect = $("sectorFilter");
    const previousSector = sectorSelect.value;
    sectorSelect.replaceChildren(new Option("Todos", ""));
    for (const sector of sectors.slice().sort((a,b) => String(a.Nome_Setor ?? "").localeCompare(String(b.Nome_Setor ?? ""), "pt-BR"))) {
      sectorSelect.add(new Option(sector.Nome_Setor || sector.ID_Setor, String(sector.ID_Setor)));
    }
    if ([...sectorSelect.options].some(o => o.value === previousSector)) sectorSelect.value = previousSector;

    const responsibleSelect = $("responsibleFilter");
    const previousResponsible = responsibleSelect.value;
    responsibleSelect.replaceChildren(new Option("Todos", ""));
    for (const person of people.slice().sort((a,b) => String(a.Nome_Completo ?? "").localeCompare(String(b.Nome_Completo ?? ""), "pt-BR"))) {
      responsibleSelect.add(new Option(person.Nome_Completo || person.ID_Responsavel, String(person.ID_Responsavel)));
    }
    if ([...responsibleSelect.options].some(o => o.value === previousResponsible)) responsibleSelect.value = previousResponsible;

    const term = (selectedAssetSearchTombamento || $("assetSearch").value.trim()).toLocaleLowerCase("pt-BR");
    const cat = $("categoryFilter").value;
    const status = $("statusFilter").value;
    const sectorIdFilter = sectorSelect.value;
    const responsibleIdFilter = responsibleSelect.value;
    const filtered = assets.filter(a =>
      (!term || String(a.Tombamento ?? "").toLocaleLowerCase("pt-BR").includes(term) || String(a.Descricao_Bem ?? "").toLocaleLowerCase("pt-BR").includes(term)) &&
      (!cat || String(a.ID_Categoria ?? "") === cat) &&
      (!status || String(a.Situacao ?? a.situacao ?? "") === status) &&
      (!sectorIdFilter || String(a.ID_Setor ?? "") === sectorIdFilter) &&
      (!responsibleIdFilter || String(a.ID_Responsavel ?? "") === responsibleIdFilter)
    );
    const tbody = $("assetsTableBody");
    tbody.replaceChildren();
    for (const asset of filtered.slice(0, 500)) {
      const tr = document.createElement("tr");
      const sectorId = String(asset.ID_Setor ?? "");
      const sector = sectorMap.get(sectorId);
      // Compatibilidade de leitura: schema atual usa ID_Local_Atual; dados antigos podem usar ID_Local_Referencia.
      const localId = String(sector?.ID_Local_Atual ?? sector?.ID_Local_Referencia ?? asset.ID_Local ?? "");
      const place = placeMap.get(localId);
      const floorId = String(place?.ID_Andar ?? "");
      const floor = floorMap.get(floorId);
      const unitId = String(place?.ID_Unidade ?? floor?.ID_Unidade ?? "");
      const unit = unitMap.get(unitId);
      const locationComplete = Boolean(place && floor && unit);
      const locationStatus = !place
        ? "Localização não cadastrada"
        : !floor
          ? "Andar não cadastrado"
          : !unit
            ? "Unidade não cadastrada"
            : "";
      cell(tr, asset.Tombamento);
      cell(tr, asset.Descricao_Bem);
      cell(tr, catMap.get(String(asset.ID_Categoria ?? "")) || asset.ID_Categoria || "Não informado");
      cell(tr, sector?.Nome_Setor || sectorId || "Setor não cadastrado");
      cell(tr, unit?.Nome_Unidade || (place?.Nome_Unidade ?? "Não informado"));
      cell(tr, floor?.Nome_Andar || (place ? "Andar não cadastrado" : "—"));
      cell(tr, place?.Nome_Local_Fisico || locationStatus || "—");
      cell(tr, peopleMap.get(String(asset.ID_Responsavel ?? ""))?.Nome_Completo || asset.ID_Responsavel || "Não informado");
      cell(tr, asset.Situacao || asset.situacao || "Não informado");
      if (!locationComplete) tr.classList.add("location-incomplete");
      tr.classList.add("asset-result-row");
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-label", `Abrir ficha do bem ${asset.Tombamento}`);
      tr.addEventListener("click", () => openAssetDetail(asset.Tombamento));
      tr.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openAssetDetail(asset.Tombamento);
        }
      });
      const actionCell = document.createElement("td");
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "button button-secondary button-small";
      editButton.textContent = asset._demoBase ? "Registro original" : "Editar";
      editButton.disabled = Boolean(asset._demoBase);
      editButton.title = asset._demoBase ? "Registro original protegido contra edição" : "Editar este bem";
      editButton.addEventListener("click", event => {
        event.stopPropagation();
        openAssetForm(asset.Tombamento).catch(error => setMessage("assetFormMessage", error.message, "error"));
      });
      actionCell.append(editButton);
      tr.append(actionCell);
      tbody.append(tr);
    }
    setMessage("assetsMessage", `${filtered.length} bem(ns) encontrado(s). A localização é resolvida pelo setor; cadastros incompletos são identificados explicitamente.`);
  } catch (error) {
    setMessage("assetsMessage", `Falha na consulta: ${error.message}`, "error");
  }
}


let reportRows = [];
let reportLoaded = false;
const reportCurrency = value => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const reportStatus = asset => String(asset.Situacao ?? asset.situacao ?? "Não informado").trim();

async function loadReportOptions() {
  const [categories, sectors, units, people] = await Promise.all([
    getCollectionRows("categorias"), getCollectionRows("setores"), getCollectionRows("unidades"), getCollectionRows("responsaveis")
  ]);
  const fill = (id, rows, valueKey, labelKey, allLabel) => {
    const select = $(id), previous = select.value;
    select.replaceChildren(new Option(allLabel, ""));
    rows.slice().sort((a,b)=>String(a[labelKey]??"").localeCompare(String(b[labelKey]??""),"pt-BR")).forEach(row=>select.add(new Option(row[labelKey] || row[valueKey], String(row[valueKey] ?? ""))));
    if ([...select.options].some(o=>o.value===previous)) select.value=previous;
  };
  fill("reportCategory",categories,"ID_Categoria","Nome_Categoria","Todas");
  {
    const select=$("reportSector"), previous=select.value;
    select.replaceChildren(new Option("Todos",""));
    const unitById=new Map(units.map(u=>[String(u.ID_Unidade),u]));
    const floorById=new Map((await getCollectionRows("andares")).map(f=>[String(f.ID_Andar),f]));
    const placeById=new Map((await getCollectionRows("locais")).map(p=>[String(p.ID_Local),p]));
    sectors.slice().sort((a,b)=>String(a.Nome_Setor||"").localeCompare(String(b.Nome_Setor||""),"pt-BR")).forEach(sec=>{
      const place=placeById.get(String(sec.ID_Local_Atual||sec.ID_Local_Referencia||""));
      const floor=floorById.get(String(place?.ID_Andar||sec.ID_Andar||""));
      const unit=unitById.get(String(sec.ID_Unidade||floor?.ID_Unidade||place?.ID_Unidade||""));
      select.add(new Option(`${sec.Nome_Setor||sec.ID_Setor} — ${unit?.Nome_Unidade||"Unidade não identificada"}`,String(sec.ID_Setor)));
    });
    if([...select.options].some(o=>o.value===previous)) select.value=previous;
  }
  fill("reportUnit",units,"ID_Unidade","Nome_Unidade","Todas");
  fill("reportResponsible",people,"ID_Responsavel","Nome_Completo","Todos");
}

async function runGeneralReport() {
  setMessage("reportMessage","Consultando dados patrimoniais...");
  try {
    const [assets,categories,sectors,places,floors,units,people] = await Promise.all([
      getCollectionRows("bens"),getCollectionRows("categorias"),getCollectionRows("setores"),getCollectionRows("locais"),getCollectionRows("andares"),getCollectionRows("unidades"),getCollectionRows("responsaveis")
    ]);
    const catMap=new Map(categories.map(x=>[String(x.ID_Categoria??""),x.Nome_Categoria||"Não informado"]));
    const sectorMap=new Map(sectors.map(x=>[String(x.ID_Setor??""),x]));
    const placeMap=new Map(places.map(x=>[String(x.ID_Local??""),x]));
    const floorMap=new Map(floors.map(x=>[String(x.ID_Andar??""),x]));
    const unitMap=new Map(units.map(x=>[String(x.ID_Unidade??""),x]));
    const personMap=new Map(people.map(x=>[String(x.ID_Responsavel??""),x.Nome_Completo||"Não informado"]));
    const enriched=assets.map(a=>{
      const sector=sectorMap.get(String(a.ID_Setor??""));
      const place=placeMap.get(String(sector?.ID_Local_Atual??sector?.ID_Local_Referencia??a.ID_Local??""));
      const floor=floorMap.get(String(place?.ID_Andar??""));
      const unit=unitMap.get(String(place?.ID_Unidade??floor?.ID_Unidade??""));
      const rawValue=a.Valor_Aquisicao;
      const valueMissing=rawValue===null||rawValue===undefined||String(rawValue).trim()===""||!Number.isFinite(Number(rawValue));
      return {...a,_categoria:catMap.get(String(a.ID_Categoria??""))||String(a.ID_Categoria||"Não informado"),_setor:sector?.Nome_Setor||"Não informado",_unidade:unit?.Nome_Unidade||place?.Nome_Unidade||"Não informado",_unidadeId:String(unit?.ID_Unidade??place?.ID_Unidade??floor?.ID_Unidade??""),_andar:floor?.Nome_Andar||"Não informado",_local:place?.Nome_Local_Fisico||"Não informado",_responsavel:personMap.get(String(a.ID_Responsavel??""))||String(a.ID_Responsavel||"Não informado"),_situacao:reportStatus(a),_valorAusente:valueMissing,_valor:valueMissing?null:Number(rawValue)};
    });
    const term=$("reportSearch").value.trim().toLocaleLowerCase("pt-BR"), cat=$("reportCategory").value, unit=$("reportUnit").value, sector=$("reportSector").value, responsible=$("reportResponsible").value, status=$("reportStatus").value;
    reportRows=enriched.filter(a=>(!term||String(a.Tombamento??"").toLocaleLowerCase("pt-BR").includes(term)||String(a.Descricao_Bem??"").toLocaleLowerCase("pt-BR").includes(term))&&(!cat||String(a.ID_Categoria??"")===cat)&&(!unit||String(a._unidadeId)===unit)&&(!sector||String(a.ID_Setor??"")===sector)&&(!responsible||String(a.ID_Responsavel??"")===responsible)&&(!status||a._situacao===status));
    const sort=$("reportSort").value;
    reportRows.sort((a,b)=>{
      if(sort==="descricao") return String(a.Descricao_Bem??"").localeCompare(String(b.Descricao_Bem??""),"pt-BR");
      if(sort==="categoria") return String(a._categoria).localeCompare(String(b._categoria),"pt-BR");
      if(sort==="setor") return String(a._setor).localeCompare(String(b._setor),"pt-BR");
      return String(a.Tombamento??"").localeCompare(String(b.Tombamento??""),"pt-BR",{numeric:true});
    });
    $("reportCount").textContent=String(reportRows.length);
    $("reportActiveCount").textContent=String(reportRows.filter(a=>a._situacao==="Ativo").length);
    $("reportValue").textContent=reportCurrency(reportRows.reduce((sum,a)=>sum+(a._valorAusente?0:a._valor),0));
    $("reportMissingValue").textContent=String(reportRows.filter(a=>a._valorAusente).length);
    const body=$("reportTableBody"); body.replaceChildren();
    if(!reportRows.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=14;td.textContent="Nenhum bem corresponde aos filtros selecionados.";tr.append(td);body.append(tr);setMessage("reportMessage","Nenhum resultado. Ajuste os filtros para consultar outros bens.");}
    else {
      for(const a of reportRows){const tr=document.createElement("tr"); const values=[a.Tombamento,a.Descricao_Bem,a._categoria,a.Marca,a.Modelo,a.Numero_Serie??a.Numero_Serie_Bem,a._unidade,a._andar,a._local,a._setor,a._responsavel,a._situacao,a.Data_Aquisicao,a._valorAusente?"Não informado":reportCurrency(a._valor)]; values.forEach(v=>cell(tr,v??""));body.append(tr);}
      setMessage("reportMessage",`${reportRows.length} bem(ns) no relatório. ${reportRows.filter(a=>a._valorAusente).length} sem valor de aquisição informado.`);
    }
    reportLoaded=true;
  } catch(error){setMessage("reportMessage",`Não foi possível gerar o relatório: ${error.message}`,"error");}
}

function reportFiltersText(){
  const labels=[["Pesquisa",$("reportSearch").value||"Todas"],["Categoria",$("reportCategory").selectedOptions[0]?.textContent||"Todas"],["Unidade",$("reportUnit").selectedOptions[0]?.textContent||"Todas"],["Setor",$("reportSector").selectedOptions[0]?.textContent||"Todos"],["Responsável",$("reportResponsible").selectedOptions[0]?.textContent||"Todos"],["Situação",$("reportStatus").selectedOptions[0]?.textContent||"Todas"],["Ordenação",$("reportSort").selectedOptions[0]?.textContent||"Tombamento"]];
  return labels.map(([k,v])=>`${k}: ${v}`).join(" | ");
}
function exportGeneralReportExcel(){
  if(!reportLoaded) { setMessage("reportMessage","Atualize o relatório antes de exportar.","error"); return; }
  const fields=[["Tombamento","Tombamento"],["Descrição","Descricao_Bem"],["Categoria","_categoria"],["Marca","Marca"],["Modelo","Modelo"],["Número de série","Numero_Serie"],["Unidade","_unidade"],["Andar","_andar"],["Local físico","_local"],["Setor","_setor"],["Responsável","_responsavel"],["Situação","_situacao"],["Data de aquisição","Data_Aquisicao"],["Valor de aquisição (R$)","_valor"],["Observações","Observacoes"]];
  const xmlEscape = value => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
  const cellXml = value => {
    const numeric = typeof value === "number" && Number.isFinite(value);
    return `<Cell><Data ss:Type="${numeric?"Number":"String"}">${xmlEscape(value)}</Data></Cell>`;
  };
  const sheetXml = (name, matrix) => `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${matrix.map(row=>`<Row>${row.map(cellXml).join("")}</Row>`).join("")}</Table></Worksheet>`;
  const inventoryMatrix=[fields.map(([label])=>label),...reportRows.map(a=>fields.map(([label,key])=>key==="Numero_Serie"?(a.Numero_Serie??a.Numero_Serie_Bem??""):key==="_valor"?(a._valorAusente?"":a._valor):(a[key]??"")))];
  const summaryMatrix=[["Indicador","Valor"],["Quantidade de bens encontrados",reportRows.length],["Bens ativos",reportRows.filter(a=>a._situacao==="Ativo").length],["Valor de aquisição conhecido (R$)",reportRows.reduce((sum,a)=>sum+(a._valorAusente?0:a._valor),0)],["Bens sem valor informado",reportRows.filter(a=>a._valorAusente).length],["Data de geração",new Date().toLocaleString("pt-BR")],["Filtros aplicados",reportFiltersText()]];
  const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheetXml("Inventário",inventoryMatrix)}${sheetXml("Resumo",summaryMatrix)}</Workbook>`;
  const blob=new Blob([xml],{type:"application/vnd.ms-excel;charset=utf-8"});
  const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="Relatorio_Geral_Inventario.xls";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function exportGeneralReportPdf(){
  if(!reportLoaded){setMessage("reportMessage","Atualize o relatório antes de exportar.","error");return;}
  const filters=reportFiltersText(), generated=new Date().toLocaleString("pt-BR");
  const rows=reportRows.map(a=>[a.Tombamento,a.Descricao_Bem,a._categoria,a._unidade,a._andar,a._local,a._setor,a._responsavel,a._situacao,a._valorAusente?"Não informado":reportCurrency(a._valor)]);
  const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const tableRows=rows.map(r=>`<tr>${r.map(v=>`<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("");
  const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Geral do Inventário</title><style>@page{size:A4 landscape;margin:10mm}body{font:9px Arial,sans-serif;color:#172b3d}h1,h2,p{text-align:center;margin:4px}h1{font-size:16px}h2{font-size:12px}.meta{font-size:8px;text-align:left;margin:8px 0}.metrics{display:flex;justify-content:space-around;margin:10px 0;font-weight:bold}table{width:100%;border-collapse:collapse;table-layout:auto}th,td{border:1px solid #b8c7d4;padding:3px 4px;overflow-wrap:anywhere;word-break:normal;text-align:left}th{font-size:7px}td{font-size:7px}td:first-child{white-space:nowrap}th{background:#e8eef4}thead{display:table-header-group}tr{break-inside:avoid}footer{margin-top:8px;font-size:8px}</style></head><body><h1>PORTAL DE GESTÃO PATRIMONIAL</h1><h2>RELATÓRIO GERAL DO INVENTÁRIO PATRIMONIAL</h2><div class="meta">Gerado em: ${escapeHtml(generated)}<br>Filtros: ${escapeHtml(filters)}</div><div class="metrics"><span>Bens encontrados: ${reportRows.length}</span><span>Bens ativos: ${reportRows.filter(a=>a._situacao==="Ativo").length}</span><span>Valor conhecido: ${escapeHtml(reportCurrency(reportRows.reduce((sum,a)=>sum+(a._valorAusente?0:a._valor),0)))}</span><span>Sem valor: ${reportRows.filter(a=>a._valorAusente).length}</span></div><table><thead><tr>${["Tombamento","Descrição","Categoria","Unidade","Andar","Local físico","Setor","Responsável","Situação","Valor aquisição"].map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table><footer>Relatório gerado pelo Portal de Gestão Patrimonial.</footer><script>window.onload=()=>window.print()</script></body></html>`;
  const win=window.open("","_blank"); if(!win){setMessage("reportMessage","Permita pop-ups para gerar o PDF.","error");return;} win.document.open();win.document.write(html);win.document.close();
}

function detailField(label, value) {
  const box = document.createElement("div");
  box.className = "detail-field";
  const heading = document.createElement("span");
  heading.className = "detail-label";
  heading.textContent = label;
  const content = document.createElement("strong");
  content.textContent = value === null || value === undefined || String(value).trim() === "" ? "Não informado" : String(value);
  box.append(heading, content);
  return box;
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "Não informado";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function openAssetDetail(tombamento) {
  const modal = $("assetDetailModal");
  const content = $("assetDetailContent");
  const historyBox = $("assetHistoryContent");
  modal.hidden = false;
  modal.scrollIntoView({behavior:"smooth",block:"start"});
  content.replaceChildren();
  historyBox.replaceChildren();
  setMessage("assetDetailMessage", "Carregando ficha e histórico...");
  try {
    const [assets, categories, sectors, places, floors, units, people, moves, disposals, audit] = await Promise.all([
      getCollectionRows("bens"), getCollectionRows("categorias"),
      getCollectionRows("setores"), getCollectionRows("locais"),
      getCollectionRows("andares"), getCollectionRows("unidades"),
      getCollectionRows("responsaveis"), getCollectionRows("movimentacoes"),
      getCollectionRows("baixas"), getCollectionRows("auditoria")
    ]);
    const asset = assets.find(a => String(a.Tombamento) === String(tombamento));
    if (!asset) throw new Error("O bem não foi encontrado na base atual.");
    const category = categories.find(x => x.ID_Categoria === asset.ID_Categoria);
    const sector = sectors.find(x => x.ID_Setor === asset.ID_Setor);
    const localId = String(sector?.ID_Local_Atual ?? sector?.ID_Local_Referencia ?? asset.ID_Local ?? "");
    const place = places.find(x => String(x.ID_Local) === localId);
    const floor = floors.find(x => String(x.ID_Andar) === String(place?.ID_Andar ?? ""));
    const unitId = String(place?.ID_Unidade ?? floor?.ID_Unidade ?? "");
    const unit = units.find(x => String(x.ID_Unidade) === unitId);
    const person = people.find(x => String(x.ID_Responsavel) === String(asset.ID_Responsavel));
    const locationStatus = !place ? "Localização não cadastrada" : !floor ? "Andar não cadastrado" : !unit ? "Unidade não cadastrada" : "Localização completa";
    setMessage("assetDetailMessage", locationStatus, locationStatus === "Localização completa" ? "success" : "error");
    const fields = [
      ["Tombamento", asset.Tombamento], ["Descrição", asset.Descricao_Bem],
      ["Categoria", category?.Nome_Categoria ?? asset.ID_Categoria],
      ["Situação", asset.Situacao], ["Marca", asset.Marca], ["Modelo", asset.Modelo],
      ["Número de série", asset.Numero_Serie], ["Unidade / edifício", unit?.Nome_Unidade],
      ["Andar", floor?.Nome_Andar], ["Sala / local físico", place?.Nome_Local_Fisico],
      ["Setor", sector?.Nome_Setor ?? asset.ID_Setor], ["Responsável", person?.Nome_Completo ?? asset.ID_Responsavel],
      ["Data de aquisição", asset.Data_Aquisicao], ["Valor de aquisição", formatCurrency(asset.Valor_Aquisicao)],
      ["Observações", asset.Observacoes]
    ];
    for (const [label, value] of fields) content.append(detailField(label, value));
    const personName = value => value?.Nome_Completo || value?.nome || "Não informado";
    const sectorName = value => value?.Nome_Setor || value?.nome || "Não informado";
    const locationForSector = sec => {
      if (!sec) return "Não informado";
      const loc = places.find(x => String(x.ID_Local) === String(sec.ID_Local_Atual ?? sec.ID_Local_Referencia ?? ""));
      const fl = floors.find(x => String(x.ID_Andar) === String(loc?.ID_Andar ?? ""));
      const un = units.find(x => String(x.ID_Unidade) === String(loc?.ID_Unidade ?? fl?.ID_Unidade ?? ""));
      return [un?.Nome_Unidade, fl?.Nome_Andar, loc?.Nome_Local_Fisico].filter(Boolean).join(" — ") || "Localização não informada";
    };
    const directHistory = [...moves.map(x => {
      const from = x.originSectorSnapshot || sectors.find(s => String(s.ID_Setor) === String(x.setorOrigemId ?? x.ID_Setor_Origem ?? ""));
      const to = x.destinationSectorSnapshot || sectors.find(s => String(s.ID_Setor) === String(x.setorDestinoId ?? x.ID_Setor_Destino ?? ""));
      const fromPerson = x.originResponsibleSnapshot || people.find(p => String(p.ID_Responsavel) === String(x.responsavelAnteriorId ?? ""));
      const toPerson = x.destinationResponsibleSnapshot || people.find(p => String(p.ID_Responsavel) === String(x.responsavelNovoId ?? ""));
      const isTransfer = String(x.tipo || "").toUpperCase() === "TRANSFERENCIA";
      const details = isTransfer
        ? `Origem: ${sectorName(from) !== "Não informado" ? sectorName(from) : x.setorOrigemNome || "Não informado"} (${locationForSector(from)}); responsável anterior: ${personName(fromPerson)}. Destino: ${sectorName(to) !== "Não informado" ? sectorName(to) : x.setorDestinoNome || "Não informado"} (${locationForSector(to)}); novo responsável: ${personName(toPerson)}.`
        : (x.descricao || x.operacao || x.acao || "Detalhes adicionais não registrados.");
      return {...x, _kind: x.tipo === "MUDANCA_LOCALIZACAO_SETOR" ? "Mudança de localização do setor" : isTransfer ? "Transferência patrimonial" : "Movimentação",
        _historyDescription: `${details}${x.motivo || x.reason ? ` Motivo: ${x.motivo || x.reason}.` : ""}${x.observacoes || x.notes ? ` Observações: ${x.observacoes || x.notes}.` : ""}`};
    }),
      ...disposals.map(x => ({...x, _kind:"Baixa", _historyDescription:`Motivo da baixa: ${x.motivo || x.reason || "Não informado"}.${x.observacoes || x.notes ? ` Observações: ${x.observacoes || x.notes}.` : ""}`})),
      ...audit.map(x => ({...x, _kind:"Auditoria", _historyDescription:`${x.descricao || x.operacao || x.acao || x.motivo || "Registro de auditoria"}${x.observacoes ? ` · ${x.observacoes}` : ""}`}))]
      .filter(x => String(x.Tombamento ?? x.tombamento ?? x.ID_Bem ?? x.idBem ?? "") === String(tombamento));
    // Mudanças futuras do setor guardam um retrato dos tombamentos afetados no momento da operação.
    // Não associamos eventos antigos apenas pelo setor atual, pois isso poderia inventar vínculos históricos.
    const indirectSectorHistory = moves
      .filter(x => x.tipo === "MUDANCA_LOCALIZACAO_SETOR"
        && Array.isArray(x.bensAfetados)
        && x.bensAfetados.some(id => String(id) === String(tombamento)))
      .map(x => ({...x, _kind:"Mudança indireta de localização (setor)", _indirect:true,
        _historyDescription:`Setor: ${x.setorOrigemNome || x.originSectorSnapshot?.Nome_Setor || "Origem não informada"} (responsável: ${x.originResponsibleSnapshot?.Nome_Completo || x.responsavelOrigemNome || "Não informado"}) → Setor: ${x.setorDestinoNome || x.destinationSectorSnapshot?.Nome_Setor || "Destino não informado"} (responsável: ${x.destinationResponsibleSnapshot?.Nome_Completo || x.responsavelDestinoNome || "Não informado"})${x.motivo || x.reason ? ` · Motivo: ${x.motivo || x.reason}` : ""}${x.observacoes || x.notes ? ` · Observações: ${x.observacoes || x.notes}` : ""}`}));
    const related = [...directHistory, ...indirectSectorHistory];
    if (!related.length) {
      const p = document.createElement("p");
      p.className = "small-note";
      p.textContent = "Nenhum registro de histórico encontrado para este bem.";
      historyBox.append(p);
    } else {
      related.sort((a,b) => {
        const timestamp = item => {
          const value = item.dataHora ?? item.criadoEm ?? item.data;
          if (value?.seconds) return value.seconds * 1000;
          return Date.parse(value ?? 0) || 0;
        };
        const av = timestamp(a);
        const bv = timestamp(b);
        return bv-av;
      });
      const list = document.createElement("ul");
      list.className = "history-list";
      for (const item of related) {
        const li = document.createElement("li");
        const title = document.createElement("strong");
        title.textContent = item._kind;
        const desc = document.createElement("p");
        desc.textContent = item._historyDescription || item.motivo || item.descricao || item.operacao || item.acao || item.observacoes || "Registro histórico disponível.";
        const meta = document.createElement("small");
        const rawWhen = item.dataHora ?? item.criadoEm ?? item.data ?? item.transferDate;
        const when = formatBrazilDateTime(rawWhen);
        meta.textContent = `${when} · ${item.usuarioNome || item.usuarioEmail || item.criadoPor || "Usuário não informado"}`;
        li.append(title, desc, meta); list.append(li);
      }
      historyBox.append(list);
    }
  } catch (error) {
    setMessage("assetDetailMessage", `Não foi possível carregar a ficha: ${error.message}`, "error");
    const p = document.createElement("p");
    p.textContent = "Confira os dados locais e as referências relacionadas.";
    historyBox.append(p);
  }
}

$("closeAssetDetailBtn")?.addEventListener("click", () => { $("assetDetailModal").hidden = true; });
$("assetDetailModal")?.addEventListener("click", event => {
});


let transferAssets = [];
let transferSectors = [];
let transferPeople = [];
let transferPlaces = [];
let transferFloors = [];
let transferUnits = [];

function sectorLocationLabel(sector) {
  if (!sector) return "Setor não cadastrado";
  const localId = String(sector.ID_Local_Atual ?? sector.ID_Local_Referencia ?? "");
  const place = transferPlaces.find(x => String(x.ID_Local) === localId);
  const floor = transferFloors.find(x => String(x.ID_Andar) === String(place?.ID_Andar ?? ""));
  const unit = transferUnits.find(x => String(x.ID_Unidade) === String(place?.ID_Unidade ?? floor?.ID_Unidade ?? ""));
  if (!place || !floor || !unit) return `${sector.Nome_Setor || sector.ID_Setor} — localização incompleta`;
  return `${unit.Nome_Unidade} — ${floor.Nome_Andar} — ${place.Nome_Local_Fisico}`;
}


function normalizeSearchText(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function showSearchResults(containerId, records, query, getTitle, getDetail, onSelect, selectedValue = "") {
  const container = $(containerId);
  if (!container) return;
  container.replaceChildren();
  const q = normalizeSearchText(query);
  if (!q) return;
  const matches = records.filter(record => normalizeSearchText(`${getTitle(record)} ${getDetail(record)}`).includes(q)).slice(0, 30);
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "search-results-empty";
    empty.textContent = "Nenhum registro encontrado para a pesquisa informada.";
    container.append(empty);
    return;
  }
  for (const record of matches) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "search-result-option";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(String(record.value) === String(selectedValue)));
    const title = document.createElement("span");
    title.className = "search-result-title";
    title.textContent = getTitle(record);
    option.append(title);
    const detailText = getDetail(record);
    if (detailText) {
      const detail = document.createElement("span");
      detail.className = "search-result-detail";
      detail.textContent = detailText;
      option.append(detail);
    }
    option.addEventListener("click", () => {
      onSelect(record);
      container.replaceChildren();
    });
    container.append(option);
  }
}

async function loadTransferView() {
  const [assets, sectors, people, places, floors, units] = await Promise.all([
    getCollectionRows("bens"), getCollectionRows("setores"), getCollectionRows("responsaveis"),
    getCollectionRows("locais"), getCollectionRows("andares"), getCollectionRows("unidades")
  ]);
  transferAssets = assets.filter(a => a.Situacao !== "Baixado");
  window.__gpCategories = await getCollectionRows("categorias");
  transferSectors = sectors.filter(x => x.Ativo !== false && x.Ativo !== "Não");
  transferPeople = people.filter(x => x.Ativo !== false && x.Ativo !== "Não");
  transferPlaces = places; transferFloors = floors; transferUnits = units;
  renderIssuers();
  const assetSelect = $("transferAsset");
  assetSelect.replaceChildren(new Option("Selecione um bem", ""));
  for (const a of transferAssets) assetSelect.add(new Option(`${a.Tombamento} — ${a.Descricao_Bem}`, String(a.Tombamento)));
  const sectorSelect = $("transferSector");
  sectorSelect.replaceChildren(new Option("Selecione o setor de destino", ""));
  for (const sec of transferSectors) sectorSelect.add(new Option(`${sec.Nome_Setor} — ${sectorLocationLabel(sec)}`, sec.ID_Setor));
  $("transferAssetSearch").value = "";
  $("transferSectorSearch").value = "";
  $("transferAssetResults").replaceChildren();
  $("transferSectorResults").replaceChildren();
  updateTransferOrigin();
  updateTransferDestination();
  /* Histórico centralizado em Consultar operações. */
}
function transferAssetSearchText(asset) {
  const sector = transferSectors.find(x => String(x.ID_Setor) === String(asset.ID_Setor));
  const person = transferPeople.find(x => String(x.ID_Responsavel) === String(asset.ID_Responsavel));
  return [asset.Tombamento, asset.Numero_Serie, asset.Descricao_Bem, asset.Marca, asset.Modelo,
    asset.Categoria, sector?.Nome_Setor, sectorLocationLabel(sector), person?.Nome_Completo].filter(Boolean).join(" ");
}
$("transferAssetSearch")?.addEventListener("input", event => {
  showSearchResults("transferAssetResults", transferAssets.map(a => ({value:String(a.Tombamento), asset:a})),
    event.target.value, r => `${r.asset.Tombamento} — ${r.asset.Descricao_Bem}`,
    r => transferAssetSearchText(r.asset), r => {
      $("transferAsset").value = r.value;
      $("transferAssetSearch").value = `${r.asset.Tombamento} — ${r.asset.Descricao_Bem}`;
      updateTransferOrigin();
    }, $("transferAsset").value);
});
$("transferSectorSearch")?.addEventListener("input", event => {
  showSearchResults("transferSectorResults", transferSectors.map(s => ({value:String(s.ID_Setor), sector:s})),
    event.target.value, r => r.sector.Nome_Setor,
    r => sectorLocationLabel(r.sector), r => {
      $("transferSector").value = r.value;
      $("transferSectorSearch").value = `${r.sector.Nome_Setor} — ${sectorLocationLabel(r.sector)}`;
      updateTransferDestination();
    }, $("transferSector").value);
});

function updateTransferOrigin() {
  const a = transferAssets.find(x => String(x.Tombamento) === $("transferAsset").value);
  const sec = transferSectors.find(x => String(x.ID_Setor) === String(a?.ID_Setor ?? ""));
  const box = $("transferOrigin");
  box.replaceChildren();
  const title = document.createElement("strong"); title.textContent = "Origem atual";
  const p = document.createElement("p");
  p.textContent = a ? `${sec?.Nome_Setor || "Setor não cadastrado"} — ${sectorLocationLabel(sec)} · Responsável: ${transferPeople.find(x => String(x.ID_Responsavel) === String(a.ID_Responsavel))?.Nome_Completo || "Não informado"}` : "Selecione um bem para consultar a origem.";
  box.append(title,p);
}

function updateTransferDestination() {
  const sec = transferSectors.find(x => String(x.ID_Setor) === $("transferSector").value);
  const box = $("transferDestination");
  box.replaceChildren();
  const title = document.createElement("strong"); title.textContent = "Destino";
  const p = document.createElement("p"); p.textContent = sec ? `${sec.Nome_Setor} — ${sectorLocationLabel(sec)}` : "Selecione um setor para consultar sua localização.";
  box.append(title,p);
}

$("transferAsset")?.addEventListener("change", updateTransferOrigin);
$("transferSector")?.addEventListener("change", updateTransferDestination);
let pendingTransfer = null;
let lastConfirmedTransfer = null;

function reviewItem(label, value, wide = false) {
  const item = document.createElement("div");
  item.className = `transfer-review-item${wide ? " transfer-review-wide" : ""}`;
  const labelEl = document.createElement("span");
  labelEl.className = "transfer-review-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("strong");
  valueEl.textContent = value || "Não informado";
  item.append(labelEl, valueEl);
  return item;
}

function showTransferReview(data) {
  const card = $("transferReviewCard");
  const content = $("transferReviewContent");
  content.replaceChildren();
  const fromSector = transferSectors.find(x => String(x.ID_Setor) === String(data.asset.ID_Setor));
  const currentResponsible = transferPeople.find(x => String(x.ID_Responsavel) === String(data.asset.ID_Responsavel));
  const manager = readLocalJson(INSTITUTIONAL_KEY, {});
  const issuer = data.issuerSnapshot || readLocalJson(ISSUERS_KEY, []).find(x => x.id === $("transferIssuer")?.value);
  content.append(
    reviewItem("Tombamento", data.asset.Tombamento),
    reviewItem("Descrição do bem", data.asset.Descricao_Bem),
    reviewItem("Setor de origem", fromSector?.Nome_Setor || data.asset.ID_Setor),
    reviewItem("Localização de origem", sectorLocationLabel(fromSector), true),
    reviewItem("Setor de destino", data.destinationSector.Nome_Setor),
    reviewItem("Localização de destino", sectorLocationLabel(data.destinationSector), true),
    reviewItem("Responsável atual", currentResponsible?.Nome_Completo),
    reviewItem("Responsável no destino", data.destinationResponsible?.Nome_Completo || "Não informado"),
    reviewItem("Responsável pelo Patrimônio", manager.name ? `${manager.name}${manager.role ? ` — ${manager.role}` : ""}` : "Não configurado"),
    reviewItem("Pessoa autorizada a emitir o documento", issuer?.name ? `${issuer.name}${issuer.role ? ` — ${issuer.role}` : ""}` : "Não selecionada"),
    reviewItem("Motivo", data.reason),
    reviewItem("Observações", data.notes || "Nenhuma observação", true)
  );
  card.hidden = false;
  $("finalConfirmTransferBtn").focus();
  card.scrollIntoView({behavior:"smooth",block:"center"});
}

function downloadTransferTermPdf(data) {
  const asset = data.assetSnapshot || data.asset;
  const from = data.originSectorSnapshot || transferSectors.find(x => String(x.ID_Setor) === String(asset?.ID_Setor));
  const to = data.destinationSectorSnapshot || data.destinationSector || transferSectors.find(x => String(x.ID_Setor) === String(data.ID_Setor_Destino ?? data.setorDestinoId));
  const fromPerson = data.originResponsibleSnapshot || transferPeople.find(x => String(x.ID_Responsavel) === String(asset?.ID_Responsavel));
  const toPerson = data.destinationResponsibleSnapshot || data.destinationResponsible || transferPeople.find(x => String(x.ID_Responsavel) === String(data.ID_Responsavel_Destino ?? data.responsavelDestinoId));
  if (!asset || !from || !to) { setMessage("transferMessage", "Não foi possível recuperar todos os dados desta transferência para gerar o termo.", "error"); return; }
  const cat = (window.__gpCategories || []).find(x => String(x.ID_Categoria) === String(asset.ID_Categoria));
  const date = new Date(data.transferDate || data.criadoEm || Date.now());
  const dateText = date.toLocaleDateString("pt-BR");
  const timeText = date.toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"});
  const transferId = data.transferId || data._id || `TR-${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  const fromLoc = sectorLocationLabel(from).split(" — ");
  const toLoc = sectorLocationLabel(to).split(" — ");
  const clean = v => String(v ?? "Não informado").replace(/\s+/g," ").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g,"-");
  const money = formatCurrency(asset.Valor_Aquisicao);
  const lines = [
    {type:"title", text:"TERMO DE TRANSFERENCIA DE BEM PATRIMONIAL"},
    {type:"sub", text:"Documento para conferencia e assinatura"},
    {type:"para", text:"Registra-se a transferencia de responsabilidade e localizacao do bem patrimonial entre os setores cedente e recebedor. As partes conferem as informacoes e formalizam a movimentacao por meio das assinaturas."},
    {type:"head", text:"1. IDENTIFICACAO DO BEM"},
    ...[["Nº de tombamento",asset.Tombamento],["Nº de serie",asset.Numero_Serie??asset.Numero_Serie_Bem],["Descricao",asset.Descricao_Bem],["Categoria",cat?.Nome_Categoria || asset.Nome_Categoria],["Marca / Modelo",`${asset.Marca||"Nao informado"} / ${asset.Modelo||"Nao informado"}`],["Valor patrimonial",money]].map(([a,b])=>({type:"row",label:a,value:b})),
    {type:"head",text:"2. ORIGEM — SETOR CEDENTE"},
    ...[["Unidade",fromLoc[0]],["Pavimento",fromLoc[1]],["Setor",from.Nome_Setor],["Ambiente",fromLoc[2]],["Responsavel pelo setor",fromPerson?.Nome_Completo],["Data e hora da transferencia",`${dateText} — ${timeText}`]].map(([a,b])=>({type:"row",label:a,value:b})),
    {type:"head",text:"3. DESTINO — SETOR RECEBEDOR"},
    ...[["Unidade",toLoc[0]],["Pavimento",toLoc[1]],["Setor",to.Nome_Setor],["Ambiente",toLoc[2]],["Responsavel pelo setor",toPerson?.Nome_Completo],["Registro da transferencia",transferId]].map(([a,b])=>({type:"row",label:a,value:b})),
    {type:"head",text:"4. DECLARACOES E OBSERVACOES"},
    {type:"para",text:"O responsavel cedente declara entregar o bem descrito, e o responsavel recebedor declara recebe-lo no local de destino indicado. A movimentacao fica registrada no sistema patrimonial, preservando seu historico."},
    ...[["Motivo",data.motivo || data.reason],["Observacoes",data.observacoes ?? data.notes ?? "Sem observacoes adicionais."]].map(([a,b])=>({type:"row",label:a,value:b})),
    {type:"head",text:"5. ASSINATURAS"},
    {type:"sign",label:"Responsável cedente",value:fromPerson?.Nome_Completo},
    {type:"sign",label:"Responsável recebedor",value:toPerson?.Nome_Completo},
    {type:"sign",label:"Responsável pela emissão do documento",value:data.issuerSnapshot?.name,role:data.issuerSnapshot?.role},
    {type:"sign",label:"Gestor patrimonial / conferência",value:data.patrimonyManagerSnapshot?.name,role:data.patrimonyManagerSnapshot?.role},
    ...(data.includeWitness ? [{type:"sign",label:"Testemunha (se aplicável)",value:data.witnessSnapshot?.name}] : []),
    {type:"foot",text:"DeLunaTech - Tecnologia que simplifica. | Modelo demonstrativo"}
  ];
  // PDF A4 de uma pagina, gerado localmente sem pop-up ou dependencia externa.
  const W=595.28,H=841.89, ops=[]; let y=H-30;
  const escPdf=t=>clean(t).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
  const text=(x,yy,size,t,bold=false)=>{ops.push(`0.08 0.15 0.27 rg BT /${bold?"F2":"F1"} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td (${escPdf(t)}) Tj ET`)};
  const line=(x1,y1,x2,y2)=>ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  ops.push("0.08 0.15 0.27 rg 0.08 0.15 0.27 RG 0.7 w");
  const wrap=(t,max)=>{const words=clean(t).split(/\s+/);let out=[],cur="";for(const word of words){if((cur+" "+word).trim().length>max&&cur){out.push(cur);cur=word}else cur=(cur?cur+" ":"")+word}if(cur)out.push(cur);return out};
  for(const item of lines){
    if(item.type==="title"){text(55,y,13,item.text,true);y-=16;line(40,y,W-40,y);y-=13;}
    else if(item.type==="sub"){text(55,y,8,item.text);y-=13;}
    else if(item.type==="para"){for(const l of wrap(item.text,112)){text(42,y,7.5,l);y-=9}y-=3;}
    else if(item.type==="head"){y-=1;ops.push("0.91 0.95 1 rg");ops.push(`40 ${y-3} ${W-80} 13 re f`);ops.push("0.03 0.40 0.95 RG 2 w");line(40,y-3,40,y+10);ops.push("0.08 0.15 0.27 RG 0.7 w");text(47,y,8,item.text,true);y-=16;}
    else if(item.type==="row"){const label=clean(item.label), value=clean(item.value||"Nao informado");ops.push("0.79 0.84 0.90 RG 0.45 w");line(40,y-3,W-40,y-3);text(45,y+2,7,label,true);const vals=wrap(value,78);vals.slice(0,2).forEach((v,i)=>text(190,y+2-i*8,7,v));y-=Math.max(12, vals.length>1?17:12);}
    else if(item.type==="sign"){
      text(45,y,item.label.length>42?7:7.5,clean(item.label),true); y-=13;
      text(45,y,7,`Cargo/função: ${clean(item.role||"")}`); y-=12;
      text(45,y,7,"Data: ____/____/________"); y-=15;
      line(45,y,300,y); y-=10;
      const signer=clean(item.value||"Nome não informado");
      text(Math.max(45,172-signer.length*1.8),y,7.5,signer,true); y-=25;
    }
    else if(item.type==="foot"){y-=2;text(40,y,6.5,item.text);}
  }
  const stream=ops.join("\n");
  const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>",`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf="%PDF-1.4\n", offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`});
  const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(o=>`${String(o).padStart(10,"0")} 00000 n \n`).join("")+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const blob=new Blob([new TextEncoder().encode(pdf)],{type:"application/pdf"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`Termo-Transferencia-${clean(asset.Tombamento).replace(/[^A-Za-z0-9-]/g,"")||"Patrimonial"}.pdf`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  setMessage("transferMessage","O termo foi gerado e o download do PDF foi iniciado.","success");
}

async function loadTransferHistory() {
  const host = $("transferHistoryList"); if (!host) return;
  host.replaceChildren();
  const records = (await getCollectionRows("movimentacoes"))
    .filter(item => item.tipo === "TRANSFERENCIA")
    .sort((a,b) => String(b.transferDate || b.criadoEm || "").localeCompare(String(a.transferDate || a.criadoEm || "")));
  if (!records.length) { const p=document.createElement("p"); p.textContent="Ainda não há transferências registradas."; host.append(p); return; }
  for (const record of records) {
    const card=document.createElement("article"); card.className="transfer-history-item";
    const info=document.createElement("div");
    const title=document.createElement("strong"); title.textContent=`${record.Tombamento || "Bem sem tombamento"} — ${record.Descricao_Bem || record.assetSnapshot?.Descricao_Bem || "Bem patrimonial"}`;
    const detail=document.createElement("p");
    const date=new Date(record.transferDate || record.criadoEm);
    detail.textContent=`${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} · ${record.setorOrigemNome || "Origem não informada"} → ${record.setorDestinoNome || "Destino não informado"} · Motivo: ${record.motivo || "Não informado"}`;
    info.append(title,detail);
    const button=document.createElement("button"); button.type="button"; button.className="button button-primary"; button.textContent="Baixar termo PDF";
    button.addEventListener("click",()=>downloadTransferTermPdf(record));
    card.append(info,button); host.append(card);
  }
}

$("generateTransferTermBtn")?.addEventListener("click", () => { if (lastConfirmedTransfer) downloadTransferTermPdf(lastConfirmedTransfer); });
$("skipTransferTermBtn")?.addEventListener("click", () => { $("transferTermPrompt").hidden = true; });
$("refreshTransferHistoryBtn")?.addEventListener("click", () => loadTransferHistory().catch(error => setMessage("transferMessage", `Não foi possível carregar o histórico: ${error.message}`, "error")));

$("transferForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const asset = transferAssets.find(x => String(x.Tombamento) === $("transferAsset").value);
  const destinationSector = transferSectors.find(x => String(x.ID_Setor) === $("transferSector").value);
  const reason = $("transferReason").value;
  const notes = $("transferNotes").value.trim();
  const issuer = readLocalJson(ISSUERS_KEY, []).find(x=>x.id===$("transferIssuer").value && x.active!==false);
  if (!asset || !destinationSector || !reason || !issuer) {
    setMessage("transferMessage","Informe o bem, o setor de destino, o motivo e o responsável pela emissão do documento.","error"); return;
  }
  if (String(asset.ID_Setor) === String(destinationSector.ID_Setor)) {
    setMessage("transferMessage","O setor de destino é igual ao setor atual. Escolha outro setor.","error"); return;
  }
  const currentSector = transferSectors.find(x => String(x.ID_Setor) === String(asset.ID_Setor));
  const currentPerson = transferPeople.find(x => String(x.ID_Responsavel) === String(asset.ID_Responsavel));
  const destinationPeople = transferPeople.filter(x => String(x.ID_Setor_Vinculo ?? "") === String(destinationSector.ID_Setor));
  const destinationResponsible = destinationPeople[0] || currentPerson || null;
  pendingTransfer = {
    asset: {...asset, _origemNome: currentSector?.Nome_Setor ?? asset.ID_Setor},
    destinationSector, destinationResponsible, reason, notes, issuerSnapshot:{...issuer}, user: currentUser
  };
  showTransferReview(pendingTransfer);
  setMessage("transferMessage","Confira os dados no cartão de revisão. A transferência ainda não foi realizada.");
});

$("editTransferBtn")?.addEventListener("click", () => {
  pendingTransfer = null;
  $("transferReviewCard").hidden = true;
  $("transferMessage").textContent = "Você pode corrigir os dados antes de confirmar.";
  $("transferForm").scrollIntoView({behavior:"smooth",block:"start"});
});

$("finalConfirmTransferBtn")?.addEventListener("click", async () => {
  if (!pendingTransfer) return;
  const btn = $("finalConfirmTransferBtn");
  btn.disabled = true;
  $("editTransferBtn").disabled = true;
  setMessage("transferMessage","Registrando transferência...");
  try {
    const now = new Date();
    const transferData = { ...pendingTransfer,
      transferId:`TR-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}-${String(Date.now()).slice(-4)}`,
      transferDate:now.toISOString(),
      originSectorSnapshot: transferSectors.find(x => String(x.ID_Setor) === String(pendingTransfer.asset.ID_Setor)) || null,
      originResponsibleSnapshot: transferPeople.find(x => String(x.ID_Responsavel) === String(pendingTransfer.asset.ID_Responsavel)) || null,
      destinationSectorSnapshot: { ...pendingTransfer.destinationSector },
      destinationResponsibleSnapshot: pendingTransfer.destinationResponsible ? { ...pendingTransfer.destinationResponsible } : null,
      issuerSnapshot: pendingTransfer.issuerSnapshot ? {...pendingTransfer.issuerSnapshot} : null,
      patrimonyManagerSnapshot: {...readLocalJson(INSTITUTIONAL_KEY, {})}
    };
    lastConfirmedTransfer = await recordAssetTransfer(transferData);
    pendingTransfer = null;
    $("transferReviewCard").hidden = true;
    $("transferForm").reset();
    $("transferTermPrompt").hidden = false;
    setMessage("transferMessage","Transferência registrada com sucesso. Você pode consultar os dados e recuperar o termo em Consultar operações.","success");
    await loadTransferView();
    $("transferTermPrompt").hidden = false;
    await refreshDashboard();
    await searchAssets();
  } catch (error) {
    setMessage("transferMessage",`Não foi possível concluir a transferência: ${error.message}`,"error");
  } finally {
    btn.disabled = false;
    $("editTransferBtn").disabled = false;
  }
});



let disposalAssets = [];
let pendingDisposal = null;

async function loadDisposalView() {
  if (currentProfile?.perfil !== "ADM") throw new Error("Somente ADM pode registrar baixa patrimonial.");
  disposalAssets = (await getCollectionRows("bens")).filter(a => a.Situacao !== "Baixado");
  const [disposalSectors, disposalPeople] = await Promise.all([getCollectionRows("setores"), getCollectionRows("responsaveis")]);
  sectorLocationData = {...(sectorLocationData || {}), sectors: disposalSectors, people: disposalPeople};
  const select = $("disposalAsset");
  select.replaceChildren(new Option("Selecione um bem", ""));
  for (const asset of disposalAssets) select.add(new Option(`${asset.Tombamento} — ${asset.Descricao_Bem}`, String(asset.Tombamento)));
  $("disposalAssetSearch").value = "";
  $("disposalAssetResults").replaceChildren();
  updateDisposalAssetSummary();
  /* Histórico centralizado em Consultar operações. */
}


async function renderDisposalHistory() {
  const list = $("disposalHistoryList");
  if (!list) return;
  const [records, assets, sectors, people] = await Promise.all([
    getCollectionRows("baixas"), getCollectionRows("bens"),
    getCollectionRows("setores"), getCollectionRows("responsaveis")
  ]);
  const query = ($("disposalHistorySearch")?.value || "").trim().toLocaleLowerCase("pt-BR");
  const sorted = [...records].sort((a,b) => new Date(b.criadoEm || b.dataHora || b.timestamp || 0) - new Date(a.criadoEm || a.dataHora || a.timestamp || 0));
  const matches = sorted.filter(record => {
    const asset = assets.find(a => String(a.Tombamento) === String(record.Tombamento));
    const sector = sectors.find(x => String(x.ID_Setor) === String(record.setorId || asset?.ID_Setor));
    const person = people.find(x => String(x.ID_Responsavel) === String(record.responsavelId || asset?.ID_Responsavel));
    const text = [record.Tombamento, record.Descricao_Bem, asset?.Descricao_Bem, record.motivo,
      record.documentoAutorizacao, record.observacoes, sector?.Nome_Setor, person?.Nome_Completo].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    return text.includes(query);
  });
  list.replaceChildren();
  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "small-note";
    empty.textContent = query ? "Nenhuma baixa corresponde à pesquisa." : "Nenhuma baixa patrimonial registrada.";
    list.append(empty); return;
  }
  matches.forEach(record => {
    const item = document.createElement("article"); item.className = "transfer-history-item disposal-history-item";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${record.Tombamento || "Sem tombamento"} — ${record.Descricao_Bem || "Bem patrimonial"}`;
    const details = document.createElement("p");
    const asset = assets.find(a => String(a.Tombamento) === String(record.Tombamento));
    const sector = sectors.find(x => String(x.ID_Setor) === String(record.setorId || asset?.ID_Setor));
    const person = people.find(x => String(x.ID_Responsavel) === String(record.responsavelId || asset?.ID_Responsavel));
    details.textContent = `Baixa: ${record.motivo || "Motivo não informado"} · Setor: ${sector?.Nome_Setor || "Não informado"} · Responsável: ${person?.Nome_Completo || "Não informado"}`;
    const metadata = document.createElement("p");
    metadata.textContent = `Processo/documento: ${record.documentoAutorizacao || "Não informado"} · ${formatBrazilDateTime(record.criadoEm || record.dataHora || record.timestamp)}`;
    info.append(title, details, metadata);
    const download = document.createElement("button");
    download.type = "button"; download.className = "button button-primary"; download.textContent = "Baixar documento";
    download.addEventListener("click", () => downloadDisposalDocument(record, asset, sector, person));
    item.append(info, download); list.append(item);
  });
}

function downloadDisposalDocument(record, asset, sector, person) {
  const value = v => String(v ?? "Não informado").replace(/\s+/g, " ").trim() || "Não informado";
  const date = new Date(record.criadoEm || record.dataHora || record.timestamp || Date.now());
  const dateText = Number.isNaN(date.getTime()) ? "Não informado" : `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"})}`;
  const data = [
    ["Tombamento", value(record.Tombamento)],
    ["Descrição do bem", value(record.Descricao_Bem || asset?.Descricao_Bem)],
    ["Categoria", value(asset?.Nome_Categoria || asset?.Categoria || asset?.ID_Categoria)],
    ["Marca / modelo", value([asset?.Marca, asset?.Modelo].filter(Boolean).join(" / "))],
    ["Número de série", value(asset?.Numero_Serie || asset?.NumeroSerie)],
    ["Situação anterior", value(record.situacaoAnterior || "Ativo")],
    ["Situação após a baixa", value(record.situacaoNova || "Baixado")],
    ["Motivo da baixa", value(record.motivo)],
    ["Documento / processo", value(record.documentoAutorizacao)],
    ["Setor de vínculo", value(sector?.Nome_Setor)],
    ["Responsável vinculado", value(person?.Nome_Completo)],
    ["Data e hora do registro", dateText],
    ["Observações", value(record.observacoes || "Nenhuma observação informada")]
  ];
  // PDF vetorial em padrão institucional; codificação WinAnsi preserva acentos em português.
  const commands = [];
  const text = (x,y,size,str,font="F1",color="0.12 0.17 0.27") => {
    const escaped = String(str).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)").replace(/[\r\n]/g," ");
    commands.push(`${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${escaped}) Tj ET`);
  };
  const rect = (x,y,w,h,color) => commands.push(`${color} rg ${x} ${y} ${w} ${h} re f`);
  const line = (x1,y1,x2,y2,color="0.78 0.82 0.88",width=0.7) => commands.push(`${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  // A4 portrait, margins 42 pt.
  rect(0, 786, 595, 56, "0.04 0.08 0.19");
  rect(42, 800, 34, 28, "0.15 0.39 0.96");
  text(49, 809, 12, "DL", "F2", "1 1 1");
  text(88, 818, 9, "DeLunaTech", "F2", "1 1 1");
  text(88, 802, 7.5, "TECNOLOGIA QUE SIMPLIFICA.", "F1", "0.78 0.87 1");
  text(42, 756, 17, "TERMO DE BAIXA PATRIMONIAL", "F2", "0.04 0.08 0.19");
  text(42, 739, 8.5, "REGISTRO ADMINISTRATIVO DE MOVIMENTAÇÃO PATRIMONIAL", "F2", "0.25 0.31 0.42");
  line(42, 728, 553, 728, "0.15 0.39 0.96", 1.4);
  rect(42, 686, 511, 28, "0.93 0.95 0.99");
  text(54, 697, 9, "IDENTIFICAÇÃO E REGISTRO DA BAIXA", "F2", "0.04 0.08 0.19");
  let y = 666;
  const left = 42, right = 553, colGap = 18, colW = (right-left-colGap)/2;
  const wrap = (str, max=54) => {
    const words = String(str).split(/\s+/); const out=[]; let current="";
    for (const word of words) { const next=current ? `${current} ${word}` : word; if(next.length>max && current){out.push(current);current=word;}else current=next; }
    if(current) out.push(current); return out;
  };
  const drawField = (label, val, x, yy, width, full=false) => {
    text(x, yy, 7.5, label.toLocaleUpperCase("pt-BR"), "F2", "0.36 0.41 0.51");
    const max = Math.max(18, Math.floor(width / 5.1)); const wrapped = wrap(val, max);
    wrapped.slice(0,3).forEach((part,i)=>text(x, yy-13-(i*11), 9, part, "F1", "0.10 0.14 0.22"));
    const h = 22 + Math.min(wrapped.length,3)*11;
    line(x, yy-h, x+width, yy-h, "0.86 0.88 0.92", 0.45);
    return h + 8;
  };
  const fields = data;
  for (let i=0; i<fields.length;) {
    const full = [1,7,12].includes(i);
    if (full) { y -= drawField(fields[i][0], fields[i][1], left, y, right-left, true); i++; }
    else {
      const h1 = drawField(fields[i][0], fields[i][1], left, y, colW);
      const h2 = i+1<fields.length && ![1,7,12].includes(i+1) ? drawField(fields[i+1][0], fields[i+1][1], left+colW+colGap, y, colW) : 0;
      y -= Math.max(h1,h2); i += h2 ? 2 : 1;
    }
  }
  // Bloco de validação e assinatura, sem afirmar aprovação automática.
  const signY = Math.max(100, y-18);
  text(42, signY, 8, "RESPONSÁVEL PELO REGISTRO", "F2", "0.25 0.31 0.42");
  line(42, signY-38, 270, signY-38, "0.55 0.59 0.66", 0.7);
  text(42, signY-50, 7.5, "Nome / assinatura", "F1", "0.42 0.46 0.54");
  text(322, signY, 8, "VALIDAÇÃO ADMINISTRATIVA", "F2", "0.25 0.31 0.42");
  line(322, signY-38, 553, signY-38, "0.55 0.59 0.66", 0.7);
  text(322, signY-50, 7.5, "Nome / assinatura / data", "F1", "0.42 0.46 0.54");
  line(42, 48, 553, 48, "0.78 0.82 0.88", 0.6);
  text(42, 33, 7, "Documento gerado pelo sistema de Gestão Patrimonial.", "F1", "0.36 0.41 0.51");
  text(553-115, 33, 7, "USO ADMINISTRATIVO", "F2", "0.15 0.39 0.96");

  const content = commands.join("\n");
  const latin1 = str => { const out = new Uint8Array(str.length); for(let i=0;i<str.length;i++){ const c=str.charCodeAt(i); out[i]=c<=255?c:63; } return out; };
  const streamBytes = latin1(content);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${streamBytes.length} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n"; const offsets=[0];
  objects.forEach((obj,i)=>{ offsets.push(pdf.length); pdf += `${i+1} 0 obj\n${obj}\nendobj\n`; });
  const xref=pdf.length; pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n` + offsets.slice(1).map(o=>`${String(o).padStart(10,"0")} 00000 n \n`).join("") + `trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length); for(let i=0;i<pdf.length;i++) bytes[i]=pdf.charCodeAt(i)&255;
  const blob=new Blob([bytes],{type:"application/pdf"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url; a.download=`Termo-Baixa-${value(record.Tombamento).replace(/[^A-Za-z0-9-]/g,"")||"Patrimonial"}.pdf`;
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500);
}

$("disposalHistorySearch")?.addEventListener("input", renderDisposalHistory);
$("refreshDisposalHistoryBtn")?.addEventListener("click", renderDisposalHistory);

function disposalAssetSearchText(asset) {
  const sector = sectorLocationData?.sectors?.find(x => String(x.ID_Setor) === String(asset.ID_Setor));
  const person = sectorLocationData?.people?.find(x => String(x.ID_Responsavel) === String(asset.ID_Responsavel));
  return [asset.Tombamento, asset.Numero_Serie, asset.Descricao_Bem, asset.Marca, asset.Modelo,
    asset.Categoria, sector?.Nome_Setor, person?.Nome_Completo].filter(Boolean).join(" ");
}
$("disposalAssetSearch")?.addEventListener("input", event => {
  showSearchResults("disposalAssetResults", disposalAssets.map(a => ({value:String(a.Tombamento), asset:a})),
    event.target.value, r => `${r.asset.Tombamento} — ${r.asset.Descricao_Bem}`,
    r => disposalAssetSearchText(r.asset), r => {
      $("disposalAsset").value = r.value;
      $("disposalAssetSearch").value = `${r.asset.Tombamento} — ${r.asset.Descricao_Bem}`;
      updateDisposalAssetSummary();
    }, $("disposalAsset").value);
});

function updateDisposalAssetSummary() {
  const asset = disposalAssets.find(a => String(a.Tombamento) === $("disposalAsset").value);
  const box = $("disposalAssetSummary"); box.replaceChildren();
  const strong = document.createElement("strong"); strong.textContent = "Bem selecionado";
  const p = document.createElement("p");
  p.textContent = asset ? `${asset.Tombamento} — ${asset.Descricao_Bem} · Situação atual: ${asset.Situacao || "Não informada"}` : "Selecione um bem para consultar seus dados.";
  box.append(strong,p);
}

$("disposalAsset")?.addEventListener("change", updateDisposalAssetSummary);
$("disposalForm")?.addEventListener("submit", event => {
  event.preventDefault();
  if (currentProfile?.perfil !== "ADM") {
    setMessage("disposalMessage","Somente ADM pode registrar baixa patrimonial.","error"); return;
  }
  const asset = disposalAssets.find(a => String(a.Tombamento) === $("disposalAsset").value);
  const reason = $("disposalReason").value;
  if (!asset || !reason) {
    setMessage("disposalMessage","Selecione um bem e informe o motivo da baixa.","error"); return;
  }
  pendingDisposal = {
    asset, reason,
    documentNumber: $("disposalDocument").value.trim(),
    notes: $("disposalNotes").value.trim(),
    user: currentUser
  };
  const content = $("disposalReviewContent"); content.replaceChildren();
  const items = [
    ["Tombamento", asset.Tombamento],
    ["Descrição", asset.Descricao_Bem],
    ["Situação atual", asset.Situacao],
    ["Nova situação", "Baixado"],
    ["Motivo", reason],
    ["Documento / processo", pendingDisposal.documentNumber || "Não informado"],
    ["Observações", pendingDisposal.notes || "Nenhuma observação"]
  ];
  for (const [label,value] of items) content.append(reviewItem(label,value,label==="Observações"));
  $("disposalReviewCard").hidden = false;
  $("disposalReviewCard").scrollIntoView({behavior:"smooth",block:"center"});
  setMessage("disposalMessage","Confira os dados no cartão. A baixa ainda não foi registrada.");
});

$("editDisposalBtn")?.addEventListener("click", () => {
  pendingDisposal = null; $("disposalReviewCard").hidden = true;
  setMessage("disposalMessage","Você pode corrigir os dados antes de confirmar.");
});

$("confirmDisposalBtn")?.addEventListener("click", async () => {
  if (!pendingDisposal || currentProfile?.perfil !== "ADM") return;
  const btn=$("confirmDisposalBtn"); btn.disabled=true; $("editDisposalBtn").disabled=true;
  setMessage("disposalMessage","Registrando baixa patrimonial...");
  try {
    await recordAssetDisposal(pendingDisposal);
    pendingDisposal=null; $("disposalReviewCard").hidden=true; $("disposalForm").reset();
    setMessage("disposalMessage","Baixa patrimonial registrada com sucesso. Você pode consultar os dados e recuperar o documento em Consultar operações.","success");
    await loadDisposalView(); await refreshDashboard(); await searchAssets();
  } catch(error) {
    setMessage("disposalMessage",`Não foi possível registrar a baixa: ${error.message}`,"error");
  } finally {btn.disabled=false;$("editDisposalBtn").disabled=false;}
});


const referenceConfigs = {
  categorias: {label:"Categoria", collection:"categorias", id:"ID_Categoria", prefix:"CAT", fields:[
    {key:"Nome_Categoria",label:"Nome da categoria",required:true},
    {key:"Descricao",label:"Descrição",type:"textarea"},
    {key:"Ativa",label:"Ativa",type:"select",options:["Sim","Não"],default:"Sim"}
  ]},
  unidades: {label:"Unidade / edifício",collection:"unidades",id:"ID_Unidade",prefix:"UNI",fields:[
    {key:"Nome_Unidade",label:"Nome da unidade",required:true},
    {key:"Descricao",label:"Descrição",type:"textarea"},
    {key:"Ativa",label:"Ativa",type:"select",options:["Sim","Não"],default:"Sim"}
  ]},
  andares: {label:"Andar",collection:"andares",id:"ID_Andar",prefix:"AND",fields:[
    {key:"ID_Unidade",label:"Unidade",type:"selectData",source:"unidades",sourceId:"ID_Unidade",sourceLabel:"Nome_Unidade",required:true},
    {key:"Nome_Andar",label:"Nome do andar",required:true},
    {key:"Ativo",label:"Ativo",type:"select",options:["Sim","Não"],default:"Sim"}
  ]},
  locais: {label:"Local físico",collection:"locais",id:"ID_Local",prefix:"LOC",fields:[
    {key:"ID_Unidade",label:"Unidade",type:"selectData",source:"unidades",sourceId:"ID_Unidade",sourceLabel:"Nome_Unidade",required:true},
    {key:"ID_Andar",label:"Andar",type:"selectData",source:"andares",sourceId:"ID_Andar",sourceLabel:"Nome_Andar",required:true,dependsOn:"ID_Unidade",filterField:"ID_Unidade"},
    {key:"Nome_Local_Fisico",label:"Sala / local físico",required:true},
    {key:"Ativo",label:"Ativo",type:"select",options:["Sim","Não"],default:"Sim"}
  ]},
  setores: {label:"Setor",collection:"setores",id:"ID_Setor",prefix:"SET",fields:[
    {key:"ID_Unidade",label:"Unidade",type:"selectData",source:"unidades",sourceId:"ID_Unidade",sourceLabel:"Nome_Unidade",required:true,derivedFromPlace:true},
    {key:"ID_Andar",label:"Andar",type:"selectData",source:"andares",sourceId:"ID_Andar",sourceLabel:"Nome_Andar",required:true,dependsOn:"ID_Unidade",filterField:"ID_Unidade",derivedFromPlace:true},
    {key:"ID_Local_Atual",label:"Local físico",type:"selectData",source:"locais",sourceId:"ID_Local",sourceLabel:"Nome_Local_Fisico",required:true,dependsOn:"ID_Andar",filterField:"ID_Andar"},
    {key:"Nome_Setor",label:"Nome do setor",required:true},
    {key:"Ativo",label:"Ativo",type:"select",options:["Sim","Não"],default:"Sim"}
  ]},
  responsaveis: {label:"Responsável",collection:"responsaveis",id:"ID_Responsavel",prefix:"RESP",fields:[
    {key:"Nome_Completo",label:"Nome completo",required:true},
    {key:"ID_Unidade",label:"Unidade",type:"selectData",source:"unidades",sourceId:"ID_Unidade",sourceLabel:"Nome_Unidade",required:true},
    {key:"ID_Andar",label:"Andar",type:"selectData",source:"andares",sourceId:"ID_Andar",sourceLabel:"Nome_Andar",required:true,dependsOn:"ID_Unidade",filterField:"ID_Unidade"},
    {key:"ID_Local_Atual",label:"Local físico",type:"selectData",source:"locais",sourceId:"ID_Local",sourceLabel:"Nome_Local_Fisico",required:true,dependsOn:"ID_Andar",filterField:"ID_Andar"},
    {key:"ID_Setor_Vinculo",label:"Setor",type:"selectData",source:"setores",sourceId:"ID_Setor",sourceLabel:"Nome_Setor",required:true,dependsOn:"ID_Local_Atual",filterField:"ID_Local_Atual"},
    {key:"Email_Ficticio",label:"E-mail",type:"email"},
    {key:"Responsavel_Oficial_Setor",label:"Responsável oficial do setor",type:"select",options:["Sim","Não"],default:"Não"},
    {key:"Ativo",label:"Ativo",type:"select",options:["Sim","Não"],default:"Sim"}
  ]}
};
let referenceRows = [];
let referenceEditingId = null;
let referenceEditing = false;
let referenceRelated = {};

async function loadReferenceView() {
  if (currentProfile?.perfil !== "ADM") throw new Error("Somente ADM pode gerenciar cadastros básicos.");
  await renderReferenceRows();
}
async function renderReferenceRows() {
  const type=$("referenceType").value, cfg=referenceConfigs[type];
  const cardHost=$("referenceTypeCards");
  if(cardHost){
    const newBtn = $("newReferenceBtn");
    cardHost.replaceChildren();
    for(const [key,item] of Object.entries(referenceConfigs)){
      const b=document.createElement("button");
      b.type="button"; b.className=`reference-type-card${key===type?" active":""}`;
      b.textContent=item.label; b.setAttribute("aria-pressed",String(key===type));
      b.addEventListener("click",()=>{
        $("referenceType").value=key;
        $("referenceFormCard").hidden=true;
        renderReferenceRows().catch(e=>setMessage("referenceMessage",e.message,"error"));
      });
      cardHost.append(b);
    }
    if (newBtn) {
      const labels = {categorias:"Nova categoria", unidades:"Nova unidade", andares:"Novo andar", locais:"Novo local físico", setores:"Novo setor", responsaveis:"Novo responsável"};
      newBtn.textContent = labels[type] || "Novo cadastro";
      const activeIndex = Object.keys(referenceConfigs).indexOf(type);
      const buttonRow = $("referenceNewButtonRow");
      if (buttonRow) buttonRow.style.setProperty("--active-index", String(Math.max(0, activeIndex)));
    }
  }
  referenceRows=await getCollectionRows(cfg.collection);
  referenceRelated={};
  for(const field of cfg.fields.filter(f=>f.type==="selectData")) referenceRelated[field.source]=await getCollectionRows(field.source);
  const head=$("referenceTableHead"), body=$("referenceTableBody");
  head.replaceChildren(); body.replaceChildren();
  const fieldLabels = Object.fromEntries(cfg.fields.map(f => [f.key, f.label]));
  // Exibe setor com sua localização completa para evitar ambiguidades entre setores homônimos.
  if(type==="responsaveis"){
    const sectors=referenceRelated.setores||[];
    const places=referenceRelated.locais||[];
    const floors=referenceRelated.andares||[];
    const units=referenceRelated.unidades||[];
    const mapBy=(rows,key)=>new Map(rows.map(r=>[String(r[key]),r]));
    const sm=mapBy(sectors,"ID_Setor"), pm=mapBy(places,"ID_Local"), fm=mapBy(floors,"ID_Andar"), um=mapBy(units,"ID_Unidade");
    referenceRelated.setores=sectors.map(sec=>{
      const place=pm.get(String(sec.ID_Local_Atual||sec.ID_Local_Referencia||""));
      const floor=fm.get(String(place?.ID_Andar||sec.ID_Andar||""));
      const unit=um.get(String(sec.ID_Unidade||floor?.ID_Unidade||place?.ID_Unidade||""));
      return {...sec,__label:[sec.Nome_Setor,unit?.Nome_Unidade,floor?.Nome_Andar,place?.Nome_Local_Fisico].filter(Boolean).join(" — ")};
    });
  }
  const cols=type==="categorias"?["Nome_Categoria","Descricao","Ativa","__actions"]:type==="unidades"?["Nome_Unidade","Descricao","Ativa","__actions"]:type==="andares"?["Nome_Andar","ID_Unidade","Ativo","__actions"]:type==="locais"?["Nome_Local_Fisico","ID_Andar","Ativo","__actions"]:type==="setores"?["Nome_Setor","ID_Local_Atual","Ativo","__actions"]:["Nome_Completo","ID_Setor_Vinculo","Email_Ficticio","__actions"];
  const trh=document.createElement("tr");
  for(const key of cols){const th=document.createElement("th");th.textContent=key==="__actions"?"Ações":(fieldLabels[key]||key);trh.append(th);}
  head.append(trh);
  for(const row of referenceRows){
    const tr=document.createElement("tr");
    for(const key of cols){
      const td=document.createElement("td");
      if(key==="__actions"){
        const btn=document.createElement("button");btn.type="button";btn.className="button button-secondary button-small";btn.textContent="Editar";
        btn.addEventListener("click",()=>openReferenceForm(row));td.append(btn);
      }else {
        const field=cfg.fields.find(f=>f.key===key);
        let value=row[key];
        const units=referenceRelated.unidades || await getCollectionRows("unidades");
        const floors=referenceRelated.andares || await getCollectionRows("andares");
        const places=referenceRelated.locais || await getCollectionRows("locais");
        const sectors=referenceRelated.setores || await getCollectionRows("setores");
        const unitName=id=>units.find(x=>String(x.ID_Unidade)===String(id))?.Nome_Unidade || "Unidade não informada";
        const floorName=id=>{const f=floors.find(x=>String(x.ID_Andar)===String(id));return f?`${f.Nome_Andar} — ${unitName(f.ID_Unidade)}`:"Andar não informado"};
        const placeName=id=>{const l=places.find(x=>String(x.ID_Local)===String(id));return l?`${l.Nome_Local_Fisico} — ${floorName(l.ID_Andar)}`:"Local não informado"};
        const sectorName=id=>{const sec=sectors.find(x=>String(x.ID_Setor)===String(id));return sec?`${sec.Nome_Setor} — ${placeName(sec.ID_Local_Atual)}`:"Setor não informado"};
        if(type==="categorias" && key==="Descricao" && !value) value=`Categoria destinada a bens patrimoniais classificados como ${row.Nome_Categoria||"esta categoria"}.`;
        if(type==="unidades" && key==="Descricao" && !value) value=`Unidade administrativa para gestão, localização e controle dos bens patrimoniais em ${row.Nome_Unidade||"esta unidade"}.`;
        if(type==="andares" && key==="ID_Unidade") value=unitName(row.ID_Unidade);
        if(type==="locais" && key==="ID_Andar") value=floorName(row.ID_Andar);
        if(type==="setores" && key==="ID_Local_Atual") value=placeName(row.ID_Local_Atual);
        if(type==="responsaveis" && key==="ID_Setor_Vinculo") value=sectorName(row.ID_Setor_Vinculo);
        if(field?.type==="selectData") {
          const related=referenceRelated[field.source] || [];
          const match=related.find(item=>String(item[field.sourceId])===String(value));
          value=match?.[field.sourceLabel] ?? value;
        }
        if(key.startsWith("ID_") && !["ID_Unidade","ID_Andar","ID_Local_Atual","ID_Setor_Vinculo"].includes(key)) value="";
        td.textContent=String(value??"");
      }
      tr.append(td);
    }
    body.append(tr);
  }
  setMessage("referenceMessage",`${referenceRows.length} registro(s) em ${cfg.label.toLocaleLowerCase("pt-BR")}.`);
}
async function openReferenceForm(row=null) {
  if(currentProfile?.perfil!=="ADM") return;
  const type=$("referenceType").value,cfg=referenceConfigs[type];
  referenceEditingId=row?.[cfg.id]??null; referenceEditing=Boolean(row);
  $("referenceFormTitle").textContent=row?`Editar ${cfg.label.toLocaleLowerCase("pt-BR")}`:`Novo cadastro — ${cfg.label.toLocaleLowerCase("pt-BR")}`;
  const fields=$("referenceFields");fields.replaceChildren();referenceRelated={};
  const collections=[...new Set(cfg.fields.filter(f=>f.type==="selectData").map(f=>f.source))];
  for(const collection of collections) referenceRelated[collection]=await getCollectionRows(collection);
  const existingSector = type==="responsaveis" ? referenceRelated.setores?.find(x=>String(x.ID_Setor)===String(row?.ID_Setor_Vinculo)) : null;
  const existingPlace = (type==="setores" || type==="responsaveis") ? referenceRelated.locais.find(x=>String(x.ID_Local)===String(type==="responsaveis" ? (row?.ID_Local_Atual || existingSector?.ID_Local_Atual) : row?.ID_Local_Atual)) : null;
  const existingFloor = (type==="setores" || type==="responsaveis") ? referenceRelated.andares.find(x=>String(x.ID_Andar)===String(existingPlace?.ID_Andar || row?.ID_Andar)) : null;
  const initialValues={...(row||{})};
  if(type==="setores" || type==="responsaveis"){
    initialValues.ID_Unidade=row?.ID_Unidade??existingPlace?.ID_Unidade??existingFloor?.ID_Unidade??existingSector?.ID_Unidade??"";
    initialValues.ID_Andar=row?.ID_Andar??existingPlace?.ID_Andar??"";
    if(type==="responsaveis") initialValues.ID_Local_Atual=existingPlace?.ID_Local??row?.ID_Local_Atual??"";
  }
  for(const field of cfg.fields){
    const wrap=document.createElement("div");wrap.className="reference-field";
    const label=document.createElement("label");label.textContent=field.label;label.htmlFor=`ref_${field.key}`;wrap.append(label);
    let input;
    if(field.type==="textarea") input=document.createElement("textarea");
    else if(field.type==="select"||field.type==="selectData"){
      input=document.createElement("select");input.add(new Option(field.dependsOn?"Selecione a etapa anterior":"Selecione", ""));
      if(field.type==="select") for(const opt of field.options) input.add(new Option(opt,opt));
      else for(const option of (referenceRelated[field.source]||[])){
        let labelText=option[field.sourceLabel]||option[field.sourceId];
        if(field.source==="andares"){
          const unit=referenceRelated.unidades?.find(u=>String(u.ID_Unidade)===String(option.ID_Unidade));
          labelText=`${option.Nome_Andar||option.ID_Andar}${unit?` — ${unit.Nome_Unidade}`:""}`;
        } else if(field.source==="locais") {
          const floor=referenceRelated.andares?.find(f=>String(f.ID_Andar)===String(option.ID_Andar));
          const unit=referenceRelated.unidades?.find(u=>String(u.ID_Unidade)===String(option.ID_Unidade||floor?.ID_Unidade));
          labelText=[unit?.Nome_Unidade,floor?.Nome_Andar,option.Nome_Local_Fisico].filter(Boolean).join(" — ")||option[field.sourceId];
        }
        input.add(new Option(labelText,option[field.sourceId]));
      }
    } else {input=document.createElement("input");input.type=field.type==="email"?"email":"text";}
    input.id=`ref_${field.key}`;input.name=field.key;input.required=Boolean(field.required);
    input.value=initialValues[field.key]??field.default??"";
    if(field.derivedFromPlace) input.dataset.derivedFromPlace="true";
    wrap.append(input);fields.append(wrap);
  }
  const updateCascades=(changedKey="")=>{
    const unitSelect=$("ref_ID_Unidade"),floorSelect=$("ref_ID_Andar"),placeSelect=$("ref_ID_Local_Atual");
    if(type==="locais"||type==="setores"||type==="responsaveis"){
      const unitId=unitSelect?.value||"";
      if(floorSelect){
        const previous=floorSelect.value;
        [...floorSelect.options].slice(1).forEach(opt=>{
          const floor=(referenceRelated.andares||[]).find(x=>String(x.ID_Andar)===String(opt.value));
          opt.hidden=Boolean(!unitId||!floor||String(floor.ID_Unidade)!==String(unitId));
        });
        if(!unitId||floorSelect.selectedOptions[0]?.hidden) floorSelect.value="";
        floorSelect.disabled=!unitId;
        if(changedKey==="ID_Unidade") floorSelect.value="";
      }
      if(type==="setores"&&placeSelect){
        const floorId=floorSelect?.value||"";
        [...placeSelect.options].slice(1).forEach(opt=>{
          const place=(referenceRelated.locais||[]).find(x=>String(x.ID_Local)===String(opt.value));
          const placeFloor=(referenceRelated.andares||[]).find(x=>String(x.ID_Andar)===String(place?.ID_Andar));
          opt.hidden=Boolean(!floorId||!place||String(place.ID_Andar)!==String(floorId)||String(place.ID_Unidade||placeFloor?.ID_Unidade)!==String(unitId));
        });
        if(!floorId||placeSelect.selectedOptions[0]?.hidden) placeSelect.value="";
        placeSelect.disabled=!floorId;
        if(changedKey==="ID_Unidade"||changedKey==="ID_Andar") placeSelect.value="";
      }
      if(type==="responsaveis"&&placeSelect){
        const floorId=floorSelect?.value||"";
        [...placeSelect.options].slice(1).forEach(opt=>{
          const place=(referenceRelated.locais||[]).find(x=>String(x.ID_Local)===String(opt.value));
          const placeFloor=(referenceRelated.andares||[]).find(x=>String(x.ID_Andar)===String(place?.ID_Andar));
          opt.hidden=Boolean(!floorId||!place||String(place.ID_Andar)!==String(floorId)||String(place.ID_Unidade||placeFloor?.ID_Unidade)!==String(unitId));
        });
        if(!floorId||placeSelect.selectedOptions[0]?.hidden) placeSelect.value="";
        placeSelect.disabled=!floorId;
        if(changedKey==="ID_Unidade"||changedKey==="ID_Andar") placeSelect.value="";
        const sectorSelect=$("ref_ID_Setor_Vinculo"), placeId=placeSelect.value;
        if(sectorSelect){
          [...sectorSelect.options].slice(1).forEach(opt=>{
            const sector=(referenceRelated.setores||[]).find(x=>String(x.ID_Setor)===String(opt.value));
            opt.hidden=Boolean(!placeId||!sector||String(sector.ID_Local_Atual)!==String(placeId)||String(sector.ID_Unidade)!==String(unitId));
          });
          if(!placeId||sectorSelect.selectedOptions[0]?.hidden) sectorSelect.value="";
          sectorSelect.disabled=!placeId;
          if(changedKey==="ID_Local_Atual") sectorSelect.value="";
        }
      }
    }
  };
  ["ID_Unidade","ID_Andar","ID_Local_Atual"].forEach(key=>$("ref_"+key)?.addEventListener("change",()=>updateCascades(key)));
  updateCascades();
  $("referenceFormCard").hidden=false;
  $("referenceFormCard").scrollIntoView({behavior:"smooth",block:"center"});
}

$("referenceType")?.addEventListener("change",()=>{ $("referenceFormCard").hidden=true; renderReferenceRows().catch(e=>setMessage("referenceMessage",e.message,"error")); });
$("newReferenceBtn")?.addEventListener("click",()=>openReferenceForm().catch(e=>setMessage("referenceMessage",e.message,"error")));
$("cancelReferenceBtn")?.addEventListener("click",()=>{$("referenceFormCard").hidden=true;referenceEditingId=null;});
$("referenceForm")?.addEventListener("submit",async event=>{
  event.preventDefault();
  if(currentProfile?.perfil!=="ADM"){setMessage("referenceMessage","Somente ADM pode salvar cadastros.","error");return;}
  const type=$("referenceType").value,cfg=referenceConfigs[type],data={};
  for(const field of cfg.fields){
    const value=$(`ref_${field.key}`).value.trim();
    if(field.required&&!value){setMessage("referenceMessage",`Preencha: ${field.label}.`,"error");return;}
    data[field.key]=value;
  }
  // Campos derivados de localização, para consultas legadas e relatórios.
  if(type==="locais"){
    const unit=referenceRelated.unidades?.find(x=>String(x.ID_Unidade)===data.ID_Unidade);
    const floor=referenceRelated.andares?.find(x=>String(x.ID_Andar)===data.ID_Andar);
    data.Nome_Unidade=unit?.Nome_Unidade??"";
    data.Nome_Andar=floor?.Nome_Andar??"";
    data.Descricao_Local=`${data.Nome_Unidade} — ${data.Nome_Andar} — ${data.Nome_Local_Fisico}`;
  }
  if(type==="andares"){
    const unit=referenceRelated.unidades?.find(x=>String(x.ID_Unidade)===data.ID_Unidade);
    data.Nome_Unidade=unit?.Nome_Unidade??"";
  }
  if(type==="setores"){
    const place=referenceRelated.locais?.find(x=>String(x.ID_Local)===data.ID_Local_Atual);
    const floor=referenceRelated.andares?.find(x=>String(x.ID_Andar)===data.ID_Andar);
    const unit=referenceRelated.unidades?.find(x=>String(x.ID_Unidade)===data.ID_Unidade);
    if(!place||!floor||!unit||String(floor.ID_Unidade)!==String(unit.ID_Unidade)||String(place.ID_Andar)!==String(floor.ID_Andar)){
      setMessage("referenceMessage","A localização selecionada não corresponde à hierarquia da unidade. Confira unidade, andar e local físico.","error");return;
    }
    data.ID_Unidade=unit.ID_Unidade;data.ID_Andar=floor.ID_Andar;
    data.Nome_Unidade=unit.Nome_Unidade;data.Nome_Andar=floor.Nome_Andar;
    data.Nome_Local_Fisico=place.Nome_Local_Fisico;
  }
  if(type==="responsaveis"){
    const place=referenceRelated.locais?.find(x=>String(x.ID_Local)===data.ID_Local_Atual);
    const floor=referenceRelated.andares?.find(x=>String(x.ID_Andar)===data.ID_Andar);
    const unit=referenceRelated.unidades?.find(x=>String(x.ID_Unidade)===data.ID_Unidade);
    const sector=referenceRelated.setores?.find(x=>String(x.ID_Setor)===data.ID_Setor_Vinculo);
    if(!unit||!floor||!place||!sector||
      String(floor.ID_Unidade)!==String(unit.ID_Unidade)||
      String(place.ID_Andar)!==String(floor.ID_Andar)||
      String(place.ID_Unidade||floor.ID_Unidade)!==String(unit.ID_Unidade)||
      String(sector.ID_Local_Atual)!==String(place.ID_Local)||
      String(sector.ID_Unidade)!==String(unit.ID_Unidade)){
      setMessage("referenceMessage","O setor selecionado não pertence à unidade, andar e local físico informados. Confira a hierarquia.","error");return;
    }
    data.ID_Unidade=unit.ID_Unidade; data.ID_Andar=floor.ID_Andar; data.ID_Local_Atual=place.ID_Local;
    data.Nome_Unidade=unit.Nome_Unidade; data.Nome_Andar=floor.Nome_Andar;
    data.Nome_Local_Fisico=place.Nome_Local_Fisico; data.Nome_Setor=sector.Nome_Setor;
  }
  const creating=!referenceEditing;
  const id=referenceEditingId || `${cfg.prefix}${String(Date.now()).slice(-8)}`;
  try{
    await saveReferenceRecord(cfg.collection,id,{...data,[cfg.id]:id},creating);
    $("referenceFormCard").hidden=true;referenceEditingId=null;
    await renderReferenceRows();
    setMessage("referenceMessage",`${cfg.label} salvo com sucesso.`,"success");
  }catch(error){setMessage("referenceMessage",`Não foi possível salvar: ${error.message}`,"error");}
});


let assetAutocompleteRows = [];
let assetFormMode = "create";
let assetFormOriginal = null;
let assetFormReferences = {categories:[],sectors:[],people:[],places:[],floors:[],units:[]};

function parseCurrencyInput(value) {
  const normalized=String(value??"").trim().replace(/\./g,"").replace(",",".");
  if(!normalized) return "";
  const n=Number(normalized);
  if(!Number.isFinite(n)||n<0) throw new Error("Informe um valor de aquisição válido.");
  return Math.round(n*100)/100;
}
function formatCurrencyInput(value) {
  if(value===null||value===undefined||value==="") return "";
  return Number(value).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
}

function applyCentMask(input) {
  if(!input || input.dataset.centMaskBound==="1") return;
  input.dataset.centMaskBound="1";
  input.addEventListener("input",()=>{
    const digits=input.value.replace(/\D/g,"");
    if(!digits){input.value="";return;}
    input.value=(Number(digits)/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
    try{input.setSelectionRange(input.value.length,input.value.length);}catch{}
  });
  input.addEventListener("blur",()=>{if(input.value.trim())input.value=formatCurrencyInput(parseCurrencyInput(input.value));});
}
document.querySelectorAll('input[id*="Value"], input[id*="Valor"], input[data-money="true"]').forEach(applyCentMask);
function showDuplicateTombamentoAction(tombamento) {
  const message = $("assetFormMessage");
  if (!message) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-secondary";
  button.textContent = "Consultar bem existente";
  button.style.marginTop = ".5rem";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      // A ficha é aberta como modal sobre o formulário; os valores digitados permanecem no DOM.
      await openAssetDetail(tombamento);
    } finally {
      button.disabled = false;
    }
  });
  message.append(document.createTextNode(" "));
  message.append(button);
}
function getSectorLocation(sector) {
  if(!sector) return "Localização não cadastrada.";
  const place=assetFormReferences.places.find(x=>String(x.ID_Local)===String(sector.ID_Local_Atual??sector.ID_Local_Referencia??""));
  const floor=assetFormReferences.floors.find(x=>String(x.ID_Andar)===String(place?.ID_Andar??""));
  const unit=assetFormReferences.units.find(x=>String(x.ID_Unidade)===String(place?.ID_Unidade??floor?.ID_Unidade??""));
  return place&&floor&&unit ? `${unit.Nome_Unidade} — ${floor.Nome_Andar} — ${place.Nome_Local_Fisico}` : "Localização incompleta: revise o vínculo do setor.";
}
async function loadAssetFormReferences() {
  const [categories,sectors,people,places,floors,units]=await Promise.all([
    getCollectionRows("categorias"),getCollectionRows("setores"),getCollectionRows("responsaveis"),
    getCollectionRows("locais"),getCollectionRows("andares"),getCollectionRows("unidades")
  ]);
  assetFormReferences={categories,sectors,people,places,floors,units};
  fillAssetSelect("newAssetCategory",categories,"ID_Categoria","Nome_Categoria");
  fillAssetSelect("newAssetUnit",units.filter(x=>x.Ativo!=="Não"&&x.Ativo!==false),"ID_Unidade","Nome_Unidade");
  fillAssetSelect("newAssetSector",[],"ID_Setor","Nome_Setor");
  fillAssetSelect("newAssetResponsible",[],"ID_Responsavel","Nome_Completo");
  updateAssetSectorsForUnit();
}
function fillAssetSelect(id,rows,valueKey,labelKey) {
  const select=$(id), previous=select.value;
  select.replaceChildren(new Option("Selecione",""));
  for(const row of rows) select.add(new Option(row[labelKey]||row[valueKey],String(row[valueKey])));
  if([...select.options].some(o=>o.value===previous)) select.value=previous;
}
function getUnitIdForSector(sector) {
  const place=assetFormReferences.places.find(x=>String(x.ID_Local)===String(sector?.ID_Local_Atual??sector?.ID_Local_Referencia??""));
  const floor=assetFormReferences.floors.find(x=>String(x.ID_Andar)===String(place?.ID_Andar??""));
  return String(place?.ID_Unidade??floor?.ID_Unidade??"");
}
function updateAssetSectorsForUnit(preferredSector="") {
  const unitId=$("newAssetUnit").value;
  const sectors=assetFormReferences.sectors.filter(x=>(x.Ativo!=="Não"&&x.Ativo!==false)&&getUnitIdForSector(x)===String(unitId));
  fillAssetSelect("newAssetSector",sectors,"ID_Setor","Nome_Setor");
  if(preferredSector && sectors.some(x=>String(x.ID_Setor)===String(preferredSector))) $("newAssetSector").value=String(preferredSector);
  updateAssetLocationPreview();
}
function updateAssetLocationPreview() {
  const sector=assetFormReferences.sectors.find(x=>String(x.ID_Setor)===$("newAssetSector").value);
  const unitId=$("newAssetUnit").value;
  const actualUnit=getUnitIdForSector(sector);
  if(sector && unitId && actualUnit!==unitId) {
    $("newAssetLocationPreview").textContent="O setor não pertence à unidade selecionada.";
    fillAssetSelect("newAssetResponsible",[],"ID_Responsavel","Nome_Completo");
    return;
  }
  $("newAssetLocationPreview").textContent=sector?getSectorLocation(sector):"Selecione uma unidade e um setor para consultar a localização.";
  const allowed=assetFormReferences.people.filter(p=>String(p.ID_Setor_Vinculo??p.ID_Setor??"")===String(sector?.ID_Setor??"")&&(p.Ativo!=="Não"&&p.Ativo!==false));
  const current=$("newAssetResponsible").value;
  fillAssetSelect("newAssetResponsible",allowed,"ID_Responsavel","Nome_Completo");
  if(allowed.some(p=>String(p.ID_Responsavel)===current)) $("newAssetResponsible").value=current;
}

async function openAssetForm(tombamento=null) {
  await loadAssetFormReferences();
  const existing=tombamento===null?null:(await getCollectionRows("bens")).find(a=>String(a.Tombamento)===String(tombamento));
  assetFormMode=existing?"edit":"create"; assetFormOriginal=existing;
  $("assetForm").reset();
  $("assetEditingTombamento").value=existing?.Tombamento??"";
  $("newAssetTombamento").value=existing?.Tombamento??"";
  $("newAssetTombamento").readOnly=Boolean(existing);
  $("newAssetDescription").value=existing?.Descricao_Bem??"";
  $("newAssetCategory").value=existing?.ID_Categoria??"";
  $("newAssetStatus").value=existing?.Situacao??"Ativo";
  $("newAssetBrand").value=existing?.Marca??"";
  $("newAssetModel").value=existing?.Modelo??"";
  $("newAssetSerial").value=existing?.Numero_Serie??"";
  const existingSector=assetFormReferences.sectors.find(x=>String(x.ID_Setor)===String(existing?.ID_Setor??""));
  $("newAssetUnit").value=existingSector?getUnitIdForSector(existingSector):"";
  updateAssetSectorsForUnit(existing?.ID_Setor??"");
  $("newAssetResponsible").value=existing?.ID_Responsavel??"";
  $("newAssetAcquisitionDate").value=existing?.Data_Aquisicao??"";
  $("newAssetAcquisitionValue").value=formatCurrencyInput(existing?.Valor_Aquisicao);
  $("newAssetNotes").value=existing?.Observacoes??"";
  $("assetFormTitle").textContent=existing?"Editar bem patrimonial":"Cadastrar bem patrimonial";
  $("saveAssetBtn").textContent=existing?"Salvar alterações":"Salvar bem";
  $("cancelAssetEditBtn").hidden=!existing;
  activateView("assetFormView");
}
$("newAssetUnit")?.addEventListener("change",()=>{ updateAssetSectorsForUnit(); });
$("newAssetSector")?.addEventListener("change",updateAssetLocationPreview);
$("cancelAssetEditBtn")?.addEventListener("click",()=>{assetFormOriginal=null;assetFormMode="create";$("assetForm").reset();$("newAssetTombamento").readOnly=false;$("assetFormTitle").textContent="Cadastrar bem patrimonial";$("saveAssetBtn").textContent="Salvar bem";$("cancelAssetEditBtn").hidden=true;setMessage("assetFormMessage","Edição cancelada.");});
$("assetForm")?.addEventListener("submit",async event=>{
  event.preventDefault();
  const creating=assetFormMode==="create";
  const tombamento=$("newAssetTombamento").value.trim();
  const description=$("newAssetDescription").value.trim();
  const category=$("newAssetCategory").value;
  const unitId=$("newAssetUnit").value;
  const sectorId=$("newAssetSector").value;
  const responsible=$("newAssetResponsible").value;
  if(!tombamento||!description||!category||!unitId||!sectorId||!responsible){setMessage("assetFormMessage","Preencha tombamento, descrição, categoria, unidade, setor e responsável.","error");return;}
  const sector=assetFormReferences.sectors.find(x=>String(x.ID_Setor)===sectorId);
  if(getUnitIdForSector(sector)!==String(unitId)){setMessage("assetFormMessage","O setor selecionado não pertence à unidade informada.","error");return;}
  const person=assetFormReferences.people.find(x=>String(x.ID_Responsavel)===String(responsible));
  if(!person || String(person.ID_Setor_Vinculo??person.ID_Setor??"")!==String(sectorId)){setMessage("assetFormMessage","Selecione um responsável vinculado ao setor escolhido.","error");return;}
  const location=getSectorLocation(sector);
  if(location.startsWith("Localização incompleta")||location.startsWith("Localização não cadastrada")){setMessage("assetFormMessage","O setor selecionado não possui localização completa. Corrija o cadastro do setor antes de salvar o bem.","error");return;}
  const value=parseCurrencyInput($("newAssetAcquisitionValue").value);
  const asset={
    Tombamento:tombamento, Descricao_Bem:description, ID_Categoria:category,
    ID_Setor:sectorId, ID_Responsavel:responsible,
    Situacao:creating?"Ativo":(assetFormOriginal?.Situacao??"Ativo"),
    Marca:$("newAssetBrand").value.trim(), Modelo:$("newAssetModel").value.trim(),
    Numero_Serie:$("newAssetSerial").value.trim(), Data_Aquisicao:$("newAssetAcquisitionDate").value,
    Valor_Aquisicao:value, Observacoes:$("newAssetNotes").value.trim()
  };
  // Cadastro novo usa confirmações em cards dentro da página, nunca diálogos nativos.
  if (creating) {
    try {
      const bensAtuais = await getCollectionRows("bens");
      const duplicado = bensAtuais.find(item => String(item.Tombamento ?? "").trim() === tombamento);
      if (duplicado) {
        setMessage("assetFormMessage", `O tombamento ${tombamento} já está cadastrado. Consulte o bem existente antes de continuar.`, "error");
        showDuplicateTombamentoAction(tombamento);
        return;
      }
    } catch (error) {
      setMessage("assetFormMessage", `Não foi possível verificar o tombamento: ${error.message}. Tente novamente.`, "error");
      return;
    }
    pendingAssetConfirmation = { asset, tombamento, creating, step: 1 };
    showTombamentoConfirmation(1, tombamento);
    return;
  }
  await persistAsset(asset, creating, tombamento);

});


let pendingAssetConfirmation = null;
function showTombamentoConfirmation(step, tombamento) {
  const card = $("tombamentoConfirmationCard");
  if (!card) return;
  pendingAssetConfirmation = { ...pendingAssetConfirmation, step, tombamento };
  card.classList.toggle("tombamento-confirmation-final", step === 2);
  $("tombamentoConfirmationTitle").textContent = step === 1
    ? "1ª confirmação — Conferência do tombamento"
    : "Verificação final de segurança";
  $("tombamentoConfirmationNumber").textContent = tombamento;
  $("tombamentoConfirmationText").textContent = step === 1
    ? "Compare o número completo com a etiqueta física do bem ou com a documentação patrimonial. Confirme somente se todos os dígitos corresponderem exatamente."
    : "Esta é a segunda verificação de segurança, não um aviso de erro. Revise novamente todos os dígitos, da esquerda para a direita, e confirme que o número corresponde exatamente ao bem que está sendo cadastrado.";
  $("tombamentoConfirmationStep").textContent = step === 1 ? "ETAPA 1 DE 2" : "ETAPA 2 DE 2 · CONFERÊNCIA FINAL";
  $("confirmTombamentoNextBtn").textContent = step === 1 ? "Confirmo a conferência" : "Confirmar segunda verificação";
  card.hidden = false;
  // Mantém o formulário visível e preserva todos os valores; para editar, o usuário cancela a confirmação.
  document.querySelectorAll("#assetForm input:not([type=hidden]), #assetForm select, #assetForm textarea, #saveAssetBtn").forEach(el => { el.disabled = true; });
  card.scrollIntoView({ behavior: "smooth", block: "center" });
}
function hideTombamentoConfirmation() {
  const card = $("tombamentoConfirmationCard");
  if (card) card.hidden = true;
  document.querySelectorAll("#assetForm input, #assetForm select, #assetForm textarea, #saveAssetBtn").forEach(el => { el.disabled = false; });
  pendingAssetConfirmation = null;
}
$("cancelTombamentoConfirmationBtn")?.addEventListener("click", () => {
  hideTombamentoConfirmation();
  setMessage("assetFormMessage", "Confirmação cancelada. Nenhum dado foi gravado; o formulário foi preservado.", "error");
});
$("confirmTombamentoNextBtn")?.addEventListener("click", async () => {
  if (!pendingAssetConfirmation) return;
  const { asset, tombamento, creating, step } = pendingAssetConfirmation;
  const nextButton = $("confirmTombamentoNextBtn");
  nextButton.disabled = true;
  try {
    const bensAtuais = await getCollectionRows("bens");
    const duplicado = bensAtuais.find(item => String(item.Tombamento ?? "").trim() === tombamento);
    if (duplicado) {
      hideTombamentoConfirmation();
      setMessage("assetFormMessage", `O tombamento ${tombamento} já está cadastrado. Consulte o bem existente antes de continuar.`, "error");
      showDuplicateTombamentoAction(tombamento);
      return;
    }
    if (step === 1) {
      showTombamentoConfirmation(2, tombamento);
      return;
    }
    hideTombamentoConfirmation();
    await persistAsset(asset, creating, tombamento);
  } catch (error) {
    hideTombamentoConfirmation();
    setMessage("assetFormMessage", `Não foi possível confirmar a disponibilidade do tombamento: ${error.message}. Revise e tente novamente.`, "error");
  } finally {
    nextButton.disabled = false;
  }
});
async function persistAsset(asset, creating, tombamento) {
  const btn = $("saveAssetBtn");
  btn.disabled = true;
  setMessage("assetFormMessage", creating ? "Cadastrando bem..." : "Salvando alterações...");
  try {
    await saveAssetRecord({ asset, originalTombamento: assetFormOriginal?.Tombamento, creating, user: currentUser });
    setMessage("assetFormMessage", creating ? "Bem cadastrado com situação Ativo." : "Cadastro atualizado; histórico de auditoria registrado.", "success");
    await refreshDashboard();
    await searchAssets();
    if (creating) {
      $("assetForm").reset();
      $("newAssetTombamento").readOnly = false;
      $("newAssetStatus").value = "Ativo";
      $("newAssetLocationPreview").textContent = "Selecione um setor para consultar a localização.";
    } else {
      assetFormOriginal = { ...assetFormOriginal, ...asset };
    }
  } catch (error) {
    setMessage("assetFormMessage", `Não foi possível salvar: ${error.message}`, "error");
    if (creating && /já existe um bem com esse tombamento/i.test(error.message)) showDuplicateTombamentoAction(tombamento);
  } finally {
    btn.disabled = false;
  }
}


let sectorLocationData = {sectors:[],places:[],floors:[],units:[],assets:[]};
let pendingSectorLocation = null;

function buildPlaceLabel(place) {
  const floor=sectorLocationData.floors.find(x=>String(x.ID_Andar)===String(place.ID_Andar));
  const unit=sectorLocationData.units.find(x=>String(x.ID_Unidade)===String(place.ID_Unidade??floor?.ID_Unidade));
  return `${unit?.Nome_Unidade??"Unidade não informada"} — ${floor?.Nome_Andar??"Andar não informado"} — ${place.Nome_Local_Fisico??place.ID_Local}`;
}
async function loadSectorLocationView() {
  if(currentProfile?.perfil!=="ADM") throw new Error("Somente ADM pode alterar a localização de setores.");
  const [sectors,places,floors,units,assets]=await Promise.all([
    getCollectionRows("setores"),getCollectionRows("locais"),getCollectionRows("andares"),getCollectionRows("unidades"),getCollectionRows("bens")
  ]);
  sectorLocationData={sectors,places,floors,units,assets};
  const sel=$("locationSectorSelect");sel.replaceChildren(new Option("Selecione um setor",""));
  for(const sector of sectors) sel.add(new Option(sector.Nome_Setor,sector.ID_Setor));
  $("locationSectorSearch").value = "";
  $("locationSectorResults").replaceChildren();
  const unitSel=$("locationUnitSelect");unitSel.replaceChildren(new Option("Selecione",""));
  for(const unit of units) unitSel.add(new Option(unit.Nome_Unidade,unit.ID_Unidade));
  updateSectorLocationCurrent();
  updateSectorLocationFloors();
  updateSectorLocationPlaces();
}
function updateSectorLocationCurrent() {
  const sector=sectorLocationData.sectors.find(x=>String(x.ID_Setor)===$("locationSectorSelect").value);
  const place=sectorLocationData.places.find(x=>String(x.ID_Local)===String(sector?.ID_Local_Atual??sector?.ID_Local_Referencia??""));
  const box=$("sectorLocationCurrent");box.replaceChildren();
  const strong=document.createElement("strong");strong.textContent="Localização atual";
  const p=document.createElement("p");p.textContent=sector?`${sector.Nome_Setor} — ${place?buildPlaceLabel(place):"Localização não cadastrada"} · ${sectorLocationData.assets.filter(a=>String(a.ID_Setor)===String(sector.ID_Setor)).length} bem(ns) vinculado(s)`:"Selecione um setor.";
  box.append(strong,p);
  if(sector&&place){$("locationUnitSelect").value=String(place.ID_Unidade??sectorLocationData.floors.find(f=>String(f.ID_Andar)===String(place.ID_Andar))?.ID_Unidade??"");}
}
function updateSectorLocationFloors() {
  const unitId=$("locationUnitSelect").value;
  const sel=$("locationFloorSelect");sel.replaceChildren(new Option("Selecione um andar",""));
  for(const floor of sectorLocationData.floors.filter(x=>String(x.ID_Unidade)===String(unitId))) sel.add(new Option(floor.Nome_Andar,floor.ID_Andar));
  const sector=sectorLocationData.sectors.find(x=>String(x.ID_Setor)===$("locationSectorSelect").value);
  const place=sectorLocationData.places.find(x=>String(x.ID_Local)===String(sector?.ID_Local_Atual??sector?.ID_Local_Referencia??""));
  if(place&&String(place.ID_Unidade??sectorLocationData.floors.find(f=>String(f.ID_Andar)===String(place.ID_Andar))?.ID_Unidade)===String(unitId)) sel.value=String(place.ID_Andar);
}
function updateSectorLocationPlaces() {
  const floorId=$("locationFloorSelect").value,sel=$("locationPlaceSelect");
  sel.replaceChildren(new Option("Selecione uma sala",""));
  for(const place of sectorLocationData.places.filter(x=>String(x.ID_Andar)===String(floorId))) sel.add(new Option(place.Nome_Local_Fisico??place.ID_Local,place.ID_Local));
}

$("locationSectorSearch")?.addEventListener("input", event => {
  showSearchResults("locationSectorResults", (sectorLocationData?.sectors || []).map(s => {
    const place = sectorLocationData.places.find(p => String(p.ID_Local) === String(s.ID_Local_Atual ?? s.ID_Local_Referencia ?? ""));
    return {value:String(s.ID_Setor), sector:s, place};
  }), event.target.value,
  r => r.sector.Nome_Setor,
  r => `${r.place ? buildPlaceLabel(r.place) : "Localização não cadastrada"} · ${sectorLocationData.assets.filter(a => String(a.ID_Setor) === String(r.sector.ID_Setor)).length} bem(ns) vinculado(s)`,
  r => {
    $("locationSectorSelect").value = r.value;
    $("locationSectorSearch").value = r.sector.Nome_Setor;
    updateSectorLocationCurrent(); updateSectorLocationFloors(); updateSectorLocationPlaces();
  }, $("locationSectorSelect").value);
});

$("locationSectorSelect")?.addEventListener("change",()=>{updateSectorLocationCurrent();updateSectorLocationFloors();updateSectorLocationPlaces();});
$("locationUnitSelect")?.addEventListener("change",()=>{updateSectorLocationFloors();updateSectorLocationPlaces();});
$("locationFloorSelect")?.addEventListener("change",updateSectorLocationPlaces);
$("sectorLocationForm")?.addEventListener("submit",event=>{
  event.preventDefault();
  if(currentProfile?.perfil!=="ADM"){setMessage("sectorLocationMessage","Somente ADM pode alterar a localização.","error");return;}
  const sector=sectorLocationData.sectors.find(x=>String(x.ID_Setor)===$("locationSectorSelect").value);
  const destinationPlace=sectorLocationData.places.find(x=>String(x.ID_Local)===$("locationPlaceSelect").value);
  const reason=$("sectorLocationReason").value,notes=$("sectorLocationNotes").value.trim();
  if(!sector||!destinationPlace||!reason){setMessage("sectorLocationMessage","Selecione setor, destino e motivo.","error");return;}
  const currentId=String(sector.ID_Local_Atual??sector.ID_Local_Referencia??"");
  if(currentId===String(destinationPlace.ID_Local)){setMessage("sectorLocationMessage","O setor já está vinculado a esse local físico.","error");return;}
  const affectedAssets=sectorLocationData.assets.filter(a=>String(a.ID_Setor)===String(sector.ID_Setor));
  pendingSectorLocation={sector:{...sector,_origemDescricao:sectorLocationData.places.find(p=>String(p.ID_Local)===currentId)?buildPlaceLabel(sectorLocationData.places.find(p=>String(p.ID_Local)===currentId)):"Localização não cadastrada"},destinationPlace:{...destinationPlace,_descricaoCompleta:buildPlaceLabel(destinationPlace)},reason,notes,user:currentUser,affectedAssetCount:affectedAssets.length,affectedAssets};
  const content=$("sectorLocationReviewContent");content.replaceChildren();
  const items=[["Setor",sector.Nome_Setor],["Localização anterior",pendingSectorLocation.sector._origemDescricao],["Nova localização",buildPlaceLabel(destinationPlace)],["Bens afetados",String(pendingSectorLocation.affectedAssetCount)],["Motivo",reason],["Observações",notes||"Nenhuma observação"]];
  for(const [label,value] of items)content.append(reviewItem(label,value,label==="Observações"||label==="Nova localização"||label==="Localização anterior"));
  $("sectorLocationReview").hidden=false;$("sectorLocationReview").scrollIntoView({behavior:"smooth",block:"center"});
  setMessage("sectorLocationMessage","Confira a alteração no cartão. Nenhum bem foi atualizado individualmente.");
});
$("editSectorLocationBtn")?.addEventListener("click",()=>{pendingSectorLocation=null;$("sectorLocationReview").hidden=true;});
$("confirmSectorLocationBtn")?.addEventListener("click",async()=>{
  if(!pendingSectorLocation||currentProfile?.perfil!=="ADM")return;
  const btn=$("confirmSectorLocationBtn");btn.disabled=true;
  try{
    await changeSectorLocation(pendingSectorLocation);
    pendingSectorLocation=null;$("sectorLocationReview").hidden=true;$("sectorLocationForm").reset();
    setMessage("sectorLocationMessage","Localização do setor alterada. Os bens vinculados passam a exibir o novo local; a mudança foi registrada no histórico.","success");
    await loadSectorLocationView();await searchAssets();await refreshDashboard();
  }catch(error){setMessage("sectorLocationMessage",`Não foi possível alterar a localização: ${error.message}`,"error");}
  finally{btn.disabled=false;}
});

function renderImportResult(result) {
  const summary = $("importSummary");
  const errorsBox = $("importErrors");
  summary.hidden = false;
  errorsBox.hidden = result.errors.length === 0;
  summary.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = result.ok ? "Planilha validada" : "Validação não aprovada";
  summary.append(title);
  const list = document.createElement("ul");
  for (const [name, count] of Object.entries(result.counts || {})) {
    const li = document.createElement("li");
    li.textContent = `${name}: ${count} registro(s)`;
    list.append(li);
  }
  summary.append(list);
  errorsBox.replaceChildren();
  if (result.errors.length) {
    const heading = document.createElement("strong");
    heading.textContent = `Problemas encontrados (${result.errors.length})`;
    const errors = document.createElement("ul");
    result.errors.slice(0, 200).forEach(error => {
      const li = document.createElement("li");
      li.textContent = error;
      errors.append(li);
    });
    errorsBox.append(heading, errors);
  }
  importIsValid = result.ok;
  $("commitImportBtn").disabled = !result.ok || currentProfile?.perfil !== "ADM";
  setMessage("importMessage", result.ok
    ? (currentProfile?.perfil === "ADM" ? "A planilha passou nas validações. Revise o resumo e confirme a importação." : "A planilha passou nas validações, mas somente ADM pode confirmar a carga inicial.")
    : "Corrija os problemas indicados e valide novamente.", result.ok ? "success" : "error");
}


// Consulta unificada de transferências e baixas, com filtros combinados e paginação.
let operationsSearchPage = 1;
let operationsSearchCache = [];
async function searchOperations() {
  const host = $("operationsResults");
  const pagination = $("operationsPagination");
  if (!host) return;
  host.replaceChildren(); pagination.hidden = true;
  const [moves, disposals, assets, sectors, people] = await Promise.all([
    getCollectionRows("movimentacoes"), getCollectionRows("baixas"), getCollectionRows("bens"),
    getCollectionRows("setores"), getCollectionRows("responsaveis")
  ]);
  window.__operationsSectors = sectors; window.__operationsPeople = people;
  const type = $("operationsType").value;
  const q = id => ($(id)?.value || "").trim().toLocaleLowerCase("pt-BR");
  const from = $("operationsDateFrom").value ? new Date($("operationsDateFrom").value + "T00:00:00") : null;
  const to = $("operationsDateTo").value ? new Date($("operationsDateTo").value + "T23:59:59") : null;
  const rows = [];
  if (type !== "BAIXA") moves.filter(r => r.tipo === "TRANSFERENCIA").forEach(r => {
    const asset = assets.find(a => String(a.Tombamento) === String(r.Tombamento || r.assetSnapshot?.Tombamento));
    rows.push({type:"TRANSFERENCIA", record:r, asset, date:new Date(r.transferDate || r.criadoEm || 0), sector:[r.setorOrigemNome,r.setorDestinoNome].filter(Boolean).join(" → "), responsible:[r.originResponsibleSnapshot?.Nome_Completo,r.destinationResponsibleSnapshot?.Nome_Completo,r.issuerSnapshot?.name].filter(Boolean).join(" "), reason:r.motivo || "", document:r.transferId || r.documento || ""});
  });
  if (type !== "TRANSFERENCIA") disposals.forEach(r => {
    const asset = assets.find(a => String(a.Tombamento) === String(r.Tombamento));
    const sector = sectors.find(x => String(x.ID_Setor) === String(r.setorId || asset?.ID_Setor));
    const person = people.find(x => String(x.ID_Responsavel) === String(r.responsavelId || asset?.ID_Responsavel));
    rows.push({type:"BAIXA",record:r,asset,date:new Date(r.criadoEm || r.dataHora || r.timestamp || 0),sector:sector?.Nome_Setor || "",responsible:person?.Nome_Completo || "",reason:r.motivo || "",document:r.documentoAutorizacao || r.numeroDocumento || ""});
  });
  // Autocompletar dos filtros textuais: sugestões extraídas do histórico completo.
  const assetText = row => {
    const a = row.asset || row.record.assetSnapshot || {};
    return [row.record.Descricao_Bem, a.Descricao_Bem, a.Marca, a.Modelo].filter(Boolean);
  };
  const assetIds = row => {
    const a = row.asset || row.record.assetSnapshot || {};
    return [row.record.Tombamento, a.Tombamento, a.Numero_Serie].filter(Boolean);
  };
  const suggestionSets = {
    operationsDocument: rows.flatMap(row => [row.document, row.record.documentoAutorizacao, row.record.transferId, row.record.numeroDocumento]).filter(Boolean),
    operationsAsset: rows.flatMap(assetIds),
    operationsDescription: rows.flatMap(assetText),
    operationsSector: [...sectors.map(item => item.Nome_Setor), ...rows.flatMap(row => [row.record.setorOrigemNome, row.record.setorDestinoNome, row.sector])].filter(Boolean),
    operationsResponsible: [...people.map(item => item.Nome_Completo), ...rows.flatMap(row => [row.record.originResponsibleSnapshot?.Nome_Completo, row.record.destinationResponsibleSnapshot?.Nome_Completo, row.record.issuerSnapshot?.name, row.responsible])].filter(Boolean),
    operationsReason: rows.map(row => row.reason).filter(Boolean)
  };
  Object.entries(suggestionSets).forEach(([inputId, values]) => {
    const list = $(inputId + "Suggestions");
    if (!list) return;
    const unique = [...new Set(values.map(value => String(value).trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    list.replaceChildren();
    unique.forEach(value => { const option = document.createElement("option"); option.value = value; list.append(option); });
  });

  operationsSearchCache = rows.filter(row => {
    const asset = row.asset || row.record.assetSnapshot || {};
    const desc = [row.record.Descricao_Bem,asset.Descricao_Bem,asset.Marca,asset.Modelo].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    const tomb = [row.record.Tombamento,asset.Tombamento,asset.Numero_Serie].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    const doc = [row.document,row.record.documentoAutorizacao,row.record.transferId].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    return (!q("operationsDocument") || doc.includes(q("operationsDocument"))) && (!q("operationsAsset") || tomb.includes(q("operationsAsset"))) && (!q("operationsDescription") || desc.includes(q("operationsDescription"))) && (!q("operationsSector") || row.sector.toLocaleLowerCase("pt-BR").includes(q("operationsSector"))) && (!q("operationsResponsible") || row.responsible.toLocaleLowerCase("pt-BR").includes(q("operationsResponsible"))) && (!q("operationsReason") || row.reason.toLocaleLowerCase("pt-BR").includes(q("operationsReason"))) && (!from || row.date >= from) && (!to || row.date <= to);
  }).sort((a,b)=>b.date-a.date);
  operationsSearchPage = 1;
  renderOperationsSearchPage();
}
function renderOperationsSearchPage() {
  const host=$("operationsResults"), pagination=$("operationsPagination");
  const size=Number($("operationsPageSize").value || 25), total=operationsSearchCache.length, pages=Math.max(1,Math.ceil(total/size));
  operationsSearchPage=Math.min(operationsSearchPage,pages); host.replaceChildren();
  if (!total) { const p=document.createElement("p"); p.className="small-note"; p.textContent="Nenhuma operação corresponde aos filtros informados."; host.append(p); pagination.hidden=true; $("operationsSearchMessage").textContent="0 operações encontradas."; return; }
  const tableWrap=document.createElement("div"); tableWrap.className="table-wrap"; const table=document.createElement("table");
  table.innerHTML="<thead><tr><th>Documento</th><th>Tombamento</th><th>Bem patrimonial</th><th>Operação</th><th>Data</th><th>Ações</th></tr></thead><tbody></tbody>";
  const body=table.querySelector("tbody"), start=(operationsSearchPage-1)*size;
  operationsSearchCache.slice(start,start+size).forEach(row=>{
    const tr=document.createElement("tr"), asset=row.asset || row.record.assetSnapshot || {};
    const values=[row.document || "Não informado",row.record.Tombamento || asset.Tombamento || "—",row.record.Descricao_Bem || asset.Descricao_Bem || "Bem patrimonial",row.type==="TRANSFERENCIA"?"Transferência":"Baixa patrimonial",Number.isNaN(row.date.getTime())?"Data não informada":formatBrazilDateTime(row.date)];
    values.forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.append(td)});
    const actions=document.createElement("td"), btn=document.createElement("button"); btn.type="button";btn.className="button button-primary";btn.textContent="Baixar PDF";
    btn.addEventListener("click",()=>{ if(row.type==="TRANSFERENCIA") downloadTransferTermPdf(row.record); else {const allSectors=window.__operationsSectors||[];const allPeople=window.__operationsPeople||[];const sector=allSectors.find(x=>String(x.ID_Setor)===String(row.record.setorId||asset.ID_Setor));const person=allPeople.find(x=>String(x.ID_Responsavel)===String(row.record.responsavelId||asset.ID_Responsavel));downloadDisposalDocument(row.record,asset,sector,person);} });actions.append(btn);tr.append(actions);body.append(tr);
  });
  tableWrap.append(table);host.append(tableWrap);pagination.replaceChildren();pagination.hidden=false;
  const summary=document.createElement("span");summary.textContent=`Exibindo ${start+1}–${Math.min(start+size,total)} de ${total} operações · Página ${operationsSearchPage} de ${pages}`;pagination.append(summary);
  const prev=document.createElement("button");prev.type="button";prev.className="button button-secondary";prev.textContent="Anterior";prev.disabled=operationsSearchPage===1;prev.addEventListener("click",()=>{operationsSearchPage--;renderOperationsSearchPage()});
  const next=document.createElement("button");next.type="button";next.className="button button-secondary";next.textContent="Próxima";next.disabled=operationsSearchPage===pages;next.addEventListener("click",()=>{operationsSearchPage++;renderOperationsSearchPage()});pagination.append(prev,next);
  $("operationsSearchMessage").textContent=`${total} operação(ões) encontrada(s).`;
}
// Carrega as sugestões antes da primeira pesquisa, ao entrar nos campos de filtro.
// O datalist nativo só tinha opções depois de clicar em Pesquisar, tornando o recurso invisível inicialmente.
let operationsSuggestionsLoaded = false;
const operationFilterIds = ["operationsDocument", "operationsAsset", "operationsDescription", "operationsSector", "operationsResponsible", "operationsReason"];
async function ensureOperationsSuggestions() {
  if (operationsSuggestionsLoaded) return;
  await searchOperations();
  operationsSuggestionsLoaded = true;
}
operationFilterIds.forEach(id => {
  $(id)?.addEventListener("focus", () => {
    ensureOperationsSuggestions().catch(error => console.error("Falha ao carregar sugestões de operações:", error));
  }, { once: true });
});
$("operationsSearchNavTab")?.addEventListener("click", () => {
  ensureOperationsSuggestions().catch(error => setMessage("operationsSearchMessage", `Não foi possível carregar sugestões: ${error.message}`, "error"));
});
$("searchOperationsBtn")?.addEventListener("click",()=>searchOperations().catch(e=>setMessage("operationsSearchMessage",`Erro na consulta: ${e.message}`,"error")));
$("operationsPageSize")?.addEventListener("change",renderOperationsSearchPage);
$("clearOperationsSearchBtn")?.addEventListener("click",()=>{operationsSuggestionsLoaded=false;["operationsDocument","operationsAsset","operationsDescription","operationsSector","operationsResponsible","operationsReason","operationsDateFrom","operationsDateTo"].forEach(id=>$(id).value="");$("operationsType").value="TODAS";operationsSearchPage=1;searchOperations().catch(e=>setMessage("operationsSearchMessage",e.message,"error"));});

document.querySelectorAll(".nav-tab").forEach(button => button.addEventListener("click", async () => {
  activateView(button.dataset.view);
  if (button.dataset.view === "reportView") {
    try { await loadReportOptions(); await runGeneralReport(); }
    catch (error) { setMessage("reportMessage", `Não foi possível carregar o relatório: ${error.message}`, "error"); }
  }
  if (button.dataset.view === "assetsView") {
    try { await searchAssets(); }
    catch (error) { setMessage("assetsMessage", `Não foi possível carregar a consulta: ${error.message}`, "error"); }
  }
  if (button.dataset.view === "transferView") {
    try { await loadTransferView(); }
    catch (error) { setMessage("transferMessage", `Não foi possível carregar os dados para transferência: ${error.message}`, "error"); }
  }
  if (button.dataset.view === "disposalView") {
    try { await loadDisposalView(); }
    catch (error) { setMessage("disposalMessage", `Não foi possível carregar os bens: ${error.message}`, "error"); }
  }
  if (button.dataset.view === "referenceView") {
    try { await loadReferenceView(); }
    catch (error) { setMessage("referenceMessage", error.message, "error"); }
  }
  if (button.dataset.view === "assetFormView") {
    try { await openAssetForm(); }
    catch (error) { setMessage("assetFormMessage", error.message, "error"); }
  }
  if (button.dataset.view === "sectorLocationView") {
    try { await loadSectorLocationView(); }
    catch (error) { setMessage("sectorLocationMessage", error.message, "error"); }
  }
}));
// Relatório geral: listeners explícitos para atualizar e exportar.
$("runReportBtn").addEventListener("click", async () => {
  const button = $("runReportBtn");
  button.disabled = true;
  button.textContent = "Atualizando...";
  try { await runGeneralReport(); }
  finally { button.disabled = false; button.textContent = "Atualizar relatório"; }
});
$("exportReportExcel").addEventListener("click", exportGeneralReportExcel);
$("exportReportPdf").addEventListener("click", exportGeneralReportPdf);
["reportSearch","reportCategory","reportUnit","reportSector","reportResponsible","reportStatus","reportSort"].forEach(id => {
  const control = $(id);
  control.addEventListener(id === "reportSearch" ? "keydown" : "change", event => {
    if (id === "reportSearch" && event.key !== "Enter") return;
    if (id === "reportSearch") event.preventDefault();
    runGeneralReport();
  });
});

$("assetSearch")?.addEventListener("input", event => {
  selectedAssetSearchTombamento = "";
  const rows = assetAutocompleteRows.map(asset => ({value:String(asset.Tombamento), asset}));
  showSearchResults("assetSearchResults", rows, event.target.value,
    row => `${row.asset.Tombamento || "Sem tombamento"} — ${row.asset.Descricao_Bem || "Bem sem descrição"}`,
    row => [row.asset.Numero_Serie ? `Série: ${row.asset.Numero_Serie}` : "", row.asset.Marca, row.asset.Modelo, row.asset.Situacao || row.asset.situacao].filter(Boolean).join(" · "),
    row => {
      selectedAssetSearchTombamento = String(row.asset.Tombamento || "");
      $("assetSearch").value = `${row.asset.Tombamento || ""} — ${row.asset.Descricao_Bem || ""}`.trim();
      $("assetSearchResults").replaceChildren();
      searchAssets();
    }, "");
});
$("assetSearch")?.addEventListener("focus", () => {
  if ($("assetSearch").value.trim()) $("assetSearch").dispatchEvent(new Event("input", {bubbles:true}));
});
$("searchBtn").addEventListener("click", searchAssets);
$("assetSearch").addEventListener("keydown", event => { if (event.key === "Enter") searchAssets(); });
$("categoryFilter").addEventListener("change", searchAssets);
$("statusFilter").addEventListener("change", searchAssets);
$("sectorFilter").addEventListener("change", searchAssets);
$("responsibleFilter").addEventListener("change", searchAssets);

$("validateImportBtn").addEventListener("click", async () => {
  $("commitImportBtn").disabled = true;
  setMessage("importMessage", "Lendo e validando a planilha...");
  try {
    const result = await prepareWorkbook($("workbookFile").files[0]);
    renderImportResult(result);
  } catch (error) {
    renderImportResult({ ok: false, errors: [error.message || String(error)], counts: {} });
  }
});

$("commitImportBtn").addEventListener("click", async () => {
  if (!importIsValid || currentProfile?.perfil !== "ADM") return;
  $("commitImportBtn").disabled = true;
  setMessage("importMessage", "Salvando dados localmente. Não feche esta página...");
  try {
    await commitPreparedWorkbook(currentUser.uid);
    importIsValid = false;
    setMessage("importMessage", "Importação concluída. Confira os indicadores e a consulta dos bens.", "success");
    await refreshDashboard();
    await loadCategories();
  } catch (error) {
    setMessage("importMessage", `Importação não concluída: ${error.message}. Confira os dados locais antes de tentar novamente.`, "error");
  }
});

// Autocompletar institucional e persistência das configurações locais.
let registeredResponsibleRows = [];
let selectedManagerId = "";
let selectedIssuerPersonId = "";
function renderResponsibleSuggestions(inputId, boxId, onSelect) {
  const input = $(inputId), box = $(boxId);
  if (!input || !box) return;
  const query = input.value.trim().toLocaleLowerCase("pt-BR");
  box.replaceChildren();
  if (!query) { box.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
  const matches = registeredResponsibleRows.filter(p => p.Ativo !== "Não" && p.Ativo !== false &&
    String(p.Nome_Completo || "").toLocaleLowerCase("pt-BR").includes(query)).slice(0, 8);
  for (const p of matches) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "responsible-suggestion-card";
    const title = document.createElement("strong"); title.textContent = p.Nome_Completo || "";
    const meta = document.createElement("span");
    meta.textContent = [p.Cargo || p.Funcao || p["Função"], p.Unidade_Nome || p.Nome_Unidade, p.Setor_Nome || p.Nome_Setor].filter(Boolean).join(" · ") || `Cadastro ${p.ID_Responsavel ?? ""}`;
    button.append(title, meta);
    button.addEventListener("click", () => { input.value = p.Nome_Completo || ""; onSelect(p); box.hidden = true; input.setAttribute("aria-expanded", "false"); });
    box.append(button);
  }
  box.hidden = matches.length === 0;
  input.setAttribute("aria-expanded", String(matches.length > 0));
}
async function loadInstitutionalSettings() {
  const data = readLocalJson(INSTITUTIONAL_KEY, {});
  selectedManagerId = String(data.responsibleId || "");
  if ($("patrimonyManagerName")) {
    $("patrimonyManagerName").value = data.name || "";
    $("patrimonyManagerRole").value = data.role || "";
    $("patrimonyManagerUnit").value = data.unit || "";
    $("patrimonyManagerRegistration").value = data.registration || "";
  }
  renderIssuers();
  try {
    registeredResponsibleRows = await getCollectionRows("responsaveis");
    const manager = registeredResponsibleRows.find(p => String(p.ID_Responsavel ?? "") === selectedManagerId || p.Nome_Completo === data.name);
    if (manager) selectedManagerId = String(manager.ID_Responsavel ?? "");
  } catch (error) { console.warn("Não foi possível carregar responsáveis cadastrados", error); }
}
$("patrimonyManagerName")?.addEventListener("input", () => {
  selectedManagerId = "";
  renderResponsibleSuggestions("patrimonyManagerName", "patrimonyManagerSuggestions", p => {
    selectedManagerId = String(p.ID_Responsavel ?? "");
    $("patrimonyManagerRole").value = p.Cargo || p.Funcao || p["Função"] || $("patrimonyManagerRole").value;
    $("patrimonyManagerUnit").value = p.Unidade_Nome || p.Nome_Unidade || $("patrimonyManagerUnit").value;
    $("patrimonyManagerRegistration").value = p.Matricula || p["Matrícula"] || p.Registro || $("patrimonyManagerRegistration").value;
  });
});
$("issuerName")?.addEventListener("input", () => {
  selectedIssuerPersonId = "";
  renderResponsibleSuggestions("issuerName", "issuerNameSuggestions", p => {
    selectedIssuerPersonId = String(p.ID_Responsavel ?? "");
    $("issuerRole").value = p.Cargo || p.Funcao || p["Função"] || $("issuerRole").value;
    $("issuerRegistration").value = p.Matricula || p["Matrícula"] || p.Registro || $("issuerRegistration").value;
  });
});
document.addEventListener("click", event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  for (const [inputId, boxId] of [["patrimonyManagerName", "patrimonyManagerSuggestions"], ["issuerName", "issuerNameSuggestions"]]) {
    if (!target.closest(`#${inputId}`) && !target.closest(`#${boxId}`)) { const box = $(boxId); if (box) box.hidden = true; }
  }
});
$("institutionalSettingsForm")?.addEventListener("submit", event => {
  event.preventDefault();
  const name = $("patrimonyManagerName").value.trim();
  const person = registeredResponsibleRows.find(p => String(p.ID_Responsavel ?? "") === String(selectedManagerId) || p.Nome_Completo === name);
  if (!person) { setMessage("institutionalSettingsMessage", "Selecione um responsável cadastrado na lista de sugestões antes de salvar.", "error"); return; }
  const data = { responsibleId: String(person.ID_Responsavel ?? ""), name: person.Nome_Completo || name, role: $("patrimonyManagerRole").value.trim(), unit: $("patrimonyManagerUnit").value.trim(), registration: $("patrimonyManagerRegistration").value.trim() };
  saveLocalJson(INSTITUTIONAL_KEY, data); selectedManagerId = data.responsibleId;
  setMessage("institutionalSettingsMessage", "Responsável pelo Patrimônio salvo com sucesso.", "success");
});
$("transferIssuerForm")?.addEventListener("submit", event => {
  event.preventDefault();
  const name = $("issuerName").value.trim();
  const person = registeredResponsibleRows.find(p => String(p.ID_Responsavel ?? "") === String(selectedIssuerPersonId) || p.Nome_Completo === name);
  if (!person) { setMessage("issuerMessage", "Selecione um responsável cadastrado na lista de sugestões.", "error"); return; }
  const issuers = readLocalJson(ISSUERS_KEY, []), id = String(person.ID_Responsavel ?? Date.now());
  if (issuers.some(x => String(x.responsibleId) === id && x.active !== false)) { setMessage("issuerMessage", "Este responsável já está cadastrado como emissor ativo.", "error"); return; }
  issuers.push({ id: `issuer-${id}`, responsibleId: id, name: person.Nome_Completo || name, role: $("issuerRole").value.trim(), registration: $("issuerRegistration").value.trim(), active: true });
  saveLocalJson(ISSUERS_KEY, issuers); renderIssuers(); $("transferIssuerForm").reset();
  setMessage("issuerMessage", "Emissor autorizado cadastrado com sucesso.", "success");
});

// Inicialização pública: não há autenticação nem conexão com banco remoto.
loadInstitutionalSettings();
currentUser = { uid: "demo-local", email: "Demonstração local" };
currentProfile = { perfil: "ADM" };
showApp();
activateView("assetsView");
ensureDemoSeed().then(() => refreshDashboard()).then(async () => { await loadCategories(); await searchAssets(); }).catch(error => console.error("Falha ao carregar a demonstração local:", error));

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

const resetPhraseInput = $("resetPhrase");
const resetButton = $("resetTestDataBtn");
if (resetPhraseInput && resetButton) {
  const phrase = "APAGAR DADOS DE TESTE";
  const refreshResetButton = () => { resetButton.disabled = currentProfile?.perfil !== "ADM" || resetPhraseInput.value !== phrase; };
  resetPhraseInput.addEventListener("input", refreshResetButton);
  resetButton.addEventListener("click", async () => {
    if (currentProfile?.perfil !== "ADM" || resetPhraseInput.value !== phrase) return;
    resetButton.disabled = true;
    setMessage("resetMessage","Apagando cadastros locais...");
    try {
      await deleteTestMasterData();
      importIsValid = false;
      $("commitImportBtn").disabled = true;
      setMessage("resetMessage","Cadastros principais apagados do armazenamento deste navegador.","success");
      await refreshDashboard(); await loadCategories(); await searchAssets();
    } catch (error) {
      setMessage("resetMessage",`Não foi possível limpar os dados locais: ${error.message}`,"error");
    } finally { resetPhraseInput.value = ""; refreshResetButton(); }
  });
}
