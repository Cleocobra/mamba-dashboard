#!/usr/bin/env node
// Descobre o IG_USER_ID e gera um IG_ACCESS_TOKEN que não expira, a partir de
// um token curto do Graph API Explorer. Não precisa instalar nada (Node 18+).
//
//   node scripts/ig-setup.mjs --app-id 123 --app-secret abc --token EAAB...
//
// Como obter os três valores:
//   1. developers.facebook.com → Meus apps → Criar app (tipo "Empresa") → anote ID e Chave secreta
//      (Configurações do app → Básico).
//   2. Adicione o produto "Login do Facebook para empresas" (ou "Instagram Graph API").
//   3. Ferramentas → Explorador da Graph API → selecione o app → "Gerar token de acesso" marcando:
//      pages_show_list, pages_read_engagement, instagram_basic, instagram_content_publish
//      → copie o token (curto, vale 1 hora) e passe em --token.
//   Requisito: a conta do Instagram precisa ser Business/Creator e estar vinculada a uma Página
//   do Facebook que você administra.

const API = 'https://graph.facebook.com/v20.0'
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]] : []).filter(Boolean))
const { 'app-id': appId, 'app-secret': appSecret, token } = args
if (!appId || !appSecret || !token) {
  console.error('Uso: node scripts/ig-setup.mjs --app-id ID --app-secret SEGREDO --token TOKEN_CURTO')
  process.exit(1)
}

async function g(path, params) {
  const url = new URL(`${API}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url)
  const json = await res.json()
  if (json.error) throw new Error(`${path}: ${json.error.message}`)
  return json
}

try {
  // 1. token curto → token de usuário de longa duração (60 dias)
  const long = await g('oauth/access_token', { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: token })
  console.log('✔ Token de usuário de longa duração obtido (60 dias).')

  // 2. Páginas do usuário + conta do Instagram vinculada. O token de Página derivado de um
  //    token longo NÃO expira: é o ideal para o cron.
  const pages = await g('me/accounts', { access_token: long.access_token, fields: 'id,name,access_token,instagram_business_account{id,username,name}' })
  const withIg = (pages.data || []).filter(p => p.instagram_business_account)
  if (withIg.length === 0) {
    console.error('✖ Nenhuma Página com conta do Instagram vinculada. Vincule o Instagram (Business/Creator) à Página em facebook.com/pages → Configurações → Instagram, e gere o token de novo.')
    if (pages.data?.length) console.error('  Páginas encontradas: ' + pages.data.map(p => p.name).join(', '))
    process.exit(2)
  }
  for (const p of withIg) {
    const ig = p.instagram_business_account
    // 3. valida o token de Página na conta do Instagram
    const info = await g(ig.id, { access_token: p.access_token, fields: 'id,username,followers_count,media_count' })
    console.log(`\nPágina: ${p.name}  →  Instagram @${info.username} (${info.followers_count} seguidores, ${info.media_count} posts)`)
    console.log('Cole no .env do servidor:')
    console.log(`IG_USER_ID=${ig.id}`)
    console.log(`IG_ACCESS_TOKEN=${p.access_token}`)
  }
  console.log('\nDepois: docker compose up -d web  (ou rode sudo bash deploy/scemalta-vps.sh de novo)')
} catch (e) {
  console.error('✖ ' + e.message)
  process.exit(3)
}
