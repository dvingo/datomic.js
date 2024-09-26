import React from 'react'
import { Box, Typography, Paper, List, ListItem, Collapse } from '@mui/material'
import { useEntitiesState, EntityShape } from '../../machines/appStateMachine'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

const isCollectionType = ({ type }: { type: string }) => type === 'vector' || type === 'map'

const EntitiesPage: React.FC = () => {
  const { entityShapes, isLoading, error } = useEntitiesState()
  const [expandedItems, setExpandedItems] = React.useState<{ [key: string]: boolean }>({})

  const toggleExpand = (uniqueAttribute: string) => {
    setExpandedItems((prev) => ({ ...prev, [uniqueAttribute]: !prev[uniqueAttribute] }))
  }

  const renderSchemaItem = (schema: any, indent: number = 0): React.ReactNode => {
    if (!schema) return <Typography variant="body2">No schema available</Typography>

    if (schema.type === 'map') {
      return (
        <Box sx={{ ml: indent }}>
          <Typography variant="subtitle2">map</Typography>
          {Object.entries(schema.keys)
            .sort(([, a], [, b]) => a.order - b.order)
            .map(([key, value]: [string, any]) => {
              return (
                <Box key={key} sx={{ ml: 2 }}>
                  <Typography variant="body2" component="span">
                    <Box
                      component="span"
                      sx={{
                        color: 'primary.main'
                      }}
                    >
                      {key}
                    </Box>
                    : {!isCollectionType(value.value) ? ` ${value.value.type}` : ''}
                  </Typography>
                  {isCollectionType(value.value) && renderSchemaItem(value.value, indent + 2)}
                </Box>
              )
            })}
        </Box>
      )
    } else if (schema.type === 'vector') {
      return (
        <Box sx={{ ml: indent }}>
          <Typography variant="subtitle2">
            Array{'<'}
            {isCollectionType(schema.child) ? renderSchemaItem(schema.child, indent + 2) : schema.child.type}
            {'>'}
          </Typography>
        </Box>
      )
    } else {
      return (
        <Typography variant="body2" sx={{ ml: indent }}>
          {schema.type}
        </Typography>
      )
    }
  }

  if (isLoading) return <Typography variant="body2">Loading...</Typography>
  if (error) return <Typography variant="body2">Error: {error.message}</Typography>

  console.log('entityShapes', entityShapes)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Entity Shapes
      </Typography>
      <Paper
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'background.default'
        }}
      >
        <List sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          {entityShapes?.map((entity: EntityShape) => (
            <ListItem
              key={entity.uniqueAttribute}
              sx={{ flexDirection: 'column', alignItems: 'flex-start', p: 0, mb: 2 }}
            >
              <Box
                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%', p: 1 }}
                onClick={() => toggleExpand(entity.uniqueAttribute)}
              >
                {expandedItems[entity.uniqueAttribute] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                <Typography variant="h6" sx={{ ml: 1 }}>
                  {entity.uniqueAttribute}
                </Typography>
              </Box>
              <Collapse in={expandedItems[entity.uniqueAttribute]} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
                <Box sx={{ ml: 4, mt: 1, mb: 2 }}>{renderSchemaItem(entity.schema)}</Box>
              </Collapse>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  )
}

export default EntitiesPage
