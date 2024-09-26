import React, { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { TextField } from '@mui/material'
import CodeMirrorJsView from './CodeMirrorJsView'
import { LibraryItem as LibraryItemType, LibraryState, useThemeState } from '../machines/appStateMachine'

type LibraryItemProps = {
  item: LibraryItemType
  onSelectQuery: (query: string) => void
  libraryState: LibraryState
}

const LibraryItemView: React.FC<LibraryItemProps> = ({ item, onSelectQuery, libraryState }) => {
  const { editingLibraryItem } = libraryState
  const theme = useThemeState().palette.mode
  const { control, handleSubmit, reset } = useForm<LibraryItemType>({
    defaultValues: item
  })
  const isEditing = editingLibraryItem?.id === item.id
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)

  const handleEdit = () => {
    libraryState.libraryEvents.updateEditingLibraryItem(item)
  }

  const handleSave = handleSubmit((data) => {
    libraryState.libraryEvents.updateLibraryItem(data)
    libraryState.libraryEvents.updateEditingLibraryItem(null)
  })

  const handleCancel = () => {
    reset(item)
    libraryState.libraryEvents.updateEditingLibraryItem(null)
  }

  const handleDeleteClick = () => {
    setOpenDeleteDialog(true)
  }

  const handleDeleteConfirm = () => {
    libraryState.libraryEvents.removeFromLibrary(item)
    setOpenDeleteDialog(false)
  }

  const handleDeleteCancel = () => {
    setOpenDeleteDialog(false)
  }

  return (
    <Box key={item.id} display="flex" flexDirection="column" gap={1}>
      {/* <Typography>{item.id}</Typography> */}

      {isEditing ? (
        <form onSubmit={handleSave}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => <TextField label="Name" {...field} fullWidth margin="dense" />}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField label="Description" {...field} fullWidth margin="dense" multiline rows={2} />
            )}
          />
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <CodeMirrorJsView
                code={field.value}
                theme={theme}
                onChange={field.onChange}
                readOnly={false}
                minHeight="50px"
              />
            )}
          />
        </form>
      ) : (
        <>
          <Typography variant="h6">{item.name}</Typography>
          <Typography variant="caption" color="textSecondary">
            Created: {item.createdAt.toLocaleString()}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {item.description}
          </Typography>
          <CodeMirrorJsView code={item.code} readOnly={true} minHeight="50px" theme={theme} />
        </>
      )}
      <Box display="flex" justifyContent="space-between">
        <Button variant="contained" color="primary" onClick={() => onSelectQuery(item.code)} size="small">
          Send to editor
        </Button>
        <Box>
          {isEditing ? (
            <>
              <Button variant="outlined" color="primary" onClick={handleSave} sx={{ mr: 1 }}>
                Save
              </Button>
              <Button variant="outlined" color="secondary" onClick={handleCancel} sx={{ mr: 1 }}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="outlined" color="primary" onClick={handleEdit} sx={{ mr: 1 }}>
              Edit
            </Button>
          )}
          <Button variant="outlined" color="error" onClick={handleDeleteClick}>
            Delete
          </Button>
        </Box>
      </Box>

      <Dialog
        open={openDeleteDialog}
        onClose={handleDeleteCancel}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{'Confirm Deletion'}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete this library item? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default LibraryItemView
