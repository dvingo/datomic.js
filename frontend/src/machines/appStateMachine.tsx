import { fromPromise, assign, createActor, setup, SnapshotFrom, fromCallback, ActorRefFrom } from 'xstate'
import React from 'react'
import { useSelector } from '@xstate/react'
import { keyBy, omit } from 'lodash'
import { useQuery } from '@tanstack/react-query'
import { Search, Schema, Settings, Storage } from '@mui/icons-material'
import { createTheme, Theme } from '@mui/material/styles'
import { useLocation } from 'react-router-dom' // Add this import
import { openDB } from 'idb'

export type NavigationTab = {
  label: 'Query' | 'Schema' | 'Settings' | 'Entities'
  icon: React.ReactNode
  path: string
}

export type SchemaAttribute = {
  isIdent: boolean
  isFunction: boolean
  isAttribute: boolean
  isUnique: boolean
  isComponent: boolean
  ident: string
  namespace: string
  valueType: string
  cardinality: string
  function?: string
  updatedAt: Date
  unique?: 'unique/value' | 'unique/identity'
  doc?: string
  // function?: {
  //   imports: string[]
  //   requires: string[]
  //   lang: string
  //   params: string[]
  //   code: string
  // }
}

type SchemaUi = {
  filters: {
    showIdent: boolean
    showFn: boolean
    showAttribute: boolean
    onlyShowUnique: boolean
    onlyShowComponents: boolean
  }
  expandedNamespaces: string[]
}

type SchemaUiEvent = Partial<SchemaUi> & { filters?: Partial<SchemaUi['filters']> }
type SettingsEvent = Partial<Settings>

type QueryHistoryItem = {
  code: string
  time: number
}

export type Settings = {
  theme: 'light' | 'dark'
  apiAuthHeaders: Record<string, string>
  apiUrl: string
  fetchSchemaEndpoint: string
  submitQueryEndpoint: string
  translateQueryEndpoint: string
  fetchEntityShapesEndpoint: string
}

export type LibraryItem = {
  id: string
  name: string
  description: string
  code: string
  createdAt: Date
}

export type EntityShape = {
  uniqueAttribute: string
  schema: object
}

export type AppContext = {
  query: string
  schema: string
  data: string
  selectedTab: NavigationTab
  queryResult: string
  queryError: string
  queryHistory: QueryHistoryItem[]
  persistQueryHistoryActorRef: ActorRefFrom<typeof persistQueryHistoryActor> | null
  persistLibraryItemActorRef: ActorRefFrom<typeof persistLibraryItemActor> | null
  libraryItemsById: Record<string, LibraryItem>
  editingLibraryItem: LibraryItem | null
  isLibraryFormOpen: boolean
  sidebarItems: NavigationTab[]
  schemaUi: SchemaUi
  themesByName: Record<string, Theme>
  settings: Settings
  removeFromIndexedDBActorRef: ActorRefFrom<typeof removeFromIndexedDBActor> | null
  entityShapes: EntityShape[]
}

const MAX_QUERY_HISTORY_SIZE = 500

const DB_VERSION = 2 // Increment this when you make schema changes

const loadFromIndexedDbActor = fromCallback<MachineEvent, void>(({ sendBack }) => {
  openDB('appStateDB', DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`)

      if (oldVersion < 1) {
        // Create initial stores
        if (!db.objectStoreNames.contains('queryHistory')) {
          db.createObjectStore('queryHistory', { keyPath: 'id', autoIncrement: true })
        }
      }

      if (oldVersion < 2) {
        // Add libraryItems store in version 2
        if (!db.objectStoreNames.contains('libraryItems')) {
          db.createObjectStore('libraryItems', { keyPath: 'id', autoIncrement: true })
        }
      }

      // Add more version checks here for future migrations
    }
  })
    .then(async (db) => {
      let queryHistory: QueryHistoryItem[] = []
      let libraryItems: LibraryItem[] = []

      // Query History
      if (db.objectStoreNames.contains('queryHistory')) {
        const tx = db.transaction('queryHistory', 'readonly')
        const store = tx.objectStore('queryHistory')
        const history = await store.getAll()
        queryHistory = history.map((item) => ({ code: item.code, time: item.time })).slice(-MAX_QUERY_HISTORY_SIZE)
      }

      // Library Items
      if (db.objectStoreNames.contains('libraryItems')) {
        const tx2 = db.transaction('libraryItems', 'readonly')
        const store2 = tx2.objectStore('libraryItems')
        libraryItems = await store2.getAll()
      }

      console.log('loaeded data from indexed db')
      console.log('queryHistory', queryHistory)
      console.log('libraryItems', libraryItems)

      sendBack({ type: 'INDEXED_DB_DATA_LOADED', queryHistory, libraryItems })
    })
    .catch((error) => {
      console.error('Error in loadFromIndexedDbActor:', error)
      // Optionally, you can send an error event back to the machine
      // sendBack({ type: 'DB_LOAD_ERROR', error });
    })
})

const saveToIndexedDB = async <T extends object>({
  dbName,
  storeName,
  data,
  maxItems
}: {
  dbName: string
  storeName: string
  data: T
  key?: string
  maxItems?: number
}) => {
  console.log(`Saving to ${storeName}:`, data)
  const db = await openDB(dbName, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true })
      }
    }
  })
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)

  // Use put instead of add to update existing entries or add new ones
  await store.put(data)

  if (maxItems) {
    const count = await store.count()
    if (count > maxItems) {
      const keys = await store.getAllKeys()
      const oldestKey = keys[0]
      await store.delete(oldestKey)
    }
  }
  console.log(`Saved to ${storeName}:`, data)
}

const saveToQueryHistoryFn = ({ code, time }: { code: string; time: number }) =>
  saveToIndexedDB({
    dbName: 'appStateDB',
    storeName: 'queryHistory',
    data: { code, time },
    maxItems: MAX_QUERY_HISTORY_SIZE
  })

const persistQueryHistoryActor = fromPromise(
  async ({ input, self }: { input: QueryHistoryItem; self: ActorRefFrom<typeof Promise.resolve> }) => {
    console.log('persisting query history', input.code)
    await saveToQueryHistoryFn(input)
    self.send({ type: 'PERSIST_QUERY_HISTORY_COMPLETE' })
  }
)

const saveToLibraryFn = ({ libraryItem }: { libraryItem: LibraryItem }) =>
  saveToIndexedDB({
    dbName: 'appStateDB',
    storeName: 'libraryItems',
    data: libraryItem,
    key: libraryItem.id
  })

const persistLibraryItemActor = fromPromise(
  async ({ input, self }: { input: LibraryItem; self: ActorRefFrom<typeof Promise.resolve> }) => {
    console.log('persisting library item', input.name)
    await saveToLibraryFn({ libraryItem: input })
    self.send({ type: 'PERSIST_LIBRARY_ITEM_COMPLETE' })
  }
)

const removeFromIndexedDB = async ({ dbName, storeName, id }: { dbName: string; storeName: string; id: string }) => {
  try {
    const db = await openDB(dbName, DB_VERSION)
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    await store.delete(id)
    console.log(`Successfully removed item with id ${id} from ${storeName}`)
  } catch (error) {
    console.error(`Error removing item with id ${id} from ${storeName}:`, error)
    throw error // Re-throw the error if you want calling code to handle it
  }
}

const removeFromIndexedDBActor = fromPromise(
  async ({
    input,
    self
  }: {
    input: { dbName: string; storeName: string; id: string }
    self: ActorRefFrom<typeof Promise.resolve>
  }) => {
    try {
      await removeFromIndexedDB(input)
    } catch (error) {
      console.error('Error in removeFromIndexedDBActor:', error)
    } finally {
      self.send({ type: 'REMOVE_FROM_INDEXED_DB_COMPLETE' })
    }
  }
)

type MachineEvent =
  | { type: 'SELECT_TAB'; tab: NavigationTab }
  | { type: 'UPDATE_QUERY'; query: string }
  | { type: 'UPDATE_SCHEMA'; schema: string }
  | { type: 'UPDATE_DATA'; data: string }
  | { type: 'ADD_QUERY_TO_HISTORY'; query: string; time: number }
  | { type: 'INDEXED_DB_DATA_LOADED'; queryHistory: QueryHistoryItem[]; libraryItems: LibraryItem[] }
  | { type: 'EXECUTE_QUERY'; query: string }
  | { type: 'UPDATE_SCHEMA_UI'; schemaUi: SchemaUiEvent }
  | { type: 'UPDATE_SETTINGS'; settings: Settings }
  | { type: 'PERSIST_QUERY_HISTORY_COMPLETE' }
  | { type: 'PERSIST_LIBRARY_ITEM_COMPLETE' }
  | { type: 'REMOVE_FROM_LIBRARY'; libraryItem: LibraryItem }
  | { type: 'UPDATE_LIBRARY_ITEM'; libraryItem: LibraryItem }
  | { type: 'UPDATE_EDITING_LIBRARY_ITEM'; libraryItem: LibraryItem | null }
  | { type: 'SET_IS_LIBRARY_FORM_OPEN'; isLibraryFormOpen: boolean }
  | { type: 'REMOVE_FROM_INDEXED_DB_COMPLETE' }
  | { type: 'UPDATE_ENTITY_SHAPES'; entityShapes: string }

const sidebarItems: NavigationTab[] = [
  { label: 'Query', icon: <Search />, path: 'query' },
  { label: 'Schema', icon: <Schema />, path: 'schema' },
  { label: 'Entities', icon: <Storage />, path: 'entities' },
  { label: 'Settings', icon: <Settings />, path: 'settings' }
]

const sidebarItemsByPath = keyBy(sidebarItems, 'path')

const getInitialTab = () => {
  const path = window.location.pathname.slice(1) || 'query'
  return sidebarItemsByPath[path] || sidebarItems[0]
}

const initialContext: AppContext = {
  query: '',
  schema: '',
  data: '',
  selectedTab: getInitialTab(),
  queryResult: '',
  queryError: '',
  queryHistory: [],
  persistQueryHistoryActorRef: null,
  persistLibraryItemActorRef: null,
  libraryItemsById: {
    '69fa0c0d-3716-4bc6-91d0-054d09f74dda': {
      id: '69fa0c0d-3716-4bc6-91d0-054d09f74dda',
      name: 'Query 1',
      description: 'Description 1',
      code: `return datomic
                  .pullMany('?e', [['artist/name', 'as', 'name']])
                  .where(['?e', 'artist/name', '?name'])
                  .run()`,
      createdAt: new Date()
    }
  },
  editingLibraryItem: null,
  isLibraryFormOpen: false,
  themesByName: {
    dark: createTheme({
      palette: {
        mode: 'dark',
        background: {
          default: '#121212', // Dark background color
          paper: '#1e1e1e' // Slightly lighter background for paper elements
        }
      }
    }),
    light: createTheme({
      palette: {
        mode: 'light',
        background: {
          default: '#f0f0f0', // Light background color
          paper: '#ffffff' // White background for paper elements
        }
      }
    })
  },
  sidebarItems,
  settings: {
    theme: 'light',
    apiAuthHeaders: {},
    apiUrl: 'http://localhost:8080',
    fetchSchemaEndpoint: 'http://localhost:8080/api/datomic/schema',
    submitQueryEndpoint: 'http://localhost:8080/api/datomic/query',
    translateQueryEndpoint: 'http://localhost:8080/api/datomic/translate-query',
    fetchEntityShapesEndpoint: 'http://localhost:8080/api/datomic/entity-shapes'
  },
  schemaUi: {
    expandedNamespaces: [],
    filters: {
      onlyShowUnique: false,
      onlyShowComponents: false,
      showIdent: true,
      showFn: true,
      showAttribute: true
    }
  },
  removeFromIndexedDBActorRef: null,
  entityShapes: {}
}

const appMachine = setup({
  types: {
    context: {} as AppContext,
    events: {} as MachineEvent
  },
  actors: {
    executeQuery: fromPromise(async ({ input }: { input: string }) => {
      return new Promise((resolve) => {
        // Simulate query execution
        console.log(input)
        setTimeout(() => {
          resolve('Query result')
        }, 1000)
      })
    }),
    loadFromIndexedDbActor,
    persistQueryHistoryActor,
    removeFromIndexedDBActor
  },
  actions: {
    updateSettings: assign({
      settings: ({ context, event }) => {
        return event.type === 'UPDATE_SETTINGS' ? event.settings : context.settings
      }
    }),
    saveSettingsToLocalStorage: ({ context }) => {
      localStorage.setItem('appSettings', JSON.stringify(context.settings))
    },
    restoreSettings: assign({
      settings: ({ context }) => {
        const storedSettings = localStorage.getItem('appSettings')
        if (storedSettings) {
          try {
            const parsedSettings = JSON.parse(storedSettings)
            // Merge the parsed settings with the initial context settings
            return {
              ...context.settings,
              ...parsedSettings
            }
          } catch (error) {
            console.error('Failed to parse stored settings:', error)
            return context.settings
          }
        }
        return context.settings
      }
    }),
    updateSchemaUi: assign({
      schemaUi: ({ context, event }) => {
        const currentSchemaUi = context.schemaUi
        console.log('Updating schema ui:', event.type === 'UPDATE_SCHEMA_UI' ? event.schemaUi : context.schemaUi)
        return event.type === 'UPDATE_SCHEMA_UI' ? { ...currentSchemaUi, ...event.schemaUi } : currentSchemaUi
      }
    }),
    updateSelectedTab: assign({
      selectedTab: ({ context, event }) => {
        console.log('Updating selected tab:', event.type === 'SELECT_TAB' ? event.tab : context.selectedTab)
        return event.type === 'SELECT_TAB' ? event.tab : context.selectedTab
      }
    }),
    updateQuery: assign({
      query: ({ context, event }) => (event.type === 'UPDATE_QUERY' ? event.query : context.query)
    }),
    updateSchema: assign({
      schema: ({ context, event }) => (event.type === 'UPDATE_SCHEMA' ? event.schema : context.schema)
    }),
    updateData: assign({
      data: ({ context, event }) => (event.type === 'UPDATE_DATA' ? event.data : context.data)
    }),
    updateQueryResult: assign({
      queryResult: ({ context, event }) => (event.type === 'EXECUTE_QUERY' ? event.query : context.queryResult)
    }),
    setQueryError: assign({
      queryError: ({ context, event }) => (event.type === 'EXECUTE_QUERY' ? event.query : context.queryError)
    }),
    addToHistory: assign({
      queryHistory: ({ context, event }) =>
        event.type === 'ADD_QUERY_TO_HISTORY'
          ? [...context.queryHistory, { code: event.query, time: event.time }].slice(-MAX_QUERY_HISTORY_SIZE)
          : context.queryHistory,
      persistQueryHistoryActorRef: ({ spawn, event, context }) =>
        event.type === 'ADD_QUERY_TO_HISTORY'
          ? spawn(persistQueryHistoryActor, { input: { code: event.query, time: event.time } })
          : context.persistQueryHistoryActorRef
    }),
    setIndexedDbData: assign({
      queryHistory: ({ event }) => (event.type === 'INDEXED_DB_DATA_LOADED' ? event.queryHistory : []),
      libraryItemsById: ({ event }) =>
        event.type === 'INDEXED_DB_DATA_LOADED'
          ? Object.fromEntries(event.libraryItems.map((item) => [item.id, item]))
          : {}
    }),
    cleanupPersistQueryHistoryActor: assign({
      persistQueryHistoryActorRef: () => null
    }),
    removeFromLibrary: assign({
      libraryItemsById: ({ context, event }) =>
        event.type === 'REMOVE_FROM_LIBRARY'
          ? omit(context.libraryItemsById, event.libraryItem.id)
          : context.libraryItemsById,
      removeFromIndexedDBActorRef: ({ spawn, event }) =>
        event.type === 'REMOVE_FROM_LIBRARY'
          ? spawn(removeFromIndexedDBActor, {
              input: {
                dbName: 'appStateDB',
                storeName: 'libraryItems',
                id: event.libraryItem.id
              }
            })
          : null
    }),
    cleanupRemoveFromIndexedDBActor: assign({
      removeFromIndexedDBActorRef: () => null
    }),
    updateLibraryItem: assign({
      libraryItemsById: ({ context, event }) =>
        event.type === 'UPDATE_LIBRARY_ITEM'
          ? {
              ...context.libraryItemsById,
              [event.libraryItem.id]: event.libraryItem
            }
          : context.libraryItemsById,
      persistLibraryItemActorRef: ({ spawn, event, context }) =>
        event.type === 'UPDATE_LIBRARY_ITEM'
          ? spawn(persistLibraryItemActor, { input: event.libraryItem })
          : context.persistLibraryItemActorRef
    }),
    updateEditingLibraryItem: assign({
      editingLibraryItem: ({ context, event }) =>
        event.type === 'UPDATE_EDITING_LIBRARY_ITEM' ? event.libraryItem : context.editingLibraryItem
    }),
    setIsLibraryFormOpen: assign({
      isLibraryFormOpen: ({ context, event }) =>
        event.type === 'SET_IS_LIBRARY_FORM_OPEN' ? event.isLibraryFormOpen : context.isLibraryFormOpen
    }),
    cleanupPersistLibraryItemActor: assign({
      persistLibraryItemActorRef: () => null
    }),
    updateEntityShapes: assign({
      entityShapes: ({ context, event }) =>
        event.type === 'UPDATE_ENTITY_SHAPES' ? event.entityShapes : context.entityShapes
    })
  },
  guards: {}
}).createMachine({
  id: 'app',
  initial: 'initializing',
  context: initialContext,
  states: {
    initializing: {
      entry: 'restoreSettings',
      invoke: {
        id: 'loadFromIndexedDb',
        src: 'loadFromIndexedDbActor',
        onDone: { target: 'idle' },
        onError: { target: 'idle' }
      },
      on: {
        INDEXED_DB_DATA_LOADED: {
          actions: 'setIndexedDbData',
          target: 'idle'
        }
      }
    },
    idle: {
      on: {
        SELECT_TAB: {
          actions: 'updateSelectedTab'
        },
        UPDATE_QUERY: {
          actions: 'updateQuery'
        },
        UPDATE_SCHEMA: {
          actions: 'updateSchema'
        },
        UPDATE_DATA: {
          actions: 'updateData'
        },
        UPDATE_SCHEMA_UI: {
          actions: 'updateSchemaUi'
        },
        UPDATE_SETTINGS: {
          actions: ['updateSettings', 'saveSettingsToLocalStorage']
        },
        // todo this isn't being used - could use the evalMachine in from this machine and
        // spawn a child instead to use this approach
        EXECUTE_QUERY: { target: 'executingQuery', actions: 'addToHistory' },
        ADD_QUERY_TO_HISTORY: { actions: 'addToHistory' },
        PERSIST_QUERY_HISTORY_COMPLETE: {
          actions: 'cleanupPersistQueryHistoryActor'
        },
        PERSIST_LIBRARY_ITEM_COMPLETE: {
          actions: 'cleanupPersistLibraryItemActor'
        },
        ADD_TO_LIBRARY: {
          actions: 'addToLibrary'
        },
        REMOVE_FROM_LIBRARY: {
          actions: 'removeFromLibrary'
        },
        UPDATE_LIBRARY_ITEM: {
          actions: 'updateLibraryItem'
        },
        SET_IS_LIBRARY_FORM_OPEN: {
          actions: 'setIsLibraryFormOpen'
        },
        UPDATE_EDITING_LIBRARY_ITEM: {
          actions: 'updateEditingLibraryItem'
        },
        REMOVE_FROM_INDEXED_DB_COMPLETE: {
          actions: 'cleanupRemoveFromIndexedDBActor'
        },
        UPDATE_ENTITY_SHAPES: {
          actions: 'updateEntityShapes'
        }
      }
    },
    executingQuery: {
      invoke: [
        {
          id: 'persistQueryHistoryActor',
          src: 'persistQueryHistoryActor',
          input: ({ context }) => ({ code: context.query, time: Date.now() })
        },
        {
          id: 'executeQuery',
          src: 'executeQuery',
          input: ({ context }) => context.query,
          onDone: {
            target: 'idle',
            actions: 'updateQueryResult'
          },
          onError: {
            target: 'idle',
            actions: 'setQueryError'
          }
        }
      ]
    }
  }
})

// Create an actor to interpret the machine
const appActor = createActor(appMachine).start()

/** Todo this needs to be DeepPartial */
export type HandleSchemaUiChange = (schemaUi: SchemaUiEvent) => void

export const makeAppState = (stateSnapshot: SnapshotFrom<typeof appMachine>) => {
  const { selectedTab, query, schema, data, sidebarItems, schemaUi } = stateSnapshot.context

  const handleTabChange = (path: string) => {
    if (path.startsWith('/')) {
      path = path.slice(1)
    }
    const newTab = sidebarItemsByPath[path]
    if (newTab) {
      appActor.send({ type: 'SELECT_TAB', tab: newTab })
    }
  }

  const handleQueryChange = (newQuery: string) => {
    appActor.send({ type: 'UPDATE_QUERY', query: newQuery })
  }

  const handleSchemaChange = (newSchema: string) => {
    appActor.send({ type: 'UPDATE_SCHEMA', schema: newSchema })
  }

  const handleDataChange = (newData: string) => {
    appActor.send({ type: 'UPDATE_DATA', data: newData })
  }

  const handleSchemaUiChange = (schemaUi: SchemaUiEvent) => {
    console.log('schemaUi in handleSchemaUiChange', schemaUi)
    const updatedFilters = Object.fromEntries(
      Object.entries(schemaUi.filters || {}).filter(([_key, value]) => value !== undefined)
    )
    const mergedSchemaUi = {
      filters: {
        ...appActor.getSnapshot().context.schemaUi.filters,
        ...updatedFilters
      },
      ...(schemaUi.expandedNamespaces && {
        expandedNamespaces: schemaUi.expandedNamespaces
      })
    }
    appActor.send({ type: 'UPDATE_SCHEMA_UI', schemaUi: mergedSchemaUi })
  }

  const executeQuery = (query: string) => {
    appActor.send({ type: 'EXECUTE_QUERY', query })
  }

  return {
    machineState: appActor.getSnapshot(),
    sidebarItems,
    selectedTab,
    query,
    schema,
    schemaUi,
    data,
    handleTabChange,
    handleQueryChange,
    handleSchemaChange,
    handleDataChange,
    executeQuery,
    handleSchemaUiChange
  }
}

export const getAppState = () => {
  return makeAppState(appActor.getSnapshot())
}

////////////////////////////////////////////////////////////////////////////////
// React Hooks
////////////////////////////////////////////////////////////////////////////////

export const useAppState = () => {
  const [state, setState] = React.useState(appActor.getSnapshot())
  const location = useLocation()

  React.useEffect(() => {
    const subscription = appActor.subscribe(setState)
    return () => subscription.unsubscribe()
  }, [])

  React.useEffect(() => {
    const path = location.pathname.slice(1) || 'query'
    const newTab = sidebarItemsByPath[path]
    if (newTab && newTab.path !== state.context.selectedTab.path) {
      appActor.send({ type: 'SELECT_TAB', tab: newTab })
    }
  }, [location, state.context.selectedTab])

  return makeAppState(state)
}

/**
 * hook that fetches the schema from the API
 * @returns
 */
const useSchemaQuery = ({ fetchSchemaUrl }: { fetchSchemaUrl: string }) => {
  return useQuery<SchemaAttribute[]>({
    queryKey: ['schema'],
    queryFn: async () => {
      const response = await fetch(fetchSchemaUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch schema')
      }
      const data = await response.json()
      return data.data as SchemaAttribute[]
    },
    select: (data) => data.map((attr) => ({ ...attr, updatedAt: new Date(attr.updatedAt) }))
  })
}

export const useSchemaViewState = () => {
  const selectSchemaUi = (snapshot: SnapshotFrom<typeof appMachine>) => snapshot.context.schemaUi
  const [state, setState] = React.useState(appActor.getSnapshot())

  const handleSchemaUiChange = (schemaUi: SchemaUiEvent) => {
    const updatedFilters = Object.fromEntries(
      Object.entries(schemaUi.filters || {}).filter(([_key, value]) => value !== undefined)
    )
    const mergedSchemaUi = {
      filters: {
        ...state.context.schemaUi.filters,
        ...updatedFilters
      },
      ...(schemaUi.expandedNamespaces && {
        expandedNamespaces: schemaUi.expandedNamespaces
      })
    }
    appActor.send({ type: 'UPDATE_SCHEMA_UI', schemaUi: mergedSchemaUi })
  }
  const schemaUi = useSelector(appActor, selectSchemaUi)
  const fetchSchemaUrl = state.context.settings.fetchSchemaEndpoint
  const { data: schema, isLoading, error } = useSchemaQuery({ fetchSchemaUrl })

  React.useEffect(() => {
    const subscription = appActor.subscribe(setState)
    return () => subscription.unsubscribe()
  }, [])

  return { schemaUi, handleSchemaUiChange, schema, isLoading, error }
}

export const useSettingsState = () => {
  const selectSettings = (snapshot: SnapshotFrom<typeof appMachine>) => snapshot.context.settings
  const [state, setState] = React.useState(appActor.getSnapshot())

  const handleSettingsChange = (settings: SettingsEvent) => {
    const updatedSettings = {
      ...state.context.settings,
      ...settings
    }
    console.log('updatedSettings', updatedSettings)
    appActor.send({ type: 'UPDATE_SETTINGS', settings: updatedSettings })
  }
  const settings = useSelector(appActor, selectSettings)

  React.useEffect(() => {
    const subscription = appActor.subscribe(setState)
    return () => subscription.unsubscribe()
  }, [])

  return { settings, handleSettingsChange }
}

export const useQueryHistoryState = () => {
  const selectQueryHistory = (snapshot: SnapshotFrom<typeof appMachine>) =>
    [...snapshot.context.queryHistory].sort((a, b) => b.time - a.time)
  const [_, setState] = React.useState(appActor.getSnapshot())

  React.useEffect(() => {
    const subscription = appActor.subscribe(setState)
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmitQuery = (query: string) => {
    appActor.send({ type: 'ADD_QUERY_TO_HISTORY', query, time: Date.now() })
  }
  const queryHistory = useSelector(appActor, selectQueryHistory)

  return { queryHistory, handleSubmitQuery }
}

export const useThemeState = () => {
  const selectTheme = (snapshot: SnapshotFrom<typeof appMachine>) => ({
    theme: snapshot.context.settings.theme,
    themesByName: snapshot.context.themesByName
  })

  const themeState = useSelector(appActor, selectTheme)
  return themeState.themesByName[themeState.theme]
}

export type LibraryState = {
  library: LibraryItem[]
  editingLibraryItem: LibraryItem | null
  isLibraryFormOpen: boolean
  libraryEvents: {
    removeFromLibrary: (libraryItem: LibraryItem) => void
    updateLibraryItem: (libraryItem: LibraryItem) => void
    setIsLibraryFormOpen: (isLibraryFormOpen: boolean) => void
    updateEditingLibraryItem: (libraryItem: LibraryItem | null) => void
  }
}

export const useLibraryState = (): LibraryState => {
  const selectLibraryState = (snapshot: SnapshotFrom<typeof appMachine>) => ({
    library: Object.values(snapshot.context.libraryItemsById),
    editingLibraryItem: snapshot.context.editingLibraryItem,
    isLibraryFormOpen: snapshot.context.isLibraryFormOpen
  })
  const [_, setState] = React.useState(appActor.getSnapshot())

  const libraryEvents = {
    removeFromLibrary: (libraryItem: LibraryItem) => {
      appActor.send({ type: 'REMOVE_FROM_LIBRARY', libraryItem })
    },
    updateLibraryItem: (libraryItem: LibraryItem) => {
      appActor.send({ type: 'UPDATE_LIBRARY_ITEM', libraryItem })
    },
    setIsLibraryFormOpen: (isLibraryFormOpen: boolean) => {
      console.log('setting isLibraryFormOpen', isLibraryFormOpen)
      appActor.send({ type: 'SET_IS_LIBRARY_FORM_OPEN', isLibraryFormOpen })
    },
    updateEditingLibraryItem: (libraryItem: LibraryItem | null) => {
      appActor.send({ type: 'UPDATE_EDITING_LIBRARY_ITEM', libraryItem })
    }
  }
  React.useEffect(() => {
    const subscription = appActor.subscribe(setState)
    return () => subscription.unsubscribe()
  }, [])
  const libraryState = useSelector(appActor, selectLibraryState)
  console.log('useLibraryState', libraryState.library)
  return {
    ...libraryState,
    libraryEvents
  }
}

/**
 * Hook that fetches the entity shapes from the API
 */
const useEntityShapesQuery = ({ fetchEntityShapesUrl }: { fetchEntityShapesUrl: string }) => {
  return useQuery<string>({
    queryKey: ['entityShapes'],
    queryFn: async () => {
      const response = await fetch(fetchEntityShapesUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch entity shapes')
      }
      return await response.json()
    },
    select: (data) => data.data
  })
}

export const useEntitiesState = () => {
  const selectSettings = (snapshot: SnapshotFrom<typeof appMachine>) => snapshot.context.settings

  const settings = useSelector(appActor, selectSettings)
  const {
    data: entityShapes,
    isLoading,
    error
  } = useEntityShapesQuery({ fetchEntityShapesUrl: settings.fetchEntityShapesEndpoint })

  React.useEffect(() => {
    if (entityShapes) {
      appActor.send({ type: 'UPDATE_ENTITY_SHAPES', entityShapes })
    }
  }, [entityShapes])

  return {
    entityShapes,
    isLoading,
    error
  }
}
