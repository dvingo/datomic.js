import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material'
import { LibraryItem } from '../machines/appStateMachine'
import { useForm, Controller } from 'react-hook-form'

interface LibraryItemFormProps {
  open: boolean
  isCreatingNew: boolean
  onClose: () => void
  onSubmit: (item: Omit<LibraryItem, 'id' | 'createdAt' | 'code'>) => void
}

interface FormData {
  name: string
  description: string
}

const LibraryItemForm: React.FC<LibraryItemFormProps> = ({ open, isCreatingNew, onClose, onSubmit }) => {
  const { control, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      name: '',
      description: ''
    }
  })

  const onSubmitForm = (data: FormData) => {
    onSubmit(data)
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{isCreatingNew ? 'Create New Library Item' : 'Edit Library Item'}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmitForm)}>
        <DialogContent>
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Name is required' }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                autoFocus
                margin="dense"
                label="Name"
                type="text"
                fullWidth
                error={!!error}
                helperText={error?.message}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField {...field} margin="dense" label="Description" type="text" fullWidth multiline rows={4} />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default LibraryItemForm
