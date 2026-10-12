# MineOps — tour visual

[README em português](../README.pt-BR.md) · [English README](../README.md) · [Roteiro de demonstração](demo-guide.md) · [Índice técnico](README.md)

Da cobertura LTE ao impacto na operação industrial: esta galeria reúne **18 capturas reais da aplicação**, com dados demonstrativos. Clique nas imagens para ampliar. As seções recolhíveis permitem explorar os detalhes sem tornar a página excessivamente longa.

Todas as capturas com mapa usam a **base de satélite Esri**, para facilitar a leitura das cavas e da distribuição dos sites. A cobertura, os dispositivos e os painéis permanecem sobrepostos à imagem, com a atribuição do provedor preservada.

## Visão geral da operação

Indicadores de disponibilidade, capacidade, dispositivos e alarmes, acompanhados pelo mapa operacional e pela evolução da telemetria.

![Overview: indicadores da rede, mapa e gráficos de telemetria](screenshots/overview.png)

## Mapa operacional e cobertura LTE

As torres acompanham as cavas visíveis na base de satélite. A infraestrutura LTE é fictícia; os contornos são aproximações visuais para a demonstração. A imagem mantém a atribuição de seu provedor.

![Network Map: torres distribuídas pelas cavas na base de satélite Esri](screenshots/satellite-map.png)

<details>
<summary><strong>Explorar cobertura direcional, consulta de sinal e controles do mapa</strong></summary>

### Cobertura por setor

Três pétalas por site, faixas nominais de sinal e seleção de setor conectam a visualização à geometria calculada pelo backend.

![Cobertura direcional LTE e seleção de setores](screenshots/directional-map.png)

### Consulta de sinal

O **Signal probe** consulta a faixa nominal de RSRP, o site candidato e seu setor no ponto escolhido. Os valores são ilustrativos, sem medição de campo.

![Signal probe: consulta de sinal e site candidato diretamente no mapa](screenshots/signal-probe.png)

### Controle da visualização

**Map options** reúne bases, camadas e legendas; X ou Esc fecha o menu. **Hide map** esconde o mapa inteiro.

![Menu recolhível de bases, camadas e legendas](screenshots/map-controls.png)

### Enquadramento e telas menores

**Fit all towers** enquadra os sites; o mapa se ajusta ao redimensionamento da tela.

![Mapa operacional em viewport de tablet](screenshots/distributed-sites.png)

</details>

## Impacto operacional

Uma falha de backhaul no **SITE-LTE-014** conecta a indisponibilidade da rede às dependências industriais: **42 dispositivos, 3 aplicações e 1 área** no cenário inicial. Os totais são calculados pelas relações persistidas no banco.

![Impact Analysis: dispositivos e aplicações afetados por falha de backhaul](screenshots/impact-analysis.png)

<details>
<summary><strong>Explorar monitoramento, alarmes e simulação</strong></summary>

### NOC Monitoring

Uma visão dedicada ao estado dos sites e aos indicadores operacionais ajuda a localizar degradações na rede.

![NOC Monitoring: acompanhamento de sites e indicadores operacionais](screenshots/noc-monitoring.png)

### Alarms & Incidents

Alarmes técnicos e incidentes humanos têm fluxos distintos: reconhecer um alarme, abrir um incidente, investigar e concluir o atendimento.

![Alarms & Incidents: lista de alarmes, severidades e ações de atendimento](screenshots/alarms-incidents.png)

### Simulation Center

Falha de backhaul, energia, congestionamento, degradação de sinal e recuperação são cenários processados pelo backend, com histórico auditável.

![Simulation Center: cenários de falha, recuperação e controles do simulador](screenshots/simulation-center.png)

</details>

## Planejamento conectado à operação

As demandas de conectividade percorrem um fluxo de oito etapas. A ativação inclui o novo site no mapa, no inventário e na telemetria.

![LTE Adoption: demandas de conectividade e estágios de planejamento](screenshots/adoption-workflow.png)

<details>
<summary><strong>Ver um site ativado pelo fluxo de expansão</strong></summary>

Esta captura foi feita durante o teste de ponta a ponta, após a ativação de um site adicional. Por isso, ela apresenta 25 sites em vez dos 24 do seed inicial.

![Novo site operacional após concluir o fluxo de expansão](screenshots/expansion.png)

</details>

## Inventário e dependências industriais

<details>
<summary><strong>Explorar sites, infraestrutura, dispositivos e aplicações</strong></summary>

### LTE Sites

Sites e indicadores de capacidade podem ser consultados para investigar a condição de cada ponto da rede.

![LTE Sites: inventário dos sites e indicadores de operação](screenshots/lte-sites.png)

### Network Inventory

Equipamentos de infraestrutura complementam a visão lógica dos sites e células.

![Network Inventory: equipamentos de infraestrutura da rede](screenshots/network-inventory.png)

### Connected Devices

Dispositivos, estados de conexão e associações de rede sustentam o cálculo de impacto operacional.

![Connected Devices: dispositivos conectados e suas associações de rede](screenshots/connected-devices.png)

### Industrial Applications

Fleet Management, Industrial Telemetry e Video Monitoring exemplificam a ligação entre conectividade e operação da mina.

![Industrial Applications: aplicações industriais e dependências de conectividade](screenshots/industrial-applications.png)

</details>

## Análise e configuração

![Analytics: indicadores agregados e gráficos da rede](screenshots/analytics.png)

<details>
<summary><strong>Explorar configurações da demonstração</strong></summary>

![Settings: configuração dos parâmetros da plataforma demonstrativa](screenshots/settings.png)

</details>

## Reproduzir as capturas

Com a aplicação disponível em `http://localhost:3000`:

```sh
cd frontend
npm run screenshots
```

O script captura 12 vistas adicionais sem alterar os dados operacionais, reinicializar a demonstração ou sobrescrever as seis capturas existentes. As vistas com mapa usam satélite automaticamente. Os cenários de impacto, expansão, visão geral e mapa também são reproduzidos com satélite por `npm run test:e2e`; essa suíte reinicializa a base demonstrativa. A captura dos mapas requer internet para carregar as imagens Esri. Indicadores e horários podem variar com o simulador.

As imagens são capturas da interface, sem montagem ou alteração dos valores exibidos. Todos os ativos e fluxos operacionais são fictícios e independentes de clientes corporativos.
