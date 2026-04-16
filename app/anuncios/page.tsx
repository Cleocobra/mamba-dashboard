'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import MetaAdsPanel from '@/components/MetaAdsPanel'
import { Megaphone } from 'lucide-react'

export default function AnunciosPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [metaData, setMetaData] = useState<any>(null)
  const [connected, setConnected] = useState(false)

  const fetchMeta = async () => {
    try {
      const res = await fetch('/api/meta')
      const data = await res.json()
      setConnected(data.connected || false)
      if (data.connected) setMetaData(data.data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchMeta().finally(() => setIsLoading(false))
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchMeta()
    setIsRefreshing(false)
  }

  return (
    <div className="flex h-screen bg-mamba-black overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        <Header
          title="Meta Ads"
          subtitle="Acompanhamento de campanhas e gastos em anúncios"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-5xl">
            {/* Header banner */}
            <div className="flex items-center gap-4 p-4 mb-6 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30">
                <Megaphone className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-mamba-white">Integração Meta Ads</h2>
                <p className="text-xs text-mamba-silver/70 mt-0.5">
                  {connected
                    ? 'Conectado — dados atualizados a cada 5 minutos'
                    : 'Configure o token de acesso Meta para ativar esta integração'
                  }
                </p>
              </div>
              <div className="ml-auto">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                  connected
                    ? 'text-green-400 bg-green-400/10 border-green-400/20'
                    : 'text-orange-400 bg-orange-400/10 border-orange-400/20'
                }`}>
                  {connected ? 'Conectado' : 'Não configurado'}
                </span>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-mamba-gold/30 border-t-mamba-gold rounded-full animate-spin" />
              </div>
            ) : (
              <MetaAdsPanel connected={connected} data={metaData} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
