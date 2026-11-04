// Portal DTF — tipos do pipeline de tutoriais (pauta → artigo → site + Instagram).

export type ArticleStatus = 'draft' | 'approved' | 'rejected' | 'published' | 'error'

export const CATEGORIES = [
  'fundamentos', 'arte', 'equipamentos', 'insumos', 'aplicacao', 'problemas', 'negocio', 'manutencao',
] as const
export type Category = typeof CATEGORIES[number]

export const CATEGORY_INFO: Record<Category, { label: string; desc: string }> = {
  fundamentos:  { label: 'Fundamentos',          desc: 'Como o DTF funciona e quando usar cada técnica de estamparia.' },
  arte:         { label: 'Arte e arquivo',       desc: 'Preparar a arte para DTF: resolução, cor, base branca, fundo transparente.' },
  equipamentos: { label: 'Equipamentos',         desc: 'Impressoras, shakers, fornos e prensas: escolha e configuração.' },
  insumos:      { label: 'Insumos',              desc: 'Filmes, pós e tintas: tipos, diferenças e armazenamento.' },
  aplicacao:    { label: 'Aplicação',            desc: 'Prensagem por tecido: temperatura, tempo, pressão e tipo de peel.' },
  problemas:    { label: 'Problemas e soluções', desc: 'Diagnóstico de defeitos: descascando, granulado, banding e mais.' },
  negocio:      { label: 'Negócio',              desc: 'Precificação, gang sheet, venda por metro e gestão da produção.' },
  manutencao:   { label: 'Manutenção',           desc: 'Rotina de limpeza, cabeça de impressão e cuidados com a tinta branca.' },
}

export const LEVELS = ['iniciante', 'intermediario', 'avancado'] as const
export type Level = typeof LEVELS[number]
export const LEVEL_LABEL: Record<Level, string> = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' }

// Item da fila de pautas (o que vai virar tutorial).
export interface Topic {
  id:          string
  titulo:      string      // a pergunta/tema, ex.: "Como prensar DTF em poliamida"
  categoria?:  Category
  palavraChave?: string    // termo de busca principal
  notas?:      string      // contexto seu: parâmetros testados, fotos, ângulo
  prioridade:  number      // maior sai antes
  origem:      'manual' | 'ia'
  createdAt:   string
  usedBy?:     string      // slug do artigo gerado
}

export interface Step     { titulo: string; texto: string }
export interface Faq      { pergunta: string; resposta: string }
export interface Problem  { problema: string; solucao: string }

export interface InstagramResult {
  mediaId:     string
  permalink?:  string
  publishedAt: string
}

export interface Article {
  slug:          string
  status:        ArticleStatus
  createdAt:     string
  updatedAt:     string
  publishedAt?:  string
  topicId?:      string
  titulo:        string
  resumo:        string      // meta description (até 160 caracteres)
  categoria:     Category
  nivel:         Level
  tempoMin:      number      // tempo de leitura estimado
  introducao:    string
  materiais:     string[]
  passos:        Step[]
  dicas:         string[]
  problemas:     Problem[]
  faq:           Faq[]
  conclusao:     string
  palavrasChave: string[]
  legenda:       string      // legenda do Instagram (sem hashtags)
  hashtags:      string[]
  cardCount:     number
  model?:        string
  instagram?:    InstagramResult
  error?:        string
}

// Carrossel: capa + até 7 passos + card final. Instagram aceita até 10.
export const MAX_STEP_CARDS = 7
export const MAX_CARDS = 10

// Interessado nas soluções pagas (formulário da página /solucoes).
export const INTERESTS = ['encaixe', 'finalizacao', 'outro'] as const
export type Interest = typeof INTERESTS[number]
export const INTEREST_LABEL: Record<Interest, string> = {
  encaixe: 'Encaixe automático (gang sheet)', finalizacao: 'Finalização e checagem de arquivos', outro: 'Outro',
}

export interface Lead {
  id:        string
  nome:      string
  contato:   string    // WhatsApp ou e-mail
  empresa?:  string
  interesse: Interest
  mensagem?: string
  createdAt: string
}
