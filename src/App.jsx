import { InvitationPage } from './components/InvitationPage'
import { InviteAdminPage } from './components/InviteAdminPage'
import { findInvite } from './lib/inviteStore'
import './styles.css'

function App() {
  const path = window.location.pathname
  if (path === '/admin') return <InviteAdminPage />
  if (path === '/invitacion') {
    const slug = new URLSearchParams(window.location.search).get('slug')
    return <InvitationPage invite={findInvite(slug) || undefined} />
  }
  return <InvitationPage />
}

export default App
