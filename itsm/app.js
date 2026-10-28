import { mountAceWidget } from './ace-widget.js';
import {
    auth,
    db,
    googleProvider,
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    setDoc,
    query,
    where,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from './auth.js';

/* Aplicação de demonstração: todos os registros são mantidos no localStorage deste navegador. */
const users = [
    { id: 'u1', email: 'solicitante@teste.local', password: '123456', name: 'Usuário de Demonstração', username: 'usuario.demo', role: 'requester', department: 'Financeiro', unit: 'Matriz' },
    { id: 't1', email: 'tecnico1@teste.local', password: '123456', name: 'Rafael Mendes', username: 'rafael.mendes', role: 'technician' },
    { id: 't2', email: 'tecnico2@teste.local', password: '123456', name: 'Maria Costa', username: 'maria.costa', role: 'technician' }
];
const catalog = {
    'Impressora': ['Instalação', 'Impressora não funciona', 'Sem impressão', 'Troca de toner', 'Falta de papel', 'Mudança de local'],
    'Desktop e Notebooks': ['Computador não liga', 'Lentidão', 'Tela/monitor', 'Teclado ou mouse', 'Instalação de software', 'Troca de equipamento'],
    'Acesso e senha': ['Redefinição de senha', 'Bloqueio de conta', 'Novo acesso', 'Alteração de permissão', 'VPN'],
    'E-mail e colaboração': ['E-mail não envia/recebe', 'Caixa cheia', 'Criação de e-mail', 'Lista de distribuição', 'Microsoft Teams'],
    'Rede e internet': ['Sem conexão', 'Internet lenta', 'Wi‑Fi', 'Cabo de rede', 'VPN'],
    'Sistemas corporativos': ['Erro no sistema', 'Novo acesso', 'Permissão', 'Lentidão', 'Dúvida de uso'],
    'Telefonia': ['Ramal sem funcionar', 'Criação/alteração de ramal', 'Chamadas', 'Headset'],
    'Solicitações gerais': ['Dúvida', 'Orientação técnica', 'Visita técnica', 'Outro']
};
const requisitions = ['Instalação', 'Troca de toner', 'Mudança de local', 'Instalação de software', 'Troca de equipamento', 'Redefinição de senha', 'Novo acesso', 'Alteração de permissão', 'Criação de e-mail', 'Lista de distribuição', 'Criação/alteração de ramal', 'Orientação técnica', 'Visita técnica'];
const slas = { Requisição: { Baixa: 18, Média: 10, Alta: 6 }, Incidente: { Baixa: 6, Média: 4, Alta: 2 } };
const seeded = [
    { id: 1001, requester: 'ana.souza', service: 'Impressora', subcategory: 'Impressora não funciona', type: 'Incidente', priority: 'Alta', sla: 2, status: 'Aberto', responsible: null, openedAt: '2026-09-02T08:20:00', description: 'A impressora do almoxarifado não imprime documentos.' },
    { id: 1002, requester: 'carlos.lima', service: 'Acesso e senha', subcategory: 'Novo acesso', type: 'Requisição', priority: 'Alta', sla: 6, status: 'Aberto', responsible: null, openedAt: '2026-09-02T09:05:00', description: 'Necessário acesso ao sistema corporativo.' },
    { id: 1003, requester: 'beatriz.rocha', service: 'E-mail e colaboração', subcategory: 'E-mail não envia/recebe', type: 'Incidente', priority: 'Média', sla: 4, status: 'Em análise', responsible: 'Maria Costa', openedAt: '2026-09-02T09:22:00', description: 'Mensagens permanecem na caixa de saída.' },
    { id: 1004, requester: 'usuario.demo', service: 'Desktop e Notebooks', subcategory: 'Lentidão', type: 'Incidente', priority: 'Baixa', sla: 6, status: 'Concluído', responsible: 'Rafael Mendes', openedAt: '2026-09-02T07:00:00', closedAt: '2026-09-02T15:30:00', description: 'Notebook está lento para executar as atividades.' },
    { id: 1005, requester: 'ana.souza', service: 'Rede e internet', subcategory: 'Sem conexão', type: 'Incidente', priority: 'Alta', sla: 2, status: 'Concluído', responsible: 'Maria Costa', openedAt: '2026-09-02T10:00:00', closedAt: '2026-09-02T11:20:00', description: 'Estação sem acesso à rede.' }
];
const directorySeed = [
    { username: 'usuario.demo', name: 'Usuário de Demonstração', password: '123456', unit: 'Matriz', department: 'Financeiro' },
    { username: 'ana.souza', name: 'Ana Souza', password: '123456', unit: 'Matriz', department: 'Administrativo' },
    { username: 'carlos.lima', name: 'Carlos Lima', password: '123456', unit: 'Filial São Paulo', department: 'Comercial' },
    { username: 'beatriz.rocha', name: 'Beatriz Rocha', password: '123456', unit: 'Matriz', department: 'Recursos Humanos' }
];
let state = {
    user: null,
    view: 'new',
    selected: null,
    message: '',
    tickets: [],
    users: [],
    services: [],
    searchResults: [],

    minePage: 1,
    minePageSize: 25,

    queuePage: 1,
    queuePageSize: 25,

    reportPage: 1,
    reportPageSize: 25
};
const $ = s => document.querySelector(s); const pad = n => String(n).padStart(2, '0');
async function loadTickets() {
    let snapshot = await getDocs(collection(db, 'tickets'));
    if (snapshot.empty && !localStorage.getItem('delunatech-itsm-seeded-v1')) {
        for (const ticket of seeded) {
            await setDoc(doc(db, 'tickets', String(ticket.id)), ticket);
        }
        localStorage.setItem('delunatech-itsm-seeded-v1', '1');
        snapshot = await getDocs(collection(db, 'tickets'));
    }
    state.tickets = snapshot.docs.map(item => ({ firestoreId: item.id, ...item.data() }));
    return state.tickets;
}

function tickets() {

    return state.tickets;
}

async function loadUsers(
    mode = 'all'
) {

    let usersQuery;

    if (
        mode ===
        'active-requesters'
    ) {

        usersQuery =
            query(
                collection(
                    db,
                    'users'
                ),
                where(
                    'role',
                    '==',
                    'requester'
                ),
                where(
                    'active',
                    '==',
                    true
                )
            );

    } else if (
        mode ===
        'all-requesters'
    ) {

        usersQuery =
            query(
                collection(
                    db,
                    'users'
                ),
                where(
                    'role',
                    '==',
                    'requester'
                )
            );

    } else {

        usersQuery =
            collection(
                db,
                'users'
            );
    }

    let snapshot = await getDocs(usersQuery);

    if (mode === 'all' && snapshot.empty && !localStorage.getItem('delunatech-itsm-users-seeded-v1')) {
        const demoUsers = [
            ...directorySeed.map((user, index) => ({ ...user, role: 'requester', active: true, id: `demo-user-${index + 1}` })),
            { username: 'rafael.mendes', name: 'Rafael Mendes', role: 'technician', active: true, unit: 'Matriz', department: 'Tecnologia' },
            { username: 'maria.costa', name: 'Maria Costa', role: 'technician', active: true, unit: 'Matriz', department: 'Tecnologia' },
            { username: 'admin.demo', name: 'Administrador Demo', role: 'admin', active: true, unit: 'Matriz', department: 'Tecnologia' }
        ];
        for (const user of demoUsers) {
            await setDoc(doc(db, 'users', user.username), user);
        }
        localStorage.setItem('delunatech-itsm-users-seeded-v1', '1');
        snapshot = await getDocs(usersQuery);
    }

    state.users = snapshot.docs.map(userDoc => ({ firestoreId: userDoc.id, ...userDoc.data() }));
    return state.users;
}

async function loadServices() {

    const snapshot = await getDocs(
        collection(db, 'services')
    );

    if (snapshot.empty) {

        for (const service of Object.keys(catalog)) {

            await setDoc(
                doc(db, 'services', service),
                {
                    name: service,
                    subcategories: catalog[service],
                    active: true
                }
            );

        }

        return loadServices();
    }

    state.services = snapshot.docs.map(serviceDoc => {
        const data = serviceDoc.data();
        const subcategories = Array.isArray(data.subcategories) ? data.subcategories : [];
        const subcategoryStatus = data.subcategoryStatus || Object.fromEntries(subcategories.map(subcategory => [subcategory, true]));
        const subcategoryConfig = { ...(data.subcategoryConfig || {}) };
        let configChanged = false;

        // Garante configuração de tipo, criticidade e SLA para cada subcategoria da demonstração.
        for (const subcategory of subcategories) {
            if (!subcategoryConfig[subcategory] || !subcategoryConfig[subcategory].type || !subcategoryConfig[subcategory].criticality || !(Number(subcategoryConfig[subcategory].sla) > 0)) {
                const name = String(subcategory).toLocaleLowerCase('pt-BR');
                const type = typeFor(subcategory);
                const criticality = /(não funciona|nao funciona|não liga|nao liga|sem conexão|sem conexao|bloqueio|indisponível|indisponivel|falha geral|parado)/.test(name)
                    ? 'Alta'
                    : /(dúvida|duvida|orientação|orientacao|consulta|informação|informacao|outro)/.test(name)
                        ? 'Baixa' : 'Média';
                const fallbackSla = Number(slas[type]?.[criticality]) || 4;
                subcategoryConfig[subcategory] = { ...(subcategoryConfig[subcategory] || {}), type, criticality, sla: fallbackSla };
                configChanged = true;
            }
        }
        const service = { firestoreId: serviceDoc.id, ...data, subcategoryStatus, subcategoryConfig };
        if (configChanged) setDoc(doc(db, 'services', serviceDoc.id), { ...data, subcategoryStatus, subcategoryConfig }).catch(err => console.warn('Não foi possível persistir configurações locais do catálogo:', err));
        return service;
    });

    return state.services;
}

function directory() { const stored = localStorage.getItem('itsm-demo-users'); if (!stored) { localStorage.setItem('itsm-demo-users', JSON.stringify(directorySeed)); return [...directorySeed] } const list = JSON.parse(stored), migrated = list.map(u => ({ ...u, password: u.password || '123456' })); if (JSON.stringify(list) !== JSON.stringify(migrated)) localStorage.setItem('itsm-demo-users', JSON.stringify(migrated)); return migrated }
function saveDirectory(list) { localStorage.setItem('itsm-demo-users', JSON.stringify(list)) }
function formatDate(v) { const d = new Date(v); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}` }

function ajustarInicioSLA(data) {

    const d = new Date(data);

    while (true) {

        const dia =
            d.getDay();

        // Sábado ou domingo
        if (dia === 0 || dia === 6) {

            d.setDate(
                d.getDate() +
                (dia === 6 ? 2 : 1)
            );

            d.setHours(
                8,
                0,
                0,
                0
            );

            continue;
        }

        // Antes das 08:00
        if (d.getHours() < 8) {

            d.setHours(
                8,
                0,
                0,
                0
            );

            return d;
        }

        // Às 18:00 ou depois
        if (
            d.getHours() > 18 ||
            (
                d.getHours() === 18 &&
                (
                    d.getMinutes() > 0 ||
                    d.getSeconds() > 0 ||
                    d.getMilliseconds() > 0
                )
            )
        ) {

            d.setDate(
                d.getDate() + 1
            );

            d.setHours(
                8,
                0,
                0,
                0
            );

            continue;
        }

        return d;
    }
}


function adicionarHorasUteis(
    inicio,
    horas
) {

    let d =
        ajustarInicioSLA(
            inicio
        );

    let restantes =
        Number(horas);

    while (restantes > 0) {

        const dia =
            d.getDay();

        // Fim de semana
        if (
            dia === 0 ||
            dia === 6
        ) {

            d =
                ajustarInicioSLA(
                    d
                );

            continue;
        }

        const fimExpediente =
            new Date(d);

        fimExpediente.setHours(
            18,
            0,
            0,
            0
        );

        const horasDisponiveis =
            (
                fimExpediente.getTime() -
                d.getTime()
            ) /
            (
                60 * 60 * 1000
            );

        if (
            restantes <=
            horasDisponiveis
        ) {

            d.setTime(
                d.getTime() +
                restantes *
                60 *
                60 *
                1000
            );

            restantes = 0;

        } else {

            restantes -=
                horasDisponiveis;

            d.setDate(
                d.getDate() + 1
            );

            d.setHours(
                8,
                0,
                0,
                0
            );

            d =
                ajustarInicioSLA(
                    d
                );
        }
    }

    return d;
}


function deadline(t) {

    if (
        !t ||
        !Number.isFinite(
            Number(t.sla)
        ) ||
        Number(t.sla) <= 0
    ) {

        return null;
    }

    /*
     * Chamado que já foi retomado após uma pendência.
     *
     * O SLA continua a partir do momento da retomada,
     * utilizando apenas o tempo restante calculado antes.
     */
    if (
        Number.isFinite(
            Number(t.slaRemainingMinutes)
        ) &&
        Number(t.slaRemainingMinutes) > 0 &&
        t.slaResumeAt
    ) {

        return adicionarHorasUteis(
            t.slaResumeAt,
            Number(t.slaRemainingMinutes) / 60
        );
    }

    /*
     * Chamados antigos ou que ainda não passaram
     * por uma pendência continuam utilizando
     * o cálculo original.
     */
    if (!t.openedAt) {

        return null;
    }

    return adicionarHorasUteis(
        t.openedAt,
        Number(t.sla)
    );
}

function horasUteisEntre(
    inicio,
    fim
) {

    const inicioDate =
        new Date(inicio);

    const fimDate =
        new Date(fim);

    if (
        Number.isNaN(
            inicioDate.getTime()
        ) ||
        Number.isNaN(
            fimDate.getTime()
        ) ||
        fimDate <= inicioDate
    ) {

        return 0;
    }

    let totalHoras = 0;

    const diaAtual =
        new Date(inicioDate);

    diaAtual.setHours(
        0,
        0,
        0,
        0
    );

    while (
        diaAtual <= fimDate
    ) {

        const dia =
            diaAtual.getDay();

        // Sábado e domingo não contam
        if (
            dia !== 0 &&
            dia !== 6
        ) {

            const inicioExpediente =
                new Date(diaAtual);

            inicioExpediente.setHours(
                8,
                0,
                0,
                0
            );

            const fimExpediente =
                new Date(diaAtual);

            fimExpediente.setHours(
                18,
                0,
                0,
                0
            );

            const inicioContagem =
                inicioDate > inicioExpediente
                    ? inicioDate
                    : inicioExpediente;

            const fimContagem =
                fimDate < fimExpediente
                    ? fimDate
                    : fimExpediente;

            if (
                fimContagem >
                inicioContagem
            ) {

                totalHoras +=
                    (
                        fimContagem.getTime() -
                        inicioContagem.getTime()
                    ) /
                    (
                        60 * 60 * 1000
                    );
            }
        }

        diaAtual.setDate(
            diaAtual.getDate() + 1
        );
    }

    return totalHoras;
}

function criarRegistroPendencia(
    reason,
    description,
    responsible
) {

    return {

        reason,

        description:
            description || '',

        responsible,

        startedAt:
            new Date().toISOString(),

        endedAt:
            null,

        totalMinutes:
            null,

        usefulMinutes:
            null
    };
}

function slaResult(t) {

    const limit =
        deadline(t);

    if (
        !t.closedAt ||
        !limit
    ) {

        return null;
    }

    return new Date(t.closedAt) <= limit
        ? 'Dentro da SLA'
        : 'Em atraso';
}

function formatarTempoSLA(horas) {

    const minutos =
        Math.max(
            0,
            Math.round(
                Number(horas) * 60
            )
        );

    const horasInteiras =
        Math.floor(
            minutos / 60
        );

    const minutosRestantes =
        minutos % 60;

    return `
        ${horasInteiras}h
        ${minutosRestantes}min
    `;
}

function slaInfo(t) {

    const result =
        slaResult(t);

    if (result) {

        return `
            <strong class="${result === 'Dentro da SLA'
                ? 'sla-ok'
                : 'sla-late'}">

                ${result}

            </strong>

            <br>

            <span class="muted">

                Encerrado:
                ${formatDate(t.closedAt)}

            </span>
        `;
    }

    /*
     * Chamado atualmente pendente
     */

    if (
        t.status === 'Pendente' &&
        Array.isArray(t.pendingHistory)
    ) {

        const pendenciaAtual =
            [...t.pendingHistory]
                .reverse()
                .find(
                    item =>
                        !item.endedAt
                );

        if (pendenciaAtual) {

            const limit =
                deadline(t);

            if (limit) {

                const horasRestantes =
                    horasUteisEntre(
                        pendenciaAtual.startedAt,
                        limit
                    );

                return `
                    <strong>
                        SLA pausada
                    </strong>

                    <br>

                    <span class="muted">
                        Desde:
                        ${formatDate(
                    pendenciaAtual.startedAt
                )}
                    </span>

                    <br>

                    <span class="muted">
                        Restante:
                        ${formatarTempoSLA(
                    horasRestantes
                )}
                    </span>
                `;
            }
        }
    }

    const limit =
        deadline(t);

    if (!limit) {

        return `
            <span class="muted">
                SLA não definida
            </span>
        `;
    }

    return `
        <span class="muted">
            Limite:
            ${formatDate(limit)}
        </span>
    `;
}
function typeFor(sub) { return requisitions.includes(sub) ? 'Requisição' : 'Incidente' }
function badge(status) {

    let classe = 'done';

    if (status === 'Aberto') {

        classe = 'open';

    } else if (status === 'Em análise') {

        classe = 'analysis';

    } else if (status === 'Pendente') {

        classe = 'pending';
    }

    return `
        <span class="badge ${classe}">
            ${status}
        </span>
    `;
}
function login() {
    return `
      <main class="login">
        <section class="login-card profile-picker">
          <div class="brand"><img class="brand-logo" src="assets/delunatech-icon.png" alt="DeLunaTech" /><div><h1>DeLunaTech <span class="brand-divider">|</span> Portal ITSM</h1><p>Tecnologia que simplifica. · Ambiente local de demonstração</p></div></div>
          <h2>Escolha o perfil que deseja testar</h2>
          <p class="hint">Todos os dados são fictícios e ficam somente neste navegador.</p>
          <div class="profile-options">
            <button type="button" class="profile-option" data-demo-profile="requester"><span class="profile-icon">U</span><strong>Usuário</strong><span>Abrir chamados e acompanhar solicitações.</span><b>Entrar como usuário →</b></button>
            <button type="button" class="profile-option" data-demo-profile="technician"><span class="profile-icon">T</span><strong>Técnico</strong><span>Atender chamados, registrar soluções e atualizar status.</span><b>Entrar como técnico →</b></button>
            <button type="button" class="profile-option" data-demo-profile="admin"><span class="profile-icon">A</span><strong>Administrador</strong><span>Acessar todas as áreas e configurações do sistema.</span><b>Entrar como administrador →</b></button>
          </div>
          <div class="local-demo-note"><strong>Modo de demonstração local</strong><br>As alterações afetam apenas os dados salvos no seu navegador. Não há conexão com banco de dados online.</div>
          <p style="text-align:center;margin:16px 0 0;color:#526078;font-size:13px">Entre como Usuário para experimentar o assistente ACE flutuante.</p>
        </section>
      </main>`;
}

function cadastro() {
    return `
        <main class="login">
            <section class="login-card">

                <div class="brand">
                    <img class="brand-logo" src="assets/delunatech-icon.png" alt="DeLunaTech" />
                    <div>
                        <h1>DeLunaTech <span class="brand-divider">|</span> Portal ITSM</h1>
                        <p>Criação de conta</p>
                    </div>
                </div>

                <h2>Criar conta</h2>

                <p class="hint">
                    Crie sua conta para acessar o Portal ITSM DeLunaTech.
                </p>

                <form id="register-form">

                    <label>Nome</label>
                    <input
                        id="register-name"
                        type="text"
                        required
                        autocomplete="name"
                        placeholder="Seu nome completo"
                    >

                    <label style="margin-top:16px">
                        E-mail
                    </label>

                    <input
                        id="register-email"
                        type="email"
                        required
                        autocomplete="email"
                        placeholder="seu.email@empresa.com"
                    >

                    <label style="margin-top:16px">
                        Senha
                    </label>

                    <input
                        id="register-password"
                        type="password"
                        required
                        minlength="6"
                        autocomplete="new-password"
                        placeholder="Mínimo de 6 caracteres"
                    >

                    <label style="margin-top:16px">
                        Confirmar senha
                    </label>

                    <input
                        id="register-password-confirm"
                        type="password"
                        required
                        minlength="6"
                        autocomplete="new-password"
                        placeholder="Digite a senha novamente"
                    >

                    <div id="register-error"></div>

                    <button
                        type="submit"
                        class="primary"
                        style="width:100%;margin-top:22px"
                    >
                        Criar conta
                    </button>

                </form>

                <button
                    id="back-to-login"
                    class="secondary"
                    type="button"
                    style="width:100%;margin-top:12px"
                >
                    Voltar para o login
                </button>

            </section>
        </main>
    `;
}
function shell(content) {

    const tech = state.user.role === 'technician';
    const admin = state.user.role === 'admin';

    let navigation = '';

    if (admin) {

        navigation = `
        <button
            class="nav ${state.view === 'admin' ? 'active' : ''}"
            data-view="admin"
        >
            Administração
        </button>

        <button
    class="nav ${state.view === 'admin-reports' ? 'active' : ''}"
    data-view="admin-reports"
>
    Relatórios Gerenciais
</button>

        <button
            class="nav ${state.view === 'queue' ? 'active' : ''}"
            data-view="queue"
        >
            Fila de chamados
        </button>

        <button
    class="nav ${state.view === 'new-on-behalf' ? 'active' : ''}"
    data-view="new-on-behalf"
>
    Abrir em nome de solicitante
</button>

<button
    class="nav ${state.view === 'search-tickets' ? 'active' : ''}"
    data-view="search-tickets"
>
    Pesquisar chamados
</button>
    `;

    } else if (tech) {

        navigation = `
        <button
            class="nav ${state.view === 'queue' ? 'active' : ''}"
            data-view="queue"
        >
            Fila de chamados
        </button>

        <button
            class="nav ${state.view === 'new-on-behalf' ? 'active' : ''}"
            data-view="new-on-behalf"
        >
            Abrir em nome de solicitante
        </button>

        <button
    class="nav ${state.view === 'search-tickets' ? 'active' : ''}"
    data-view="search-tickets"
>
    Pesquisar chamados
</button>
    `;

    } else {

        navigation = `
            <button
                class="nav ${state.view === 'new' ? 'active' : ''}"
                data-view="new"
            >
                Abrir novo chamado
            </button>

            <button
                class="nav ${state.view === 'mine' ? 'active' : ''}"
                data-view="mine"
            >
                Meus chamados
            </button>
        `;
    }

    const label =
        admin
            ? 'ADMINISTRAÇÃO'
            : tech
                ? 'EQUIPE DE SUPORTE'
                : 'SOLICITANTE';

    return `
        <div class="shell">

            <header class="topbar">

                <div class="brand">
                    <img class="brand-logo" src="assets/delunatech-icon.png" alt="DeLunaTech" />

                    <div>
                        <h1>DeLunaTech <span class="brand-divider">|</span> Portal ITSM</h1>
                        <p>Ambiente local de demonstração</p>
                    </div>
                </div>

                <div class="userbar">
                    <span>${state.user.name}</span>
                    <button class="logout" id="logout">
                        Sair
                    </button>
                </div>

            </header>

            <div class="layout">

                <aside class="sidebar">

                    <div class="nav-label">
                        ${label}
                    </div>

                    ${navigation}

                </aside>

                <main class="main">
                    ${content}
                </main>

            </div>

        </div>
    `;
}
function newTicket() {

    const services = state.services
        .filter(service => service.active !== false)
        .sort((a, b) =>
            (a.name || '').localeCompare(
                b.name || '',
                'pt-BR'
            )
        )
        .map(service => `
            <option value="${service.name}">
                ${service.name}
            </option>
        `)
        .join('');
    return shell(`<div class="page-head"><div><h2>Abrir novo chamado</h2><p>Informe os dados para registrar sua solicitação.</p></div></div><section class="card"><form id="ticket-form"><div class="form-grid"><div><label>Nome do solicitante</label><input readonly value="${state.user.name}"></div><div><label>Unidade / Departamento</label><input readonly value="${state.user.unit} / ${state.user.department}"></div><div><label>Serviço</label><select id="service" required><option value="">Selecione um serviço</option>${services}</select></div><div><label>Subcategoria</label><select id="subcategory" required disabled><option>Escolha primeiro um serviço</option></select></div><div><label>Tipo de chamado</label><input id="type" readonly value="Será definido automaticamente"><p class="readonly-note">Classificação automática.</p></div><div><label>SLA de resolução</label><input id="sla" readonly value="Selecione prioridade e subcategoria"><p class="readonly-note">Prazo calculado automaticamente.</p></div>
            
            <div>
    <label>Criticidade</label>
    <input
        id="criticality"
        readonly
        value="Será definida automaticamente"
    >
    <p class="readonly-note">
        Definida pela configuração da subcategoria.
    </p>
</div>
            
            <div class="full"><label>Descrição</label><textarea id="description" required placeholder="Descreva o motivo do chamado com suas palavras."></textarea></div></div><div class="actions"><button type="reset" class="secondary">Limpar</button><button class="primary">Criar chamado</button></div></form></section>`)
}

function newTicketOnBehalf() {

    const services =
        state.services
            .filter(
                service =>
                    service.active !== false
            )
            .sort(
                (a, b) =>
                    (a.name || '').localeCompare(
                        b.name || '',
                        'pt-BR'
                    )
            )
            .map(
                service => `
                    <option
                        value="${service.name}"
                    >
                        ${service.name}
                    </option>
                `
            )
            .join('');

    return shell(`
        <div class="page-head">

            <div>

                <h2>
                    Abrir chamado em nome de outro solicitante
                </h2>

                <p>
                    Registre um chamado recebido por telefone,
                    atendimento presencial ou outro canal.
                </p>

            </div>

        </div>

        <section class="card">

            <div
                class="message"
                style="margin-bottom:20px"
            >

                <strong>
                    Aberto por:
                </strong>

                ${state.user.name}

                <br>

                <strong>
                    Perfil:
                </strong>

                ${state.user.role === 'admin'
            ? 'Administrador'
            : 'Técnico'
        }

            </div>

            <form id="ticket-on-behalf-form">

                <div class="form-grid">

                    <div class="full">

                        <label>
                            Em nome de
                        </label>

                        <input
                            type="text"
                            id="on-behalf-requester-search"
                            autocomplete="off"
                            placeholder="Digite o nome do solicitante"
                        >

                        <input
                            type="hidden"
                            id="on-behalf-requester"
                        >

                        <div
                            id="on-behalf-requester-results"
                            style="
                                margin-top:6px;
                                display:none;
                                border:1px solid #d7e0eb;
                                border-radius:8px;
                                background:#fff;
                                max-height:220px;
                                overflow-y:auto;
                            "
                        ></div>

                        <div
                            id="on-behalf-requester-selected"
                            style="
                                margin-top:8px;
                                display:none;
                                padding:10px 12px;
                                border-radius:8px;
                                background:#eef6ff;
                            "
                        ></div>

                    </div>

                    <div>

                        <label>
                            Serviço
                        </label>

                        <select
                            id="on-behalf-service"
                            required
                        >

                            <option value="">
                                Selecione um serviço
                            </option>

                            ${services}

                        </select>

                    </div>

                    <div>

                        <label>
                            Subcategoria
                        </label>

                        <select
                            id="on-behalf-subcategory"
                            required
                            disabled
                        >

                            <option value="">
                                Escolha primeiro um serviço
                            </option>

                        </select>

                    </div>

                    <div>

                        <label>
                            Tipo de chamado
                        </label>

                        <input
                            id="on-behalf-type"
                            readonly
                            value="Será definido automaticamente"
                        >

                    </div>

                    <div>

                        <label>
                            Criticidade
                        </label>

                        <input
                            id="on-behalf-criticality"
                            readonly
                            value="Será definida automaticamente"
                        >

                    </div>

                    <div>

                        <label>
                            SLA de resolução
                        </label>

                        <input
                            id="on-behalf-sla"
                            readonly
                            value="Será definido automaticamente"
                        >

                    </div>

                    <div class="full">

                        <label>
                            Descrição
                        </label>

                        <textarea
                            id="on-behalf-description"
                            required
                            placeholder="Descreva o motivo do chamado."
                        ></textarea>

                    </div>

                </div>

                <div class="actions">

                    <button
                        type="button"
                        class="secondary"
                        data-view="queue"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="primary"
                        disabled
                    >
                        Criar chamado
                    </button>

                </div>

            </form>

        </section>
    `);
}


function mine() {

    const meusChamados =
        tickets()
            .filter(
                t =>
                    t.requester ===
                    state.user.username
            )
            .sort(
                (a, b) =>
                    new Date(b.openedAt) -
                    new Date(a.openedAt)
            );

    const filtro =
        state.mineStatus ||
        'Todos';

    const listaFiltrada =
        filtro === 'Todos'
            ? meusChamados
            : filtro === 'Resolvidos'
                ? meusChamados.filter(
                    t =>
                        t.status ===
                        'Concluído'
                )
                : meusChamados.filter(
                    t =>
                        t.status !==
                        'Concluído'
                );

                    const totalChamados =
        listaFiltrada.length;

    const totalPaginas =
        Math.max(
            1,
            Math.ceil(
                totalChamados /
                state.minePageSize
            )
        );

    if (
        state.minePage >
        totalPaginas
    ) {
        state.minePage =
            totalPaginas;
    }

    const inicio =
        (state.minePage - 1) *
        state.minePageSize;

    const fim =
        Math.min(
            inicio +
            state.minePageSize,
            totalChamados
        );

    const chamadosPagina =
        listaFiltrada.slice(
            inicio,
            fim
        );

    return shell(`

        <div class="page-head">

            <div>

                <h2>
                    Meus chamados
                </h2>

                <p>
                    Acompanhe os tickets registrados
                    em seu nome.
                </p>

            </div>

            <button
                class="primary"
                data-view="new"
            >
                + Abrir novo chamado
            </button>

        </div>

        <section class="card">

            <div
                style="
                    display:flex;
                    align-items:center;
                    gap:12px;
                    margin-bottom:20px;
                    flex-wrap:wrap;
                "
            >

                <label
                    for="mine-status"
                    style="margin:0"
                >
                    Status:
                </label>

                <select
                    id="mine-status"
                    style="max-width:280px"
                >

                    <option
                        value="Todos"
                        ${filtro === 'Todos'
            ? 'selected'
            : ''
        }
                    >
                        Todos
                    </option>

                    <option
                        value="Em andamento"
                        ${filtro === 'Em andamento'
            ? 'selected'
            : ''
        }
                    >
                        Em andamento
                    </option>

                    <option
                        value="Resolvidos"
                        ${filtro === 'Resolvidos'
            ? 'selected'
            : ''
        }
                    >
                        Resolvidos
                    </option>

                </select>

            </div>

            ${totalChamados
    ? `
        ${table(
            chamadosPagina,
            false
        )}

        <div
            style="
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:12px;
                flex-wrap:wrap;
                margin-top:18px;
            "
        >

            <span class="muted">
                Exibindo
                ${totalChamados ? inicio + 1 : 0}
                a
                ${fim}
                de
                ${totalChamados}
                chamados
            </span>

            <div
                style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    flex-wrap:wrap;
                "
            >

                <label
                    for="mine-page-size"
                    style="margin:0"
                >
                    Por página:
                </label>

                <select
                    id="mine-page-size"
                    style="width:auto"
                >
                    <option value="25"
                        ${state.minePageSize === 25 ? 'selected' : ''}>
                        25
                    </option>

                    <option value="50"
                        ${state.minePageSize === 50 ? 'selected' : ''}>
                        50
                    </option>

                    <option value="100"
                        ${state.minePageSize === 100 ? 'selected' : ''}>
                        100
                    </option>
                </select>

                <button
                    type="button"
                    id="mine-prev"
                    ${state.minePage <= 1 ? 'disabled' : ''}
                >
                    Anterior
                </button>

                <span>
                    Página ${state.minePage} de ${totalPaginas}
                </span>

                <button
                    type="button"
                    id="mine-next"
                    ${state.minePage >= totalPaginas ? 'disabled' : ''}
                >
                    Próxima
                </button>

            </div>

        </div>
    `
    : `
        <div class="empty">
            Nenhum chamado encontrado
            para o filtro selecionado.
        </div>
    `
}

        </section>

    `);
}

function table(list, tech) {
    return `
        <div class="table-wrap">
            <table class="tickets">
                <thead>
                    <tr>
                        <th>Ticket</th>
                        <th>Solicitante</th>
                        <th>Aberto por</th>
                        <th>Serviço</th>
                        <th>Tipo</th>
                        <th>Aberto em</th>
                        <th>Status</th>

                        ${tech
            ? `
                                    <th>SLA</th>
                                    <th>Responsável</th>
                                    <th>Ação</th>
                                `
            : ''
        }
                    </tr>
                </thead>

                <tbody>
                    ${list
            .map(
                t => `
                                    <tr>
                                        <td>
                                            <button
                                                class="ticket-link"
                                                data-ticket="${t.id}"
                                            >
                                               ${numeroChamado(t)}
                                            </button>
                                        </td>

                                        <td>
    ${t.requesterName || t.requester}
</td>

<td>
    ${!t.openedBy
        ? '<span class="muted">Não informado</span>'
        : t.openedBy === t.requester
            ? 'Próprio solicitante'
            : t.openedBy
    }
</td>

<td>
    ${t.service}
</td>

<td>
    ${t.type || '<span class="muted">Não informado</span>'}
</td>

<td>
    ${formatDate(t.openedAt)}
</td>

                                        <td>
                                            ${badge(t.status)}
                                        </td>

                                        ${tech
                        ? `
                                                    <td>
                                                        ${slaInfo(t)}
                                                    </td>

                                                    <td>
                                                        ${t.responsible ||
                        '<span class="muted">Não atribuído</span>'
                        }
                                                    </td>

                                                    <td>
    ${!t.responsible
                            ? `
                <button
                    class="primary capture"
                    data-capture="${t.id}"
                >
                    Capturar
                </button>
            `
                            : t.responsible !== state.user.name &&
                                t.status !== 'Concluído'
                                ? `
        <button
            class="primary assume"
            data-assume="${t.id}"
        >
            Assumir atendimento
        </button>
    `
                                : `
                    <button
                        class="secondary"
                        data-ticket="${t.id}"
                    >
                        Visualizar
                    </button>
                `
                        }
</td>
                                                `
                        : ''
                    }
                                    </tr>
                                `
            )
            .join('')
        }
                </tbody>
            </table>
        </div>
    `;
}

function searchTickets() {

    return shell(`

        <div class="page-head">

            <div>

                <h2>
                    Pesquisar chamados
                </h2>

                <p>
                    Consulte chamados atuais e históricos.
                </p>

            </div>

        </div>

        <section class="card">

            <div class="form-grid">

                <div>
    <label>
        Número do chamado
    </label>

    <input
        id="search-ticket-number"
        type="text"
        placeholder="Ex.: 2026-1047"
    >
</div>

<div>
    <label>
        Solicitante
    </label>

    <input
        id="search-requester"
        type="text"
        autocomplete="off"
        placeholder="Nome, usuário ou e-mail"
    >

    <input
        type="hidden"
        id="search-requester-id"
    >

    <div
        id="search-requester-results"
        style="
            margin-top:6px;
            display:none;
            border:1px solid #d7e0eb;
            border-radius:8px;
            background:#fff;
            max-height:220px;
            overflow-y:auto;
        "
    ></div>
</div>

                <div>
                    <label>
                        Técnico responsável
                    </label>

                    <select
    id="search-responsible"
>
    <option value="">
        Todos
    </option>

    ${
        state.users
            .filter(
                user =>
                    user.role === 'technician' &&
                    user.active !== false
            )
            .sort(
                (a, b) =>
                    (a.name || '')
                        .localeCompare(
                            b.name || '',
                            'pt-BR'
                        )
            )
            .map(
                user => `
                    <option
                        value="${user.name}"
                    >
                        ${user.name}
                    </option>
                `
            )
            .join('')
    }

</select>
                </div>

                <div>
                    <label>
                        Serviço
                    </label>

                    <select
                        id="search-service"
                    >
                        <option value="">
                            Todos
                        </option>
                    </select>
                </div>

                <div>
                    <label>
                        Status
                    </label>

                    <select
                        id="search-status"
                    >
                        <option value="">
                            Todos
                        </option>

                        <option value="Aberto">
                            Aberto
                        </option>

                        <option value="Em análise">
                            Em análise
                        </option>

                        <option value="Pendente">
                            Pendente
                        </option>

                        <option value="Concluído">
                            Concluído
                        </option>
                    </select>
                </div>

                <div>
                    <label>
                        Tipo
                    </label>

                    <select
                        id="search-type"
                    >
                        <option value="">
                            Todos
                        </option>

                        <option value="Incidente">
                            Incidente
                        </option>

                        <option value="Requisição">
                            Requisição
                        </option>
                    </select>
                </div>

                <div>
                    <label>
                        Data inicial
                    </label>

                    <input
                        id="search-date-start"
                        type="date"
                    >
                </div>

                <div>
                    <label>
                        Data final
                    </label>

                    <input
                        id="search-date-end"
                        type="date"
                    >
                </div>

            </div>

            <div class="actions">

                <button
                    type="button"
                    class="secondary"
                    id="clear-ticket-search"
                >
                    Limpar
                </button>

                <button
                    type="button"
                    class="primary"
                    id="execute-ticket-search"
                >
                    Pesquisar chamados
                </button>

            </div>

        </section>

        <section
            class="card"
            style="margin-top:20px"
        >

            <div
    class="empty"
    id="search-results"
>
    Utilize os filtros acima para pesquisar chamados.
</div>

        </section>

    `);
}

function queue() {

    const responsaveis =
        [
            ...new Set(
                tickets()
                    .map(
                        ticket =>
                            ticket.responsible
                    )
                    .filter(Boolean)
            )
        ]
            .sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        'pt-BR'
                    )
            );

    const filtro =
        state.queueResponsible ||
        'Todos';

    const listaFiltrada =
        filtro === 'Todos'
            ? tickets()
            : tickets().filter(
                ticket =>
                    ticket.responsible ===
                    filtro
            );

    const list =
        listaFiltrada.sort(
            (a, b) =>
                new Date(b.openedAt) -
                new Date(a.openedAt)
        );

            const totalChamados =
        list.length;

    const totalPaginas =
        Math.max(
            1,
            Math.ceil(
                totalChamados /
                state.queuePageSize
            )
        );

    if (
        state.queuePage >
        totalPaginas
    ) {
        state.queuePage =
            totalPaginas;
    }

    const inicio =
        (state.queuePage - 1) *
        state.queuePageSize;

    const fim =
        Math.min(
            inicio +
            state.queuePageSize,
            totalChamados
        );

    const chamadosPagina =
        list.slice(
            inicio,
            fim
        );

    return shell(`

        <div class="page-head">

            <div>

                <h2>
                    Fila de chamados
                </h2>

                <p>
                    Chamados em ordem de abertura.
                    Capture um ticket para assumir o atendimento.
                </p>

            </div>

        </div>

        <section class="card">

            <div
                style="
                    display:flex;
                    align-items:center;
                    gap:12px;
                    margin-bottom:20px;
                    flex-wrap:wrap;
                "
            >

                <label
                    for="queue-responsible"
                    style="margin:0"
                >
                    Responsável:
                </label>

                <select
                    id="queue-responsible"
                    style="max-width:280px"
                >

                    <option
                        value="Todos"
                        ${filtro === 'Todos'
            ? 'selected'
            : ''
        }
                    >
                        Todos
                    </option>

                    ${responsaveis
            .map(
                responsavel => `
                                    <option
                                        value="${responsavel}"
                                        ${filtro === responsavel
                        ? 'selected'
                        : ''
                    }
                                    >
                                        ${responsavel}
                                    </option>
                                `
            )
            .join('')
        }

                </select>

            </div>

           ${totalChamados
    ? `
        ${table(
            chamadosPagina,
            true
        )}

        <div
            style="
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:12px;
                flex-wrap:wrap;
                margin-top:18px;
            "
        >

            <span class="muted">
                Exibindo
                ${inicio + 1}
                a
                ${fim}
                de
                ${totalChamados}
                chamados
            </span>

            <div
                style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    flex-wrap:wrap;
                "
            >

                <label
                    for="queue-page-size"
                    style="margin:0"
                >
                    Por página:
                </label>

                <select
                    id="queue-page-size"
                    style="width:auto"
                >
                    <option value="25"
                        ${state.queuePageSize === 25 ? 'selected' : ''}>
                        25
                    </option>

                    <option value="50"
                        ${state.queuePageSize === 50 ? 'selected' : ''}>
                        50
                    </option>

                    <option value="100"
                        ${state.queuePageSize === 100 ? 'selected' : ''}>
                        100
                    </option>
                </select>

                <button
                    type="button"
                    id="queue-prev"
                    ${state.queuePage <= 1 ? 'disabled' : ''}
                >
                    Anterior
                </button>

                <span>
                    Página ${state.queuePage} de ${totalPaginas}
                </span>

                <button
                    type="button"
                    id="queue-next"
                    ${state.queuePage >= totalPaginas ? 'disabled' : ''}
                >
                    Próxima
                </button>

            </div>

        </div>
    `
    : `
        <div class="empty">
            Nenhum chamado encontrado
            para o responsável selecionado.
        </div>
    `
}

        </section>

    `);
}
function usersPage() { const list = directory(); return shell(`<div class="page-head"><div><h2>Cadastro de usuários</h2><p>Base local que simula a futura consulta ao Active Directory.</p></div></div><section class="card"><h3 style="margin-top:0">Adicionar usuário</h3><form id="user-form"><div class="form-grid"><div><label>Usuário (AD)</label><input id="new-username" required placeholder="nome.sobrenome"></div><div><label>Senha de acesso</label><input id="new-password" type="password" required placeholder="Defina uma senha"></div><div><label>Nome completo</label><input id="new-name" required placeholder="Nome do colaborador"></div><div><label>Unidade</label><input id="new-unit" required placeholder="Ex.: Matriz"></div><div class="full"><label>Departamento</label><input id="new-department" required placeholder="Ex.: Financeiro"></div></div><div class="actions"><button class="primary">Cadastrar usuário</button></div></form></section><section class="card" style="margin-top:24px"><h3 style="margin-top:0">Usuários cadastrados</h3><div class="table-wrap"><table class="tickets"><thead><tr><th>Usuário</th><th>Nome</th><th>Unidade</th><th>Departamento</th><th>Acesso</th></tr></thead><tbody>${list.map(u => `<tr><td><strong>${u.username}</strong></td><td>${u.name}</td><td>${u.unit}</td><td>${u.department}</td><td><span class="badge done">Ativo</span></td></tr>`).join('')}</tbody></table></div></section>`) }

function adminPage() {
    return shell(`
        <div class="page-head">
            <div>
                <h2>Administração</h2>
                <p>Gerenciamento do Portal ITSM DeLunaTech.</p>
            </div>
        </div>

        <section class="card">
            <h3 style="margin-top:0">Módulo Administrativo</h3>

            <p>
                Esta área será utilizada para administrar
                usuários e a Central de Serviços.
            </p>

            <div class="actions">
                <button class="primary" data-admin="users">
                    Usuários
                </button>

                <button class="secondary" data-admin="catalog">
                    Central de Serviços
                </button>

             
            </div>
        </section>
    `);
}

function adminCatalogPage() {

    const services = state.services
        .slice()
        .sort((a, b) =>
            (a.name || '').localeCompare(
                b.name || '',
                'pt-BR'
            )
        );

    return shell(`
        <div class="page-head">

            <div>
                <h2>Central de Serviços</h2>

                <p>
                    Gerenciamento dos serviços disponíveis no Portal.
                </p>
            </div>

            <div class="actions">

    <button
        class="primary"
        type="button"
        data-admin="new-service"
    >
        + Novo serviço
    </button>

    <button
        class="secondary"
        data-view="admin"
    >
        Voltar
    </button>

    </div>

        </div>

        <section class="card">

            <h3 style="margin-top:0">
                Serviços cadastrados
            </h3>

            <div class="table-wrap">

                <table class="tickets">

                    <thead>

                        <tr>
                            <th>Serviço</th>
                            <th>Subcategorias</th>
                            <th>Status</th>
                            <th>Ação</th>
                        </tr>

                    </thead>

                    <tbody>

                        ${services.length
            ? services
                .map(service => `
                                        <tr>

                                            <td>
                                                <strong>
                                                    ${service.name}
                                                </strong>
                                            </td>

                                            <td>
                                                ${service.subcategories?.length || 0
                    }
                                            </td>

                                            <td>
                                                ${service.active
                        ? '<span class="badge done">Ativo</span>'
                        : '<span class="badge">Inativo</span>'
                    }
                                            </td>

                                           <td>

    <div style="display:flex;gap:8px;flex-wrap:wrap">

        <button
            class="secondary"
            type="button"
            data-edit-service="${service.firestoreId}"
        >
            Editar
        </button>

        <button
            class="secondary"
            type="button"
            data-toggle-service="${service.firestoreId}"
        >
            ${service.active
                        ? 'Desativar'
                        : 'Ativar'
                    }
        </button>

    </div>

</td>

                                        </tr>
                                    `)
                .join('')
            : `
                                    <tr>
                                        <td colspan="4">
                                            Nenhum serviço cadastrado.
                                        </td>
                                    </tr>
                                `
        }

                    </tbody>

                </table>

            </div>

        </section>
    `);
}

function adminNewServicePage() {

    return shell(`
        <div class="page-head">

            <div>
                <h2>Novo serviço</h2>

                <p>
                    Cadastre o serviço e suas subcategorias.
                </p>
            </div>

            <button
                class="secondary"
                data-view="admin-catalog"
            >
                Voltar
            </button>

        </div>

        <section class="card">

            <form id="admin-service-form">

                <div class="form-grid">

                    <div class="full">

                        <label>
                            Nome do serviço
                        </label>

                        <input
                            id="admin-service-name"
                            type="text"
                            required
                            maxlength="100"
                            placeholder="Ex.: Computadores"
                        >

                    </div>

                    <div class="full">

                        <label>
                            Status do serviço
                        </label>

                        <select id="admin-service-active">

                            <option value="true">
                                Ativo
                            </option>

                            <option value="false">
                                Inativo
                            </option>

                        </select>

                    </div>

                </div>

                <hr>

                                <div class="page-head">

                    <div>

                        <h3>
                            Subcategorias
                        </h3>

                        <p>
                            Cadastre as categorias e defina
                            o tipo e o SLA de cada uma.
                        </p>

                    </div>

                </div>


                <div id="admin-subcategories">

                    <div
    class="subcategory-editor"
    style="
        margin-top:18px;
        padding:20px;
        border:1px solid #d7e0eb;
        border-radius:10px;
        background:rgba(240, 244, 249, 0.55);
    "
>

    <h4
        class="subcategory-title"
        style="
            margin:0 0 18px 0;
            font-size:15px;
        "
    >
        Subcategoria 1
    </h4>

    <div class="form-grid">

                            <div class="full">

                                <label>
                                    Nome da subcategoria
                                </label>

                                <input
                                    type="text"
                                    class="admin-subcategory-name"
                                    maxlength="100"
                                    placeholder="Ex.: Computador não liga"
                                >

                            </div>


                            <div>

                                <label>
                                    Tipo
                                </label>

                                <select class="admin-subcategory-type">

                                    <option value="Incidente">
                                        Incidente
                                    </option>

                                    <option value="Requisição">
                                        Requisição
                                    </option>

                                </select>

                            </div>


                            <div>

                                <label>
                                    Criticidade
                                </label>

                                <select class="admin-subcategory-criticality">

                                    <option value="Baixa">
                                        Baixa
                                    </option>

                                    <option value="Média">
                                        Média
                                    </option>

                                    <option value="Alta">
                                        Alta
                                    </option>

                                    <option value="Crítica">
                                        Crítica
                                    </option>

                                </select>

                            </div>


                            <div>

                                <label>
                                    SLA
                                </label>

                                <div
                                    style="
                                        display:flex;
                                        gap:8px;
                                        align-items:center
                                    "
                                >

                                    <input
                                        type="number"
                                        class="admin-subcategory-sla"
                                        min="1"
                                        step="1"
                                        placeholder="2"
                                    >

                                    <span>
                                        horas
                                    </span>

                                </div>

                            </div>


                            <div>

                                <label>
                                    Status
                                </label>

                                <select class="admin-subcategory-active">

                                    <option value="true">
                                        Ativa
                                    </option>

                                    <option value="false">
                                        Inativa
                                    </option>

                                </select>

                            </div>

                        </div>

                    </div>

                </div>


                <div style="margin-top:16px">

                    <button
                        type="button"
                        class="secondary"
                        id="admin-add-subcategory"
                    >
                        + Nova subcategoria
                    </button>

                </div>


                <div class="actions">

                    <button
                        type="reset"
                        class="secondary"
                    >
                        Limpar
                    </button>

                    <button
                        type="submit"
                        class="primary"
                    >
                        Criar serviço
                    </button>

                </div>


            </form>


        </section>
    `);
}

function adminEditServicePage(service) {

    const subcategories =
        service.subcategories || [];

    const subcategoryConfig =
        service.subcategoryConfig || {};

    const subcategoryStatus =
        service.subcategoryStatus || {};

    const editors =
        subcategories.length
            ? subcategories
                .map(
                    (subcategory, index) => {

                        const config =
                            subcategoryConfig[
                            subcategory
                            ] || {};

                        const active =
                            subcategoryStatus[
                            subcategory
                            ] !== false;

                        return `
                            <div
    class="subcategory-editor"
    style="
        margin-top:18px;
        padding:20px;
        border:1px solid #d7e0eb;
        border-radius:10px;
        background:rgba(240, 244, 249, 0.55);
    "
> 

                                <h4
    class="subcategory-title"
    style="
        margin:0 0 18px 0;
        font-size:15px;
    "
>
 Subcategoria ${index + 1}
</h4>

                                <div class="form-grid">

                                    <div>
                                        <label>
                                            Nome da subcategoria
                                        </label>

                                        <input
                                            class="admin-subcategory-name"
                                            value="${subcategory}"
                                            required
                                        >
                                    </div>

                                    <div>
                                        <label>
                                            Tipo
                                        </label>

                                        <select
                                            class="admin-subcategory-type"
                                            required
                                        >
                                            <option
                                                value="Incidente"
                                                ${config.type === 'Incidente'
                                ? 'selected'
                                : ''
                            }
                                            >
                                                Incidente
                                            </option>

                                            <option
                                                value="Requisição"
                                                ${config.type === 'Requisição'
                                ? 'selected'
                                : ''
                            }
                                            >
                                                Requisição
                                            </option>
                                        </select>
                                    </div>

                                    <div>
                                        <label>
                                            Criticidade
                                        </label>

                                        <select
                                            class="admin-subcategory-criticality"
                                            required
                                        >
                                            <option
                                                value="Baixa"
                                                ${config.criticality === 'Baixa'
                                ? 'selected'
                                : ''
                            }
                                            >
                                                Baixa
                                            </option>

                                            <option
                                                value="Média"
                                                ${config.criticality === 'Média'
                                ? 'selected'
                                : ''
                            }
                                            >
                                                Média
                                            </option>

                                            <option
                                                value="Alta"
                                                ${config.criticality === 'Alta'
                                ? 'selected'
                                : ''
                            }
                                            >
                                                Alta
                                            </option>
                                        </select>
                                    </div>

                                    <div>
                                        <label>
                                            SLA de resolução (horas)
                                        </label>

                                        <input
                                            type="number"
                                            class="admin-subcategory-sla"
                                            min="1"
                                            value="${config.sla || ''}"
                                            required
                                        >
                                    </div>

                                    <div>
                                        <label>
                                            Status
                                        </label>

                                        <select
                                            class="admin-subcategory-active"
                                            required
                                        >
                                            <option
                                                value="true"
                                                ${active
                                ? 'selected'
                                : ''
                            }
                                            >
                                                Ativa
                                            </option>

                                            <option
                                                value="false"
                                                ${!active
                                ? 'selected'
                                : ''
                            }
                                            >
                                                Inativa
                                            </option>
                                        </select>
                                    </div>

                                </div>

                            </div>
                        `;
                    }
                )
                .join('')
            : `
            
                <div
    class="subcategory-editor"
    style="
        margin-top:18px;
        padding:20px;
        border:1px solid #d7e0eb;
        border-radius:10px;
        background:rgba(240, 244, 249, 0.55);
    "
> 

                    <h4
    class="subcategory-title"
    style="
        margin:0 0 18px 0;
        font-size:15px;
    "
>

                    <div class="form-grid">

                        <div>
                            <label>
                                Nome da subcategoria
                            </label>

                            <input
                                class="admin-subcategory-name"
                                required
                            >
                        </div>

                        <div>
                            <label>
                                Tipo
                            </label>

                            <select
                                class="admin-subcategory-type"
                                required
                            >
                                <option value="Incidente">
                                    Incidente
                                </option>

                                <option value="Requisição">
                                    Requisição
                                </option>
                            </select>
                        </div>

                        <div>
                            <label>
                                Criticidade
                            </label>

                            <select
                                class="admin-subcategory-criticality"
                                required
                            >
                                <option value="Baixa">
                                    Baixa
                                </option>

                                <option value="Média">
                                    Média
                                </option>

                                <option value="Alta">
                                    Alta
                                </option>
                            </select>
                        </div>

                        <div>
                            <label>
                                SLA de resolução (horas)
                            </label>

                            <input
                                type="number"
                                class="admin-subcategory-sla"
                                min="1"
                                required
                            >
                        </div>

                        <div>
                            <label>
                                Status
                            </label>

                            <select
                                class="admin-subcategory-active"
                                required
                            >
                                <option value="true">
                                    Ativa
                                </option>

                                <option value="false">
                                    Inativa
                                </option>
                            </select>
                        </div>

                    </div>

                </div>
            `;

    return shell(`
        <div class="page-head">

            <div>

                <h2>Editar serviço</h2>

                <p>
                    Altere as configurações do serviço e de suas subcategorias.
                </p>

            </div>

        </div>

        <section class="card">

            <form id="admin-edit-service-form">

                <div class="form-grid">

                    <div>
                        <label>
                            Nome do serviço
                        </label>

                        <input
                            id="admin-edit-service-name"
                            value="${service.name || ''}"
                            required
                        >
                    </div>

                    <div>
                        <label>
                            Status do serviço
                        </label>

                        <select
                            id="admin-edit-service-active"
                            required
                        >
                            <option
                                value="true"
                                ${service.active !== false
            ? 'selected'
            : ''
        }
                            >
                                Ativo
                            </option>

                            <option
                                value="false"
                                ${service.active === false
            ? 'selected'
            : ''
        }
                            >
                                Inativo
                            </option>
                        </select>
                    </div>

                </div>

                <div style="margin-top:24px">

                    <h3>
                        Subcategorias
                    </h3>

                    <div id="edit-subcategories-container">
                        ${editors}
                    </div>

                    <button
                        type="button"
                        class="secondary"
                        id="add-edit-subcategory"
                        style="margin-top:18px"
                    >
                        + Nova subcategoria
                    </button>

                </div>

                <div class="actions">

                    <button
                        type="button"
                        class="secondary"
                        data-view="admin-catalog"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="primary"
                    >
                        Salvar alterações
                    </button>

                </div>

            </form>

        </section>
    `);
}

function adminUsersPage() {

    const list = state.users
        .slice()
        .sort((a, b) =>
            (a.name || '').localeCompare(
                b.name || '',
                'pt-BR'
            )
        );

    return shell(`
        <div class="page-head">

            <div>
                <h2>Usuários</h2>
                <p>Usuários cadastrados no Portal ITSM DeLunaTech.</p>
            </div>

            <button
                class="secondary"
                data-view="admin"
            >
                Voltar
            </button>

        </div>

        <section class="card">

            <h3 style="margin-top:0">
                Usuários cadastrados
            </h3>

            ${list.length
            ? `
                        <div class="table-wrap">

                            <table class="tickets">

                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>E-mail</th>
                                        <th>Perfil</th>
                                        <th>Unidade</th>
                                        <th>Departamento</th>
                                        <th>Status</th>
                                        <th>Ação</th>
                                    </tr>
                                </thead>

                                <tbody>

                                    ${list.map(u => {

                const ativo =
                    u.active !== false;

                const role =
                    u.role === 'admin'
                        ? 'Administrador'
                        : u.role === 'technician'
                            ? 'Técnico'
                            : 'Solicitante';

                return `
                                            <tr>

                                                <td>
                                                    <strong>
                                                        ${u.name || 'Não informado'}
                                                    </strong>
                                                </td>

                                                <td>
                                                    ${u.email || 'Não informado'}
                                                </td>

                                                <td>
                                                    ${role}
                                                </td>

                                                <td>
                                                    ${u.unit || 'Não definido'}
                                                </td>

                                                <td>
                                                    ${u.department || 'Não definido'}
                                                </td>

                                                <td>
                                                    <span class="badge ${ativo ? 'done' : 'analysis'}">
                                                        ${ativo ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </td>

                                                <td>
                                                    <button
                                                        class="secondary"
                                                        data-edit-user="${u.firestoreId}"
                                                    >
                                                        Editar
                                                    </button>
                                                </td>

                                            </tr>
                                        `;

            }).join('')}

                                </tbody>

                            </table>

                        </div>
                    `
            : `
                        <div class="empty">
                            Nenhum usuário cadastrado.
                        </div>
                    `
        }

        </section>
    `);
}

function adminEditUserPage(user) {

    const role =
        user.role === 'technician'
            ? 'technician'
            : 'requester';

    const ativo =
        user.active !== false;

    return shell(`
        <div class="page-head">

            <div>
                <h2>Editar usuário</h2>
                <p>Altere os dados e permissões do usuário.</p>
            </div>

            <button
                class="secondary"
                data-view="admin-users"
            >
                Voltar
            </button>

        </div>

        <section class="card">

            <form id="edit-user-form">

                <div class="form-grid">

                    <div>
                        <label>Nome</label>

                        <input
                            id="edit-user-name"
                            type="text"
                            required
                            value="${user.name || ''}"
                        >
                    </div>

                    <div>
                        <label>E-mail</label>

                        <input
                            type="email"
                            readonly
                            value="${user.email || ''}"
                        >
                    </div>

                    <div>
                        <label>Perfil</label>

                        <select
                            id="edit-user-role"
                            required
                        >
                            <option
                                value="requester"
                                ${role === 'requester' ? 'selected' : ''}
                            >
                                Solicitante
                            </option>

                            <option
                                value="technician"
                                ${role === 'technician' ? 'selected' : ''}
                            >
                                Técnico
                            </option>
                        </select>
                    </div>

                    <div>
                        <label>Status</label>

                        <select
                            id="edit-user-active"
                            required
                        >
                            <option
                                value="true"
                                ${ativo ? 'selected' : ''}
                            >
                                Ativo
                            </option>

                            <option
                                value="false"
                                ${!ativo ? 'selected' : ''}
                            >
                                Inativo
                            </option>
                        </select>
                    </div>

                    <div>
                        <label>Unidade</label>

                        <input
                            id="edit-user-unit"
                            type="text"
                            value="${user.unit || ''}"
                        >
                    </div>

                    <div>
                        <label>Departamento</label>

                        <input
                            id="edit-user-department"
                            type="text"
                            value="${user.department || ''}"
                        >
                    </div>

                </div>

                <div class="actions">

                    <button
                        type="button"
                        class="secondary"
                        data-view="admin-users"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="primary"
                    >
                        Salvar alterações
                    </button>

                </div>

            </form>

        </section>
    `);
}

function detail() {

    const t = tickets().find(
        x => x.id === state.selected
    );

    if (!t)
        return mine();

    const tech =
        state.user.role === 'technician';

    const result =
        slaResult(t);

    const canFinish =
        tech &&
        t.responsible === state.user.name &&
        t.status !== 'Concluído';

    const canPending =
        tech &&
        t.responsible === state.user.name &&
        t.status === 'Em análise';

    const canResume =
        tech &&
        t.responsible === state.user.name &&
        t.status === 'Pendente';

    return shell(`
        <div class="page-head">

            <div>

                <button
                    class="ticket-link"
                    data-view="${tech ? 'queue' : 'mine'}"
                >
                    ← Voltar
                </button>

                <h2 style="margin-top:12px">
                     Chamado ${numeroChamado(t)}
                </h2>

                <p>
                    ${badge(t.status)}
                </p>

            </div>

            

        </div>

        <section class="card">

        <div class="detail-layout">
    <div class="detail-content">

            <div class="detail-grid">

              <div>
    <span>Solicitante</span>
    <strong>
        ${t.requesterName || t.requester}
    </strong>
</div>

${t.openedBy
            ? `
            <div>
                <span>Aberto por</span>
                <strong>${t.openedBy}</strong>
            </div>
        `
            : ''
        }

<div>
    <span>Serviço</span>
    <strong>${t.service}</strong>
</div>

                <div>
                    <span>Subcategoria</span>
                    <strong>${t.subcategory}</strong>
                </div>

                <div>
                    <span>Tipo</span>
                    <strong>${t.type}</strong>
                </div>

                <div>
    <span>Criticidade / SLA</span>
    <strong>
        ${t.criticality || 'Não informada'} · ${t.sla || 'Não definido'} horas
    </strong>
</div>

                <div>
                    <span>Responsável</span>
                    <strong>
                        ${t.responsible || 'Não atribuído'}
                    </strong>
                </div>

                <div>
                    <span>Prazo limite</span>
                    <strong>
                        ${formatDate(deadline(t))}
                    </strong>
                </div>

                ${t.closedAt ? `
                    <div>
                        <span>Encerrado em</span>
                        <strong>
                            ${formatDate(t.closedAt)}
                        </strong>
                    </div>

                    <div>
                        <span>Resultado da SLA</span>
                        <strong
                            class="${result === 'Dentro da SLA'
                ? 'sla-ok'
                : 'sla-late'}"
                        >
                            ${result}
                        </strong>
                    </div>
                ` : ''}

            </div>

            <label>
                Descrição
            </label>

                        <p>
                ${t.description}
            </p>

        

        <h3>
                Andamento
            </h3>

            <div class="timeline">

                <div class="event">

                    <strong>
                        Chamado criado
                    </strong>

                    <time>
                        ${formatDate(t.openedAt)}
                    </time>

                </div>

                ${t.responsible ? `
                    <div class="event">

                        <strong>
                            Capturado por ${t.responsible}
                        </strong>

                        <time>
                            Atualização registrada no ambiente de teste
                        </time>

                    </div>
                ` : ''}

                                ${(Array.isArray(t.pendingHistory)
                    ? t.pendingHistory
                    : []
                ).map(pending => `
                    <div class="event">

                        <strong>
                            Chamado colocado em Pendente
                        </strong>

                        <p>
                            <strong>Motivo:</strong>
                            ${pending.reason || 'Não informado'}
                        </p>

                        ${pending.description ? `
                            <p>
                                <strong>Descrição:</strong>
                                ${pending.description}
                            </p>
                        ` : ''}

                        <time>
                            ${formatDate(pending.startedAt)}
                        </time>

                        ${pending.endedAt ? `
                            <p>
                                <strong>Atendimento retomado por:</strong>
                                ${pending.resumedBy || 'Não informado'}
                            </p>

                            <time>
                                ${formatDate(pending.endedAt)}
                            </time>
                        ` : ''}
                    </div>
                `).join('')}

                ${t.status === 'Concluído' ? `
                    <div class="event">

                        <strong>
                            Chamado concluído · ${result}
                        </strong>

                        <time>
                            ${formatDate(t.closedAt)}
                        </time>

                    </div>
                ` : ''}

                </div>
                </div>

        <div class="detail-actions">

        

                    ${canFinish || canPending || canResume ? `
                <div class="detail-action-form">

                    <label for="solution">
                        Solução / procedimento realizado
                    </label>

                    <textarea id="solution" rows="4" minlength="15"
                        placeholder="Descreva o que foi feito para resolver o chamado..."
                    >${t.solution || ''}</textarea>

                    ${canPending ? `
                        <button
                            class="secondary"
                            id="pending"
                            type="button"
                        >
                            Colocar em Pendente
                        </button>
                    ` : ''}

                    ${canResume ? `
                        <button
                            class="primary"
                            id="resume-pending"
                            type="button"
                        >
                            Retomar atendimento
                        </button>
                    ` : ''}

                    <button
                        class="primary"
                        id="finish"
                        type="button"
                    >
                        Concluir chamado
                    </button>

                </div>
            ` : ''}

            ${t.solution ? `
                <label>
                    Solução / procedimento realizado
                </label>

                <p>
                    ${t.solution}
                </p>
            ` : ''}

            
                </div>
            </div>

        </section>

        
    `);
}

function adminReportsPage() {
    const services = state.services || [];

    const serviceOptions = services
        .map(service => {
            const name = String(service.name || '');
            const safeName = name
                .replaceAll('&', '&amp;')
                .replaceAll('"', '&quot;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;');

            return `<option value="${safeName}">${safeName}</option>`;
        })
        .join('');

    const filters = state.reportFilters || {};

const reportTickets = state.tickets || [];

/*
 * Aplica os filtros selecionados
 * antes de calcular os indicadores.
 */
const filteredReportTickets = reportTickets.filter(ticket => {

    const openedAt = ticket.openedAt
        ? new Date(ticket.openedAt)
        : null;

    /*
     * Filtro por período
     */
    let matchesPeriod = true;

    if (openedAt && filters.period) {

        const hoje = new Date();

        hoje.setHours(
            0,
            0,
            0,
            0
        );

        let startDate = null;
        let endDate = new Date(hoje);

        endDate.setHours(
            23,
            59,
            59,
            999
        );

        if (filters.period === 'today') {

            startDate = new Date(hoje);

        } else if (filters.period === '7days') {

            startDate = new Date(hoje);

            startDate.setDate(
                startDate.getDate() - 6
            );

        } else if (filters.period === '30days') {

            startDate = new Date(hoje);

            startDate.setDate(
                startDate.getDate() - 29
            );

        } else if (filters.period === 'month') {

            startDate = new Date(
                hoje.getFullYear(),
                hoje.getMonth(),
                1
            );

        } else if (filters.period === 'custom') {

            startDate = filters.start
                ? new Date(`${filters.start}T00:00:00`)
                : null;

            endDate = filters.end
                ? new Date(`${filters.end}T23:59:59.999`)
                : null;
        }

        if (startDate) {

            matchesPeriod =
                openedAt >= startDate &&
                (!endDate || openedAt <= endDate);
        }
    }

    /*
     * Filtro por serviço
     */
    const matchesService =
        !filters.service ||
        ticket.service === filters.service;

    /*
     * Filtro por tipo
     */
    const matchesType =
        !filters.type ||
        ticket.type === filters.type;

    /*
     * Filtro por status
     */
    const matchesStatus =
        !filters.status ||
        ticket.status === filters.status;

    return (
        matchesPeriod &&
        matchesService &&
        matchesType &&
        matchesStatus
    );
});


/*
 * Indicadores calculados sobre os
 * chamados já filtrados.
 */

const totalChamados =
    filteredReportTickets.length;

const totalPaginas =
    Math.max(
        1,
        Math.ceil(
            totalChamados /
            state.reportPageSize
        )
    );

if (
    state.reportPage >
    totalPaginas
) {
    state.reportPage =
        totalPaginas;
}

const inicio =
    (state.reportPage - 1) *
    state.reportPageSize;

const fim =
    Math.min(
        inicio +
        state.reportPageSize,
        totalChamados
    );

const chamadosPagina =
    filteredReportTickets.slice(
        inicio,
        fim
    );

const total =
    filteredReportTickets.length;

const abertos =
    filteredReportTickets.filter(
        ticket =>
            ticket.status === 'Aberto'
    ).length;

const emAndamento =
    filteredReportTickets.filter(
        ticket =>
            ticket.status === 'Em análise' ||
            ticket.status === 'Pendente'
    ).length;

const concluidos =
    filteredReportTickets.filter(
        ticket =>
            ticket.status === 'Concluído'
    ).length;

    return shell(`
        <div class="page-head">
            <div>
                <h2>Relatórios Gerenciais</h2>
                <p>Indicadores e acompanhamento dos chamados do Portal.</p>
            </div>
        </div>

        <section class="card report-filters">
    <h3 style="margin-top:0">Filtros</h3>

    <div class="report-filter-top">

        <div>
            <label for="report-period">Período</label>
            <select id="report-period">
                <option value="today" ${filters.period === 'today' ? 'selected' : ''}>Hoje</option>
                <option value="7days" ${filters.period === '7days' ? 'selected' : ''}>Últimos 7 dias</option>
                <option value="30days" ${filters.period === '30days' ? 'selected' : ''}>Últimos 30 dias</option>
                <option value="month" ${filters.period === 'month' ? 'selected' : ''}>Mês atual</option>
                <option value="custom" ${filters.period === 'custom' ? 'selected' : ''}>Personalizado</option>
            </select>
        </div>

        <div class="report-date-range">
            <div class="report-date-heading">
                <strong>Intervalo de datas</strong>
                <small>Selecione o intervalo que deseja consultar.</small>
            </div>

            <div class="report-date-fields">
                <div>
                    <label for="report-start">Data inicial</label>
                    <input id="report-start" type="date" value="${filters.start || ''}">
                </div>

                <span class="report-date-arrow" aria-hidden="true">→</span>

                <div>
                    <label for="report-end">Data final</label>
                    <input id="report-end" type="date" value="${filters.end || ''}">
                </div>
            </div>
        </div>

    </div>

    <div class="report-filter-middle">

        <div>
            <label for="report-service">Serviço</label>
            <select id="report-service">
                <option value="">Todos os serviços</option>
                ${serviceOptions}
            </select>
        </div>

        <div>
            <label for="report-type">Tipo</label>
            <select id="report-type">
                <option value="">Todos os tipos</option>
                <option value="Incidente" ${filters.type === 'Incidente' ? 'selected' : ''}>Incidente</option>
                <option value="Requisição" ${filters.type === 'Requisição' ? 'selected' : ''}>Requisição</option>
            </select>
        </div>

    </div>

    <div class="report-filter-bottom">

        <div class="report-status-field">
            <label for="report-status">Status</label>
            <select id="report-status">
                <option value="">Todos os status</option>
                <option value="Aberto" ${filters.status === 'Aberto' ? 'selected' : ''}>Aberto</option>
                <option value="Em análise" ${filters.status === 'Em análise' ? 'selected' : ''}>Em análise</option>
                <option value="Pendente" ${filters.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                <option value="Concluído" ${filters.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
            </select>
        </div>

        <div class="actions" style="margin-top:18px">

    <button
        class="primary"
        id="report-apply"
        type="button"
    >
        Aplicar filtros
    </button>

    <button
        class="secondary"
        id="report-clear"
        type="button"
    >
        Limpar filtros
    </button>

    <button
        class="secondary"
        id="report-export-excel"
        type="button"
    >
        Exportar Excel
    </button>

    <button
        class="secondary"
        data-view="admin"
        type="button"
    >
        Voltar
    </button>

</div>

    </div>
</section>

       <section class="card" style="margin-top:20px">
    <h3 style="margin-top:0">Painel de relatórios</h3>

    <div
        style="
            display:grid;
            grid-template-columns:repeat(4, minmax(0, 1fr));
            border:1px solid #d5e4f5;
            border-radius:10px;
            overflow:hidden;
            background:#fff;
        "
    >

        <div
            style="
                display:flex;
                align-items:center;
                gap:14px;
                padding:18px 22px;
                min-height:82px;
            "
        >
            <div
                style="
                    width:42px;
                    height:42px;
                    border-radius:50%;
                    background:#eaf3ff;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:20px;
                    flex-shrink:0;
                "
            >
                ▣
            </div>

            <div>
                <h3
                    style="
                        margin:0 0 4px;
                        font-size:14px;
                        font-weight:600;
                    "
                >
                    Total de chamados
                </h3>

                <strong
                    id="report-total"
                    style="
                        font-size:26px;
                        line-height:1;
                    "
                >
                    ${total}
                </strong>
            </div>
        </div>


        <div
            style="
                display:flex;
                align-items:center;
                gap:14px;
                padding:18px 22px;
                min-height:82px;
                border-left:1px solid #d5e4f5;
            "
        >
            <div
                style="
                    width:42px;
                    height:42px;
                    border-radius:50%;
                    background:#eaf8f0;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:20px;
                    flex-shrink:0;
                "
            >
                ○
            </div>

            <div>
                <h3
                    style="
                        margin:0 0 4px;
                        font-size:14px;
                        font-weight:600;
                    "
                >
                    Abertos
                </h3>

                <strong
                    id="report-open"
                    style="
                        font-size:26px;
                        line-height:1;
                    "
                >
                    ${abertos}
                </strong>
            </div>
        </div>


        <div
            style="
                display:flex;
                align-items:center;
                gap:14px;
                padding:18px 22px;
                min-height:82px;
                border-left:1px solid #d5e4f5;
            "
        >
            <div
                style="
                    width:42px;
                    height:42px;
                    border-radius:50%;
                    background:#fff6d9;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:20px;
                    flex-shrink:0;
                "
            >
                ◷
            </div>

            <div>
                <h3
                    style="
                        margin:0 0 4px;
                        font-size:14px;
                        font-weight:600;
                    "
                >
                    Em andamento
                </h3>

                <strong
                    id="report-progress"
                    style="
                        font-size:26px;
                        line-height:1;
                    "
                >
                    ${emAndamento}
                </strong>
            </div>
        </div>


        <div
            style="
                display:flex;
                align-items:center;
                gap:14px;
                padding:18px 22px;
                min-height:82px;
                border-left:1px solid #d5e4f5;
            "
        >
            <div
                style="
                    width:42px;
                    height:42px;
                    border-radius:50%;
                    background:#eaf3ff;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:20px;
                    flex-shrink:0;
                "
            >
                ✓
            </div>

            <div>
                <h3
                    style="
                        margin:0 0 4px;
                        font-size:14px;
                        font-weight:600;
                    "
                >
                    Concluídos
                </h3>

                <strong
                    id="report-done"
                    style="
                        font-size:26px;
                        line-height:1;
                    "
                >
                    ${concluidos}
                </strong>
            </div>
        </div>

    </div>
</section>

<section class="card" style="margin-top:20px">

    <div
        style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:12px;
            margin-bottom:16px;
            flex-wrap:wrap;
        "
    >
       <div>
    <h3 style="margin:0">
        Chamados encontrados
    </h3>

    <p
        style="
            margin:4px 0 0;
            color:var(--muted);
            font-size:13px;
        "
    >
        ${filteredReportTickets.length}
        chamado(s) conforme os filtros selecionados.
    </p>
</div>
</div>

${filteredReportTickets.length
    ? `
        ${table(
            chamadosPagina,
            false
        )}

        <div
            style="
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:12px;
                flex-wrap:wrap;
                margin-top:18px;
            "
        >

            <span class="muted">
                Exibindo
                ${inicio + 1}
                a
                ${fim}
                de
                ${totalChamados}
                chamados
            </span>

            <div
                style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    flex-wrap:wrap;
                "
            >

                <label
                    for="report-page-size"
                    style="margin:0"
                >
                    Por página:
                </label>

                <select
                    id="report-page-size"
                    style="width:auto"
                >

                    <option
                        value="25"
                        ${state.reportPageSize === 25 ? 'selected' : ''}
                    >
                        25
                    </option>

                    <option
                        value="50"
                        ${state.reportPageSize === 50 ? 'selected' : ''}
                    >
                        50
                    </option>

                    <option
                        value="100"
                        ${state.reportPageSize === 100 ? 'selected' : ''}
                    >
                        100
                    </option>

                </select>

                <button
                    type="button"
                    id="report-prev"
                    ${state.reportPage <= 1 ? 'disabled' : ''}
                >
                    Anterior
                </button>

                <span>
                    Página
                    ${state.reportPage}
                    de
                    ${totalPaginas}
                </span>

                <button
                    type="button"
                    id="report-next"
                    ${state.reportPage >= totalPaginas ? 'disabled' : ''}
                >
                    Próxima
                </button>

            </div>

        </div>
    `
    : `
        <div class="empty">
            Nenhum chamado encontrado
            para os filtros selecionados.
        </div>
    `
}

</section>

    `);
}

/* ============================================================
 * EXPORTAÇÃO DE RELATÓRIOS — EXCELJS
 * ============================================================
 */

let xlsxLibraryPromise = null;

function carregarBibliotecaXLSX() {

    if (window.ExcelJS) {
        return Promise.resolve(window.ExcelJS);
    }

    if (xlsxLibraryPromise) {
        return xlsxLibraryPromise;
    }

    xlsxLibraryPromise = new Promise((resolve, reject) => {

        const script =
            document.createElement('script');

        script.src =
            'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';

        script.onload = () => {

            if (window.ExcelJS) {

                resolve(
                    window.ExcelJS
                );

            } else {

                reject(
                    new Error(
                        'Biblioteca ExcelJS carregada, mas indisponível.'
                    )
                );

            }

        };

        script.onerror = () => {

            reject(
                new Error(
                    'Não foi possível carregar a biblioteca ExcelJS.'
                )
            );

        };

        document.head.appendChild(
            script
        );

    });

    return xlsxLibraryPromise;
}

async function exportarRelatorioExcel(
    chamados,
    filtros
) {

    try {

        const ExcelJS =
            await carregarBibliotecaXLSX();

        const workbook =
            new ExcelJS.Workbook();

        workbook.creator =
            'Portal ITSM DeLunaTech';

        workbook.created =
            new Date();

        /*
         * =====================================================
         * DADOS GERAIS
         * =====================================================
         */

        const agora =
            new Date();

        const dataEmissao =
            agora.toLocaleString(
                'pt-BR'
            );

        const total =
            chamados.length;

        const abertos =
            chamados.filter(
                ticket =>
                    ticket.status === 'Aberto'
            ).length;

        const emAnalise =
            chamados.filter(
                ticket =>
                    ticket.status === 'Em análise'
            ).length;

        const pendentes =
            chamados.filter(
                ticket =>
                    ticket.status === 'Pendente'
            ).length;

        const concluidos =
            chamados.filter(
                ticket =>
                    ticket.status === 'Concluído'
            ).length;

        const incidentes =
            chamados.filter(
                ticket =>
                    ticket.type === 'Incidente'
            ).length;

        const requisicoes =
            chamados.filter(
                ticket =>
                    ticket.type === 'Requisição'
            ).length;

        /*
         * =====================================================
         * ABA 1 — RESUMO
         * =====================================================
         */

        const wsResumo =
            workbook.addWorksheet(
                'Resumo'
            );

        wsResumo.columns = [
            {
                width: 30
            },
            {
                width: 38
            }
        ];

        wsResumo.mergeCells(
            'A1:B1'
        );

        const tituloResumo =
            wsResumo.getCell(
                'A1'
            );

        tituloResumo.value =
            'RELATÓRIO GERENCIAL — PORTAL DE SERVIÇOS';

        tituloResumo.font = {
            bold: true,
            size: 16,
            color: {
                argb: 'FFFFFFFF'
            }
        };

        tituloResumo.alignment = {
            horizontal: 'center',
            vertical: 'middle'
        };

        tituloResumo.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {
                argb: 'FF1F4E78'
            }
        };

        wsResumo.getRow(1).height =
            30;

        wsResumo.addRow([]);

        wsResumo.addRow([
            'Data/hora da emissão',
            dataEmissao
        ]);

        wsResumo.addRow([]);

        const filtroTitulo =
            wsResumo.addRow([
                'FILTROS UTILIZADOS'
            ]);

        filtroTitulo.font = {
            bold: true,
            color: {
                argb: 'FFFFFFFF'
            }
        };

        filtroTitulo.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {
                argb: 'FF5B9BD5'
            }
        };

        wsResumo.addRow([
            'Período',
            filtros?.period || 'Todos'
        ]);

        wsResumo.addRow([
            'Data inicial',
            filtros?.start || ''
        ]);

        wsResumo.addRow([
            'Data final',
            filtros?.end || ''
        ]);

        wsResumo.addRow([
            'Serviço',
            filtros?.service ||
                'Todos os serviços'
        ]);

        wsResumo.addRow([
            'Tipo',
            filtros?.type ||
                'Todos os tipos'
        ]);

        wsResumo.addRow([
            'Status',
            filtros?.status ||
                'Todos os status'
        ]);

        wsResumo.addRow([]);

        const indicadoresTitulo =
            wsResumo.addRow([
                'INDICADORES'
            ]);

        indicadoresTitulo.font = {
            bold: true,
            color: {
                argb: 'FFFFFFFF'
            }
        };

        indicadoresTitulo.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {
                argb: 'FF5B9BD5'
            }
        };

        const resumoIndicadores = [
            [
                'Total de chamados',
                total
            ],
            [
                'Abertos',
                abertos
            ],
            [
                'Em análise',
                emAnalise
            ],
            [
                'Pendentes',
                pendentes
            ],
            [
                'Concluídos',
                concluidos
            ],
            [
                'Incidentes',
                incidentes
            ],
            [
                'Requisições',
                requisicoes
            ]
        ];

        resumoIndicadores.forEach(
            item => {

                wsResumo.addRow(
                    item
                );

            }
        );

        wsResumo.eachRow(
            row => {

                row.eachCell(
                    cell => {

                        cell.border = {
                            top: {
                                style: 'thin',
                                color: {
                                    argb: 'FFD9E2F3'
                                }
                            },
                            bottom: {
                                style: 'thin',
                                color: {
                                    argb: 'FFD9E2F3'
                                }
                            },
                            left: {
                                style: 'thin',
                                color: {
                                    argb: 'FFD9E2F3'
                                }
                            },
                            right: {
                                style: 'thin',
                                color: {
                                    argb: 'FFD9E2F3'
                                }
                            }
                        };

                        cell.alignment = {
                            vertical: 'middle'
                        };

                    }
                );

            }
        );

        /*
         * =====================================================
         * ABA 2 — CHAMADOS
         * =====================================================
         */

        const wsChamados =
            workbook.addWorksheet(
                'Chamados'
            );

        const colunasChamados = [
            'Chamado',
            'Solicitante',
            'Serviço',
            'Subcategoria',
            'Tipo',
            'Prioridade',
            'SLA (horas)',
            'Responsável',
            'Data de abertura',
            'Data de conclusão',
            'Status',
            'Descrição'
        ];

        wsChamados.columns = [
            {
                header: colunasChamados[0],
                key: 'chamado',
                width: 14
            },
            {
                header: colunasChamados[1],
                key: 'solicitante',
                width: 26
            },
            {
                header: colunasChamados[2],
                key: 'servico',
                width: 25
            },
            {
                header: colunasChamados[3],
                key: 'subcategoria',
                width: 30
            },
            {
                header: colunasChamados[4],
                key: 'tipo',
                width: 16
            },
            {
                header: colunasChamados[5],
                key: 'prioridade',
                width: 16
            },
            {
                header: colunasChamados[6],
                key: 'sla',
                width: 14
            },
            {
                header: colunasChamados[7],
                key: 'responsavel',
                width: 26
            },
            {
                header: colunasChamados[8],
                key: 'abertura',
                width: 22
            },
            {
                header: colunasChamados[9],
                key: 'conclusao',
                width: 22
            },
            {
                header: colunasChamados[10],
                key: 'status',
                width: 18
            },
            {
                header: colunasChamados[11],
                key: 'descricao',
                width: 50
            }
        ];

        chamados.forEach(
            ticket => {

                wsChamados.addRow({
                    chamado:
                        numeroChamado(
                            ticket
                        ),

                    solicitante:
                        ticket.requesterName ||
                        ticket.requester ||
                        '',

                    servico:
                        ticket.service ||
                        '',

                    subcategoria:
                        ticket.subcategory ||
                        '',

                    tipo:
                        ticket.type ||
                        '',

                    prioridade:
                        ticket.priority ||
                        '',

                    sla:
                        ticket.sla ??
                        '',

                    responsavel:
                        ticket.responsible ||
                        'Não atribuído',

                    abertura:
                        ticket.openedAt
                            ? formatDate(
                                ticket.openedAt
                            )
                            : '',

                    conclusao:
                        ticket.closedAt
                            ? formatDate(
                                ticket.closedAt
                            )
                            : '',

                    status:
                        ticket.status ||
                        '',

                    descricao:
                        ticket.description ||
                        ''
                });

            }
        );

        /*
         * Congela a primeira linha.
         */

        wsChamados.views = [
            {
                state: 'frozen',
                ySplit: 1
            }
        ];

        /*
         * Filtro automático.
         */

        if (
            wsChamados.rowCount >
            1
        ) {

            wsChamados.autoFilter = {
                from: {
                    row: 1,
                    column: 1
                },
                to: {
                    row:
                        wsChamados.rowCount,
                    column:
                        colunasChamados.length
                }
            };

        }

        /*
         * Formatação do cabeçalho.
         */

        const headerRow =
            wsChamados.getRow(1);

        headerRow.height = 26;

        headerRow.eachCell(
            cell => {

                cell.font = {
                    bold: true,
                    color: {
                        argb: 'FFFFFFFF'
                    }
                };

                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: {
                        argb: 'FF1F4E78'
                    }
                };

                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle',
                    wrapText: true
                };

                cell.border = {
                    top: {
                        style: 'thin',
                        color: {
                            argb: 'FFFFFFFF'
                        }
                    },
                    bottom: {
                        style: 'thin',
                        color: {
                            argb: 'FFFFFFFF'
                        }
                    },
                    left: {
                        style: 'thin',
                        color: {
                            argb: 'FFFFFFFF'
                        }
                    },
                    right: {
                        style: 'thin',
                        color: {
                            argb: 'FFFFFFFF'
                        }
                    }
                };

            }
        );

        /*
         * Formatação das linhas.
         * Zebra + bordas + quebra de texto.
         */

        for (
            let numeroLinha = 2;
            numeroLinha <=
                wsChamados.rowCount;
            numeroLinha++
        ) {

            const row =
                wsChamados.getRow(
                    numeroLinha
                );

            row.eachCell(
                cell => {

                    cell.alignment = {
                        vertical: 'top',
                        wrapText: true
                    };

                    cell.border = {
                        top: {
                            style: 'thin',
                            color: {
                                argb: 'FFD9E2F3'
                            }
                        },
                        bottom: {
                            style: 'thin',
                            color: {
                                argb: 'FFD9E2F3'
                            }
                        },
                        left: {
                            style: 'thin',
                            color: {
                                argb: 'FFD9E2F3'
                            }
                        },
                        right: {
                            style: 'thin',
                            color: {
                                argb: 'FFD9E2F3'
                            }
                        }
                    };

                }
            );

            /*
             * Linhas pares recebem fundo alternado.
             */

            if (
                numeroLinha % 2 === 0
            ) {

                row.eachCell(
                    cell => {

                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: {
                                argb: 'FFF2F6FA'
                            }
                        };

                    }
                );

            }

            row.height = 32;
        }

        /*
         * =====================================================
         * ABA 3 — INDICADORES
         * =====================================================
         */

        const wsIndicadores =
            workbook.addWorksheet(
                'Indicadores'
            );

        wsIndicadores.columns = [
            {
                width: 30
            },
            {
                width: 18
            }
        ];

        wsIndicadores.mergeCells(
            'A1:B1'
        );

        const tituloIndicadores =
            wsIndicadores.getCell(
                'A1'
            );

        tituloIndicadores.value =
            'INDICADORES GERENCIAIS';

        tituloIndicadores.font = {
            bold: true,
            size: 16,
            color: {
                argb: 'FFFFFFFF'
            }
        };

        tituloIndicadores.alignment = {
            horizontal: 'center',
            vertical: 'middle'
        };

        tituloIndicadores.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {
                argb: 'FF1F4E78'
            }
        };

        wsIndicadores.getRow(1).height =
            30;

        wsIndicadores.addRow([]);

        const statusTitulo =
            wsIndicadores.addRow([
                'STATUS',
                'QUANTIDADE'
            ]);

        const tiposTitulo =
            null;

        statusTitulo.eachCell(
            cell => {

                cell.font = {
                    bold: true,
                    color: {
                        argb: 'FFFFFFFF'
                    }
                };

                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: {
                        argb: 'FF5B9BD5'
                    }
                };

                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle'
                };

            }
        );

        [
            [
                'Aberto',
                abertos
            ],
            [
                'Em análise',
                emAnalise
            ],
            [
                'Pendente',
                pendentes
            ],
            [
                'Concluído',
                concluidos
            ]
        ].forEach(
            item =>
                wsIndicadores.addRow(
                    item
                )
        );

        wsIndicadores.addRow([]);

        const tipoTitulo =
            wsIndicadores.addRow([
                'TIPO',
                'QUANTIDADE'
            ]);

        tipoTitulo.eachCell(
            cell => {

                cell.font = {
                    bold: true,
                    color: {
                        argb: 'FFFFFFFF'
                    }
                };

                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: {
                        argb: 'FF5B9BD5'
                    }
                };

                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle'
                };

            }
        );

        [
            [
                'Incidente',
                incidentes
            ],
            [
                'Requisição',
                requisicoes
            ]
        ].forEach(
            item =>
                wsIndicadores.addRow(
                    item
                )
        );

        wsIndicadores.addRow([]);

        const contagemServicos = {};

        chamados.forEach(
            ticket => {

                const servico =
                    ticket.service ||
                    'Não informado';

                contagemServicos[servico] =
                    (
                        contagemServicos[servico] ||
                        0
                    ) + 1;

            }
        );

        const servicosTitulo =
            wsIndicadores.addRow([
                'SERVIÇO',
                'QUANTIDADE'
            ]);

        servicosTitulo.eachCell(
            cell => {

                cell.font = {
                    bold: true,
                    color: {
                        argb: 'FFFFFFFF'
                    }
                };

                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: {
                        argb: 'FF5B9BD5'
                    }
                };

                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle'
                };

            }
        );

        Object.entries(
            contagemServicos
        )
            .sort(
                (a, b) =>
                    b[1] - a[1]
            )
            .forEach(
                ([servico, quantidade]) => {

                    wsIndicadores.addRow([
                        servico,
                        quantidade
                    ]);

                }
            );

        wsIndicadores.eachRow(
            row => {

                row.eachCell(
                    cell => {

                        cell.border = {
                            top: {
                                style: 'thin',
                                color: {
                                    argb: 'FFD9E2F3'
                                }
                            },
                            bottom: {
                                style: 'thin',
                                color: {
                                    argb: 'FFD9E2F3'
                                }
                            },
                            left: {
                                style: 'thin',
                                color: {
                                    argb: 'FFD9E2F3'
                                }
                            },
                            right: {
                                style: 'thin',
                                color: {
                                    argb: 'FFD9E2F3'
                                }
                            }
                        };

                    }
                );

            }
        );

        /*
         * =====================================================
         * DOWNLOAD
         * =====================================================
         */

        const dataArquivo =
            agora
                .toISOString()
                .slice(
                    0,
                    10
                )
                .replaceAll(
                    '-',
                    ''
                );

        const nomeArquivo =
            `ITSM_Relatorio_Gerencial_${dataArquivo}.xlsx`;

        const buffer =
            await workbook.xlsx.writeBuffer();

        const blob =
            new Blob(
                [buffer],
                {
                    type:
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const link =
            document.createElement(
                'a'
            );

        link.href = url;

        link.download =
            nomeArquivo;

        document.body.appendChild(
            link
        );

        link.click();

        link.remove();

        URL.revokeObjectURL(
            url
        );

    } catch (error) {

        console.error(
            'Erro na exportação Excel:',
            error
        );

        alert(
            'Não foi possível gerar o relatório Excel.'
        );

    }
}

function render() {

    let page =
        !state.user
            ? login()
            : state.view === 'new'
                ? newTicket()
                : state.view === 'mine'
                    ? mine()
                    : state.view === 'queue'
                        ? queue()
                        : state.view === 'new-on-behalf'
                            ? newTicketOnBehalf()
                            : state.view === 'search-tickets'
                                ? searchTickets()
                                : state.view === 'admin'
                                    ? adminPage()
                                    : state.view === 'admin-users'
                                        ? adminUsersPage()
                                        : state.view === 'admin-catalog'
                                            ? adminCatalogPage()
                                            : state.view === 'admin-reports'
                                                ? adminReportsPage()
                                                : state.view === 'admin-new-service'
                                                    ? adminNewServicePage()
                                                    : state.view === 'admin-edit-service'
                                                        ? adminEditServicePage(state.selected)
                                                        : state.view === 'admin-user-edit'
                                                            ? adminEditUserPage(state.selected)
                                                            : detail();

    $('#app').innerHTML = page;

    bind();
    mountAceWidget({ user: state.user, services: state.services, createTicket: createAceLocalTicket });
}
function updateForm() {

    const serviceName =
        $('#service')?.value;

    const subcategory =
        $('#subcategory')?.value;

    if (
        !serviceName ||
        !subcategory
    ) {

        $('#type').value =
            'Será definido automaticamente';

        $('#criticality').value =
            'Será definida automaticamente';

        $('#sla').value =
            'Selecione uma subcategoria';

        return;
    }

    const service =
        state.services.find(
            item =>
                item.name === serviceName
        );

    if (!service) {

        $('#type').value =
            'Não configurado';

        $('#criticality').value =
            'Não configurada';

        $('#sla').value =
            'Não configurado';

        return;
    }

    const config =
        service.subcategoryConfig?.[subcategory];

    if (!config) {

        $('#type').value =
            'Não configurado';

        $('#criticality').value =
            'Não configurada';

        $('#sla').value =
            'Não configurado';

        return;
    }

    $('#type').value =
        config.type || 'Não configurado';

    $('#criticality').value =
        config.criticality || 'Não configurada';

    $('#sla').value =
        config.sla
            ? `${config.sla} horas`
            : 'Não configurado';
}


async function bind() {

    console.log('BIND EXECUTADO', state.user);

    if (!state.user) {
        document.querySelectorAll('[data-demo-profile]').forEach(button => {
            button.onclick = async () => {
                const profile = button.dataset.demoProfile;
                const profiles = {
                    requester: { id:'demo-requester', name:'Usuário de Demonstração', username:'usuario.demo', role:'requester', unit:'Matriz', department:'Financeiro', email:'usuario@demo.local' },
                    technician: { id:'demo-technician', name:'Rafael Mendes', username:'rafael.mendes', role:'technician', unit:'Matriz', department:'Tecnologia', email:'tecnico@demo.local' },
                    admin: { id:'demo-admin', name:'Administrador Demo', username:'admin.demo', role:'admin', unit:'Matriz', department:'Tecnologia', email:'admin@demo.local' }
                };
                state.user = profiles[profile] || profiles.requester;
                localStorage.setItem('delunatech-itsm-demo-profile', profile);
                state.view = profile === 'admin' ? 'admin' : profile === 'technician' ? 'queue' : 'new';
                state.selected = null;
                try { await loadTickets(); await loadUsers(); await loadServices(); }
                catch (err) { console.error('Falha ao preparar dados locais:', err); }
                render();
            };
        });
        return;
    }

    /*
     * A partir daqui o usuário já está autenticado.
     */

    $('#logout').onclick = async () => {
        state.user = null;
        localStorage.removeItem('delunatech-itsm-demo-profile');
        state.view = 'new';
        state.selected = null;

        render();
    };

    document
        .querySelectorAll('[data-view]')
        .forEach(
            b =>
                b.onclick = async () => {

                    state.view =
                        b.dataset.view;

                    state.selected =
                        null;


                                       if (
                        state.view === 'new-on-behalf' ||
                        state.view === 'search-tickets'
                    ) {

                        try {

                            if (
                                state.view ===
                                'new-on-behalf'
                            ) {

                                await loadUsers(
                                    'active-requesters'
                                );

                            } else {

                                await loadUsers(
                                    'all-requesters'
                                );
                            }

                        } catch (err) {

                            console.error(
                                'Erro ao carregar usuários:',
                                err
                            );

                            alert(
                                'Não foi possível carregar os usuários. ' +
                                'Verifique o acesso ao Firestore.'
                            );

                            return;
                        }
                    }


                    render();
                }
        );

            /*
     * Filtros dos relatórios gerenciais
     */

    const reportApply = $('#report-apply');

    if (reportApply) {

        reportApply.onclick = () => {

            state.reportFilters = {
                period: $('#report-period').value,
                start: $('#report-start').value,
                end: $('#report-end').value,
                service: $('#report-service').value,
                type: $('#report-type').value,
                status: $('#report-status').value
            };

            render();
        };
    }


const reportExportExcel =
    $('#report-export-excel');

if (reportExportExcel) {

    reportExportExcel.onclick = async () => {

        const filtros =
            state.reportFilters || {};

        const chamados =
            state.tickets || [];

        reportExportExcel.disabled =
            true;

        reportExportExcel.textContent =
            'Gerando Excel...';

        try {

            await exportarRelatorioExcel(
                chamados.filter(ticket => {

                    const openedAt =
                        ticket.openedAt
                            ? new Date(
                                ticket.openedAt
                            )
                            : null;

                    let matchesPeriod =
                        true;

                    if (
                        openedAt &&
                        filtros.period
                    ) {

                        const hoje =
                            new Date();

                        let startDate =
                            null;

                        let endDate =
                            null;

                        if (
                            filtros.period ===
                            'today'
                        ) {

                            startDate =
                                new Date(
                                    hoje
                                );

                            startDate.setHours(
                                0,
                                0,
                                0,
                                0
                            );

                            endDate =
                                new Date(
                                    hoje
                                );

                            endDate.setHours(
                                23,
                                59,
                                59,
                                999
                            );

                        } else if (
                            filtros.period ===
                            '7days'
                        ) {

                            startDate =
                                new Date(
                                    hoje
                                );

                            startDate.setDate(
                                hoje.getDate() - 6
                            );

                            startDate.setHours(
                                0,
                                0,
                                0,
                                0
                            );

                            endDate =
                                new Date(
                                    hoje
                                );

                            endDate.setHours(
                                23,
                                59,
                                59,
                                999
                            );

                        } else if (
                            filtros.period ===
                            '30days'
                        ) {

                            startDate =
                                new Date(
                                    hoje
                                );

                            startDate.setDate(
                                hoje.getDate() - 29
                            );

                            startDate.setHours(
                                0,
                                0,
                                0,
                                0
                            );

                            endDate =
                                new Date(
                                    hoje
                                );

                            endDate.setHours(
                                23,
                                59,
                                59,
                                999
                            );

                        } else if (
                            filtros.period ===
                            'month'
                        ) {

                            startDate =
                                new Date(
                                    hoje.getFullYear(),
                                    hoje.getMonth(),
                                    1
                                );

                            endDate =
                                new Date(
                                    hoje.getFullYear(),
                                    hoje.getMonth() + 1,
                                    0,
                                    23,
                                    59,
                                    59,
                                    999
                                );

                        } else if (
                            filtros.period ===
                            'custom'
                        ) {

                            startDate =
                                filtros.start
                                    ? new Date(
                                        `${filtros.start}T00:00:00`
                                    )
                                    : null;

                            endDate =
                                filtros.end
                                    ? new Date(
                                        `${filtros.end}T23:59:59.999`
                                    )
                                    : null;
                        }

                        if (startDate) {

                            matchesPeriod =
                                openedAt >= startDate &&
                                (
                                    !endDate ||
                                    openedAt <= endDate
                                );
                        }
                    }

                    const matchesService =
                        !filtros.service ||
                        ticket.service ===
                        filtros.service;

                    const matchesType =
                        !filtros.type ||
                        ticket.type ===
                        filtros.type;

                    const matchesStatus =
                        !filtros.status ||
                        ticket.status ===
                        filtros.status;

                    return (
                        matchesPeriod &&
                        matchesService &&
                        matchesType &&
                        matchesStatus
                    );

                }),
                filtros
            );

        } catch (error) {

            console.error(
                'Erro na exportação Excel:',
                error
            );

            alert(
                'Não foi possível gerar o relatório Excel.'
            );

        } finally {

            reportExportExcel.disabled =
                false;

            reportExportExcel.textContent =
                'Exportar Excel';
        }
    };
}

   const reportClear = $('#report-clear');

if (reportClear) {

    reportClear.onclick = () => {

        state.reportFilters = {};
        state.reportPage = 1;

        render();
    };
}


/*
 * Paginação dos relatórios gerenciais
 */

const reportPageSize =
    $('#report-page-size');

if (reportPageSize) {

    reportPageSize.onchange = () => {

        state.reportPageSize =
            Number(reportPageSize.value);

        state.reportPage = 1;

        render();
    };
}

const reportPrev =
    $('#report-prev');

if (reportPrev) {

    reportPrev.onclick = () => {

        if (state.reportPage > 1) {

            state.reportPage--;

            render();
        }
    };
}

const reportNext =
    $('#report-next');

if (reportNext) {

    reportNext.onclick = () => {

        state.reportPage++;

        render();
    };
}

    const queueResponsible =
        $('#queue-responsible');

    if (queueResponsible) {

        queueResponsible.onchange = () => {

            state.queueResponsible =
                queueResponsible.value;

                state.queuePage = 1;

            render();
        };
    }

        /*
     * Paginação da fila de chamados
     */

    const queuePageSize =
        $('#queue-page-size');

    if (queuePageSize) {

        queuePageSize.onchange = () => {

            state.queuePageSize =
                Number(queuePageSize.value);

            state.queuePage = 1;

            render();
        };
    }

    const queuePrev =
        $('#queue-prev');

    if (queuePrev) {

        queuePrev.onclick = () => {

            if (state.queuePage > 1) {

                state.queuePage--;

                render();
            }
        };
    }

    const queueNext =
        $('#queue-next');

    if (queueNext) {

        queueNext.onclick = () => {

            state.queuePage++;

            render();
        };
    }

    const mineStatus =
        $('#mine-status');

    if (mineStatus) {

        mineStatus.onchange = () => {

            state.mineStatus =
                mineStatus.value;

                state.minePage = 1;

            render();
        };
    }

        /*
     * Paginação dos chamados do solicitante
     */

    const minePageSize =
        $('#mine-page-size');

    if (minePageSize) {

        minePageSize.onchange = () => {

            state.minePageSize =
                Number(minePageSize.value);

            state.minePage = 1;

            render();
        };
    }

    const minePrev =
        $('#mine-prev');

    if (minePrev) {

        minePrev.onclick = () => {

            if (state.minePage > 1) {

                state.minePage--;

                render();
            }
        };
    }

    const mineNext =
        $('#mine-next');

    if (mineNext) {

        mineNext.onclick = () => {

            state.minePage++;

            render();
        };
    }


    document
        .querySelectorAll('[data-admin]')
        .forEach(b => {

            b.onclick = async () => {

                if (state.user.role !== 'admin') {
                    return;
                }

                if (b.dataset.admin === 'users') {

                    try {

                        await loadUsers();

                        state.view = 'admin-users';
                        state.selected = null;

                        render();

                    } catch (err) {

                        console.error(
                            'Erro ao carregar usuários:',
                            err
                        );

                        state.message =
                            'Não foi possível carregar os usuários.';

                        render();
                    }
                }
                if (b.dataset.admin === 'new-service') {

                    state.view = 'admin-new-service';
                    state.selected = null;

                    render();

                    return;
                }

                if (b.dataset.admin === 'catalog') {

                    if (state.user.role !== 'admin') return;

                    try {

                        await loadServices();

                        state.view = 'admin-catalog';
                        state.selected = null;

                        render();

                    } catch (err) {

                        console.error(
                            'Erro ao carregar serviços:',
                            err
                        );

                        alert(
                            'Não foi possível carregar a Central de Serviços.'
                        );
                    }

                    document.querySelectorAll('[data-toggle-service]').forEach(button => {

                        button.onclick = async () => {

                            if (state.user.role !== 'admin') return;

                            const service = state.services.find(
                                item => item.firestoreId === button.dataset.toggleService
                            );

                            if (!service) return;

                            try {

                                await updateDoc(
                                    doc(db, 'services', service.firestoreId),
                                    {
                                        active: !service.active
                                    }
                                );

                                await loadServices();

                                render();

                            } catch (err) {

                                console.error(
                                    'Erro ao alterar status do serviço:',
                                    err
                                );

                                alert(
                                    'Não foi possível alterar o status do serviço.'
                                );
                            }
                        };

                    });

                                        return;
                }

                // Acesso aos Relatórios Gerenciais
                if (b.dataset.admin === 'reports') {
                    if (state.user.role !== 'admin') return;

                    state.view = 'admin-reports';
                    state.selected = null;

                    if (!state.reportFilters) {
                        state.reportFilters = {
                            period: '30days',
                            start: '',
                            end: '',
                            service: '',
                            type: '',
                            status: ''
                        };
                    }

                    render();
                    return;
                }

            };

        });

    const addSubcategory =
        $('#admin-add-subcategory');

    if (addSubcategory) {

        addSubcategory.onclick = () => {

            const container =
                $('#admin-subcategories');

            const first =
                container?.querySelector(
                    '.subcategory-editor'
                );

            if (!container || !first) {
                return;
            }

            const clone =
                first.cloneNode(true);

            clone
                .querySelectorAll('input')
                .forEach(input => {
                    input.value = '';
                });

            clone
                .querySelectorAll('select')
                .forEach(select => {
                    select.selectedIndex = 0;
                });

            container.appendChild(clone);

            const editors =
                container.querySelectorAll(
                    '.subcategory-editor'
                );

            editors.forEach(
                (editor, index) => {

                    const title =
                        editor.querySelector(
                            '.subcategory-title'
                        );

                    if (title) {

                        title.textContent =
                            `Subcategoria ${index + 1}`;
                    }
                }
            );
        };
    }

    const addEditSubcategory =
        $('#add-edit-subcategory');

    if (addEditSubcategory) {

        addEditSubcategory.onclick = () => {

            const container =
                $('#edit-subcategories-container');

            const first =
                container?.querySelector(
                    '.subcategory-editor'
                );

            if (!container || !first) {
                return;
            }

            const clone =
                first.cloneNode(true);

            clone
                .querySelectorAll('input')
                .forEach(input => {

                    input.value = '';
                });

            clone
                .querySelectorAll('select')
                .forEach(select => {

                    select.selectedIndex = 0;
                });

            const removeButton =
                document.createElement('button');

            removeButton.type =
                'button';

            removeButton.className =
                'secondary';

            removeButton.textContent =
                'Remover';

            removeButton.style.marginTop =
                '16px';

            removeButton.onclick = () => {

                clone.remove();

                const editors =
                    container.querySelectorAll(
                        '.subcategory-editor'
                    );

                editors.forEach(
                    (editor, index) => {

                        const title =
                            editor.querySelector(
                                '.subcategory-title'
                            );

                        if (title) {

                            title.textContent =
                                `Subcategoria ${index + 1}`;
                        }
                    }
                );
            };

            clone.appendChild(
                removeButton
            );

            container.appendChild(
                clone
            );

            const editors =
                container.querySelectorAll(
                    '.subcategory-editor'
                );

            editors.forEach(
                (editor, index) => {

                    const title =
                        editor.querySelector(
                            '.subcategory-title'
                        );

                    if (title) {

                        title.textContent =
                            `Subcategoria ${index + 1}`;
                    }
                }
            );
        };
    }

    document
        .querySelectorAll('[data-edit-service]')
        .forEach(b => {

            b.onclick = () => {

                if (state.user.role !== 'admin') {
                    return;
                }

                const service =
                    state.services.find(
                        item =>
                            item.firestoreId ===
                            b.dataset.editService
                    );

                if (!service) {

                    console.error(
                        'Serviço não encontrado:',
                        b.dataset.editService
                    );

                    return;
                }

                state.selected = service;

                state.view =
                    'admin-edit-service';

                render();
            };

        });

    document
        .querySelectorAll('[data-edit-user]')
        .forEach(b => {

            b.onclick = () => {

                if (state.user.role !== 'admin') {
                    return;
                }

                const user =
                    state.users.find(
                        u => u.firestoreId === b.dataset.editUser
                    );

                if (!user) {
                    console.error(
                        'Usuário não encontrado:',
                        b.dataset.editUser
                    );

                    return;
                }

                state.selected = user;
                state.view = 'admin-user-edit';

                render();
            };

        });

    document
        .querySelectorAll('[data-ticket]')
        .forEach(b =>
            b.onclick = () => {

                state.selected = Number(
                    b.dataset.ticket
                );

                state.view = 'detail';

                render();
            }
        );

    document.querySelectorAll('[data-capture]').forEach(b =>
        b.onclick = async () => {

            const t = state.tickets.find(
                x => x.id === Number(b.dataset.capture)
            );

            if (!t) {
                console.error('Chamado não encontrado:', b.dataset.capture);
                return;
            }

            try {

                await updateDoc(
                    doc(db, 'tickets', t.firestoreId),
                    {
                        responsible: state.user.name,
                        status: 'Em análise',
                        responsibilityHistory: [
                            ...(t.responsibilityHistory || []),
                            {
                                action: 'captura',
                                from: t.responsible || null,
                                to: state.user.name,
                                date: new Date().toISOString()
                            }
                        ]
                    }
                );

                await loadTickets();

                render();

            } catch (err) {

                console.error(
                    'Erro ao capturar chamado:',
                    err
                );

                alert(
                    'Não foi possível capturar o chamado. ' +
                    'Verifique o acesso ao Firestore.'
                );
            }
        }
    );

    document
        .querySelectorAll('[data-assume]')
        .forEach(b =>
            b.onclick = async () => {

                const t = state.tickets.find(
                    x => x.id === Number(b.dataset.assume)
                );

                if (!t) {

                    console.error(
                        'Chamado não encontrado:',
                        b.dataset.assume
                    );

                    return;
                }

                if (
                    !t.responsible ||
                    t.responsible === state.user.name ||
                    t.status === 'Concluído'
                ) {

                    return;
                }

                try {

                    await updateDoc(
                        doc(
                            db,
                            'tickets',
                            t.firestoreId
                        ),
                        {
                            responsible: state.user.name,
                            status: 'Em análise',

                            responsibilityHistory: [
                                ...(t.responsibilityHistory || []),
                                {
                                    action: 'transferência',
                                    from: t.responsible,
                                    to: state.user.name,
                                    date: new Date().toISOString()
                                }
                            ]
                        }
                    );

                    await loadTickets();

                    render();

                } catch (err) {

                    console.error(
                        'Erro ao assumir atendimento:',
                        err
                    );

                    alert(
                        'Não foi possível assumir o atendimento. ' +
                        'Verifique o acesso ao Firestore.'
                    );
                }
            }
        );

    if ($('#user-form'))
        $('#user-form').onsubmit = e => {

            e.preventDefault();

            const list = directory();

            const username =
                $('#new-username')
                    .value
                    .trim()
                    .toLowerCase();

            if (
                list.some(
                    u => u.username === username
                )
            ) {
                alert(
                    'Este usuário já está cadastrado.'
                );

                return;
            }

            list.push({
                username,
                password:
                    $('#new-password').value,
                name:
                    $('#new-name')
                        .value
                        .trim(),
                unit:
                    $('#new-unit')
                        .value
                        .trim(),
                department:
                    $('#new-department')
                        .value
                        .trim()
            });

            saveDirectory(list);

            render();
        };

    const editUserForm = $('#edit-user-form');

    if (editUserForm) {

        editUserForm.onsubmit = async e => {

            e.preventDefault();

            const user = state.selected;

            if (!user) {
                alert('Usuário não encontrado.');
                return;
            }

            const name =
                $('#edit-user-name').value.trim();

            const role =
                $('#edit-user-role').value;

            const active =
                $('#edit-user-active').value === 'true';

            const unit =
                $('#edit-user-unit').value.trim();

            const department =
                $('#edit-user-department').value.trim();

            try {

                await updateDoc(
                    doc(db, 'users', user.firestoreId),
                    {
                        name,
                        role,
                        active,
                        unit,
                        department
                    }
                );

                await loadUsers();

                state.selected = null;
                state.view = 'admin-users';

                render();

            } catch (err) {

                console.error(
                    'Erro ao atualizar usuário:',
                    err
                );

                alert(
                    'Não foi possível salvar as alterações. ' +
                    'Verifique o acesso ao Firestore.'
                );
            }
        };
    }

    /*
 * Formulário de criação de serviço
 */

    const adminServiceForm =
        $('#admin-service-form');

    if (adminServiceForm) {

        adminServiceForm.onsubmit = async e => {

            e.preventDefault();

            const serviceName =
                $('#admin-service-name')
                    .value
                    .trim();

            const serviceActive =
                $('#admin-service-active')
                    .value === 'true';

            const editors =
                document.querySelectorAll(
                    '.subcategory-editor'
                );

            const subcategories = [];
            const subcategoryStatus = {};
            const subcategoryConfig = {};

            for (const editor of editors) {

                const name =
                    editor
                        .querySelector(
                            '.admin-subcategory-name'
                        )
                        ?.value
                        .trim();

                const type =
                    editor
                        .querySelector(
                            '.admin-subcategory-type'
                        )
                        ?.value;

                const criticality =
                    editor
                        .querySelector(
                            '.admin-subcategory-criticality'
                        )
                        ?.value;

                const sla =
                    Number(
                        editor
                            .querySelector(
                                '.admin-subcategory-sla'
                            )
                            ?.value
                    );

                const active =
                    editor
                        .querySelector(
                            '.admin-subcategory-active'
                        )
                        ?.value === 'true';

                if (!name) {

                    alert(
                        'Informe o nome de todas as subcategorias.'
                    );

                    return;
                }

                if (!Number.isInteger(sla) || sla < 1) {

                    alert(
                        `Informe um SLA válido para a subcategoria "${name}".`
                    );

                    return;
                }

                if (
                    subcategories.some(
                        item =>
                            item.toLowerCase() ===
                            name.toLowerCase()
                    )
                ) {

                    alert(
                        `A subcategoria "${name}" está duplicada.`
                    );

                    return;
                }

                subcategories.push(name);

                subcategoryStatus[name] =
                    active;

                subcategoryConfig[name] = {
                    type,
                    criticality,
                    sla,
                    active
                };
            }

            if (!subcategories.length) {

                alert(
                    'Cadastre pelo menos uma subcategoria.'
                );

                return;
            }

            const existingService =
                state.services.find(
                    service =>
                        (service.name || '')
                            .trim()
                            .toLowerCase() ===
                        serviceName.toLowerCase()
                );

            if (existingService) {

                alert(
                    'Já existe um serviço com esse nome.'
                );

                return;
            }

            try {

                await addDoc(
                    collection(
                        db,
                        'services'
                    ),
                    {
                        name: serviceName,
                        active: serviceActive,
                        subcategories,
                        subcategoryStatus,
                        subcategoryConfig
                    }
                );

                await loadServices();

                state.view =
                    'admin-catalog';

                state.selected = null;

                render();

            } catch (err) {

                console.error(
                    'Erro ao criar serviço:',
                    err
                );

                alert(
                    'Não foi possível criar o serviço. ' +
                    'Verifique o acesso ao Firestore.'
                );
            }
        };
    }


    /*
 * Formulário de edição de serviço
 */

    const adminEditServiceForm =
        $('#admin-edit-service-form');

    if (adminEditServiceForm) {

        adminEditServiceForm.onsubmit = async e => {

            e.preventDefault();

            const service =
                state.selected;

            if (!service) {

                alert(
                    'Serviço não encontrado.'
                );

                return;
            }

            const serviceName =
                $('#admin-edit-service-name')
                    .value
                    .trim();

            const serviceActive =
                $('#admin-edit-service-active')
                    .value === 'true';

            const editors =
                document.querySelectorAll(
                    '#edit-subcategories-container .subcategory-editor'
                );

            const subcategories = [];
            const subcategoryStatus = {};
            const subcategoryConfig = {};

            for (const editor of editors) {

                const name =
                    editor
                        .querySelector(
                            '.admin-subcategory-name'
                        )
                        ?.value
                        .trim();

                const type =
                    editor
                        .querySelector(
                            '.admin-subcategory-type'
                        )
                        ?.value;

                const criticality =
                    editor
                        .querySelector(
                            '.admin-subcategory-criticality'
                        )
                        ?.value;

                const sla =
                    Number(
                        editor
                            .querySelector(
                                '.admin-subcategory-sla'
                            )
                            ?.value
                    );

                const active =
                    editor
                        .querySelector(
                            '.admin-subcategory-active'
                        )
                        ?.value === 'true';

                if (!name) {

                    alert(
                        'Informe o nome de todas as subcategorias.'
                    );

                    return;
                }

                if (!Number.isInteger(sla) || sla < 1) {

                    alert(
                        `Informe um SLA válido para a subcategoria "${name}".`
                    );

                    return;
                }

                if (
                    subcategories.some(
                        item =>
                            item.toLowerCase() ===
                            name.toLowerCase()
                    )
                ) {

                    alert(
                        `A subcategoria "${name}" está duplicada.`
                    );

                    return;
                }

                subcategories.push(name);

                subcategoryStatus[name] =
                    active;

                subcategoryConfig[name] = {

                    type,

                    criticality,

                    sla,

                    active
                };
            }

            if (!subcategories.length) {

                alert(
                    'O serviço precisa possuir pelo menos uma subcategoria.'
                );

                return;
            }

            const existingService =
                state.services.find(
                    item =>
                        item.firestoreId !==
                        service.firestoreId &&
                        (item.name || '')
                            .trim()
                            .toLowerCase() ===
                        serviceName.toLowerCase()
                );

            if (existingService) {

                alert(
                    'Já existe outro serviço com esse nome.'
                );

                return;
            }

            try {

                await updateDoc(
                    doc(
                        db,
                        'services',
                        service.firestoreId
                    ),
                    {
                        name: serviceName,
                        active: serviceActive,
                        subcategories,
                        subcategoryStatus,
                        subcategoryConfig
                    }
                );

                await loadServices();

                state.selected = null;

                state.view =
                    'admin-catalog';

                render();

            } catch (err) {

                console.error(
                    'Erro ao atualizar serviço:',
                    err
                );

                alert(
                    'Não foi possível salvar as alterações do serviço. ' +
                    'Verifique o acesso ao Firestore.'
                );
            }
        };
    }


    /*
     * Formulário de criação de chamado
     */

    const ticketForm = $('#ticket-form');

    if (ticketForm) {

        ticketForm.onsubmit = async e => {

            e.preventDefault();

            const service =
                $('#service').value;

            const subcategory =
                $('#subcategory').value;

            const selectedService =
                state.services.find(
                    item =>
                        item.name === service
                );

            const config =
                selectedService
                    ?.subcategoryConfig
                ?.[subcategory];

            if (!config || !config.type || !config.criticality || !(Number(config.sla) > 0)) {
                alert('Esta subcategoria ainda não possui uma configuração válida de criticidade e SLA. Atualize o catálogo ou selecione outra subcategoria.');
                return;
            }

            const type = config.type;
            const criticality = config.criticality;
            const sla = Number(config.sla);

            const list =
                tickets();

            const id =
                Math.max(
                    ...list.map(x => x.id),
                    1000
                ) + 1;

            const ticket = {

                id,

openedBy:
    state.user.username,

requester:
    state.user.username,

service,

                subcategory,

                type,

                criticality,

                sla,

                status:
                    'Aberto',

                responsible:
                    null,

                pendingHistory:
                    [],

                openedAt:
                    new Date().toISOString(),

                description:
                    $('#description').value
            };

            try {

                await addDoc(
                    collection(
                        db,
                        'tickets'
                    ),
                    ticket
                );

                await loadTickets();

                showSuccess(ticket);

            } catch (err) {

                console.error(
                    'Erro ao criar chamado:',
                    err
                );

                alert(
                    'Não foi possível criar o chamado. ' +
                    'Verifique o acesso ao Firestore.'
                );
            }
        };
    }

    /*
 * Formulário de chamado em nome de solicitante
 */

    const ticketOnBehalfForm =
        $('#ticket-on-behalf-form');


    if (ticketOnBehalfForm) {

        const submitButton =
            ticketOnBehalfForm.querySelector(
                'button[type="submit"]'
            );


        const validateOnBehalfForm =
            () => {

                const requester =
                    $('#on-behalf-requester')?.value
                        .trim();


                const service =
                    $('#on-behalf-service')?.value
                        .trim();

                const subcategory =
                    $('#on-behalf-subcategory')?.value
                        .trim();

                const description =
                    $('#on-behalf-description')?.value
                        .trim();


                const valid =
                    Boolean(
                        requester &&
                        service &&
                        subcategory &&
                        description
                    );


                if (submitButton) {

                    submitButton.disabled =
                        !valid;
                }


                return valid;
            };


        /*
         * Atualiza o estado do botão quando
         * os campos forem alterados.
         */

        $('#on-behalf-requester-search')?.addEventListener(
            'input',
            validateOnBehalfForm
        );


        $('#on-behalf-service')?.addEventListener(
            'change',
            validateOnBehalfForm
        );


        $('#on-behalf-subcategory')?.addEventListener(
            'change',
            validateOnBehalfForm
        );


        $('#on-behalf-description')?.addEventListener(
            'input',
            validateOnBehalfForm
        );


        /*
         * Criação do chamado.
         */

        ticketOnBehalfForm.onsubmit =
            async e => {

                e.preventDefault();


                if (!validateOnBehalfForm()) {

                    alert(
                        'Preencha o solicitante, serviço, subcategoria e descrição.'
                    );

                    return;
                }


                const requester =
                    $('#on-behalf-requester')
                        .value
                        .trim();

                const requesterUser =
                    state.users.find(
                        user =>
                            user.username === requester ||
                            user.email === requester
                    );

                const requesterName =
                    requesterUser?.name ||
                    requester;

                const service =
                    $('#on-behalf-service')
                        .value
                        .trim();

                const subcategory =
                    $('#on-behalf-subcategory')
                        .value
                        .trim();

                const description =
                    $('#on-behalf-description')
                        .value
                        .trim();


                const selectedService =
                    state.services.find(
                        item =>
                            item.name === service
                    );


                const config =
                    selectedService
                        ?.subcategoryConfig
                    ?.[subcategory];


                if (!config) {

                    alert(
                        'A subcategoria selecionada não possui uma configuração válida.'
                    );

                    return;
                }


                const type =
                    config.type ||
                    'Não configurado';


                const criticality =
                    config.criticality ||
                    'Não configurada';


                const sla =
                    config.sla || 0;


                const list =
                    tickets();


                const id =
                    Math.max(
                        ...list.map(
                            x =>
                                Number(x.id) || 0
                        ),
                        1000
                    ) + 1;


                const ticket = {

                    id,

                    openedBy:
                        state.user.username,

                    requester,

                    requesterName,

                    service,

                    subcategory,

                    type,

                    criticality,

                    sla,

                    status:
                        'Aberto',

                    responsible:
                        null,

                    pendingHistory:
                        [],

                    openedAt:
                        new Date().toISOString(),

                    description
                };


                submitButton.disabled =
                    true;

                submitButton.textContent =
                    'Criando chamado...';


                try {

                    await addDoc(
                        collection(
                            db,
                            'tickets'
                        ),
                        ticket
                    );


                    await loadTickets();

                    showSuccess(
                        ticket,
                        true
                    );


                } catch (err) {

                    console.error(
                        'Erro ao criar chamado em nome de solicitante:',
                        err
                    );


                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        'Criar chamado';


                    alert(
                        'Não foi possível criar o chamado. ' +
                        'Verifique o acesso ao Firestore.'
                    );
                }

            };


        /*
         * Estado inicial do botão.
         */

        validateOnBehalfForm();

    }

    if (
        $('#service') &&
        $('#subcategory')
    ) {

        $('#service').onchange = e => {

            const service =
                state.services.find(
                    item =>
                        item.name === e.target.value
                );

            const subs =
                service?.subcategories || [];

            const activeSubs =
                subs.filter(
                    subcategory =>
                        service.subcategoryStatus?.[subcategory] !== false
                );

            $('#subcategory').disabled =
                !activeSubs.length;

            $('#subcategory').innerHTML =
                '<option value="">Selecione uma subcategoria</option>' +
                activeSubs
                    .map(
                        subcategory =>
                            `<option value="${subcategory}">
                                ${subcategory}
                            </option>`
                    )
                    .join('');

            updateForm();
        };

        if ($('#subcategory')) {

            $('#subcategory').onchange =
                updateForm;
        }

    }

/*
 * Motor da pesquisa de chamados
 */

const executeTicketSearch =
    $('#execute-ticket-search');

if (executeTicketSearch) {

    executeTicketSearch.onclick = () => {

        const normalize = value =>
    String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

        const number =
            normalize(
                $('#search-ticket-number')?.value
            ).replace(/^#/, '');

        const requesterId =
            $('#search-requester-id')?.value || '';

        const requester =
            state.users.find(
                user =>
                    user.firestoreId === requesterId
            );

        const responsible =
            $('#search-responsible')?.value || '';

        const service =
            $('#search-service')?.value || '';

        const status =
            $('#search-status')?.value || '';

        const type =
            $('#search-type')?.value || '';

        const dateStart =
            $('#search-date-start')?.value || '';

        const dateEnd =
            $('#search-date-end')?.value || '';

        if (
            dateStart &&
            dateEnd &&
            dateStart > dateEnd
        ) {

            alert(
                'A data inicial não pode ser posterior à data final.'
            );

            return;
        }

        const requesterValues =
            requester
                ? [
                    requester.username,
                    requester.email,
                    requester.name
                ]
                    .filter(Boolean)
                    .map(normalize)
                : [];

        state.searchResults =
            state.tickets.filter(ticket => {

                const ticketNumber =
                    normalize(
                        numeroChamado(ticket)
                    ).replace(/^#/, '');

                const ticketId =
                    normalize(ticket.id);

                const matchesNumber =
                    !number ||
                    ticketNumber.includes(number) ||
                    ticketId === number;

                const ticketRequester =
                    normalize(ticket.requester);

                const ticketRequesterName =
                    normalize(ticket.requesterName);

                const matchesRequester =
                    !requesterId ||
                    requesterValues.includes(ticketRequester) ||
                    requesterValues.includes(ticketRequesterName);

                const matchesResponsible =
                    !responsible ||
                    ticket.responsible === responsible;

                const matchesService =
                    !service ||
                    ticket.service === service;

                const matchesStatus =
                    !status ||
                    ticket.status === status;

                const matchesType =
                    !type ||
                    ticket.type === type;

                const openedAt =
                    ticket.openedAt
                        ? new Date(ticket.openedAt)
                        : null;

                const startDate =
                    dateStart
                        ? new Date(`${dateStart}T00:00:00`)
                        : null;

                const endDate =
                    dateEnd
                        ? new Date(`${dateEnd}T23:59:59.999`)
                        : null;

                const matchesStartDate =
                    !startDate ||
                    (
                        openedAt &&
                        openedAt >= startDate
                    );

                const matchesEndDate =
                    !endDate ||
                    (
                        openedAt &&
                        openedAt <= endDate
                    );

                return (
                    matchesNumber &&
                    matchesRequester &&
                    matchesResponsible &&
                    matchesService &&
                    matchesStatus &&
                    matchesType &&
                    matchesStartDate &&
                    matchesEndDate
                );
            });

        const searchResultsContainer =
    $('#search-results');

if (searchResultsContainer) {

    if (!state.searchResults.length) {

        searchResultsContainer.innerHTML = `
            <div class="empty">
                Nenhum chamado encontrado com os filtros informados.
            </div>
        `;

    } else {

        searchResultsContainer.innerHTML = `
            <p style="margin-bottom:12px">
                ${state.searchResults.length}
                chamado(s) encontrado(s).
            </p>

            ${table(state.searchResults, true)}
        `;

        searchResultsContainer
            .querySelectorAll('[data-ticket]')
            .forEach(button => {

                button.onclick = () => {

                    state.selected =
                        Number(button.dataset.ticket);

                    state.view = 'detail';

                    render();
                };
            });
    }
}
    };
}

/*
 * Limpar filtros da pesquisa
 */

const clearTicketSearch =
    $('#clear-ticket-search');

if (clearTicketSearch) {

    clearTicketSearch.onclick = () => {

        $('#search-ticket-number').value = '';
        $('#search-requester').value = '';
        $('#search-requester-id').value = '';
        $('#search-responsible').value = '';
        $('#search-service').value = '';
        $('#search-status').value = '';
        $('#search-type').value = '';
        $('#search-date-start').value = '';
        $('#search-date-end').value = '';

        $('#search-requester-results').innerHTML = '';
        $('#search-requester-results').style.display = 'none';

        state.searchResults = [];

        const resultsContainer =
            $('#search-results');

        if (resultsContainer) {

            resultsContainer.innerHTML = `
                <div class="empty">
                    Utilize os filtros acima para pesquisar chamados.
                </div>
            `;
        }
    };
}

    /*
 * Autocomplete do solicitante na pesquisa
 */

const searchRequesterInput =
    $('#search-requester');

const searchRequesterResults =
    $('#search-requester-results');

const searchRequesterId =
    $('#search-requester-id');

if (
    searchRequesterInput &&
    searchRequesterResults &&
    searchRequesterId
) {

    const normalizeSearchRequester =
        value =>
            (value || '')
                .normalize('NFD')
                .replace(
                    /[\u0300-\u036f]/g,
                    ''
                )
                .toLowerCase()
                .trim();

    searchRequesterInput.oninput = () => {

        const search =
            normalizeSearchRequester(
                searchRequesterInput.value
            );

        searchRequesterId.value = '';

        if (!search) {

            searchRequesterResults.innerHTML = '';
            searchRequesterResults.style.display = 'none';

            return;
        }

        const users =
            state.users
                .filter(
                    user =>
                        user.role === 'requester'
                )
                .filter(
                    user => {

                        const name =
                            normalizeSearchRequester(
                                user.name
                            );

                        const username =
                            normalizeSearchRequester(
                                user.username
                            );

                        const email =
                            normalizeSearchRequester(
                                user.email
                            );

                        return (
                            name.includes(search) ||
                            username.includes(search) ||
                            email.includes(search)
                        );
                    }
                )
                .sort(
                    (a, b) =>
                        (a.name || '').localeCompare(
                            b.name || '',
                            'pt-BR'
                        )
                )
                .slice(0, 8);

        if (!users.length) {

            searchRequesterResults.innerHTML = `
                <div style="padding:12px;color:#667085">
                    Nenhum solicitante encontrado.
                </div>
            `;

            searchRequesterResults.style.display = 'block';

            return;
        }

        searchRequesterResults.innerHTML =
            users
                .map(
                    user => `
                        <button
                            type="button"
                            data-search-requester-id="${user.firestoreId}"
                            style="
                                display:block;
                                width:100%;
                                padding:10px 12px;
                                border:0;
                                border-bottom:1px solid #edf1f5;
                                background:#fff;
                                text-align:left;
                                cursor:pointer;
                            "
                        >
                            <strong>
                                ${user.name || 'Nome não informado'}
                            </strong>

                            <br>

                            <small>
                                ${user.username || user.email || ''}
                                —
                                ${user.active === false ? 'Inativo' : 'Ativo'}
                            </small>
                        </button>
                    `
                )
                .join('');

        searchRequesterResults.style.display = 'block';

        searchRequesterResults
            .querySelectorAll('[data-search-requester-id]')
            .forEach(
                button => {

                    button.onclick = () => {

                        const firestoreId =
                            button.dataset.searchRequesterId;

                        const user =
                            state.users.find(
                                item =>
                                    item.firestoreId === firestoreId
                            );

                        if (!user) {
                            return;
                        }

                        searchRequesterId.value =
                            user.firestoreId;

                        searchRequesterInput.value =
                            user.name || user.username || user.email;

                        searchRequesterResults.innerHTML = '';
                        searchRequesterResults.style.display = 'none';
                    };
                }
            );
    };
}

/*
 * Filtro de técnico responsável na pesquisa
 */

const searchResponsible =
    $('#search-responsible');

if (searchResponsible) {

    const selectedResponsible =
        searchResponsible.value;

    const responsibleNames =
        [
            ...new Set(
                state.tickets
                    .map(
                        ticket =>
                            ticket.responsible
                    )
                    .filter(Boolean)
            )
        ]
        .sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    'pt-BR'
                )
        );

    searchResponsible.innerHTML = `
        <option value="">
            Todos
        </option>
    `;

    responsibleNames.forEach(
        name => {

            const option =
                document.createElement('option');

            option.value = name;
            option.textContent = name;

            searchResponsible.appendChild(
                option
            );
        }
    );

    if (
        responsibleNames.includes(
            selectedResponsible
        )
    ) {
        searchResponsible.value =
            selectedResponsible;
    }
}

/*
 * Filtro de serviço na pesquisa
 */

const searchService =
    $('#search-service');

if (searchService) {

    const selectedService =
        searchService.value;

    const serviceNames =
        [
            ...new Set(
                state.tickets
                    .map(
                        ticket =>
                            ticket.service
                    )
                    .filter(Boolean)
            )
        ]
        .sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    'pt-BR'
                )
        );

    searchService.innerHTML = `
        <option value="">
            Todos
        </option>
    `;

    serviceNames.forEach(
        name => {

            const option =
                document.createElement('option');

            option.value = name;
            option.textContent = name;

            searchService.appendChild(
                option
            );
        }
    );

    if (
        serviceNames.includes(
            selectedService
        )
    ) {
        searchService.value =
            selectedService;
    }
}



    /*
     * Autocomplete do solicitante
     */

    const requesterSearch =
        $('#on-behalf-requester-search');

    const requesterResults =
        $('#on-behalf-requester-results');

    const requesterHidden =
        $('#on-behalf-requester');

    const requesterSelected =
        $('#on-behalf-requester-selected');


    if (
        requesterSearch &&
        requesterResults &&
        requesterHidden
    ) {

        const normalizeText =
            value =>
                (value || '')
                    .normalize('NFD')
                    .replace(
                        /[\u0300-\u036f]/g,
                        ''
                    )
                    .toLowerCase()
                    .trim();


        const getRequesterIdentifier =
            user =>
                user.username ||
                user.email ||
                '';


        requesterSearch.oninput = () => {

            const search =
                normalizeText(
                    requesterSearch.value
                );


            /*
             * Ao alterar o texto,
             * desfazemos uma seleção anterior.
             */

            requesterHidden.value = '';


            if (requesterSelected) {

                requesterSelected.style.display =
                    'none';

                requesterSelected.innerHTML =
                    '';
            }


            if (!search) {

                requesterResults.innerHTML =
                    '';

                requesterResults.style.display =
                    'none';

                return;
            }


            const users =
                state.users
                    .filter(
                        user =>
                            user.role === 'requester' &&
                            user.active !== false
                    )
                    .filter(
                        user => {

                            const name =
                                normalizeText(
                                    user.name
                                );

                            const email =
                                normalizeText(
                                    user.email
                                );

                            const username =
                                normalizeText(
                                    user.username
                                );

                            return (
                                name.includes(search) ||
                                email.includes(search) ||
                                username.includes(search)
                            );
                        }
                    )
                    .sort(
                        (a, b) =>
                            (a.name || '')
                                .localeCompare(
                                    b.name || '',
                                    'pt-BR'
                                )
                    )
                    .slice(0, 8);


            if (!users.length) {

                requesterResults.innerHTML = `
                <div
                    style="
                        padding:12px;
                        color:#667085;
                    "
                >
                    Nenhum solicitante encontrado.
                </div>
            `;

                requesterResults.style.display =
                    'block';

                return;
            }


            requesterResults.innerHTML =
                users
                    .map(
                        user => {

                            const identifier =
                                getRequesterIdentifier(
                                    user
                                );

                            return `
                            <button
                                type="button"
                                data-requester-id="${user.firestoreId}"
                                style="
                                    display:block;
                                    width:100%;
                                    padding:10px 12px;
                                    border:0;
                                    border-bottom:1px solid #edf1f5;
                                    background:#fff;
                                    text-align:left;
                                    cursor:pointer;
                                "
                            >

                                <strong>
                                    ${user.name || 'Nome não informado'}
                                </strong>

                                <br>

                                <small>
                                    ${identifier}
                                </small>

                            </button>
                        `;
                        }
                    )
                    .join('');


            requesterResults.style.display =
                'block';


            requesterResults
                .querySelectorAll(
                    '[data-requester-id]'
                )
                .forEach(
                    button => {

                        button.onclick = () => {

                            const firestoreId =
                                button.dataset
                                    .requesterId;


                            const user =
                                state.users.find(
                                    item =>
                                        item.firestoreId ===
                                        firestoreId
                                );


                            if (!user) {

                                console.error(
                                    'Solicitante não encontrado:',
                                    firestoreId
                                );

                                return;
                            }


                            const identifier =
                                getRequesterIdentifier(
                                    user
                                );


                            /*
                             * Guarda o identificador que será
                             * utilizado posteriormente no chamado.
                             */

                            requesterHidden.value =
                                identifier;


                            /*
                             * Mostra o nome selecionado
                             * no campo de pesquisa.
                             */

                            requesterSearch.value =
                                user.name || identifier;


                            /*
                             * Fecha a lista de sugestões.
                             */

                            requesterResults.innerHTML =
                                '';

                            requesterResults.style.display =
                                'none';


                            /*
                             * Mostra claramente quem foi selecionado.
                             */

                            if (requesterSelected) {

                                requesterSelected.innerHTML = `
                                <strong>
                                    Solicitante selecionado:
                                </strong>

                                ${user.name || 'Nome não informado'}

                                —
                                ${identifier}
                            `;

                                requesterSelected.style.display =
                                    'block';
                            }

                        };

                    }
                );

        };

    }

    /*
 * Formulário de chamado em nome de solicitante
 */

    const onBehalfService =
        $('#on-behalf-service');

    const onBehalfSubcategory =
        $('#on-behalf-subcategory');

    if (
        onBehalfService &&
        onBehalfSubcategory
    ) {

        onBehalfService.onchange = e => {

            const service =
                state.services.find(
                    item =>
                        item.name ===
                        e.target.value
                );

            const subs =
                service?.subcategories || [];

            const activeSubs =
                subs.filter(
                    subcategory =>
                        service.subcategoryStatus?.[subcategory] !== false
                );

            onBehalfSubcategory.disabled =
                !activeSubs.length;

            onBehalfSubcategory.innerHTML =
                '<option value="">Selecione uma subcategoria</option>' +

                activeSubs
                    .map(
                        subcategory =>
                            `<option value="${subcategory}">
                            ${subcategory}
                        </option>`
                    )
                    .join('');

            $('#on-behalf-type').value =
                'Será definido automaticamente';

            $('#on-behalf-criticality').value =
                'Será definida automaticamente';

            $('#on-behalf-sla').value =
                'Será definido automaticamente';
        };


        onBehalfSubcategory.onchange = e => {

            const service =
                state.services.find(
                    item =>
                        item.name ===
                        onBehalfService.value
                );

            const config =
                service
                    ?.subcategoryConfig
                ?.[e.target.value];

            if (!config) {

                $('#on-behalf-type').value =
                    'Não configurado';

                $('#on-behalf-criticality').value =
                    'Não configurada';

                $('#on-behalf-sla').value =
                    'Não configurado';

                return;
            }

            $('#on-behalf-type').value =
                config.type ||
                'Não configurado';

            $('#on-behalf-criticality').value =
                config.criticality ||
                'Não configurada';

            $('#on-behalf-sla').value =
                config.sla
                    ? `${config.sla} horas`
                    : 'Não configurado';
        };

    }

    if ($('#resume-pending')) {

        $('#resume-pending').onclick =
            async () => {

                const t =
                    tickets().find(
                        x =>
                            x.id ===
                            state.selected
                    );

                if (!t) {

                    alert(
                        'Chamado não encontrado.'
                    );

                    return;
                }

                if (
                    t.status !== 'Pendente' ||
                    t.responsible !==
                    state.user.name
                ) {

                    alert(
                        'Este chamado não está disponível para retomada.'
                    );

                    return;
                }

                const pendingIndex =
                    Array.isArray(
                        t.pendingHistory
                    )
                        ? t.pendingHistory
                            .map(
                                (item, index) => ({
                                    item,
                                    index
                                })
                            )
                            .reverse()
                            .find(
                                x =>
                                    !x.item.endedAt
                            )
                        : null;

                if (!pendingIndex) {

                    alert(
                        'Não foi encontrada uma pendência ativa para este chamado.'
                    );

                    return;
                }

                const now =
                    new Date();

                const startedAt =
                    new Date(
                        pendingIndex.item.startedAt
                    );

                const totalMinutes =
                    Math.max(
                        0,
                        Math.round(
                            (
                                now.getTime() -
                                startedAt.getTime()
                            ) / 60000
                        )
                    );

                const limit =
                    deadline(t);

                let slaRemainingMinutes =
                    null;

                if (limit) {

                    const current =
                        new Date(
                            startedAt
                        );

                    let minutes = 0;

                    while (
                        current < limit
                    ) {

                        const day =
                            current.getDay();

                        const hour =
                            current.getHours();

                        if (
                            day >= 1 &&
                            day <= 5 &&
                            hour >= 8 &&
                            hour < 18
                        ) {

                            minutes++;
                        }

                        current.setMinutes(
                            current.getMinutes() + 1
                        );
                    }

                    slaRemainingMinutes =
                        Math.max(
                            0,
                            minutes
                        );
                }

                const pendingHistory =
                    [...t.pendingHistory];

                pendingHistory[
                    pendingIndex.index
                ] = {

                    ...pendingHistory[
                    pendingIndex.index
                    ],

                    endedAt:
                        now.toISOString(),

                    totalMinutes,

                    usefulMinutes:
                        0,

                    resumedBy:
                        state.user.name
                };

                const button =
                    $('#resume-pending');

                button.disabled =
                    true;

                button.textContent =
                    'Retomando...';

                try {

                    await updateDoc(
                        doc(
                            db,
                            'tickets',
                            t.firestoreId
                        ),
                        {

                            status:
                                'Em análise',

                            pendingHistory,

                            slaRemainingMinutes,

                            slaResumeAt:
                                now.toISOString()
                        }
                    );

                    await loadTickets();

                    render();

                } catch (err) {

                    console.error(
                        'Erro ao retomar chamado:',
                        err
                    );

                    button.disabled =
                        false;

                    button.textContent =
                        'Retomar atendimento';

                    alert(
                        'Não foi possível retomar o chamado. ' +
                        'Verifique o acesso ao Firestore.'
                    );
                }
            };
    }

    if ($('#finish')) {
        $('#finish').onclick = async () => {
            const t = tickets().find(x => x.id === state.selected);

            if (!t) {
                alert('Chamado não encontrado.');
                return;
            }

            const solution = $('#solution')?.value.trim() || '';

            if (!solution) {
                alert('Informe a solução/procedimento realizado antes de concluir o chamado.');
                $('#solution')?.focus();
                return;
            }

            if (solution.length < 15) {
                alert('A descrição da solução deve ter no mínimo 15 caracteres.');
                $('#solution')?.focus();
                return;
            }

            const button = $('#finish');

            button.disabled = true;
            button.textContent = 'Concluindo...';

            try {
                await updateDoc(
                    doc(db, 'tickets', t.firestoreId),
                    {
                        solution,
                        status: 'Concluído',
                        closedAt: new Date().toISOString()
                    }
                );

                await loadTickets();

                state.selected = null;
                state.view = 'queue';

                render();

            } catch (err) {
                console.error('Erro ao concluir chamado:', err);

                button.disabled = false;
                button.textContent = 'Concluir chamado';

                alert(
                    'Não foi possível concluir o chamado. ' +
                    'Verifique o acesso ao Firestore.'
                );
            }
        };
    }
    if ($('#pending')) {

        $('#pending').onclick = () => {

            const modal =
                document.createElement('div');

            modal.className =
                'modal';

            modal.innerHTML = `
            <div class="modal-box">

                <h2>
                    Colocar chamado em Pendente
                </h2>

                <div>

                    <label for="pending-reason">
                        Motivo da pendência
                    </label>

                    <select id="pending-reason">

                        <option value="">
                            Selecione o motivo
                        </option>

                        <option value="Usuário não encontrado">
                            Usuário não encontrado
                        </option>

                        <option value="Aguardando ação externa">
                            Aguardando ação externa
                        </option>

                        <option value="Aguardando atividade da equipe elétrica">
                            Aguardando atividade da equipe elétrica
                        </option>

                        <option value="Outro">
                            Outro
                        </option>

                    </select>

                </div>

                <div
                    id="pending-description-container"
                    style="display:none"
                >

                    <label for="pending-description">
                        Descreva o motivo
                    </label>

                    <textarea
                        id="pending-description"
                        rows="4"
                        placeholder="Informe o motivo da pendência..."
                    ></textarea>

                </div>

                <div class="actions">

                    <button
                        type="button"
                        class="secondary"
                        id="cancel-pending"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        class="primary"
                        id="confirm-pending"
                    >
                        Confirmar
                    </button>

                </div>

            </div>
        `;

            document.body.append(
                modal
            );

            $('#pending-reason').onchange = e => {

                const container =
                    $('#pending-description-container');

                if (
                    e.target.value === 'Outro'
                ) {

                    container.style.display =
                        'block';

                } else {

                    container.style.display =
                        'none';

                    $('#pending-description').value =
                        '';
                }
            };

            $('#cancel-pending').onclick = () => {

                modal.remove();

            };

            $('#confirm-pending').onclick =
                async () => {

                    const reason =
                        $('#pending-reason').value;

                    if (!reason) {

                        alert(
                            'Selecione o motivo da pendência.'
                        );

                        $('#pending-reason').focus();

                        return;
                    }

                    const description =
                        reason === 'Outro'
                            ? $('#pending-description')
                                .value
                                .trim()
                            : '';

                    if (
                        reason === 'Outro' &&
                        !description
                    ) {

                        alert(
                            'Descreva o motivo da pendência.'
                        );

                        $('#pending-description')
                            .focus();

                        return;
                    }

                    const t =
                        tickets().find(
                            x =>
                                x.id ===
                                state.selected
                        );

                    if (!t) {

                        alert(
                            'Chamado não encontrado.'
                        );

                        modal.remove();

                        return;
                    }

                    const pending =
                        criarRegistroPendencia(
                            reason,
                            description,
                            state.user.name
                        );

                    try {

                        await updateDoc(
                            doc(
                                db,
                                'tickets',
                                t.firestoreId
                            ),
                            {
                                status:
                                    'Pendente',

                                pendingHistory: [
                                    ...(t.pendingHistory || []),
                                    pending
                                ]
                            }
                        );

                        await loadTickets();

                        modal.remove();

                        render();

                    } catch (err) {

                        console.error(
                            'Erro ao colocar chamado em Pendente:',
                            err
                        );

                        alert(
                            'Não foi possível colocar o chamado em Pendente. ' +
                            'Verifique o acesso ao Firestore.'
                        );
                    }
                };
        };
    }

}

function numeroChamado(t) {

    const ano =
        t?.openedAt
            ? new Date(t.openedAt).getFullYear()
            : new Date().getFullYear();

    return `#${ano}-${t.id}`;
}

function showSuccess(
    t,
    onBehalf = false
) {

    const modal =
        document.createElement('div');

    modal.className =
        'modal';

    modal.innerHTML = `
        <div class="modal-box">

            <h2>
                ✓ Chamado criado com sucesso
            </h2>

            <p class="number">
    ${numeroChamado(t)}
</p>

            ${onBehalf
            ? `
            <div class="message">
                
                <strong>
                    Abertura em nome de:
                </strong>

                ${t.requester}

                <br>

                <strong>
                    Aberto por:
                </strong>

                ${t.openedBy}
                
            </div>
        `
            : ''
        }

            <div class="confirm-list">

                <strong>
                    ${t.service}
                </strong>
                ·
                ${t.subcategory}

                <br>

                Tipo:
                ${t.type}

                <br>

                Criticidade:
                ${t.criticality || 'Não informada'}

                <br>

                SLA de resolução:
                ${t.sla || 'Não definido'} horas

                <br>

                Status:
                Aberto

            </div>

            <div class="actions">

                <button
    class="primary"
    id="go-mine"
>
    ${onBehalf
            ? 'Ir para a fila de chamados'
            : 'Ver meus chamados'
        }
</button>

            </div>

        </div>
    `;

    document.body.append(
        modal
    );

    $('#go-mine').onclick = () => {

        modal.remove();

        state.view =
            onBehalf
                ? 'queue'
                : 'mine';

        state.selected =
            null;

        render();
    };
}
function createAceLocalTicket(payload) {
    const list = tickets();
    const id = Math.max(...list.map(item => Number(item.id) || 0), 1000) + 1;
    const service = state.services.find(item => item.name === payload.service);
    const config = service?.subcategoryConfig?.[payload.subcategory] || {};
    const type = config.type || typeFor(payload.subcategory);
    const priority = config.criticality || config.priority || 'Média';
    const sla = Number(config.sla) || slas[type]?.[priority] || 4;
    const ticket = {
        id,
        openedBy: payload.username,
        requester: payload.username,
        requesterName: payload.name,
        requesterUnit: payload.unit,
        requesterDepartment: payload.department,
        service: payload.service,
        subcategory: payload.subcategory,
        type,
        criticality: priority,
        priority,
        sla,
        status: 'Aberto',
        responsible: null,
        pendingHistory: [],
        openedAt: new Date().toISOString(),
        description: payload.description,
        source: 'ACE'
    };
    list.push(ticket);
    state.tickets = list;
    save(list);
    return ticket;
}

function save(list) {
    const key = 'delunatech-itsm-local-db-v1';
    const database = JSON.parse(localStorage.getItem(key) || '{}');
    database.tickets ||= {};
    list.forEach(ticket => {
        const id = String(ticket.firestoreId || ticket.id);
        const { firestoreId, ...data } = ticket;
        database.tickets[id] = data;
        ticket.firestoreId = id;
    });
    localStorage.setItem(key, JSON.stringify(database));
}
window.localTicketApi = {
    createTicket(payload) {
        const list = tickets();
        const id = Math.max(...list.map(x => Number(x.id) || 0), 1000) + 1;
        const type = payload.type || typeFor(payload.subcategory);
        const priority = payload.priority || 'Média';
        const ticket = { id, status: 'Aberto', responsible: null, openedAt: new Date().toISOString(), sla: slas[type][priority], ...payload, type, priority, firestoreId: String(id) };
        list.push(ticket); save(list); return ticket;
    },
    getTickets() { return tickets(); }
};
async function bootLocalDemo() {
    state.user = null;
    state.view = 'new';
    state.selected = null;
    try {
        await loadTickets();
        await loadUsers();
        await loadServices();
    } catch (err) {
        console.error('Inicialização local:', err);
    }
    render();
}
bootLocalDemo();
