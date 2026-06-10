// Identidade da instância (white-label). NEXT_PUBLIC_* é inlined no build do
// Next — cada loja builda sua própria imagem passando build args no compose.
// Sem as vars, mantém a marca Mamba Army (comportamento original).
export const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'Mamba Army'
export const STORE_LOGO = process.env.NEXT_PUBLIC_STORE_LOGO || '/logo-mamba.png'
