import React, { useState, useMemo } from 'react'
import { Box, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { LibraryState } from '../machines/appStateMachine'
import LibraryItemView from './LibraryItemView'
import Fuse from 'fuse.js'

type SortOption = 'nameAsc' | 'nameDesc' | 'dateAsc' | 'dateDesc'

interface LibraryViewProps {
  libraryState: LibraryState
  onSelectQuery: (query: string) => void
}

function LibraryView({ libraryState, onSelectQuery }: LibraryViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('dateDesc')

  const fuse = useMemo(
    () =>
      new Fuse(libraryState.library, {
        keys: ['name', 'description'],
        threshold: 0.4
      }),
    [libraryState.library]
  )

  const filteredAndSortedLibrary = useMemo(() => {
    let result = searchTerm ? fuse.search(searchTerm).map((item) => item.item) : libraryState.library

    return result.sort((a, b) => {
      switch (sortOption) {
        case 'nameAsc':
          return a.name.localeCompare(b.name)
        case 'nameDesc':
          return b.name.localeCompare(a.name)
        case 'dateAsc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'dateDesc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })
  }, [libraryState.library, searchTerm, sortOption, fuse])

  const handleSortChange = (_event: React.MouseEvent<HTMLElement>, newSortOption: SortOption) => {
    if (newSortOption !== null) {
      setSortOption(newSortOption)
    }
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <TextField
        fullWidth
        variant="outlined"
        label="Search library"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <ToggleButtonGroup
        size="small"
        value={sortOption}
        exclusive
        onChange={handleSortChange}
        aria-label="sort options"
      >
        <ToggleButton value="nameAsc" aria-label="sort by name ascending">
          Name ↑
        </ToggleButton>
        <ToggleButton value="nameDesc" aria-label="sort by name descending">
          Name ↓
        </ToggleButton>
        <ToggleButton value="dateAsc" aria-label="sort by date ascending">
          Date ↑
        </ToggleButton>
        <ToggleButton value="dateDesc" aria-label="sort by date descending">
          Date ↓
        </ToggleButton>
      </ToggleButtonGroup>
      {filteredAndSortedLibrary.length === 0 ? (
        <Typography>No items found</Typography>
      ) : (
        filteredAndSortedLibrary.map((item) => (
          <LibraryItemView key={item.id} item={item} onSelectQuery={onSelectQuery} libraryState={libraryState} />
        ))
      )}
    </Box>
  )
}

export default LibraryView
