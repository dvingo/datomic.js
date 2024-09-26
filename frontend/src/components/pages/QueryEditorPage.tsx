import { Box, Typography, Tabs, Tab } from '@mui/material'
import KeyboardShortcut from '../KeyboardShortcut'
import Button from '@mui/material/Button'
import { useEvalCodeState } from '../../machines/evalCodeMachine'
import CodeMirrorJsView from '../CodeMirrorJsView'
import { useSettingsState, useQueryHistoryState, useLibraryState, LibraryState } from '../../machines/appStateMachine'
import LibraryView from '../LibraryView'
import LibraryItemForm from '../LibraryItemForm'
import { useThemeState } from '../../machines/appStateMachine'
import ReactJson from '@microlink/react-json-view'
import { isPlainObject, isArray } from 'lodash'
import { Paper } from '@mui/material'
import { useNavigate, useLocation, useResolvedPath } from 'react-router-dom'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import Documentation from '../QueryDocumentation'

function TabPanel(props: { children?: React.ReactNode; value: number; index: number }) {
  const { children, value, index } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
    >
      {value === index && <Box sx={{ pr: 2, pt: 2 }}>{children}</Box>}
    </div>
  )
}

// todo: pass in find spec to render the columns header names for table output

function ResultView({ result }: { result: any }) {
  console.log('result', result)
  const renderContent = () => {
    switch (true) {
      case isPlainObject(result) && Array.isArray(result.data) && Array.isArray(result.data[0]): {
        // Table rendering logic using Material-UI DataGrid
        const columns: GridColDef[] = result.data[0].map((_header: string, index: number) => ({
          field: `col${index}`,
          headerName: `Column ${index}`,
          flex: 1
        }))
        const rows = result.data.slice(1).map((row: any[], index: number) => ({
          id: index,
          ...row.reduce((acc, cell, i) => ({ ...acc, [`col${i}`]: cell }), {})
        }))
        return (
          <div style={{ height: 400, width: '100%' }}>
            <DataGrid
              rows={rows}
              columns={columns}
              initialState={{
                pagination: { paginationModel: { pageSize: 5 } }
              }}
              pageSizeOptions={[5]}
              disableRowSelectionOnClick
            />
          </div>
        )
      }
      case isPlainObject(result) || isArray(result):
        return (
          <Box
            sx={{
              height: '100%',
              overflow: 'auto',
              '& .object-content': {
                backgroundColor: 'rgb(239, 255, 255)'
              }
            }}
          >
            <ReactJson theme="apathy:inverted" src={result} style={{ height: '100%' }} />
          </Box>
        )
      default:
        return <pre>{result}</pre>
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" sx={{ p: 1 }}>
        Output:
      </Typography>
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>{renderContent()}</Box>
    </Box>
  )
}

function ErrorView({ error }: { error: { message: string; stack: string } }) {
  return (
    <Paper elevation={3} sx={{ p: 2, mt: 2, bgcolor: 'error.main' }}>
      <Typography color="error.contrastText">ERROR: {error.message}</Typography>
      {error.stack && (
        <Typography color="error.contrastText" sx={{ mt: 1, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          {error.stack}
        </Typography>
      )}
    </Paper>
  )
}

function QueryTabs({
  tabValue,
  handleTabChange,
  onSelectQuery,
  libraryState,
  queryHistory,
  theme
}: {
  tabValue: number
  handleTabChange: (event: React.SyntheticEvent, newValue: number) => void
  onSelectQuery: (query: string) => void
  queryHistory: { code: string; time: number }[]
  libraryState: LibraryState
  theme: 'light' | 'dark'
}) {
  return (
    <Box overflow="auto">
      <Tabs value={tabValue} onChange={handleTabChange}>
        <Tab label="History" />
        <Tab label="Docs" />
        <Tab label="Library" />
      </Tabs>
      <TabPanel value={tabValue} index={0}>
        {queryHistory.map((query, index) => (
          <Box key={index}>
            <Typography>{new Date(query.time).toLocaleString()}</Typography>
            <CodeMirrorJsView code={query.code} theme={theme} readOnly={true} minHeight="50px" />
            <Button onClick={() => onSelectQuery(query.code)}>Send to editor</Button>
          </Box>
        ))}
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <Documentation onSelectQuery={onSelectQuery} />
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        <LibraryView libraryState={libraryState} onSelectQuery={onSelectQuery} />
      </TabPanel>
    </Box>
  )
}

function QueryEditorPage() {
  const { settings } = useSettingsState()
  const { submitQueryEndpoint } = settings
  const { queryHistory, handleSubmitQuery } = useQueryHistoryState()
  const libraryState = useLibraryState()
  const { libraryEvents, editingLibraryItem, isLibraryFormOpen } = libraryState
  const theme = useThemeState().palette.mode
  const { code, handleCodeChange, handleEvalCode, error, result } = useEvalCodeState({ apiUrl: submitQueryEndpoint })
  const handleEval = () => {
    handleSubmitQuery(code)
    handleEvalCode()
  }
  const modifier = /Mac/.test(navigator.userAgent) ? 'Cmd' : 'Ctrl'
  const navigate = useNavigate()
  const tabIndexToPath = [
    useResolvedPath('').pathname,
    useResolvedPath('docs').pathname,
    useResolvedPath('library').pathname
  ]
  const location = useLocation()
  const tabValue = tabIndexToPath.indexOf(location.pathname)

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    navigate(tabIndexToPath[newValue])
  }

  return (
    <Box
      display="grid"
      gridTemplateColumns="1fr 1fr"
      gridTemplateRows="auto 1fr"
      gap={2}
      sx={{
        height: 'calc(100vh - 8px)',
        overflow: 'hidden',
        pb: 0.5
      }}
    >
      <Box gridColumn="1" display="flex" flexDirection="column" overflow="hidden">
        <Box>
          <Box display="flex" flexDirection="row" gap={0}>
            <KeyboardShortcut keys={['Ctrl', 'Space']} label="Trigger autocomplete" />
            <KeyboardShortcut keys={[modifier, 'Enter']} label="Submit code" />
          </Box>
        </Box>

        <Box flexGrow={1} display="flex" flexDirection="column" overflow="hidden">
          <Box sx={{ maxHeight: '50%', minHeight: '100px', overflow: 'auto' }}>
            <CodeMirrorJsView code={code} theme={theme} onChange={handleCodeChange} onSubmit={handleEval} />
          </Box>
          <Box mt={2} display="flex" justifyContent="space-between" flexDirection="row" gap={2}>
            <Button variant="contained" onClick={handleEval} sx={{ mt: 2, mb: 2 }}>
              Eval
            </Button>
            <Button variant="outlined" onClick={() => libraryEvents.setIsLibraryFormOpen(true)} sx={{ mt: 2, mb: 2 }}>
              Save to Library
            </Button>
          </Box>
          <pre>{JSON.stringify(editingLibraryItem, null, 2)}</pre>

          <LibraryItemForm
            open={isLibraryFormOpen}
            isCreatingNew={!editingLibraryItem?.id}
            onClose={() => libraryEvents.setIsLibraryFormOpen(false)}
            onSubmit={(item) => {
              libraryEvents.updateLibraryItem({
                ...item,
                code,
                id: editingLibraryItem?.id || crypto.randomUUID(),
                createdAt: new Date()
              })
            }}
          />
          <Box flexGrow={1} overflow="auto">
            {error && <ErrorView error={error} />}
            {result && <ResultView result={result} />}
          </Box>
        </Box>
      </Box>

      <Box gridColumn="2" overflow="auto">
        <QueryTabs
          tabValue={tabValue}
          handleTabChange={handleTabChange}
          onSelectQuery={handleCodeChange}
          queryHistory={queryHistory}
          libraryState={libraryState}
          theme={theme}
        />
      </Box>
    </Box>
  )
}

export default QueryEditorPage
