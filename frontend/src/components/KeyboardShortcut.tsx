import React from 'react'
import { Box, Button, Typography } from '@mui/material'

interface KeyboardShortcutProps {
  keys: string[]
  label: string
}

const KeyboardShortcut: React.FC<KeyboardShortcutProps> = ({ keys, label }) => {
  return (
    <Box display="flex" alignItems="center" mb={1} mr={2}>
      {keys.map((key, index) => (
        <Button
          key={index}
          variant="outlined"
          size="small"
          disabled={true}
          sx={{
            minWidth: 'auto',
            padding: '2px 6px 1px 6px',
            marginRight: '2px',
            fontSize: '0.6rem',
            fontWeight: 'bold',
            color: 'text.primary',
            borderColor: 'text.primary',
            backgroundColor: 'background.paper',
            '&.Mui-disabled': {
              color: 'text.primary',
              borderColor: 'grey.800',
              opacity: 1
            }
          }}
        >
          {key}
        </Button>
      ))}
      <Typography variant="body2" sx={{ fontSize: '0.8rem', marginLeft: '4px' }}>
        {label}
      </Typography>
    </Box>
  )
}

export default KeyboardShortcut
