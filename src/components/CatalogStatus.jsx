export function CatalogStatus({ isLoading, error }) {
  if (isLoading) return <div className="catalog-status">Cargando información del complejo…</div>
  if (error) return <div className="catalog-status catalog-status-error">{error} Verifica las variables de Supabase y las políticas de lectura.</div>
  return null
}
