# Consulta Técnica DeLunaTech

PWA mobile-first para registrar e consultar procedimentos técnicos com imagens. Desenvolvida em HTML, CSS e JavaScript puro, sem login e sem Firebase.

## Recursos
- Cadastro, edição, consulta e exclusão de procedimentos.
- IndexedDB para armazenar dados e imagens localmente.
- Categorias, pesquisa e palavras-chave.
- Várias imagens por procedimento, com pré-visualização.
- Código sequencial `PT-000001`; números excluídos não são reutilizados.
- Backup/restauração JSON incluindo imagens.
- Exportação CSV compatível com Excel.
- Tema claro/escuro e opção de texto grande.
- Interface responsiva e suporte PWA/offline após carregamento inicial.

## Executar localmente
Não abra `index.html` diretamente por `file://`. Use um servidor HTTP local. Por exemplo, com VS Code, instale/ative uma extensão de servidor local e abra a página por `http://localhost`.

Também pode usar Python:
```bash
python -m http.server 8000
```
Depois acesse `http://localhost:8000/consulta-tecnica-delunatech/` se executar o comando na pasta que contém a pasta do projeto, ou `http://localhost:8000/` se executá-lo dentro da pasta do projeto.

## Publicar no GitHub Pages
Envie todos os arquivos mantendo a estrutura de pastas. Ative Pages para a branch/pasta correta. O armazenamento é local por navegador e dispositivo; dados não sincronizam automaticamente entre dispositivos.

## Cuidados com dados
- Faça backups regulares e guarde-os fora do dispositivo.
- O backup JSON inclui as imagens, portanto pode ficar grande.
- Imagens individuais são limitadas a 5 MB nesta versão.
- CSV exporta os campos textuais e a quantidade de imagens, não os binários das imagens.
- Não há sincronização em nuvem.
- Os recursos de PWA e service worker exigem HTTPS ou localhost.


## Ajustes visuais DeLunaTech
- Cabeçalho e tela Sobre com logotipo oficial da marca.
- Paleta azul profundo, azul Tech e ciano; botões padronizados por ação.
- Confirmações e renomeação de categorias feitas em cards/telas internas, sem `alert`, `confirm` ou `prompt`.
- Visualização ampliada das imagens ocorre dentro da própria tela de detalhes.
- Cache do PWA atualizado para a versão 2 e inclui os novos arquivos de identidade visual.
