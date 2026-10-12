# MineOps — especificação do produto

## Objetivo

O MineOps conecta a operação de uma rede LTE privada às necessidades industriais de uma mina. A plataforma demonstrativa integra monitoramento, inventário, análise de impacto e planejamento de expansão em uma interface web.

Aurora Mining é fictícia. Sites, dispositivos, telemetria, fluxos e prazos são sintéticos e independentes de clientes corporativos. A base de satélite fornece contexto visual, com atribuição ao provedor; não representa uma rede instalada ou limites oficiais de uma mina.

## Escopo da versão 1.0.0

| Recurso | Comportamento |
| --- | --- |
| Overview | Indicadores agregados, tendências de telemetria e mapa da operação |
| Network Map | Sites, setores, cobertura ilustrativa, consulta de sinal, camadas e satélite |
| Impact Analysis | Dispositivos, aplicações e áreas dependentes do site selecionado |
| NOC Monitoring | Estado dos sites, utilização e indicadores de desempenho |
| Alarms & Incidents | Reconhecimento de alarmes e ciclo de atendimento |
| LTE Sites | Consulta de sites, células, dependências e histórico |
| Network Inventory | Equipamentos de infraestrutura |
| Connected Devices | Dispositivos industriais, estado e associação ao site |
| Industrial Applications | Aplicações e dependências de conectividade |
| LTE Adoption | Demandas, análise ilustrativa de cobertura e ativação operacional |
| Analytics | Agregação de telemetria e indicadores por período |
| Simulation Center | Cenários de falha, degradação, crescimento e recuperação |
| Settings | Parâmetros da demonstração |
| Exportação | Dados em CSV e XLSX |

## Jornadas principais

### Monitorar e investigar

O operador consulta os indicadores, identifica um site e inspeciona células e dependências. O mapa oferece satélite, camadas selecionáveis e faixas geométricas de sinal por setor. O menu pode ser recolhido e o mapa inteiro pode ser ocultado.

### Simular falhas e avaliar impacto

A falha de backhaul do SITE-LTE-014 afeta inicialmente 42 dispositivos, 3 aplicações e 1 área. Os totais são derivados das associações persistidas. A recuperação restabelece conectividade e limpa alarmes técnicos; o atendimento humano do incidente segue seu próprio fluxo.

### Planejar e ativar conectividade

A demanda registra localização, aplicação, quantidade de dispositivos e justificativa. O fluxo percorre oito etapas, do recebimento à passagem para a operação. A ativação de nova cobertura adiciona o site ao inventário, ao mapa e à telemetria; outros tipos de demanda atualizam os recursos correspondentes.

## Dados iniciais

1 operação, 4 áreas, 24 sites LTE, 72 células, 500 dispositivos, 12 aplicações, 150 equipamentos, 20 demandas e 40 incidentes históricos. Sete dias de amostras horárias fornecem contexto analítico. O simulador produz novas amostras e movimentação de dispositivos.

## Requisitos técnicos e aceitação

As 13 telas consultam o backend FastAPI. React e TypeScript compõem a interface; SQLAlchemy e PostgreSQL/PostGIS persistem os dados, com migrações Alembic. WebSocket, polling e reconexão mantêm as atualizações. Docker Compose permite execução local sem hardware LTE ou chave comercial.

Cenários alteram o estado persistido e o impacto exibido. A ativação cria um site consultável nos demais módulos. Exportações refletem os dados da demonstração. Mapas preservam atribuição das fontes externas. Testes verificam domínio, migrações, operações espaciais e jornadas de navegador.

## Limites

Perfil local compartilhado e simulador em processo único. Cobertura geométrica ilustrativa, sem predição RF certificada, handover real, integração com operadoras ou autenticação de produção. Disponibilidade por amostras e prazos demonstrativos não constituem medições ou compromissos operacionais reais.

Consulte a [galeria](gallery.md), a [arquitetura](architecture.md), as [decisões técnicas](technical-decisions.md) e a [validação](validation.md).
