import { CatalogStatus } from './components/CatalogStatus'
import { ComplexHeader } from './components/ComplexHeader'
import { ComplexInformation } from './components/ComplexInformation'
import { CourtCatalog } from './components/CourtCatalog'
import { LocationSection } from './components/LocationSection'
import { SponsorCarousel } from './components/SponsorCarousel'
import { useDemoCatalog } from './hooks/useDemoCatalog'

function App() {
  const catalog = useDemoCatalog()

  return <main>
    <ComplexHeader complex={catalog.complex} />
    <CatalogStatus isLoading={catalog.isLoading} error={catalog.error} />
    {catalog.complex ? <>
      <ComplexInformation complex={catalog.complex} />
      <CourtCatalog courts={catalog.courts} />
      <SponsorCarousel sponsors={catalog.sponsors} />
      <LocationSection complex={catalog.complex} />
      <footer className="simple-footer">© 2026 {catalog.complex.name}</footer>
    </> : <section className="connection-empty"><p className="eyebrow"><span /> CONEXIÓN PENDIENTE</p><h1>Conectando información del complejo</h1><p>Cuando este configurado el complejo, aquí aparecerán los datos y su catálogo.</p></section>}
  </main>
}

export default App
