# DigitAí V1 — DeLunaTech

Aplicativo independente de treinamento de digitação em português brasileiro, desenvolvido com HTML, CSS e JavaScript puro.

## Recursos
- Dashboard e trilha de lições progressivas
- Treinos de letras, palavras, frases, precisão e velocidade
- Teclado visual com indicação de dedo por tecla
- Cronômetro, PPM, precisão e contagem de erros
- Desafio diário com bônus de XP
- Pontuação, sequência diária, histórico e identificação das teclas mais erradas
- Arcade: Defesa da Base e Corrida de Digitação
- DigitAí Futebol: disputa de 5 pênaltis, com precisão influenciando a chance de gol
- DigitAí Basquete: desafio de 60 segundos, arremessos por palavra e combos
- Recordes e XP dos jogos esportivos salvos localmente
- Persistência local (LocalStorage)
- Exportar/importar progresso JSON
- PWA e cache offline
- Identidade visual DeLunaTech

## Como testar
Abra `index.html` para teste básico. Para PWA/offline e Service Worker, rode um servidor local (ex.: VS Code Live Server) ou hospede em HTTPS.

## Integração no portal DeLunaTech
O aplicativo está separado e não altera o portal. Para publicar como página independente, copie a pasta `digitai-v1` para o local desejado no repositório e publique. A página inicial é `index.html`. Caso integre em subpasta, mantenha os caminhos relativos.

## Arquivos
- `index.html`: estrutura e telas
- `styles.css`: identidade visual e responsividade
- `app.js`: exercícios, finger map, métricas e armazenamento
- `manifest.json`: configuração PWA
- `sw.js`: cache/offline
- `assets/`: logos e ícone

## Nota sobre finger map
O mapa usa atribuição convencional de teclado QWERTY: polegares apenas na barra de espaço; indicador direito cobre U/J/M; indicador esquerdo cobre R/T/F/G/V/B. Teclas de acento e símbolos são aproximadas para a versão inicial e devem ser validadas em teclado ABNT2 físico.
