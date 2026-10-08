// Base de conhecimento técnica do DTF: a "fonte da verdade" que o redator (Claude) usa.
// Regra do projeto: parâmetro técnico (temperatura, tempo, pressão) só entra no artigo se
// estiver aqui ou nas notas da pauta, e sempre como faixa + "confirme com o fabricante do filme".
//
// Ajuste estes números com os SEUS testes de produção: é isso que diferencia o portal
// de conteúdo genérico. Mantenha o texto estável (está em cache no prompt do Claude).

export const KNOWLEDGE_BASE = `
# Base técnica DTF (faixas típicas de mercado — sempre confirmar com o fabricante do filme/pó)

## Processo
1. Arte (PNG com fundo transparente, 300 dpi no tamanho final) → RIP gera camada de cor + camada de branco.
2. Impressão no filme PET: cor primeiro, branco por cima (o filme é lido "de costas").
3. Pó adesivo (poliuretano termofusível) aplicado com a tinta ainda úmida; excesso retirado (shaker ou manual).
4. Cura do pó: forno/estufa ou shaker com túnel, tipicamente 110–130 °C por 2–4 min, até o pó derreter por completo
   e ficar com aspecto uniforme de "casca de laranja". Pó granulado/arenoso = cura insuficiente.
5. Transferência na prensa térmica; retirada do filme a quente (hot peel) ou a frio (cold peel) conforme o filme.
6. Pós-prensa (recomendada): 5–10 s com papel siliconado/teflon por cima para fixar e dar acabamento fosco.

## Prensagem por tecido (faixas de referência)
- Algodão e mistos com algodão: 150–165 °C, 10–15 s, pressão média a firme. Pré-prensar a peça 3–5 s para tirar umidade e rugas.
- Poliéster comum: 140–150 °C, 10–12 s. Temperatura alta demais pode causar migração de corante (manchas) e brilho na malha.
- Poliéster sublimado/colorido e dry-fit: 130–140 °C com pó antimigração (blocker/pó preto) para evitar que o corante "suba" na estampa.
- Poliamida (nylon), corta-vento, guarda-chuva: 120–135 °C com pó low temp e tempo curto; testar sempre em retalho, alguns tecidos exigem adesivo específico.
- Jeans e lona: 155–165 °C, 15–20 s, pressão firme (tecido grosso e irregular).
- Boné: prensa de boné, 150–160 °C, 10–15 s; usar arte menor e curvatura do berço.
- Couro sintético e EVA: baixa temperatura (120–135 °C) e teste prévio — risco de deformar o material.

## Hot peel x cold peel
- Hot peel: retirar o filme imediatamente após a prensa; acabamento mais fosco, produção mais rápida.
- Cold peel: esperar esfriar totalmente (geralmente 30–60 s ou mais); acabamento mais brilhante, mais tolerante a erro.
- Existe filme "warm peel"/universal. O tipo de peel é do FILME, não da técnica: siga a ficha do fornecedor.

## Arte e arquivo
- Resolução: 300 dpi no tamanho real de impressão. Ampliar imagem pequena não recupera nitidez.
- Formato: PNG com fundo transparente (ou TIFF/PDF com transparência, conforme o RIP). JPG não tem transparência.
- Cor: trabalhar em RGB (sRGB) é o padrão da maioria dos RIPs de DTF; o RIP converte para CMYK com o perfil da impressora/tinta.
- Semitransparências e sombras suaves: o pó não adere de forma uniforme em tinta muito fina → converter em retícula (halftone)
  ou eliminar. Bordas com "névoa" de pixels semitransparentes geram contorno sujo.
- Detalhes mínimos: linhas e textos muito finos (abaixo de ~0,5–1 mm) tendem a quebrar na lavagem ou não pegar pó.
- Base branca: o RIP normalmente aplica "choke" (branco levemente menor que a cor) para não aparecer borda branca.
- Fundo preto na arte para peça preta: em vez de imprimir preto, deixar vazado (knockout) usa o tecido como cor e deixa o toque mais leve.

## Gang sheet / encaixe
- Encaixar várias artes num mesmo comprimento de filme reduz desperdício; larguras comuns de filme: 30 cm, 33 cm e 60 cm (≈58 cm úteis).
- Deixar espaçamento entre artes (ex.: 0,5–1 cm) para recortar e para o pó não emendar.
- Aproveitamento é calculado por área de arte / área de filme usada. Rotacionar peças e agrupar tamanhos parecidos aumenta o aproveitamento.
- A venda "por metro" é o modelo mais comum: o cliente monta o gang sheet e paga o comprimento linear.

## Insumos
- Filme PET: espessura, camada receptiva e tipo de peel variam; armazenar em local seco, na embalagem.
- Pó: fino (detalhes, toque macio), médio (uso geral), grosso (tecidos grossos/texturizados), preto/antimigração (poliéster sublimado).
- Tinta: CMYK + branco. A tinta branca (dióxido de titânio) sedimenta: agitar diariamente e manter circulação/agitação conforme o equipamento.
- Ambiente ideal de impressão: ~20–25 °C e umidade relativa ~40–60%. Umidade alta = pó grudando fora da arte e secagem lenta.

## Manutenção
- Teste de bicos (nozzle check) no início do dia; limpeza só quando necessário (limpeza excessiva gasta tinta).
- Limpeza da capping station e do wiper com fluido de limpeza próprio; nunca deixar a cabeça descoberta.
- Branco parado entope: imprimir algo todos os dias ou seguir a rotina de circulação da máquina.

## Problemas comuns (causa provável → o que verificar)
- Estampa descascando/soltando na lavagem: prensagem insuficiente (temperatura, tempo ou pressão), pó mal curado,
  peça com umidade/goma sem pré-prensa, falta de pós-prensa, tecido incompatível (ex.: tecidos com tratamento repelente).
- Pó grudando fora da arte: umidade alta, filme úmido ou com estática, tinta ainda muito molhada; usar ionizador/controlar ambiente.
- Pó granulado/arenoso depois da cura: cura insuficiente (temperatura baixa ou tempo curto).
- Rachaduras na estampa: excesso de tinta/branco, cura excessiva, pó inadequado para malha elástica, estampa muito grande e sólida em tecido que estica.
- Banding (listras): bicos falhando, cabeça desalinhada, perfil/velocidade inadequados; fazer nozzle check e alinhamento.
- Cores lavadas/opacas: perfil de cor errado, pouca carga de branco, filme incompatível com a tinta.
- Borda branca aparecendo: choke do branco insuficiente no RIP.
- Manchas na peça de poliéster (ghosting/migração): temperatura alta demais para o tecido; usar pó antimigração e temperatura menor.

## Cuidados com a peça (instruir o cliente final)
- Esperar 24 h antes da primeira lavagem; lavar do avesso, água fria ou morna (até ~40 °C).
- Evitar alvejante, secadora em alta temperatura e passar ferro direto sobre a estampa.

## Segurança
- Pó e tinta: usar em local ventilado; a cura do pó libera fumaça/odor — exaustão ou filtro são recomendados.
- Prensa e forno: risco de queimadura; nunca deixar ligados sem supervisão.
`.trim()
