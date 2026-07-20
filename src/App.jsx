import { CatalogStatus } from './components/CatalogStatus'
import './availability.css'
import './home-shell.css'
import './navbar-global.css'
import './unified-theme.css'
import './availability-shell.css'
import './complex-section.css'
import './complex-page.css'
import './sponsor-enhancement.css'
import './font-fallback.css'
import './reservation.css'
import './admin.css'
import './profile.css'
import './bottom-profile.css'
import './tournaments.css'
import { AdminReservationsPage } from './components/AdminReservationsPage'
import { AccessPage } from './components/AccessPage'
import { AvailabilityPage } from './components/AvailabilityPage'
import { BottomNavigation } from './components/BottomNavigation'
import { ComplexHeader } from './components/ComplexHeader'
import { ComplexInformation } from './components/ComplexInformation'
import { ComplexPage } from './components/ComplexPage'
import { CourtCatalog } from './components/CourtCatalog'
import { LocationSection } from './components/LocationSection'
import { ProfilePage } from './components/ProfilePage'
import { SponsorCarousel } from './components/SponsorCarousel'
import { TournamentsPage } from './components/TournamentsPage'
import { useDemoCatalog } from './hooks/useDemoCatalog'
import { useAuthSession } from './hooks/useAuthSession'

function App() {
  const catalog = useDemoCatalog()
  const session = useAuthSession()
  const isAvailabilityPage = window.location.pathname === '/horarios'
  const isTournamentsPage = window.location.pathname === '/torneos'
  const isComplexPage = window.location.pathname === '/complejo'
  const isAdminPage = window.location.pathname === '/admin'
  const isAccessPage = window.location.pathname === '/acceso'
  const isProfilePage = window.location.pathname === '/perfil'

  if (isAccessPage || (isProfilePage && !session)) {
    return <>
      <ComplexHeader complex={catalog.complex} isSecondaryPage session={session} />
      <AccessPage session={session} />
      <BottomNavigation isSecondaryPage session={session} />
    </>
  }

  if (isProfilePage) {
    return <>
      <ComplexHeader complex={catalog.complex} isSecondaryPage session={session} />
      <ProfilePage session={session} />
      <BottomNavigation isSecondaryPage session={session} />
    </>
  }

  if (isAdminPage) {
    return <>
      <ComplexHeader complex={catalog.complex} isSecondaryPage session={session} />
      <CatalogStatus isLoading={catalog.isLoading} error={catalog.error} />
      <AdminReservationsPage complex={catalog.complex} />
      <BottomNavigation isSecondaryPage session={session} />
    </>
  }

  if (isAvailabilityPage || isComplexPage || isTournamentsPage) {
    return <>
      <ComplexHeader complex={catalog.complex} isSecondaryPage session={session} />
      <CatalogStatus isLoading={catalog.isLoading} error={catalog.error} />
      {catalog.complex && (isAvailabilityPage
        ? <AvailabilityPage complex={catalog.complex} courts={catalog.courts} session={session} />
        : isTournamentsPage
          ? <TournamentsPage complex={catalog.complex} />
          : <ComplexPage complex={catalog.complex} courts={catalog.courts} />)}
      <BottomNavigation isSecondaryPage session={session} />
    </>
  }

  return <>
    <ComplexHeader complex={catalog.complex} session={session} />
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
    <BottomNavigation session={session} />
  </>
}

export default App
