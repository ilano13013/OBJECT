import { lazy, Suspense } from 'react'
import { createBrowserRouter, createMemoryRouter, Navigate, RouterProvider } from 'react-router'
import Landing from './pages/Landing'

const DemoShowroom = lazy(() => import('./pages/DemoShowroom'))
const StudioHome = lazy(() => import('./pages/studio/StudioHome'))
const NewShowroom = lazy(() => import('./pages/studio/NewShowroom'))
const Editor = lazy(() => import('./pages/studio/Editor'))
const StudioPreview = lazy(() => import('./pages/studio/StudioPreview'))
const PublicShowroom = lazy(() => import('./pages/PublicShowroom'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Capture = lazy(() => import('./pages/Capture'))

function Loading() {
  return <div className="grid min-h-[100svh] place-items-center bg-obsidian" aria-busy="true" aria-label="Loading" />
}

const s = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>

// Sandboxed previews have no real URL to route on, so they keep history in memory.
const createRouter = import.meta.env.VITE_MEMORY_ROUTER ? createMemoryRouter : createBrowserRouter

const router = createRouter([
  { path: '/', element: <Landing /> },
  { path: '/demo/:slug', element: s(<DemoShowroom />) },
  { path: '/create', element: <Navigate to="/studio/new" replace /> },
  { path: '/studio', element: s(<StudioHome />) },
  { path: '/studio/new', element: s(<NewShowroom />) },
  { path: '/studio/:id', element: s(<Editor />) },
  { path: '/studio/:id/preview', element: s(<StudioPreview />) },
  { path: '/s/:slug', element: s(<PublicShowroom />) },
  ...(import.meta.env.DEV ? [{ path: '/__capture/:id', element: s(<Capture />) }] : []),
  { path: '*', element: s(<NotFound />) },
])

export default function App() {
  return <RouterProvider router={router} />
}
