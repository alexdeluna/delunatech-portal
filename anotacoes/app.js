const sqliteWorker = new Worker(
    "./sqlite-worker.js?v=5",
    {
        type: "module"
    }
);

let anotacoes = [];


const statusBanco =
    document.getElementById("statusBanco");

const listaInicio =
    document.getElementById("listaInicio");

const listaAnotacoes =
    document.getElementById("listaAnotacoes");

const listaFavoritos =
    document.getElementById("listaFavoritos");

const listaLixeira =
    document.getElementById("listaLixeira");

const totalAnotacoes =
    document.getElementById("totalAnotacoes");

const totalFavoritos =
    document.getElementById("totalFavoritos");

const totalLixeira =
    document.getElementById("totalLixeira");

const campoBusca =
    document.getElementById("campoBusca");

const modalAnotacao =
    document.getElementById("modalAnotacao");

const textoAnotacao =
    document.getElementById("textoAnotacao");

const tituloTela =
    document.getElementById("tituloTela");

const subtituloTela =
    document.getElementById("subtituloTela");

    const btnFazerBackup =
    document.getElementById("btnFazerBackup");

const historicoBackups =
    document.getElementById("historicoBackups");
    let backupSelecionado = null;

    const arquivoBackup =
    document.getElementById("arquivoBackup");

const btnSelecionarBackup =
    document.getElementById("btnSelecionarBackup");

const infoBackupSelecionado =
    document.getElementById("infoBackupSelecionado");

    const btnRestaurarBackup =
    document.getElementById("btnRestaurarBackup");


/* =========================
   NAVEGAÇÃO
========================= */

const menus =
    document.querySelectorAll(".menu-item");

const telas =
    document.querySelectorAll(".tela");


const titulos = {

    inicio: {
        titulo: "Início",
        subtitulo: "Gerencie suas anotações."
    },

    anotacoes: {
        titulo: "Anotações",
        subtitulo: "Consulte e gerencie seus registros."
    },

    favoritos: {
        titulo: "Favoritos",
        subtitulo: "Anotações marcadas como importantes."
    },

    lixeira: {
        titulo: "Lixeira",
        subtitulo: "Anotações excluídas."
    },

    backup: {
        titulo: "Backup",
        subtitulo: "Proteja suas anotações contra perda."
    },

    configuracoes: {
        titulo: "Configurações",
        subtitulo: "Preferências do sistema."
    }

};


function abrirTela(nome) {

    telas.forEach(tela => {

        tela.classList.toggle(
            "ativa",
            tela.id === `tela-${nome}`
        );

    });


    menus.forEach(menu => {

        menu.classList.toggle(
            "ativo",
            menu.dataset.tela === nome
        );

    });


    const info = titulos[nome];

    if (info) {

        tituloTela.textContent =
            info.titulo;

        subtituloTela.textContent =
            info.subtitulo;

    }

    if (nome === "backup") {
        atualizarHistoricoBackups();
    }

}


menus.forEach(menu => {

    menu.addEventListener(
        "click",
        () => abrirTela(menu.dataset.tela)
    );

});


document.querySelectorAll("[data-tela]").forEach(elemento => {

    elemento.addEventListener("click", () => {

        const tela =
            elemento.dataset.tela;

        if (tela) {
            abrirTela(tela);
        }

    });

});


/* =========================
   MODAL
========================= */

function abrirModal() {

    modalAnotacao.classList.add("aberto");

    setTimeout(() => {

        textoAnotacao.focus();

    }, 100);

}


function fecharModal() {

    modalAnotacao.classList.remove(
        "aberto"
    );


    textoAnotacao.value = "";


    const btnSalvar =
        document.getElementById("btnSalvar");


    delete btnSalvar.dataset.editandoId;


    btnSalvar.textContent =
        "Salvar anotação";

}


document
    .getElementById("btnNovaAnotacao")
    .addEventListener(
        "click",
        abrirModal
    );


document
    .getElementById("btnNovaAnotacaoLista")
    .addEventListener(
        "click",
        abrirModal
    );


document
    .getElementById("btnFecharModal")
    .addEventListener(
        "click",
        fecharModal
    );


document
    .getElementById("btnCancelarModal")
    .addEventListener(
        "click",
        fecharModal
    );


modalAnotacao.addEventListener(
    "click",
    evento => {

        if (
            evento.target === modalAnotacao
        ) {
            fecharModal();
        }

    }
);


/* =========================
   SQLITE WORKER
========================= */

sqliteWorker.addEventListener(
    "message",
    evento => {

        const mensagem =
            evento.data;


        switch (mensagem.type) {


            case "status":

                statusBanco.textContent =
                    mensagem.message;

                break;


            case "ready":

                statusBanco.textContent =
                    "SQLite + OPFS";

                consultarBanco();

                break;


            case "saved":

                fecharModal();

                consultarBanco();

                break;


            case "list":

                anotacoes =
                    mensagem.rows || [];

                atualizarInterface();

                break;

            case "favoriteChanged":

                consultarBanco();

                break;


            case "trashed":

                consultarBanco();

                break;

            case "restored":

                consultarBanco();

                break;


            case "deleted":

                consultarBanco();

                break;

                case "backupRestored":

    backupSelecionado = null;

    arquivoBackup.value = "";

    infoBackupSelecionado.innerHTML = "";

    consultarBanco();

    alert(
        "Backup restaurado com sucesso.\n\n" +
        `${mensagem.quantidade} anotação(ões) restaurada(s).`
    );

    break;

            case "updated":

                fecharModal();

                consultarBanco();

                break;

            case "error":

                console.error(
                    "SQLite:",
                    mensagem.message
                );

                statusBanco.textContent =
                    "Erro no banco";

                if (mensagem.message && mensagem.message.includes("já está aberto em outra aba ou janela")) {
                    const aviso = document.getElementById("avisoAbaDuplicada");
                    aviso.hidden = false;
                    document.querySelector(".conteudo").classList.add("modo-aba-duplicada");
                    statusBanco.textContent = "Outra aba em uso";
                } else {
                    alert(
                        "Erro no banco de dados:\n\n" +
                        mensagem.message
                    );
                }

                break;

        }

    }
);


/* =========================
   BANCO
========================= */

function consultarBanco() {

    sqliteWorker.postMessage({
        type: "list"
    });

}


function salvarAnotacao() {

    const texto =
        textoAnotacao.value.trim();


    if (!texto) {

        alert(
            "Digite uma anotação."
        );

        textoAnotacao.focus();

        return;

    }


    const btnSalvar =
        document.getElementById("btnSalvar");


    const editandoId =
        btnSalvar.dataset.editandoId;


    if (editandoId) {

        sqliteWorker.postMessage({

            type: "update",

            id: Number(editandoId),

            texto

        });

        return;

    }


    sqliteWorker.postMessage({

        type: "save",

        texto

    });

}


document
    .getElementById("btnSalvar")
    .addEventListener(
        "click",
        salvarAnotacao
    );


/* =========================
   INTERFACE
========================= */

function atualizarInterface() {

    const ativas =
        anotacoes.filter(
            item => Number(item.excluido) === 0
        );


    const favoritas =
        ativas.filter(
            item => Number(item.favorito) === 1
        );


    const lixeira =
        anotacoes.filter(
            item => Number(item.excluido) === 1
        );


    totalAnotacoes.textContent =
        ativas.length;


    totalFavoritos.textContent =
        favoritas.length;


    totalLixeira.textContent =
        lixeira.length;


    renderizarLista(
        listaInicio,
        ativas.slice(0, 5)
    );


    renderizarLista(
        listaAnotacoes,
        aplicarBusca(ativas)
    );


    renderizarLista(
        listaFavoritos,
        favoritas
    );


    renderizarLista(
        listaLixeira,
        lixeira
    );

}


function aplicarBusca(lista) {

    const termo =
        campoBusca.value
            .trim()
            .toLowerCase();


    if (!termo) {
        return lista;
    }


    return lista.filter(item => {

        const id =
            String(item.id)
                .padStart(6, "0");


        const texto =
            String(item.texto)
                .toLowerCase();


        return (
            id.includes(termo) ||
            texto.includes(termo)
        );

    });

}


function renderizarLista(elemento, lista) {

    if (!lista.length) {

        elemento.innerHTML = `
            <div class="estado-vazio">
                Nenhuma anotação encontrada.
            </div>
        `;

        return;
    }


    elemento.innerHTML = lista.map(anotacao => {

        const numero =
            String(anotacao.id)
                .padStart(6, "0");


        const data =
            new Date(
                anotacao.criado_em
            ).toLocaleString("pt-BR");


        const favorito =
            Number(anotacao.favorito) === 1;


        return `

            <article
                class="anotacao-card"
                data-id="${anotacao.id}">

                <div class="anotacao-topo">

                    <span class="anotacao-numero">
                        ANOTAÇÃO Nº ${numero}
                    </span>

                    <button
                        class="anotacao-favorito"
                        data-acao="favorito"
                        data-id="${anotacao.id}"
                        title="Favorito">

                        ${favorito ? "★" : "☆"}

                    </button>

                </div>


                <div class="anotacao-texto">
                    ${escaparHTML(anotacao.texto)}
                </div>


                <div class="anotacao-data">

    Criada em: ${data}

    ${anotacao.atualizado_em
                && anotacao.atualizado_em !== anotacao.criado_em

                ? `
            <br>
            Atualizada em:
            ${new Date(
                    anotacao.atualizado_em
                ).toLocaleString("pt-BR")}
        `
                : ""
            }

</div>


                <div class="anotacao-acoes">

    ${Number(anotacao.excluido) === 1

                ? `

            <button
                class="acao-btn"
                data-acao="restaurar"
                data-id="${anotacao.id}">
                Restaurar
            </button>

            <button
                class="acao-btn acao-excluir"
                data-acao="excluir-definitivamente"
                data-id="${anotacao.id}">
                Excluir definitivamente
            </button>

        `

                : `

            <button
                class="acao-btn"
                data-acao="copiar"
                data-id="${anotacao.id}">
                Copiar
            </button>

            <button
                class="acao-btn"
                data-acao="editar"
                data-id="${anotacao.id}">
                Editar
            </button>

            <button
                class="acao-btn"
                data-acao="favorito"
                data-id="${anotacao.id}">
                ${favorito
                    ? "Desfavoritar"
                    : "Favoritar"}
            </button>

            <button
                class="acao-btn acao-excluir"
                data-acao="excluir"
                data-id="${anotacao.id}">
                Excluir
            </button>

        `
            }

</div>

            </article>

        `;

    }).join("");


    configurarAcoesCards();

}

function configurarAcoesCards() {

    document
        .querySelectorAll("[data-acao]")
        .forEach(botao => {

            botao.addEventListener(
                "click",
                tratarAcaoCard
            );

        });

}


async function tratarAcaoCard(evento) {

    const botao =
        evento.currentTarget;


    const acao =
        botao.dataset.acao;


    const id =
        Number(botao.dataset.id);


    if (!Number.isInteger(id)) {

        return;

    }


    switch (acao) {


        case "copiar":

            await copiarAnotacao(id);

            break;


        case "editar":

            editarAnotacao(id);

            break;


        case "favorito":

            alternarFavorito(id);

            break;


        case "excluir":

            enviarParaLixeira(id);

            break;

        case "restaurar":

            restaurarAnotacao(id);

            break;


        case "excluir-definitivamente":

            excluirDefinitivamente(id);

            break;

    }

}

async function copiarAnotacao(id) {

    const anotacao =
        anotacoes.find(
            item => Number(item.id) === id
        );


    if (!anotacao) {
        return;
    }


    try {

        await navigator.clipboard.writeText(
            anotacao.texto
        );


        alert(
            `Anotação ${String(id).padStart(6, "0")} copiada.`
        );


    } catch (erro) {

        console.error(erro);

        alert(
            "Não foi possível copiar a anotação."
        );

    }

}

function alternarFavorito(id) {

    sqliteWorker.postMessage({

        type: "toggleFavorite",

        id

    });

}

function enviarParaLixeira(id) {

    const anotacao =
        anotacoes.find(
            item => Number(item.id) === id
        );


    if (!anotacao) {
        return;
    }


    const numero =
        String(id).padStart(6, "0");


    const confirmar =
        confirm(
            `Deseja enviar a anotação ${numero} para a lixeira?`
        );


    if (!confirmar) {
        return;
    }


    sqliteWorker.postMessage({

        type: "trash",

        id

    });

}

function restaurarAnotacao(id) {

    const numero =
        String(id).padStart(6, "0");


    const confirmar =
        confirm(
            `Deseja restaurar a anotação ${numero}?`
        );


    if (!confirmar) {
        return;
    }


    sqliteWorker.postMessage({

        type: "restore",

        id

    });

}

function excluirDefinitivamente(id) {

    const numero =
        String(id).padStart(6, "0");


    const confirmar =
        confirm(
            `ATENÇÃO!\n\n` +
            `Deseja excluir definitivamente a anotação ${numero}?\n\n` +
            `Esta ação não poderá ser desfeita.`
        );


    if (!confirmar) {
        return;
    }


    sqliteWorker.postMessage({

        type: "delete",

        id

    });

}

function editarAnotacao(id) {

    const anotacao =
        anotacoes.find(
            item => Number(item.id) === id
        );


    if (!anotacao) {
        return;
    }


    textoAnotacao.value =
        anotacao.texto;


    modalAnotacao.classList.add(
        "aberto"
    );


    textoAnotacao.focus();


    const btnSalvar =
        document.getElementById("btnSalvar");


    btnSalvar.dataset.editandoId =
        String(id);


    btnSalvar.textContent =
        "Salvar alteração";

}

function validarBackup(backup) {

    if (
        !backup ||
        typeof backup !== "object"
    ) {
        throw new Error(
            "Estrutura do arquivo inválida."
        );
    }

    if (backup.sistema !== "Anotações") {
        throw new Error(
            "Este arquivo não pertence ao sistema Anotações."
        );
    }

    if (backup.formato !== "backup-json") {
        throw new Error(
            "Formato de backup não reconhecido."
        );
    }

    if (Number(backup.versao) !== 1) {
        throw new Error(
            "Versão de backup não suportada."
        );
    }

    if (
        typeof backup.criado_em !== "string" ||
        Number.isNaN(
            Date.parse(backup.criado_em)
        )
    ) {
        throw new Error(
            "Data de criação do backup inválida."
        );
    }

    if (!Array.isArray(backup.anotacoes)) {
        throw new Error(
            "A lista de anotações não foi encontrada."
        );
    }

    if (
        Number(backup.quantidade) !==
        backup.anotacoes.length
    ) {
        throw new Error(
            "A quantidade informada no backup não corresponde aos registros encontrados."
        );
    }

    const ids = new Set();

    backup.anotacoes.forEach(
        (anotacao, indice) => {

            if (
                !Number.isInteger(
                    Number(anotacao.id)
                ) ||
                Number(anotacao.id) <= 0
            ) {
                throw new Error(
                    `ID inválido na anotação ${indice + 1}.`
                );
            }

            const id =
                Number(anotacao.id);

            if (ids.has(id)) {
                throw new Error(
                    `ID duplicado encontrado: ${id}.`
                );
            }

            ids.add(id);

            if (
                typeof anotacao.texto !== "string" ||
                anotacao.texto.trim() === ""
            ) {
                throw new Error(
                    `Texto inválido na anotação ${indice + 1}.`
                );
            }

            if (
                typeof anotacao.criado_em !== "string" ||
                Number.isNaN(
                    Date.parse(
                        anotacao.criado_em
                    )
                )
            ) {
                throw new Error(
                    `Data de criação inválida na anotação ${id}.`
                );
            }

            if (
                anotacao.atualizado_em !== null &&
                (
                    typeof anotacao.atualizado_em !== "string" ||
                    Number.isNaN(
                        Date.parse(
                            anotacao.atualizado_em
                        )
                    )
                )
            ) {
                throw new Error(
                    `Data de atualização inválida na anotação ${id}.`
                );
            }

            if (
                Number(anotacao.favorito) !== 0 &&
                Number(anotacao.favorito) !== 1
            ) {
                throw new Error(
                    `Valor de favorito inválido na anotação ${id}.`
                );
            }

            if (
                Number(anotacao.excluido) !== 0 &&
                Number(anotacao.excluido) !== 1
            ) {
                throw new Error(
                    `Valor de exclusão inválido na anotação ${id}.`
                );
            }
        }
    );

    return true;
}

function restaurarBackupSelecionado() {

    if (!backupSelecionado) {

        alert(
            "Selecione um arquivo de backup válido antes de continuar."
        );

        return;
    }

    const backup =
        backupSelecionado.dados;

    const confirmar =
        confirm(
            "ATENÇÃO!\n\n" +

            "A restauração substituirá as anotações atuais " +
            "pelos registros existentes neste backup.\n\n" +

            `Backup: ${backupSelecionado.arquivo.name}\n` +
            `Anotações: ${backup.anotacoes.length}\n\n` +

            "Antes de continuar, é recomendado fazer um backup " +
            "das anotações atuais.\n\n" +

            "Deseja continuar?"
        );

    if (!confirmar) {
        return;
    }

    sqliteWorker.postMessage({

        type: "restoreBackup",

        anotacoes:
            backup.anotacoes

    });

}

function fazerBackup() {

    if (!anotacoes.length) {

        alert(
            "Não existem anotações para fazer backup."
        );

        return;
    }


    const agora =
        new Date();


    const dataArquivo =
        agora
            .toISOString()
            .slice(0, 10);


    const horaArquivo =
        agora
            .toTimeString()
            .slice(0, 8)
            .replaceAll(":", "");


    const nomeArquivo =
        `BACKUP_ANOTACOES_${dataArquivo}_${horaArquivo}.json`;


    const backup = {

        sistema: "Anotações",

        formato: "backup-json",

        versao: 1,

        criado_em:
            agora.toISOString(),

        quantidade:
            anotacoes.length,

        anotacoes:
            anotacoes.map(anotacao => ({
                id: Number(anotacao.id),

                texto: anotacao.texto,

                criado_em:
                    anotacao.criado_em,

                atualizado_em:
                    anotacao.atualizado_em,

                favorito:
                    Number(anotacao.favorito),

                excluido:
                    Number(anotacao.excluido)
            }))

    };


    const conteudo =
        JSON.stringify(
            backup,
            null,
            2
        );


    const blob =
        new Blob(
            [conteudo],
            {
                type:
                    "application/json;charset=utf-8"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download =
        nomeArquivo;


    document.body.appendChild(link);

    link.click();

    link.remove();


    URL.revokeObjectURL(url);


  registrarBackup(
    nomeArquivo,
    backup.quantidade,
    blob.size,
    backup.criado_em
);

atualizarHistoricoBackups();

alert(
    `Backup realizado com sucesso.\n\n` +
    `${nomeArquivo}\n\n` +
    `${backup.quantidade} anotação(ões).`
);

}

function exportarParaExcel() {

    const registros =
        anotacoes.filter(
            anotacao =>
                Number(anotacao.excluido) === 0
        );

    if (!registros.length) {

        alert(
            "Não existem anotações para exportar."
        );

        return;
    }

    const linhas = registros.map(anotacao => {

        const numero =
            String(anotacao.id).padStart(6, "0");

        const criadoEm =
            new Date(
                anotacao.criado_em
            ).toLocaleString("pt-BR");

        const atualizadoEm =
            anotacao.atualizado_em
                ? new Date(
                    anotacao.atualizado_em
                ).toLocaleString("pt-BR")
                : "";

        const favorito =
            Number(anotacao.favorito) === 1
                ? "Sim"
                : "Não";

        return `
            <tr>
                <td>${numero}</td>
                <td>${escaparHTML(anotacao.texto)}</td>
                <td>${criadoEm}</td>
                <td>${atualizadoEm}</td>
                <td>${favorito}</td>
            </tr>
        `;

    }).join("");

    const conteudo = `
        <html>
        <head>
            <meta charset="UTF-8">
        </head>

        <body>

            <table border="1">

                <thead>
                    <tr>
                        <th>Número</th>
                        <th>Anotação</th>
                        <th>Criada em</th>
                        <th>Atualizada em</th>
                        <th>Favorito</th>
                    </tr>
                </thead>

                <tbody>
                    ${linhas}
                </tbody>

            </table>

        </body>
        </html>
    `;

    const blob =
        new Blob(
            [conteudo],
            {
                type:
                    "application/vnd.ms-excel;charset=utf-8"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    const agora =
        new Date();

    const dataArquivo =
        agora
            .toISOString()
            .slice(0, 10);

    const horaArquivo =
        agora
            .toTimeString()
            .slice(0, 8)
            .replaceAll(":", "");

    link.href = url;

    link.download =
        `ANOTACOES_${dataArquivo}_${horaArquivo}.xls`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    alert(
        "Exportação concluída com sucesso.\n\n" +
        `${registros.length} anotação(ões) exportada(s).`
    );
}

function registrarBackup(
    nome,
    quantidade,
    tamanho,
    data
) {

    const historico =
        obterHistoricoBackups();


    historico.unshift({

        nome,

        quantidade,

        tamanho,

        data

    });


    localStorage.setItem(

        "historicoBackups",

        JSON.stringify(
            historico
        )

    );

}

function obterHistoricoBackups() {

    try {

        return JSON.parse(

            localStorage.getItem(
                "historicoBackups"
            )

        ) || [];

    } catch {

        return [];

    }

}

function atualizarHistoricoBackups() {

    if (!historicoBackups) {
        return;
    }


    const historico =
        obterHistoricoBackups();


    if (!historico.length) {

        historicoBackups.innerHTML = `

            <div class="estado-vazio">
                Nenhum backup realizado.
            </div>

        `;

        return;
    }


    historicoBackups.innerHTML =
        historico.map(backup => {

            const data =
                new Date(
                    backup.data
                ).toLocaleString(
                    "pt-BR"
                );


            const tamanho =
                formatarTamanho(
                    backup.tamanho
                );


            return `

                <div class="backup-item">

                    <div class="backup-item-topo">

                        <span class="backup-item-nome">
                            ${escaparHTML(
                                backup.nome
                            )}
                        </span>

                    </div>


                    <div class="backup-item-info">

                        ${data}
                        ·
                        ${backup.quantidade}
                        anotação(ões)
                        ·
                        ${tamanho}

                    </div>

                </div>

            `;

        }).join("");

}

function formatarTamanho(bytes) {

    if (bytes < 1024) {

        return `${bytes} B`;

    }


    if (bytes < 1024 * 1024) {

        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;

    }


    return `${(
        bytes / (1024 * 1024)
    ).toFixed(1)} MB`;

}

btnFazerBackup.addEventListener(
    "click",
    fazerBackup
);

document
    .getElementById("btnExportarExcel")
    .addEventListener(
        "click",
        exportarParaExcel
);

btnRestaurarBackup.addEventListener(
    "click",
    restaurarBackupSelecionado
);

btnSelecionarBackup.addEventListener(
    "click",
    () => {
        arquivoBackup.click();
    }
);

arquivoBackup.addEventListener(
    "change",
    async () => {

        const arquivo =
            arquivoBackup.files[0];

        if (!arquivo) {
            return;
        }

        try {

            const conteudo =
                await arquivo.text();

            const backup =
                JSON.parse(conteudo);

            validarBackup(backup);

            backupSelecionado = {
                arquivo,
                dados: backup
            };

            btnRestaurarBackup.disabled = false;

            const dataBackup =
                new Date(
                    backup.criado_em
                );

            infoBackupSelecionado.innerHTML = `
    <strong>Backup selecionado</strong>

    <div>
        <strong>Arquivo:</strong>
        ${escaparHTML(arquivo.name)}
    </div>

    <div>
        <strong>Data do backup:</strong>
        ${dataBackup.toLocaleString("pt-BR")}
    </div>

    <div>
        <strong>Quantidade:</strong>
        ${backup.anotacoes.length}
        anotação(ões)
    </div>

    <div>
        <strong>Status:</strong>
        Backup válido
    </div>
`;

        } catch (erro) {

            backupSelecionado = null;
            btnRestaurarBackup.disabled = true;

            infoBackupSelecionado.innerHTML = "";

            arquivoBackup.value = "";

            alert(
                "O arquivo selecionado não é um backup válido.\n\n" +
                erro.message
            );
        }
    }
);

document
    .getElementById("btnAtualizarBackups")
    .addEventListener(
        "click",
        atualizarAplicacao
    );

document
    .getElementById("btnRecarregar")
    .addEventListener(
        "click",
        () => window.location.reload()
    );

document
    .getElementById("btnRecarregarAviso")
    .addEventListener(
        "click",
        () => window.location.reload()
    );


 async function atualizarAplicacao() {

    localStorage.setItem(
        "telaAtual",
        "backup"
    );

    if ("serviceWorker" in navigator) {

        const registros =
            await navigator.serviceWorker.getRegistrations();

        await Promise.all(
            registros.map(
                registro => registro.unregister()
            )
        );

    }

    if ("caches" in window) {

        const cachesExistentes =
            await caches.keys();

        await Promise.all(
            cachesExistentes.map(
                nome => caches.delete(nome)
            )
        );

    }

    window.location.reload();
}

/* =========================
   BUSCA
========================= */

campoBusca.addEventListener(
    "input",
    atualizarInterface
);


/* =========================
   TEMA
========================= */

function alternarTema() {

    document.body.classList.toggle(
        "tema-escuro"
    );


    const escuro =
        document.body.classList.contains(
            "tema-escuro"
        );


    localStorage.setItem(
        "tema",
        escuro ? "escuro" : "claro"
    );

}


document
    .getElementById("btnTema")
    .addEventListener(
        "click",
        alternarTema
    );


document
    .getElementById("btnTemaConfig")
    .addEventListener(
        "click",
        alternarTema
    );


if (
    localStorage.getItem("tema") ===
    "escuro"
) {

    document.body.classList.add(
        "tema-escuro"
    );

}


/* =========================
   UTILITÁRIO
========================= */

function escaparHTML(texto) {

    return String(texto)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================
   SERVICE WORKER
========================= */

if ("serviceWorker" in navigator) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register("./sw.js")

                .then(() => {

                    console.log(
                        "Service Worker registrado."
                    );

                })

                .catch(erro => {

                    console.error(
                        "Erro no Service Worker:",
                        erro
                    );

                });

        }
    );

}


/* =========================
   INICIALIZAÇÃO
========================= */

sqliteWorker.postMessage({
    type: "init"
});

atualizarHistoricoBackups();

const telaAtual =
    localStorage.getItem("telaAtual");

if (telaAtual) {

    abrirTela(telaAtual);

    localStorage.removeItem("telaAtual");

}