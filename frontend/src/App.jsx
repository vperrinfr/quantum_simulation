import React, { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import {
  Content,
  Header,
  HeaderContainer,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  HeaderSideNavItems,
  SkipToContent,
  SideNav,
  SideNavItems,
  SideNavLink,
  Loading,
} from '@carbon/react'
import {
  Dashboard,
  Chemistry,
  QCircuitComposer,
  PlayFilledAlt,
  Analytics,
  NetworkEnterprise,
  Information,
} from '@carbon/icons-react'
import { NavLink, useNavigate } from 'react-router-dom'
import DemoBanner from './components/DemoBanner'

const DashboardPage   = lazy(() => import('./pages/DashboardPage'))
const ProblemPage     = lazy(() => import('./pages/ProblemPage'))
const CircuitPage     = lazy(() => import('./pages/CircuitPage'))
const RunPage         = lazy(() => import('./pages/RunPage'))
const ResultsPage     = lazy(() => import('./pages/ResultsPage'))
const ArchitecturePage = lazy(() => import('./pages/ArchitecturePage'))

const NAV_ITEMS = [
  { to: '/',             label: 'Dashboard',     Icon: Dashboard },
  { to: '/problem',      label: 'Problem',        Icon: Chemistry },
  { to: '/circuit',      label: 'Circuit',        Icon: QCircuitComposer },
  { to: '/run',          label: 'Run VQE',        Icon: PlayFilledAlt },
  { to: '/results',      label: 'Results',        Icon: Analytics },
  { to: '/architecture', label: 'Architecture',   Icon: NetworkEnterprise },
]

export default function App() {
  const navigate = useNavigate()

  return (
    <HeaderContainer
      render={({ isSideNavExpanded, onClickSideNavExpand }) => (
        <>
          <Header aria-label="Quantum Molecular Simulator">
            <SkipToContent />
            <HeaderMenuButton
              aria-label={isSideNavExpanded ? 'Close menu' : 'Open menu'}
              onClick={onClickSideNavExpand}
              isActive={isSideNavExpanded}
              aria-expanded={isSideNavExpanded}
            />
            <HeaderName href="/" prefix="IBM">
              Quantum Molecular Simulator
            </HeaderName>
            <HeaderNavigation aria-label="Quantum Molecular Simulator">
              {NAV_ITEMS.map(({ to, label }) => (
                <HeaderMenuItem key={to} href={to}
                  onClick={(e) => { e.preventDefault(); navigate(to) }}>
                  {label}
                </HeaderMenuItem>
              ))}
            </HeaderNavigation>
            <HeaderGlobalBar>
              <HeaderGlobalAction aria-label="About" onClick={() => navigate('/architecture')}>
                <Information size={20} />
              </HeaderGlobalAction>
            </HeaderGlobalBar>
            <SideNav
              aria-label="Side navigation"
              expanded={isSideNavExpanded}
              isPersistent={false}
              onSideNavBlur={onClickSideNavExpand}
            >
              <SideNavItems>
                <HeaderSideNavItems>
                  {NAV_ITEMS.map(({ to, label }) => (
                    <HeaderMenuItem key={to} href={to}
                      onClick={(e) => { e.preventDefault(); navigate(to); onClickSideNavExpand() }}>
                      {label}
                    </HeaderMenuItem>
                  ))}
                </HeaderSideNavItems>
              </SideNavItems>
            </SideNav>
          </Header>

          <Content>
            <div className="demo-banner-sticky">
              <DemoBanner />
            </div>
            <Suspense fallback={<Loading description="Loading page…" withOverlay={false} />}>
              <Routes>
                <Route path="/"             element={<DashboardPage />} />
                <Route path="/problem"      element={<ProblemPage />} />
                <Route path="/circuit"      element={<CircuitPage />} />
                <Route path="/run"          element={<RunPage />} />
                <Route path="/results"      element={<ResultsPage />} />
                <Route path="/architecture" element={<ArchitecturePage />} />
              </Routes>
            </Suspense>
          </Content>
        </>
      )}
    />
  )
}
