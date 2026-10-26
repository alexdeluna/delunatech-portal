import sqlite3InitModule from
    "https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.51.1-build1/sqlite-wasm/jswasm/sqlite3.mjs";

let db = null;


/* ========================================
   COMUNICAÇÃO
======================================== */

function enviar(type, dados = {}) {

    self.postMessage({
        type,
        ...dados
    });

}


function enviarErro(erro) {

    console.error("SQLite Worker:", erro);

    enviar("error", {
        message: erro?.message || String(erro)
    });

}


/* ========================================
   INICIALIZAÇÃO
======================================== */

async function inicializar() {

    try {

        enviar("status", {
            message: "Verificando acesso ao banco..."
        });

        /*
         * O OPFS SAHPOOL não permite que duas páginas abram
         * simultaneamente o mesmo arquivo SQLite. O Web Lock
         * garante que apenas uma instância seja proprietária do banco.
         * A trava permanece ativa enquanto este Worker estiver usando-o.
         */
        const lockDisponivel = await adquirirTravaBanco();

        if (!lockDisponivel) {
            enviar("error", {
                message: "O banco de dados já está aberto em outra aba ou janela deste navegador. Feche a outra instância do Anotações e recarregue esta página. Seus dados não foram alterados."
            });
            return;
        }

        enviar("status", {
            message: "Inicializando SQLite..."
        });

        const sqlite3 =
            await sqlite3InitModule({
                print: console.log,
                printErr: console.error
            });


        const poolUtil =
            await sqlite3.installOpfsSAHPoolVfs({
                initialCapacity: 6
            });


        db =
            new poolUtil.OpfsSAHPoolDb(
                "/anotacoes.sqlite3"
            );


        criarEstrutura();


        enviar("ready");

    } catch (erro) {

        enviarErro(erro);

    }

}


/* ========================================
   EXCLUSÃO MÚTUA ENTRE ABAS
======================================== */

async function adquirirTravaBanco() {

    if (!navigator.locks || typeof navigator.locks.request !== "function") {
        throw new Error(
            "Este navegador não oferece o controle de acesso necessário para proteger o banco local. Atualize o navegador e tente novamente."
        );
    }

    return new Promise((resolve, reject) => {

        navigator.locks.request(
            "anotacoes-delunatech-opfs-sahpool",
            { mode: "exclusive", ifAvailable: true },
            async trava => {

                if (!trava) {
                    resolve(false);
                    return;
                }

                resolve(true);

                // Manter a trava até o Worker ser encerrado/recarregado.
                await new Promise(() => {});

            }
        ).catch(reject);

    });

}


/* ========================================
   ESTRUTURA DO BANCO
======================================== */

function criarEstrutura() {

    db.exec(`

        CREATE TABLE IF NOT EXISTS anotacoes (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            texto TEXT NOT NULL,

            criado_em TEXT NOT NULL,

            atualizado_em TEXT,

            favorito INTEGER NOT NULL DEFAULT 0,

            excluido INTEGER NOT NULL DEFAULT 0

        );

    `);

}


/* ========================================
   CRIAR
======================================== */

function salvar(texto) {

    try {

        validarBanco();


        texto = String(texto || "").trim();


        if (!texto) {

            throw new Error(
                "O texto da anotação é obrigatório."
            );

        }


        const agora =
            new Date().toISOString();


        db.exec({

            sql: `

                INSERT INTO anotacoes (

                    texto,
                    criado_em,
                    atualizado_em,
                    favorito,
                    excluido

                )

                VALUES (?, ?, ?, 0, 0);

            `,

            bind: [
                texto,
                agora,
                agora
            ]

        });


        enviar("saved");


    } catch (erro) {

        enviarErro(erro);

    }

}


/* ========================================
   CONSULTAR
======================================== */

function listar() {

    try {

        validarBanco();


        const rows = [];


        db.exec({

            sql: `

                SELECT

                    id,
                    texto,
                    criado_em,
                    atualizado_em,
                    favorito,
                    excluido

                FROM anotacoes

                ORDER BY id DESC;

            `,

            rowMode: "object",

            callback(linha) {

                rows.push(linha);

            }

        });


        enviar("list", {
            rows
        });


    } catch (erro) {

        enviarErro(erro);

    }

}


/* ========================================
   EDITAR
======================================== */

function editar(id, texto) {

    try {

        validarBanco();


        id = Number(id);

        texto =
            String(texto || "").trim();


        if (!Number.isInteger(id)) {

            throw new Error(
                "ID da anotação inválido."
            );

        }


        if (!texto) {

            throw new Error(
                "O texto da anotação é obrigatório."
            );

        }


        const agora =
            new Date().toISOString();


        db.exec({

            sql: `

                UPDATE anotacoes

                SET
                    texto = ?,
                    atualizado_em = ?

                WHERE id = ?;

            `,

            bind: [
                texto,
                agora,
                id
            ]

        });


        enviar("updated", {
            id
        });


    } catch (erro) {

        enviarErro(erro);

    }

}


/* ========================================
   FAVORITO
======================================== */

function alternarFavorito(id) {

    try {

        validarBanco();


        id = Number(id);


        db.exec({

            sql: `

                UPDATE anotacoes

                SET

                    favorito =
                        CASE favorito

                            WHEN 1 THEN 0

                            ELSE 1

                        END,

                    atualizado_em = ?

                WHERE id = ?
                AND excluido = 0;

            `,

            bind: [
                new Date().toISOString(),
                id
            ]

        });


        enviar("favoriteChanged", {
            id
        });


    } catch (erro) {

        enviarErro(erro);

    }

}


/* ========================================
   LIXEIRA
======================================== */

function moverParaLixeira(id) {

    try {

        validarBanco();


        id = Number(id);


        db.exec({

            sql: `

                UPDATE anotacoes

                SET
                    excluido = 1,
                    atualizado_em = ?

                WHERE id = ?;

            `,

            bind: [
                new Date().toISOString(),
                id
            ]

        });


        enviar("trashed", {
            id
        });


    } catch (erro) {

        enviarErro(erro);

    }

}


/* ========================================
   RESTAURAR
======================================== */

function restaurar(id) {

    try {

        validarBanco();


        id = Number(id);


        db.exec({

            sql: `

                UPDATE anotacoes

                SET
                    excluido = 0,
                    atualizado_em = ?

                WHERE id = ?;

            `,

            bind: [
                new Date().toISOString(),
                id
            ]

        });


        enviar("restored", {
            id
        });


    } catch (erro) {

        enviarErro(erro);

    }

}


/* ========================================
   EXCLUSÃO DEFINITIVA
======================================== */

function excluirDefinitivamente(id) {

    try {

        validarBanco();


        id = Number(id);


        db.exec({

            sql: `

                DELETE FROM anotacoes

                WHERE id = ?
                AND excluido = 1;

            `,

            bind: [id]

        });


        enviar("deleted", {
            id
        });


    } catch (erro) {

        enviarErro(erro);

    }

}

/* ========================================
   RESTAURAÇÃO DE BACKUP
======================================== */

function restaurarBackup(anotacoes) {

    try {

        validarBanco();

        if (!Array.isArray(anotacoes)) {

            throw new Error(
                "Lista de anotações inválida."
            );

        }

        if (
    anotacoes.some(
        anotacao => {

            const id =
                Number(anotacao.id);

            const favorito =
                Number(anotacao.favorito);

            const excluido =
                Number(anotacao.excluido);

            return (
                !Number.isInteger(id) ||
                id <= 0 ||
                typeof anotacao.texto !== "string" ||
                anotacao.texto.trim() === "" ||
                (favorito !== 0 && favorito !== 1) ||
                (excluido !== 0 && excluido !== 1)
            );

        }
    )
) {

    throw new Error(
        "O backup contém uma ou mais anotações inválidas."
    );

}


        /*
         * IMPORTANTE:
         *
         * Não usamos MAX(id).
         *
         * O maior ID pode já ter sido excluído
         * definitivamente da tabela.
         *
         * O sqlite_sequence mantém o maior ID
         * já utilizado pelo AUTOINCREMENT.
         */

        const resultadoSequencia =
            db.exec({

                sql: `
                    SELECT
                        COALESCE(seq, 0) AS ultimo_id
                    FROM sqlite_sequence
                    WHERE name = 'anotacoes';
                `,

                returnValue: "resultRows"

            });


        const ultimoIdAtual =
            Number(
                resultadoSequencia?.[0]?.ultimo_id || 0
            );


        /*
         * Descobre o maior ID existente
         * dentro do arquivo de backup.
         */

        const maiorIdBackup =
            anotacoes.reduce(
                (maior, anotacao) => {

                    const id =
                        Number(anotacao.id);

                    return id > maior
                        ? id
                        : maior;

                },
                0
            );


        /*
         * O contador jamais pode voltar.
         *
         * Exemplo:
         *
         * sqlite_sequence = 7
         * backup máximo = 5
         *
         * resultado = 7
         *
         * Próximo ID = 8
         */

        const proximoMaiorId =
            Math.max(
                ultimoIdAtual,
                maiorIdBackup
            );


        /*
         * Inicia transação.
         */

        db.exec(
            "BEGIN TRANSACTION;"
        );


        try {

            /*
             * Remove o conteúdo atual.
             */

            db.exec(`
                DELETE FROM anotacoes;
            `);


            /*
             * Insere exatamente o conteúdo
             * existente no backup.
             */

            for (
                const anotacao
                of anotacoes
            ) {

                db.exec({

                    sql: `
                        INSERT INTO anotacoes (
                            id,
                            texto,
                            criado_em,
                            atualizado_em,
                            favorito,
                            excluido
                        )
                        VALUES (
                            ?,
                            ?,
                            ?,
                            ?,
                            ?,
                            ?
                        );
                    `,

                    bind: [

                        Number(
                            anotacao.id
                        ),

                        anotacao.texto,

                        anotacao.criado_em,

                        anotacao.atualizado_em,

                        Number(
                            anotacao.favorito
                        ),

                        Number(
                            anotacao.excluido
                        )

                    ]

                });

            }


            /*
             * Garante que o contador AUTOINCREMENT
             * nunca seja reduzido.
             */

            db.exec({

                sql: `
                    UPDATE sqlite_sequence
                    SET seq = ?
                    WHERE name = 'anotacoes';
                `,

                bind: [
                    proximoMaiorId
                ]

            });


            /*
             * Confirma a restauração.
             */

            db.exec(
                "COMMIT;"
            );


            enviar(
                "backupRestored",
                {
                    quantidade:
                        anotacoes.length
                }
            );


        } catch (erroTransacao) {

            db.exec(
                "ROLLBACK;"
            );

            throw erroTransacao;

        }


    } catch (erro) {

        enviarErro(erro);

    }

}


/* ========================================
   VALIDAÇÃO
======================================== */

function validarBanco() {

    if (!db) {

        throw new Error(
            "Banco SQLite ainda não foi inicializado."
        );

    }

}


/* ========================================
   RECEBER COMANDOS
======================================== */

self.addEventListener(
    "message",
    evento => {

        const mensagem =
            evento.data || {};


        switch (mensagem.type) {


            case "init":

                inicializar();

                break;


            case "save":

                salvar(
                    mensagem.texto
                );

                break;


            case "list":

                listar();

                break;


            case "update":

                editar(
                    mensagem.id,
                    mensagem.texto
                );

                break;


            case "toggleFavorite":

                alternarFavorito(
                    mensagem.id
                );

                break;


            case "trash":

                moverParaLixeira(
                    mensagem.id
                );

                break;


            case "restore":

                restaurar(
                    mensagem.id
                );

                break;


            case "delete":

                excluirDefinitivamente(
                    mensagem.id
                );

                break;

            case "restoreBackup":

    restaurarBackup(
        mensagem.anotacoes
    );

    break;


            default:

                enviar("error", {

                    message:
                        `Comando desconhecido: ${mensagem.type}`

                });

        }

    }
);