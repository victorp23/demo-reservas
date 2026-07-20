import { useEffect, useState } from 'react'
import { complex as fallbackComplex, courts as fallbackCourts } from '../data/demoData'
import { supabase } from '../lib/supabase'

function toCourt(row) {
  return {
    id: row.id,
    name: row.nombre,
    type: row.tipo || fallbackComplex.name,
    price: row.precio_referencial
      ? `${row.moneda || 'USD'} ${Number(row.precio_referencial).toFixed(2)}`
      : 'Valor por confirmar',
    tone: 'lime',
    slots: fallbackCourts[0].slots,
    duration: row.duracion_reserva_minutos,
    capacity: row.capacidad_jugadores,
    imageUrl: row.imagen_url || '',
  }
}

function toComplex(row) {
  return {
    ...fallbackComplex,
    id: row.id,
    name: row.nombre,
    location: row.ciudad || fallbackComplex.location,
    logo: row.logo_url || fallbackComplex.logo,
    description: row.descripcion || '',
    address: row.direccion || '',
    phone: row.telefono || '',
    whatsapp: row.whatsapp || '',
    mapsUrl: row.google_maps_url || '',
    mapsEmbedUrl: row.google_maps_embed_url || '',
  }
}

export function useDemoCatalog() {
  const [catalog, setCatalog] = useState({
    complex: null,
    courts: [],
    sponsors: [],
    isLoading: Boolean(supabase),
    error: supabase ? null : 'Supabase aún no está configurado en esta aplicación.',
  })

  useEffect(() => {
    if (!supabase) return

    let isCurrent = true

    async function loadCatalog() {
      const [complexResponse, courtsResponse, sponsorsResponse] = await Promise.all([
        supabase.from('demo_complejos').select('*').eq('activo', true).order('created_at').limit(1).maybeSingle(),
        supabase.from('demo_canchas').select('*').eq('activa', true).order('orden'),
        supabase.from('demo_auspiciantes').select('*').eq('activo', true).order('orden'),
      ])

      if (!isCurrent) return

      if (complexResponse.error || courtsResponse.error || sponsorsResponse.error) {
        setCatalog((current) => ({
          ...current,
          isLoading: false,
          error: 'No se pudo cargar el catálogo real de Supabase.',
        }))
        return
      }

      setCatalog({
        complex: complexResponse.data ? toComplex(complexResponse.data) : null,
        courts: courtsResponse.data?.length ? courtsResponse.data.map(toCourt) : [],
        sponsors: sponsorsResponse.data?.map((row) => ({
          id: row.id,
          name: row.nombre,
          category: row.categoria,
          logoUrl: row.logo_url,
          linkUrl: row.enlace_url,
        })) || [],
        isLoading: false,
        error: null,
      })
    }

    loadCatalog()
    return () => { isCurrent = false }
  }, [])

  return catalog
}
