# Gestão Patrimonial — Implementação complementar

## Alterações realizadas
- Transferência com seleção progressiva de Unidade → Pavimento → Ambiente → Setor, com opções dependentes e limpeza das seleções posteriores.
- Cadastro de bens com seleção progressiva de Unidade → Pavimento → Ambiente → Setor.
- Validação do vínculo entre o setor escolhido e o responsável antes de salvar um bem.
- Transferência bloqueada quando o destino não tem localização ou responsável válido.
- Cartões para selecionar o tipo de cadastro em Cadastros Básicos; identificadores técnicos foram removidos das colunas principais e vínculos passam a mostrar nomes legíveis quando possível.
- Pesquisa de bens ampliada para incluir nomes de categorias e contexto de localização.
- Armazenamento de valores de aquisição em centavos inteiros e máscara de entrada dinâmica em reais.
- Migração única dos valores existentes em reais para centavos, preservando as demais coleções e históricos.
- Relatórios e ficha de bem formatam valores armazenados em centavos.
- Ajustes de responsividade para seletores, cartões e valores monetários.

## Testes executados
- `node --check` em `js/app.js`, `js/db.js`, `js/schema.js` e `js/importacao.js`.
- Verificação de HTML: sem IDs duplicados.
- Teste de fumaça da base: 300 bens, 20 setores e vínculos responsáveis-setores válidos.
- Teste da migração: converte valores antigos e preserva bens, cadastros, movimentações e auditoria.

## Limitações conhecidas
- Não foi executado um teste interativo completo em navegador real nesta execução.
- A estrutura de Cadastros Básicos foi aprimorada com cartões e nomes legíveis, mas a tela de registros continua usando tabela para listar os itens.
- A validação de regras específicas de negócio depende de confirmar os relacionamentos dos dados importados pelos usuários.
- A migração assume que os valores preexistentes em `Valor_Aquisicao` estão armazenados em reais, como na versão original do projeto; esses valores são convertidos para centavos uma única vez.
