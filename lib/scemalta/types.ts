// SC em Alta — tipos do pipeline diário de notícias + oportunidades.

export type EditionStatus = 'draft' | 'approved' | 'rejected' | 'published' | 'error'

// Item bruto vindo de RSS ou da Brave News API (antes da edição).
export interface RawItem {
  id:          number      // índice estável dentro da coleta do dia
  title:       string
  link:        string
  source:      string      // nome do veículo (ex.: "G1 SC")
  publishedAt: string      // ISO
  summary?:    string
}

export type NewsCategory =
  | 'economia' | 'politica' | 'cidades' | 'seguranca' | 'clima'
  | 'infraestrutura' | 'educacao' | 'saude' | 'cultura' | 'esporte' | 'outro'

export interface NewsItem {
  titulo:    string
  resumo:    string        // 2 a 3 frases, com as próprias palavras
  fonte:     string
  link:      string
  categoria: NewsCategory
}

export type OpportunityType = 'licitacao' | 'edital' | 'evento' | 'investimento' | 'indicador' | 'outro'

export interface Opportunity {
  titulo:    string
  descricao: string
  tipo:      OpportunityType
  fonte:     string
  link:      string
}

export interface InstagramResult {
  mediaId:     string
  permalink?:  string
  publishedAt: string
}

export interface Edition {
  date:          string   // YYYY-MM-DD (America/Sao_Paulo)
  status:        EditionStatus
  createdAt:     string
  updatedAt:     string
  manchete:      string   // chamada da capa (até 60 caracteres)
  noticias:      NewsItem[]
  oportunidades: Opportunity[]
  legenda:       string   // legenda do Instagram (sem hashtags)
  hashtags:      string[]
  rawCount:      number   // quantos itens brutos entraram na edição
  cardCount:     number   // quantos cards o carrossel tem
  instagram?:    InstagramResult
  error?:        string
}

// Número máximo de cards: capa + notícias + oportunidades. Instagram aceita até 10.
export const MAX_CARDS = 10
