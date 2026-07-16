import { CatalogStatus } from './components/CatalogStatus'
import './availability.css'
import './home-shell.css'
import './navbar-global.css'
import { AvailabilityPage } from './components/AvailabilityPage'
import { BottomNavigation } from './components/BottomNavigation'
import { ComplexHeader } from './components/ComplexHeader'
import { ComplexInformation } from './components/ComplexInformation'
import { CourtCatalog } from './components/CourtCatalog'
import { LocationSection } from './components/LocationSection'
import { SponsorCarousel } from './components/SponsorCarousel'
import { useDemoCatalog } from './hooks/useDemoCatalog'

function App() {
  const catalog = useDemoCatalog()
  const isAvailabilityPage = window.location.pathname === '/horarios'

  if (isAvailabilityPage) {
    return <>
      <ComplexHeader complex={catalog.complex} isSecondaryPage />
      <CatalogStatus isLoading={catalog.isLoading} error={catalog.error} />
      {catalog.complex ? <AvailabilityPage complex={catalog.complex} courts={catalog.courts} /> : null}
      <BottomNavigation isSecondaryPage />
    </>
  }

  return <>
    <ComplexHeader complex={catalog.complex} />
    <main>
      <CatalogStatus isLoading={catalog.isLoading} error={catalog.error} />
      {catalog.complex ? <>
        <ComplexInformation complex={catalog.complex} />
        <CourtCatalog courts={catalog.courts} />
        <SponsorCarousel sponsors={catalog.sponsors} />
        <LocationSection complex={catalog.complex} />
        <footer className="simple-footer">© 2026 {catalog.complex.name}</footer>
      </> : <section className="connection-empty"><p className="eyebrow"><span /> CONEXIÓN PENDIENTE</p><h1>Conectando información del complejo</h1><p>Cuando esté configurado el complejo, aquí aparecerán los datos y su catálogo.</p></section>}
    </main>
    <BottomNavigation />
  </>
}

export default App
