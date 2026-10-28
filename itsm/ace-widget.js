/* ACE flutuante para a demonstração local do ITSM Portal. Sem autenticação ou serviços externos. */
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const flow = { open:false, step:'welcome', service:null, subcategory:'', description:'', name:'', unit:'', department:'', error:'', ticket:null };
let current = null;

function root() { return document.getElementById('ace-widget-root'); }
function activeServices() { return (current?.services || []).filter(s => s.active !== false).slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','pt-BR')); }
function activeSubcategories(service) { return (service?.subcategories || []).filter(sub => service.subcategoryStatus?.[sub] !== false && service.subcategoryConfig?.[sub]?.active !== false); }
function panelContent() {
  const services = activeServices();
  if (flow.step === 'welcome') return `
    <div class="ace-welcome"><div class="ace-avatar-large">ACE</div><h3>Assistente de TI</h3><p>Vou ajudar você a registrar sua solicitação. Esta demonstração salva os dados somente neste navegador.</p></div>
    <form id="ace-identity" class="ace-form">
      <label>Nome do solicitante<input id="ace-name" required maxlength="100" value="${esc(flow.name || current?.user?.name || '')}"></label>
      <div class="ace-two-cols"><label>Unidade<input id="ace-unit" required maxlength="80" value="${esc(flow.unit || current?.user?.unit || '')}"></label><label>Departamento<input id="ace-department" required maxlength="80" value="${esc(flow.department || current?.user?.department || '')}"></label></div>
      ${flow.error ? `<p class="ace-error">${esc(flow.error)}</p>` : ''}<button class="ace-primary" type="submit">Começar atendimento</button>
    </form>`;
  if (flow.step === 'services') return `<p class="ace-message">Olá, ${esc(flow.name)}. Qual serviço você precisa?</p><div class="ace-choice-list">${services.map(s=>`<button class="ace-choice" data-ace-service="${esc(s.name)}"><span><strong>${esc(s.name)}</strong><small>${esc(s.description || 'Selecione para ver as opções disponíveis.')}</small></span><b>›</b></button>`).join('') || '<p>Não há serviços ativos no catálogo.</p>'}</div><button class="ace-text-button" data-ace-back="welcome">Voltar aos dados</button>`;
  if (flow.step === 'subcategories') return `<p class="ace-message">Qual opção descreve melhor sua necessidade em <strong>${esc(flow.service?.name)}</strong>?</p><div class="ace-choice-list">${activeSubcategories(flow.service).map(sub=>`<button class="ace-choice" data-ace-sub="${esc(sub)}"><span><strong>${esc(sub)}</strong><small>Selecionar esta opção</small></span><b>›</b></button>`).join('') || '<p>Não há subcategorias ativas para este serviço.</p>'}</div><button class="ace-text-button" data-ace-back="services">Alterar serviço</button>`;
  if (flow.step === 'description') {
    const suggestion = flow.service?.subcategoryConfig?.[flow.subcategory]?.suggestedDescription || '';
    return `<p class="ace-message">Descreva o problema com suas palavras. Informe onde acontece e o que está ocorrendo.</p>${suggestion ? `<div class="ace-suggestion"><strong>Sugestão do catálogo</strong><p>${esc(suggestion)}</p><button type="button" class="ace-text-button" id="ace-use-suggestion">Usar esta sugestão</button></div>` : ''}<form id="ace-description-form" class="ace-form"><label>Descrição<textarea id="ace-description" required minlength="10" maxlength="2000" rows="5" placeholder="Ex.: A impressora da recepção não imprime os documentos.">${esc(flow.description || '')}</textarea></label>${flow.error ? `<p class="ace-error">${esc(flow.error)}</p>` : ''}<button class="ace-primary" type="submit">Conferir solicitação</button></form><button class="ace-text-button" data-ace-back="subcategories">Voltar</button>`;
  }
  if (flow.step === 'summary') return `<p class="ace-message">Confira os dados antes de abrir o chamado.</p><div class="ace-summary"><div><small>Solicitante</small><strong>${esc(flow.name)}</strong></div><div><small>Unidade / Departamento</small><strong>${esc(flow.unit)} / ${esc(flow.department)}</strong></div><div><small>Serviço</small><strong>${esc(flow.service?.name)}</strong></div><div><small>Subcategoria</small><strong>${esc(flow.subcategory)}</strong></div><div><small>Descrição</small><p>${esc(flow.description)}</p></div></div>${flow.error ? `<p class="ace-error">${esc(flow.error)}</p>` : ''}<div class="ace-actions"><button class="ace-primary" id="ace-create-ticket">Confirmar e abrir chamado</button><button class="ace-secondary" data-ace-back="description">Editar descrição</button><button class="ace-text-button" data-ace-back="services">Alterar serviço</button></div>`;
  if (flow.step === 'success') return `<div class="ace-success"><span>✓</span><h3>Chamado aberto!</h3><p>Seu chamado foi registrado no armazenamento local do navegador.</p><div class="ace-protocol">Protocolo #${new Date(flow.ticket.openedAt).getFullYear()}-${esc(flow.ticket.id)}</div><p>Ele também estará disponível nas telas de Técnico e Administrador neste navegador.</p><button class="ace-primary" id="ace-new-ticket">Abrir outro chamado</button></div>`;
  return '';
}
function renderWidget() {
  const el = root(); if (!el) return;
  el.innerHTML = `<button class="ace-launcher" id="ace-toggle" aria-label="${flow.open ? 'Fechar assistente ACE' : 'Abrir assistente ACE'}" aria-expanded="${flow.open}"><span class="ace-launcher-mark" aria-hidden="true"><svg viewBox="0 0 48 48" class="ace-robot-icon"><path d="M24 7v5M20 7h8"/><rect x="8" y="14" width="32" height="25" rx="8"/><path d="M4 23v8M44 23v8M15 23h4M29 23h4M18 32h12"/></svg></span><span class="ace-launcher-label">Assistente de TI</span><span class="ace-launcher-state">${flow.open ? '−' : '+'}</span></button>${flow.open ? `<section class="ace-panel" aria-label="Assistente de TI"><header class="ace-panel-head"><div class="ace-avatar"><svg viewBox="0 0 48 48" class="ace-robot-icon"><path d="M24 7v5M20 7h8"/><rect x="8" y="14" width="32" height="25" rx="8"/><path d="M4 23v8M44 23v8M15 23h4M29 23h4M18 32h12"/></svg></div><div><strong>Assistente de TI</strong><small>Modo de demonstração local</small></div><button id="ace-close" class="ace-close" aria-label="Fechar assistente">×</button></header><div class="ace-panel-body">${panelContent()}</div><footer class="ace-panel-foot">As informações ficam somente neste navegador.</footer></section>` : ''}`;
  document.getElementById('ace-toggle')?.addEventListener('click', () => { flow.open = !flow.open; renderWidget(); });
  document.getElementById('ace-close')?.addEventListener('click', () => { flow.open = false; renderWidget(); });
  document.getElementById('ace-identity')?.addEventListener('submit', e => { e.preventDefault(); flow.name = document.getElementById('ace-name').value.trim(); flow.unit = document.getElementById('ace-unit').value.trim(); flow.department = document.getElementById('ace-department').value.trim(); if (!flow.name || !flow.unit || !flow.department) { flow.error = 'Preencha nome, unidade e departamento.'; } else { flow.error = ''; flow.step = 'services'; } renderWidget(); });
  el.querySelectorAll('[data-ace-service]').forEach(btn => btn.addEventListener('click', () => { flow.service = servicesByName(btn.dataset.aceService); flow.subcategory = ''; flow.description = ''; flow.error = ''; flow.step = 'subcategories'; renderWidget(); }));
  el.querySelectorAll('[data-ace-sub]').forEach(btn => btn.addEventListener('click', () => { flow.subcategory = btn.dataset.aceSub; flow.description = flow.service?.subcategoryConfig?.[flow.subcategory]?.suggestedDescription || ''; flow.error = ''; flow.step = 'description'; renderWidget(); }));
  el.querySelectorAll('[data-ace-back]').forEach(btn => btn.addEventListener('click', () => { flow.step = btn.dataset.aceBack; flow.error = ''; renderWidget(); }));
  document.getElementById('ace-use-suggestion')?.addEventListener('click', () => { flow.description = flow.service?.subcategoryConfig?.[flow.subcategory]?.suggestedDescription || ''; renderWidget(); });
  document.getElementById('ace-description-form')?.addEventListener('submit', e => { e.preventDefault(); flow.description = document.getElementById('ace-description').value.trim(); if (flow.description.length < 10) flow.error = 'Descreva o problema com pelo menos 10 caracteres.'; else { flow.error = ''; flow.step = 'summary'; } renderWidget(); });
  document.getElementById('ace-create-ticket')?.addEventListener('click', () => {
    if (!current?.createTicket) { flow.error = 'Não foi possível acessar o registro local de chamados.'; renderWidget(); return; }
    try { flow.ticket = current.createTicket({ name:flow.name, unit:flow.unit, department:flow.department, username:current.user?.username || 'visitante.demo', service:flow.service.name, subcategory:flow.subcategory, description:flow.description }); flow.error = ''; flow.step = 'success'; renderWidget(); }
    catch (err) { flow.error = 'Não foi possível registrar o chamado. Tente novamente.'; renderWidget(); }
  });
  document.getElementById('ace-new-ticket')?.addEventListener('click', () => { flow.service = null; flow.subcategory = ''; flow.description = ''; flow.ticket = null; flow.error = ''; flow.step = 'services'; renderWidget(); });
}
function servicesByName(name) { return activeServices().find(s => s.name === name); }
export function mountAceWidget(options) {
  current = options;
  let el = root();
  if (options?.user?.role !== 'requester') { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'ace-widget-root'; document.body.appendChild(el); }
  renderWidget();
}
