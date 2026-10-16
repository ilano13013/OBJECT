import { lazy, Suspense } from 'react'
import { createBrowserRouter, createMemoryRouter, Navigate, RouterProvider } from 'react-router'
import { AuthProvider, RequireAuth } from './auth/AuthProvider'
import Landing from './pages/Landing'

const DemoShowroom = lazy(() => import('./pages/DemoShowroom'))
const StudioHome = lazy(() => import('./pages/studio/StudioHome'))
const NewShowroom = lazy(() => import('./pages/studio/NewShowroom'))
const Editor = lazy(() => import('./pages/studio/Editor'))
const StudioPreview = lazy(() => import('./pages/studio/StudioPreview'))
const PublicShowroom = lazy(() => import('./pages/PublicShowroom'))
const Stats = lazy(() => import('./pages/studio/Stats'))
const Account = lazy(() => import('./pages/studio/Account'))
const Login = lazy(() => import('./pages/auth/Login'))
const AuthCallback = lazy(() => import('./pages/auth/AuthCallback'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Capture = lazy(() => import('./pages/Capture'))

function Loading() {
  return <div className="grid min-h-[100svh] place-items-center bg-obsidian" aria-busy="true" aria-label="Loading" />
}

const s = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>
/** Studio pages: signed-in users only when accounts are on. */
const p = (el: React.ReactNode) => s(<RequireAuth>{el}</RequireAuth>)

// Sandboxed previews have no real URL to route on, so they keep history in memory.
const createRouter = import.meta.env.VITE_MEMORY_ROUTER ? createMemoryRouter : createBrowserRouter

const router = createRouter([
  { path: '/', element: <Landing /> },
  { path: '/demo/:slug', element: s(<DemoShowroom />) },
  { path: '/create', element: <Navigate to="/studio/new" replace /> },
  { path: '/studio', element: p(<StudioHome />) },
  { path: '/studio/new', element: p(<NewShowroom />) },
  { path: '/studio/:id', element: p(<Editor />) },
  { path: '/studio/:id/preview', element: p(<StudioPreview />) },
  { path: '/studio/:id/stats', element: p(<Stats />) },
  { path: '/account', element: p(<Account />) },
  { path: '/login', element: s(<Login />) },
  { path: '/auth/callback', element: s(<AuthCallback />) },
  { path: '/auth/reset', element: s(<ResetPassword />) },
  { path: '/s/:slug', element: s(<PublicShowroom />) },
  ...(import.meta.env.DEV ? [{ path: '/__capture/:id', element: s(<Capture />) }] : []),
  { path: '*', element: s(<NotFound />) },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
