import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import Landing from './pages/Landing'

const DemoShowroom = lazy(() => import('./pages/DemoShowroom'))
const Create = lazy(() => import('./pages/Create'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Capture = lazy(() => import('./pages/Capture'))

function Loading() {
  return <div className="grid min-h-[100svh] place-items-center bg-obsidian" aria-busy="true" aria-label="Loading" />
}

const s = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/demo/:slug', element: s(<DemoShowroom />) },
  { path: '/create', element: s(<Create />) },
  ...(import.meta.env.DEV ? [{ path: '/__capture/:id', element: s(<Capture />) }] : []),
  { path: '*', element: s(<NotFound />) },
])

export default function App() {
  return <RouterProvider router={router} />
}
