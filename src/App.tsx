import { lazy, Suspense } from 'react'
import { createBrowserRouter, createMemoryRouter, RouterProvider } from 'react-router'
import Landing from './pages/Landing'

const DemoShowroom = lazy(() => import('./pages/DemoShowroom'))
const Create = lazy(() => import('./pages/Create'))
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
  { path: '/create', element: s(<Create />) },
  ...(import.meta.env.DEV ? [{ path: '/__capture/:id', element: s(<Capture />) }] : []),
  { path: '*', element: s(<NotFound />) },
])

export default function App() {
  return <RouterProvider router={router} />
}
