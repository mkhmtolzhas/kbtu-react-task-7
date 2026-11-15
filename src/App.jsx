import { lazy, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AuthProvider from './context/AuthProvider.jsx';
import ConnectivityProvider from './context/ConnectivityProvider.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import VehicleDetailsPage from './pages/VehicleDetailsPage.jsx';
import VehiclesPage from './pages/VehiclesPage.jsx';
import { createQueryClient } from './queries/queryClient.js';

// Pages that are not on the shortest path to a car are split into their own
// chunks and fetched when they are first opened. The initial download is the
// landing page, the list and a vehicle — everything else arrives on demand.
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const NewVehiclePage = lazy(() => import('./pages/NewVehiclePage.jsx'));
const OfflinePage = lazy(() => import('./pages/OfflinePage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const SignupPage = lazy(() => import('./pages/SignupPage.jsx'));

// Hash URLs (#/vehicles/veh-0001) work on any static host without rewrite rules,
// and the service worker only ever has to cache one document.
const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'vehicles', element: <VehiclesPage /> },
      {
        // Adding a car to the fleet is a dispatcher action: sign-in required.
        path: 'vehicles/new',
        element: (
          <ProtectedRoute>
            <NewVehiclePage />
          </ProtectedRoute>
        ),
      },
      { path: 'vehicles/:id', element: <VehicleDetailsPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      { path: 'offline', element: <OfflinePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  // Created once per app instance, never on re-renders: the cache must outlive them.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectivityProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ConnectivityProvider>
    </QueryClientProvider>
  );
}
