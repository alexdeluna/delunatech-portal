# ITSM Portal — Demonstração local DeLunaTech

Esta edição é destinada à demonstração pública. Não utiliza Firebase nem autenticação online.

## Perfis disponíveis
- **Usuário:** abertura e acompanhamento de chamados.
- **Técnico:** fila de atendimento e atualização dos chamados.
- **Administrador:** acesso às áreas administrativas disponíveis no projeto.

## Armazenamento
Os dados são salvos no `localStorage` do navegador. Os três perfis compartilham os mesmos dados naquele navegador. Alterações não são enviadas a servidores e não afetam outros visitantes. Limpar os dados do navegador pode apagar os registros. Use somente dados fictícios.

## Execução e publicação
Publique os arquivos mantendo-os juntos na mesma pasta. Como o app usa módulos JavaScript, recomenda-se abrir via servidor estático (por exemplo, GitHub Pages) em vez de `file://`.

## Privacidade e segurança
A seleção de perfil é apenas para demonstração; não é autenticação real nem controle de acesso seguro. Não insira informações pessoais ou confidenciais.
