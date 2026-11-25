<div align="center">

<img src="doc/assets/readme/icone.png" alt="Ícone da Pulseira Verde" width="96" height="96">

# Pulseira Verde

**Quanto tempo se espera em cada hospital do DF, medido por quem esteve lá.**

App gratuito para Android · Distrito Federal · Em homologação, com lançamento público previsto para março de 2027

[Como funciona](#como-funciona) · [Tutorial](#tutorial-tela-a-tela) · [Por que dá para confiar](#por-que-dá-para-confiar) · [Para parceiros e investidores](#para-parceiros-e-investidores) · [Para desenvolvedores](#para-desenvolvedores)

</div>

---

## O problema

Quem precisa de um pronto-socorro decide no escuro. Não dá para saber, antes de sair de casa, quanto tempo se espera em cada hospital, e não existe um indicador público e imparcial da experiência de quem foi atendido. Depois da visita, o paciente também não tem um jeito rápido de contar como foi: pesquisa de satisfação longa ninguém responde.

## Como funciona

A Pulseira Verde transforma o celular de quem vai ao hospital num termômetro do atendimento, com o mínimo de esforço.

| 1. Você chega | 2. Você sai | 3. Todo mundo vê |
|---|---|---|
| O app percebe pela localização que você entrou numa unidade de saúde e começa a contar o tempo. Você não precisa apertar nada. | Na saída, ele pergunta como foi: poucas perguntas, menos de um minuto, e dá para pular qualquer uma. | A nota e o tempo de cada hospital aparecem para todos, calculados só a partir de visitas reais e só quando há avaliações suficientes. |

Consultar hospitais, ver notas e usar o mapa não exige conta. A conta é opcional e serve só para guardar o seu histórico.

> [!IMPORTANT]
> A Pulseira Verde não substitui atendimento de emergência. Em caso de urgência, ligue **192 (SAMU)**.

---

## Tutorial tela a tela

> As gravações abaixo foram feitas com **dados de exemplo**: os hospitais "Exemplo", as notas e os tempos são fictícios e não representam unidades reais.

<table>
<tr>
<td width="290" valign="top"><img src="doc/assets/readme/01-inicio.gif" alt="Tela inicial da Pulseira Verde explicando detecção automática, feedback rápido e avaliação pública" width="270"></td>
<td valign="top">

### 1. Início

O primeiro acesso explica o app em três ideias: a visita é detectada sozinha, a avaliação é rápida e opcional, e o resultado é público.

Depois disso, o **Início** é um mapa com a folha **Perto de você** por cima. As quatro abas embaixo levam a tudo: **Início**, **Ranking**, **Visitas** e **Perfil**.

</td>
</tr>
<tr>
<td valign="top"><img src="doc/assets/readme/02-hospitais.gif" alt="Lista de hospitais com nota e tempo, busca por nome e detalhe de um hospital" width="270"></td>
<td valign="top">

### 2. Encontre um hospital

Na folha **Perto de você**, no Início, cada unidade mostra a nota de 1 a 5, quantas avaliações ela tem e o tempo de permanência típico.

- Busque pelo nome ou filtre por **Todos**, **Público**, **Privado** e **Até 5 km**.
- Arraste a alça da folha: ela para em 20%, 40% e 60% da tela, e um toque na alça passa à próxima altura.
- Toque num hospital para ver endereço, telefone, horário e a **avaliação pública**, com o número de atendimentos que a sustentam, o período e a data da última atualização.

</td>
</tr>
<tr>
<td valign="top"><img src="doc/assets/readme/03-ranking.gif" alt="Ranking de hospitais por melhor nota e por menor tempo" width="270"></td>
<td valign="top">

### 3. Compare no ranking

A aba **Ranking** lista os hospitais em ordem. Ordene por **melhor nota** ou por **menor tempo** e combine com o tipo de unidade.

Hospitais com avaliações suficientes para a média fazer sentido vêm primeiro. Os demais aparecem no fim, sem nota.

</td>
</tr>
<tr>
<td valign="top"><img src="doc/assets/readme/04-mapa.gif" alt="Mapa com os hospitais e filtros de distância de 1, 5, 10 e 25 km" width="270"></td>
<td valign="top">

### 4. Veja o que está perto

No mapa do Início os hospitais aparecem em volta de você. O filtro **Até 5 km** mostra só o que está ao alcance, o botão de localizar centraliza você na faixa livre do mapa (entre a busca e a folha), e tocar num marcador abre o card e o detalhe do hospital.

</td>
</tr>
<tr>
<td valign="top"><img src="doc/assets/readme/05-checkin.gif" alt="Check-in manual com temporizador de permanência e botão Não estou aqui" width="270"></td>
<td valign="top">

### 5. A sua visita

**Automática:** com a localização permitida "o tempo todo", o app detecta a entrada e a saída do hospital mesmo fechado, e mostra o temporizador no detalhe do hospital.

**Manual (plano B):** sem GPS ou sem permissão, abra o hospital e toque em **Estou aqui agora**. O temporizador começa a contar, e **Não estou aqui** encerra a visita quando você sair.

</td>
</tr>
<tr>
<td valign="top"><img src="doc/assets/readme/06-avaliacao.gif" alt="Avaliação pendente na tela inicial e formulário curto de avaliação em etapas" width="270"></td>
<td valign="top">

### 6. Conte como foi

Depois da saída, o app avisa e a avaliação fica esperando na tela inicial por até 24 horas.

São etapas curtas: triagem, especialidade e atendimento, receita e tratamento da equipe, e a nota da visita. Todas as perguntas, menos a nota, podem ser puladas. Uma visita vale uma avaliação.

</td>
</tr>
<tr>
<td valign="top"><img src="doc/assets/readme/07-perfil.gif" alt="Login opcional, perfil e histórico de visitas e avaliações" width="270"></td>
<td valign="top">

### 7. Conta opcional e seus dados

Quem cria conta acompanha na aba **Visitas** (Histórico) as visitas e as avaliações feitas, e pode **editar uma avaliação por até 15 dias**.

Em **Perfil** você controla a permissão de localização e as notificações, baixa em PDF tudo o que o app guarda sobre você e pode excluir a conta.

</td>
</tr>
</table>

Quer o passo a passo completo, com cadastro, confirmação de e-mail e recuperação de senha? Veja o [tutorial de primeiros passos](https://github.com/devpointinnovations/pulseira-verde-docs/blob/develop/doc/tutorial-usuario/tutorial-primeiros-passos.md).

---

## Por que dá para confiar

- **Tempo medido, não declarado.** A duração da visita vem da localização do celular, da entrada até a saída, e não de alguém digitando quanto esperou.
- **Só conta quem esteve lá.** A avaliação fica ligada a uma visita, cada visita aceita uma avaliação, e só entram na nota pública as visitas registradas dentro da área do hospital.
- **Nada de nota com pouca gente.** Nota e tempo só aparecem com pelo menos 5 avaliações. O tempo usa a mediana, que não se deixa levar por um caso extremo.
- **Método à vista.** Cada hospital mostra quantos atendimentos sustentam o número, o período considerado e quando foi atualizado.
- **Sem internet, sem perder a visita.** O catálogo de hospitais fica guardado no aparelho, e entradas, saídas e avaliações feitas sem conexão entram numa fila e são enviadas quando a internet volta.
- **Privacidade por padrão.** A avaliação publicada nunca mostra quem avaliou. A localização serve para detectar a visita e pode ser revogada a qualquer momento no Perfil. A Dev Point Innovations LTDA é a controladora dos dados. Política de privacidade, termos de uso e exclusão de conta em [saudemonitor.dev](https://saudemonitor.dev/privacidade/).

---

## Para parceiros e investidores

### A oportunidade

Não existe hoje um dado contínuo e público sobre quanto se espera e como o paciente percebe o atendimento em cada unidade de saúde. A Pulseira Verde gera esse dado de baixo para cima: cada visita registrada vira um ponto de medição, e quanto mais gente usa, mais útil o app fica para quem vem depois.

### Modelo

- **Para o cidadão, o app é e continuará gratuito.**
- **Quem paga é o poder público.** Secretarias e conselhos de saúde recebem relatórios agregados por região e por hospital, sempre anônimos e com o mesmo método público do app. A venda começa por conversas e pilotos. Preço e formato de contrato ainda não estão definidos.

### Onde estamos

| | |
|---|---|
| **Produto** | App Android funcional, em homologação (versão candidata `v1.0.0-rc.21` do app, de 24/11/2026, testada com o backend `v1.0.0-rc.19`). |
| **Cobertura** | 341 estabelecimentos de saúde do DF cadastrados a partir de dados públicos do CNES/DATASUS. |
| **Operação** | API em nuvem (Google Cloud Run), painel administrativo web para a equipe manter o catálogo, site público com política de privacidade, termos e exclusão de conta. |
| **Próximos passos** | Publicação na Play Store, beta fechado com cerca de 50 pessoas por 30 dias e lançamento público no DF em março de 2027. |

O lançamento público só acontece quando o beta atingir pelo menos **3 hospitais com 5 ou mais avaliações**. Antes de ter dado de verdade, o app não mostra número inflado.

### Quer conversar?

Gestores públicos, conselhos de saúde e investidores interessados em um piloto ou em acompanhar o projeto podem falar com [Gabriel Vogado](https://github.com/GabrielVogado), criador da Pulseira Verde.

---

## Para desenvolvedores

Cada parte do projeto tem seu repositório na organização `devpointinnovations`, todos com a branch base `develop`. O monorepo antigo [GabrielVogado/saude-monitor](https://github.com/GabrielVogado/saude-monitor) está arquivado e serve só de consulta ao histórico.

| Componente | Tecnologia | Repositório |
|---|---|---|
| App mobile | Expo 55, React Native, MapLibre, TanStack Query, Zustand | **pulseira-verde-mobile** (este) |
| API | Java 25, Spring Boot 4, MongoDB, Google Cloud Run | [pulseira-verde-backend](https://github.com/devpointinnovations/pulseira-verde-backend) |
| Painel administrativo | Angular 21 | [pulseira-verde-admin](https://github.com/devpointinnovations/pulseira-verde-admin) |
| Documentação e site público | Markdown, Cloudflare Workers | [pulseira-verde-docs](https://github.com/devpointinnovations/pulseira-verde-docs) |

### Rodar o app

```bash
npm install --legacy-peer-deps   # mesmo comando do CI
npm start                        # Metro (expo start)
npm run android                  # compila e abre no emulador ou aparelho (expo run:android)
npm run web                      # versão web (o CI valida com `expo export --platform web`)
```

O mapa usa MapLibre, que é código nativo: o app precisa de um build de desenvolvimento (`npm run android`) e não roda no Expo Go. No Windows, `start-dev.ps1` configura o `adb reverse`, sobe o Metro e abre o app no emulador (`-ClearCache` limpa o cache do Metro).

A URL da API vem de `expo.extra` no `app.json` (`apiBaseUrl` local em `http://localhost:8080`, e o ambiente de desenvolvimento no Cloud Run para Android e iOS). `EXPO_PUBLIC_API_BASE_URL` sobrescreve esses valores. Para subir a API na sua máquina, veja o [Guia do Ambiente Local](https://github.com/devpointinnovations/pulseira-verde-docs/blob/develop/Documentos/02-arquitetura-tecnica/Guia-Ambiente-Local-v1.0.md).

### Testes e qualidade

```bash
npm run typecheck       # tsc --noEmit
npm run lint            # ESLint, no máximo 16 avisos
npm test                # Jest (jest-expo e Testing Library)
npm run test:coverage   # com cobertura
```

O CI (`Frontend (Expo Web)`, workflow `ci.yml`) roda typecheck, lint, testes com cobertura, SonarQube Cloud e o build web. Ele exige **90% de cobertura no código novo** do PR e tem uma trava para a contagem de testes não diminuir. O limite global do `jest.config.js` é piso, não meta.

### Estrutura

| Pasta | O que tem |
|---|---|
| `src/screens/<área>/` | Telas por área (`hospitais`, `visitas`, `perfil`, `user`, `auth`, `feedback`, `geolocalizacao`, `onboarding`, `atualizacao`), cada uma com `view/`, `service/` e, quando precisa, `hooks/` |
| `src/components/` | Componentes compartilhados `CS*` (botão, card, chip, folha de opções, aviso de conexão) |
| `src/core/` | Cliente da API, TanStack Query e stores do Zustand |
| `src/services/` | Catálogo local, fila de envio offline, configuração remota, tokens e notificações |
| `src/config/`, `src/theme/`, `src/utils/` | Configuração, tokens do tema e funções puras (distância, folha de alturas, mapa) |
| `src/__tests__/` | Testes, espelhando a estrutura de `src/` |
| `android/`, `deploy/android/` | Projeto Android versionado e o guia de assinatura e versão do APK |
| `scripts/build-apk.js` | `npm run build:apk`, APK de release local |

### Builds e ambientes

A `master` é homologação e a produção sai de `release/X.Y.Z`. O APK é gerado no próprio GitHub Actions, sem EAS.

| Ambiente | Pacote | Nome no celular | Como sai |
|---|---|---|---|
| dev | `com.gabrielvogado.saudemonitor.dev` | Pulseira Verde DEV | Cada push na `develop` que muda o código do app gera um APK (`cd-mobile-apk.yml`) |
| hom | `com.gabrielvogado.saudemonitor.hom` | Pulseira Verde HML | Merge na `master` gera a tag `vX.Y.Z-rc.N` e o APK `pulseira-verde-hom-X.Y.Z-rc.N.apk` na página Releases |
| prod | `com.gabrielvogado.saudemonitor` | Pulseira Verde | Branch `release/X.Y.Z` gera o AAB para a Play Store |

Pacotes diferentes são apps diferentes, então dev e hom ficam instalados lado a lado. Para um APK novo instalar por cima do anterior, a chave de assinatura é a mesma e o `versionCode` é maior: detalhes em [`deploy/android/README.md`](deploy/android/README.md).

### Mais documentação

- **Documentação completa:** [índice central](https://github.com/devpointinnovations/pulseira-verde-docs/blob/develop/Documentos/00-INDICE.md), com negócio, arquitetura, contratos da API, backlog e histórico de melhorias.
- **Fluxo de trabalho:** branches, ambientes, homologação e deploy no [manual do git-flow](https://github.com/devpointinnovations/pulseira-verde-docs/blob/develop/Documentos/10-git-flow/MANUAL.md).
- **Homologações:** registros de cada rc em [`homologacoes/`](https://github.com/devpointinnovations/pulseira-verde-docs/tree/develop/Documentos/10-git-flow/homologacoes).
