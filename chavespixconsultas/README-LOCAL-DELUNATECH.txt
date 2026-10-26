CHAVES PIX | DeLunaTech — edição local

O que mudou
- Dados das pessoas e chaves PIX gravados no localStorage do navegador.
- Removidas dependências de Firebase Authentication e Firestore do fluxo funcional.
- Perfil local por identificador informado na entrada; não há conta online, senha real nem sincronização.
- Identidade visual DeLunaTech aplicada: azul profundo, azul tech, ciano e branco.
- Avisos, entradas para edição e confirmações são exibidos em cards dentro da página; não usam alert(), confirm() ou prompt().
- Service Worker atualizado para armazenar os arquivos visuais locais e trabalhar offline após a primeira carga.

Como executar
1. Extraia o ZIP.
2. Para testar como PWA, publique em HTTPS ou execute um servidor local (por exemplo, Live Server no VS Code).
3. Abra index.html pelo servidor, informe um nome de perfil e clique em ABRIR APLICATIVO.
4. Cadastre pessoas e chaves; os dados ficam neste navegador e neste dispositivo.

Importante sobre armazenamento local
- Não existe sincronização entre navegadores ou dispositivos.
- Limpar os dados do site/navegador, usar janela privada ou desinstalar o navegador pode apagar os registros.
- Faça backup/exportação antes de limpar o navegador. Esta versão não envia dados para a nuvem.
- O nome do perfil apenas separa conjuntos locais; não é um mecanismo de segurança. Não use este app para guardar dados que exijam proteção de acesso.

Estrutura de dados
- localStorage: delunatech_pix_session_v1 (perfil local)
- localStorage: delunatech_pix_data_v1_<perfil> (pessoas e chaves PIX)
