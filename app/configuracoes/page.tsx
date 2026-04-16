'use client'

import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { Key, ExternalLink, CheckCircle, AlertCircle, Copy } from 'lucide-react'
import { useState } from 'react'

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md hover:bg-mamba-border transition-colors cursor-pointer text-mamba-silver/50 hover:text-mamba-silver"
    >
      {copied
        ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
        : <Copy className="w-3.5 h-3.5" />
      }
    </button>
  )
}

const integrations = [
  {
    name: 'Loja Integrada',
    status: 'configured',
    icon: '🛒',
    description: 'API de pedidos e catálogo de produtos',
    fields: [
      { label: 'Chave da API', key: 'LI_CHAVE_API', value: 'c9b02688ef5097ab6a26', masked: true },
      { label: 'Chave de Aplicação', key: 'LI_CHAVE_APLICACAO', value: 'df63ca80-5968-4476-9b43-11189846cb9a', masked: true },
    ],
    docsUrl: 'https://developers.lojaintegrada.com.br/',
  },
  {
    name: 'Meta Ads',
    status: 'pending',
    icon: '📣',
    description: 'Campanhas, gastos e performance de anúncios',
    fields: [
      { label: 'Access Token', key: 'META_ACCESS_TOKEN', value: '', masked: true },
      { label: 'Ad Account ID', key: 'META_AD_ACCOUNT_ID', value: '', masked: false },
    ],
    docsUrl: 'https://developers.facebook.com/docs/marketing-api/',
  },
]

export default function ConfiguracoesPage() {
  return (
    <div className="flex h-screen bg-mamba-black overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        <Header title="Configurações" subtitle="Integrações e chaves de API" />

        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-3xl">
          <div className="rounded-xl border border-mamba-border bg-mamba-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Key className="w-4 h-4 text-mamba-gold" />
              <h2 className="text-sm font-black text-mamba-white">Integrações de API</h2>
            </div>
            <p className="text-xs text-mamba-silver/60 mb-5">
              Configure as credenciais no arquivo <code className="bg-mamba-dark px-1.5 py-0.5 rounded text-mamba-gold font-mono">.env.local</code> para ativar cada integração.
            </p>

            <div className="space-y-4">
              {integrations.map((integ) => (
                <div key={integ.name} className="p-4 rounded-xl bg-mamba-dark border border-mamba-border">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-mamba-card border border-mamba-border flex items-center justify-center text-lg">
                        {integ.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-mamba-white">{integ.name}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            integ.status === 'configured'
                              ? 'text-green-400 bg-green-400/10 border-green-400/20'
                              : 'text-orange-400 bg-orange-400/10 border-orange-400/20'
                          }`}>
                            {integ.status === 'configured' ? 'Configurado' : 'Pendente'}
                          </span>
                        </div>
                        <p className="text-xs text-mamba-silver/60 mt-0.5">{integ.description}</p>
                      </div>
                    </div>
                    <a
                      href={integ.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-mamba-silver/50 hover:text-mamba-gold transition-colors cursor-pointer"
                    >
                      Docs <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="space-y-2">
                    {integ.fields.map((field) => (
                      <div key={field.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-mamba-black border border-mamba-border/60">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-mamba-silver/60 uppercase tracking-wider mb-0.5">{field.label}</p>
                          <code className="text-xs font-mono text-mamba-silver block truncate">
                            {field.value
                              ? (field.masked ? `${field.value.slice(0, 8)}${'•'.repeat(8)}` : field.value)
                              : <span className="text-mamba-silver/30 italic">Não configurado</span>
                            }
                          </code>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {field.value
                            ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                            : <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                          }
                          {field.value && <CopyButton value={field.value} />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Env file instructions */}
          <div className="rounded-xl border border-mamba-gold/20 bg-mamba-gold/5 p-5">
            <h3 className="text-xs font-bold tracking-wider text-mamba-gold uppercase mb-3">Como configurar variáveis de ambiente</h3>
            <ol className="space-y-2 text-xs text-mamba-silver">
              <li className="flex gap-2">
                <span className="text-mamba-gold font-bold">1.</span>
                Copie o arquivo <code className="bg-mamba-dark px-1.5 py-0.5 rounded text-mamba-gold">.env.local.example</code> para <code className="bg-mamba-dark px-1.5 py-0.5 rounded text-mamba-gold">.env.local</code>
              </li>
              <li className="flex gap-2">
                <span className="text-mamba-gold font-bold">2.</span>
                Preencha as variáveis com suas credenciais
              </li>
              <li className="flex gap-2">
                <span className="text-mamba-gold font-bold">3.</span>
                Na Vercel, adicione as variáveis em <strong>Settings → Environment Variables</strong>
              </li>
              <li className="flex gap-2">
                <span className="text-mamba-gold font-bold">4.</span>
                Faça um redeploy para aplicar as alterações
              </li>
            </ol>
          </div>
        </main>
      </div>
    </div>
  )
}
