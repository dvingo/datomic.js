import React, { Suspense } from 'react'
import {
  Box,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  Divider
} from '@mui/material'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAppState, useThemeState, type NavigationTab } from './machines/appStateMachine'

import { createBrowserRouter, RouterProvider, Outlet, Link } from 'react-router-dom'
import CssBaseline from '@mui/material/CssBaseline'

import { ThemeProvider } from '@mui/material/styles'
import QueryEditorPage from './components/pages/QueryEditorPage'
const SchemaViewerPage = React.lazy(() => import('./components/pages/SchemaViewerPage'))
const SettingsPage = React.lazy(() => import('./components/pages/SettingsPage'))
const EntitiesPage = React.lazy(() => import('./components/pages/EntitiesPage'))

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayoutConnected />,
    children: [
      {
        index: true,
        element: <QueryEditorPage />
      },
      {
        path: 'query',
        element: <QueryEditorPage />,
        children: [
          {
            path: 'docs',
            element: <QueryEditorPage />
          },
          {
            path: 'history',
            element: <QueryEditorPage />
          },
          {
            path: 'library',
            element: <QueryEditorPage />
          }
        ]
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <SettingsPage />
          </Suspense>
        )
      },
      {
        path: 'schema',
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <SchemaViewerPage />
          </Suspense>
        )
      },
      {
        path: 'schema/:attribute',
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <SchemaViewerPage />
          </Suspense>
        )
      },
      {
        path: 'entities',
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <EntitiesPage />
          </Suspense>
        )
      }
    ]
  }
])

function MainLayoutConnected() {
  const { sidebarItems, selectedTab, handleTabChange } = useAppState()
  return <MainLayout sidebarItems={sidebarItems} selectedTab={selectedTab} onTabChange={handleTabChange} />
}

function MainLayout({
  sidebarItems,
  selectedTab,
  onTabChange
}: {
  sidebarItems: NavigationTab[]
  selectedTab: NavigationTab
  onTabChange: (tab: string) => void
}) {
  const drawerWidth = 250
  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box'
          }
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Datomic.js
          </Typography>
        </Toolbar>
        <Divider />
        <List>
          {sidebarItems.map(({ label, icon, path }) => (
            <ListItem key={label} disablePadding>
              <Link to={path} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', width: '100%' }}>
                <ListItemButton selected={label === selectedTab.label} onClick={() => onTabChange(path)}>
                  <ListItemIcon>{icon}</ListItemIcon>
                  <ListItemText primary={label} />
                </ListItemButton>
              </Link>
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', pt: 1, pl: 1 }}>
        <Outlet />
      </Box>
    </Box>
  )
}

const queryClient = new QueryClient()

function App() {
  const theme = useThemeState()
  return (
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
