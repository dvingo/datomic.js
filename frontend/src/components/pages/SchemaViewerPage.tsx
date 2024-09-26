import React, { useState, useCallback, useRef, useEffect, useMemo, memo, Dispatch, SetStateAction } from 'react'

import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import ListItem from '@mui/material/ListItem'
import CodeMirrorClojureView from '../CodeMirrorClojureView'
import ListItemText from '@mui/material/ListItemText'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import LinkIcon from '@mui/icons-material/Link'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Typography, Box, Button, TextField, Checkbox, FormControlLabel } from '@mui/material'
import Fuse from 'fuse.js'
import {
  useThemeState,
  HandleSchemaUiChange,
  AppContext,
  useSchemaViewState,
  SchemaAttribute
} from '../../machines/appStateMachine'

const groupByNamespace = (attributes: SchemaAttribute[]) => {
  return attributes.reduce(
    (acc, attr) => {
      const namespace = attr.namespace
      if (!acc[namespace]) {
        acc[namespace] = []
      }
      acc[namespace].push(attr)
      return acc
    },
    {} as Record<string, SchemaAttribute[]>
  )
}

const Iso8601String = ({ date }: { date: Date }) => {
  const isoString = date.toISOString().split('.')[0] + 'Z'
  const [datePart, timePart] = isoString.split('T')
  return (
    <Box sx={{ display: 'flex', gap: '4px' }}>
      <Typography variant="caption" component="span">
        {datePart}
      </Typography>
      <Typography variant="caption" component="span" color="text.secondary">
        T
      </Typography>
      <Typography variant="caption" component="span">
        {timePart}
      </Typography>
    </Box>
  )
}

function UpdatedAt({ attr }: { attr: SchemaAttribute }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', marginRight: 1 }}>
        Updated:{' '}
      </Typography>
      <Iso8601String date={attr.updatedAt} />
    </Box>
  )
}

function DocAndUpdatedAt({ attr }: { attr: SchemaAttribute }) {
  let doc = attr?.doc
  if (doc) doc = doc.charAt(0).toUpperCase() + doc.slice(1)
  return (
    <>
      {doc}
      <UpdatedAt attr={attr} />
    </>
  )
}

function AttributeName({ attr }: { attr: SchemaAttribute }) {
  const attrName = attr.ident.split('/')[1] || attr.ident
  return (
    <Box sx={{ display: 'flex', gap: 0 }}>
      <Typography variant="body1" color="text.secondary">
        {attr.namespace}
      </Typography>
      <Typography variant="body1">/</Typography>
      <Typography variant="body1" color="primary.main">
        {attrName}
      </Typography>
    </Box>
  )
}

const SchemaAttributeItem = memo(
  ({
    attr,
    onSelect,
    isSelected
  }: {
    attr: SchemaAttribute
    onSelect: (attr: SchemaAttribute) => void
    isSelected: boolean
  }) => {
    const linkTo = `/schema/${encodeURIComponent(attr.ident)}`
    const itemRef = useRef<HTMLLIElement>(null)
    const theme = useThemeState().palette.mode

    useEffect(() => {
      if (isSelected && itemRef.current) {
        const rect = itemRef.current.getBoundingClientRect()
        const isVisible =
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)

        if (!isVisible) {
          itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    }, [isSelected, itemRef.current])

    return (
      <ListItem
        ref={itemRef}
        sx={{
          gap: 4,
          display: 'flex',
          flexDirection: attr.isFunction ? 'column' : 'row',
          backgroundColor: isSelected ? 'action.selected' : 'inherit'
        }}
        alignItems="flex-start"
        onClick={(e) => {
          console.log('onClick', attr)
          e.preventDefault()
          onSelect(attr)
        }}
      >
        {attr.isFunction ? (
          <>
            <Box sx={{ display: 'flex', gap: 4 }}>
              <ListItemAvatar>
                <Typography variant="body2">fn</Typography>
              </ListItemAvatar>
              <ListItemText
                secondaryTypographyProps={{ component: 'div' }}
                primary={
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'baseline' }}>
                    <AttributeName attr={attr} />
                    <Link to={linkTo} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <Box sx={{ padding: '4px', display: 'flex', alignItems: 'flex-start' }}>
                        <LinkIcon sx={{ fontSize: 'small', mr: 0.5, transform: 'rotate(45deg)' }} />
                      </Box>
                    </Link>
                  </Box>
                }
                secondary={<DocAndUpdatedAt attr={attr} />}
              />
            </Box>
            <Box>
              <CodeMirrorClojureView content={attr?.function || ''} theme={theme} />
            </Box>
          </>
        ) : (
          <>
            <ListItemAvatar sx={{ minWidth: 96 }}>
              {attr.isIdent ? (
                <Typography variant="body2">ident</Typography>
              ) : (
                <>
                  <Typography variant="body2">{attr.cardinality}</Typography>
                  <Typography variant="body2">{attr.valueType}</Typography>
                  {attr.isUnique && <Typography variant="body2">{attr.unique}</Typography>}
                  {attr.isComponent && <Typography variant="body2">component</Typography>}
                </>
              )}
            </ListItemAvatar>
            <Box sx={{ flexGrow: 1, display: 'flex' }}>
              <ListItemText
                secondaryTypographyProps={{ component: 'div' }}
                primary={
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'baseline' }}>
                    <AttributeName attr={attr} />
                    <Link to={linkTo} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <Box sx={{ padding: '4px', display: 'flex', alignItems: 'flex-start' }}>
                        <LinkIcon sx={{ fontSize: 'small', mr: 0.5, transform: 'rotate(45deg)' }} />
                      </Box>
                    </Link>
                  </Box>
                }
                secondary={<DocAndUpdatedAt attr={attr} />}
              />
            </Box>
          </>
        )}
      </ListItem>
    )
  }
)

type UseFilteredSchemaProps = {
  schema: SchemaAttribute[]
  searchTerm: string
  showIdent: boolean
  showFn: boolean
  showAttribute: boolean
  onlyShowUnique: boolean
  onlyShowComponents: boolean
}
/**
 * useFilteredSchema is a custom hook that filters the schema based on the search term using Fuse.js
 * @param param0
 * @returns
 */
function useFilteredSchema({
  schema,
  searchTerm,
  showIdent,
  showFn,
  showAttribute,
  onlyShowUnique,
  onlyShowComponents
}: UseFilteredSchemaProps) {
  const fuse = useMemo(() => {
    const options = {
      keys: ['namespace', 'doc', 'ident'],
      threshold: 0.4
    }
    return new Fuse(schema as SchemaAttribute[], options)
  }, [schema])

  const textFilteredSchema = useMemo(() => {
    if (!searchTerm) return schema
    return fuse.search(searchTerm).map((result) => result.item)
  }, [fuse, searchTerm, schema])

  const filteredSchema = useMemo(() => {
    if (!showIdent && !showFn && !showAttribute) return []
    return textFilteredSchema.filter((attr) => {
      const matchesType =
        (showIdent && attr.isIdent) || (showFn && attr.isFunction) || (showAttribute && attr.isAttribute)

      /* Only show unique attributes if the user has selected to show them */
      switch (true) {
        case onlyShowComponents && onlyShowUnique:
          return matchesType && attr.isUnique && attr.isComponent
        case onlyShowUnique:
          return matchesType && attr.isUnique
        case onlyShowComponents:
          return matchesType && attr.isComponent
        default:
          return matchesType
      }
    })
  }, [textFilteredSchema, showIdent, showFn, showAttribute, onlyShowUnique, onlyShowComponents])

  return filteredSchema
}

type SchemaFuzzyFinderProps = {
  schema: SchemaAttribute[]
  isLoading: boolean
  error: Error | null
  schemaUi: AppContext['schemaUi']
  handleSchemaUiChange: HandleSchemaUiChange
  handleExpandedItemsChange: (event: React.SyntheticEvent, itemIds: string[]) => void
  searchTerm: string
  setSearchTerm: Dispatch<SetStateAction<string>>
}

// todo scroll to isn't working because the elements are collapsed by default.
// you will need to make them controlled first and then expand the namespace and then scroll to the element.
const SchemaAttrView = memo(({ namespace, attributes }: { namespace: string; attributes: SchemaAttribute[] }) => {
  const navigate = useNavigate()
  const onSelect = useCallback((attr: SchemaAttribute) => {
    console.log('selected', attr)
    const linkTo = `/schema/${encodeURIComponent(attr.ident)}`
    navigate(linkTo)
  }, [])

  const currentPath = useLocation().pathname
  return (
    <TreeItem itemId={namespace} label={`${namespace} (${attributes.length})`}>
      {attributes.map((item) => {
        const isSelected = currentPath === `/schema/${encodeURIComponent(item.ident)}`
        return <SchemaAttributeItem key={item.ident} attr={item} onSelect={onSelect} isSelected={isSelected} />
      })}
    </TreeItem>
  )
})

type SchemaListViewProps = {
  expandedNamespaces: string[]
  handleExpandedItemsChange: (event: React.SyntheticEvent, itemIds: string[]) => void
  groupedSchema: Record<string, SchemaAttribute[]>
}

function SchemaListView({ expandedNamespaces, handleExpandedItemsChange, groupedSchema }: SchemaListViewProps) {
  return (
    <SimpleTreeView
      expandedItems={expandedNamespaces}
      onExpandedItemsChange={handleExpandedItemsChange}
      sx={{ flexGrow: 1 }}
    >
      {Object.entries(groupedSchema).map(([namespace, attributes]) => (
        <SchemaAttrView key={namespace} namespace={namespace} attributes={attributes} />
      ))}
    </SimpleTreeView>
  )
}

type CheckboxFilterProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

function CheckboxFilter({ checked, onChange, label }: CheckboxFilterProps) {
  return (
    <FormControlLabel
      control={<Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} />}
      label={label}
    />
  )
}

function SchemaFuzzyFinderWithTreeView({
  schema,
  isLoading,
  error,
  schemaUi,
  searchTerm,
  setSearchTerm,
  handleSchemaUiChange,
  handleExpandedItemsChange
}: SchemaFuzzyFinderProps) {
  const functionCount = useMemo(() => schema?.filter((attr) => attr.isFunction).length || 0, [schema])
  const attributeCount = useMemo(() => schema?.filter((attr) => attr.isAttribute).length || 0, [schema])
  const componentCount = useMemo(() => schema?.filter((attr) => attr.isComponent).length || 0, [schema])
  const uniqueCount = useMemo(() => schema?.filter((attr) => attr.isUnique).length || 0, [schema])
  const identCount = useMemo(() => schema?.filter((attr) => attr.isIdent).length || 0, [schema])
  const {
    filters: { showIdent, showFn, showAttribute, onlyShowUnique, onlyShowComponents },
    expandedNamespaces
  } = schemaUi
  const filteredSchema = useFilteredSchema({
    schema,
    searchTerm,
    showIdent,
    showFn,
    showAttribute,
    onlyShowUnique,
    onlyShowComponents
  })
  const groupedSchema = useMemo(() => groupByNamespace(filteredSchema || []), [filteredSchema])

  const theme = useThemeState()

  const handleExpandAll = useCallback(() => {
    handleSchemaUiChange({ expandedNamespaces: Object.keys(groupedSchema) })
  }, [handleSchemaUiChange, groupedSchema])

  const handleCollapseAll = useCallback(() => {
    handleSchemaUiChange({ expandedNamespaces: [] })
  }, [handleSchemaUiChange])

  if (isLoading) return <Typography>Loading schema...</Typography>
  if (error) return <Typography>Error fetching schema: {error.message}</Typography>

  return (
    <Box>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          backgroundColor: theme.palette.background.default,
          paddingTop: 2,
          paddingBottom: 2
        }}
      >
        <TextField
          fullWidth
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search schema..."
          sx={{ mb: 2 }}
        />
        <Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <CheckboxFilter
              checked={showIdent}
              onChange={(checked) => handleSchemaUiChange({ filters: { showIdent: checked } })}
              label={`Show Idents (${identCount})`}
            />
            <CheckboxFilter
              checked={showFn}
              onChange={(checked) => handleSchemaUiChange({ filters: { showFn: checked } })}
              label={`Show Functions (${functionCount})`}
            />
            <CheckboxFilter
              checked={showAttribute}
              onChange={(checked) => handleSchemaUiChange({ filters: { showAttribute: checked } })}
              label={`Show Attributes (${attributeCount})`}
            />
            <CheckboxFilter
              checked={onlyShowUnique}
              onChange={(checked) => handleSchemaUiChange({ filters: { onlyShowUnique: checked } })}
              label={`Only Show Unique (${uniqueCount})`}
            />
            <CheckboxFilter
              checked={onlyShowComponents}
              onChange={(checked) => handleSchemaUiChange({ filters: { onlyShowComponents: checked } })}
              label={`Only Show Components (${componentCount})`}
            />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
          <Typography variant="body1">{Object.keys(groupedSchema).length} Namespaces</Typography>
          <Typography variant="body1">{filteredSchema?.length || 0} Attributes</Typography>
        </Box>
        <Box>
          <Button onClick={handleExpandAll} sx={{ mr: 1 }}>
            Expand all
          </Button>
          <Button onClick={handleCollapseAll}>Collapse all</Button>
        </Box>
      </Box>
      <SchemaListView
        expandedNamespaces={expandedNamespaces}
        handleExpandedItemsChange={handleExpandedItemsChange}
        groupedSchema={groupedSchema}
      />
    </Box>
  )
}

function SchemaViewConnected() {
  const { schema, isLoading, error, schemaUi, handleSchemaUiChange } = useSchemaViewState()
  const [searchTerm, setSearchTerm] = useState('')
  const { attribute } = useParams()
  console.log('attribute', attribute)

  const handleExpandedItemsChange = useCallback(
    (event: React.SyntheticEvent, expandedNamespaces: string[]) => {
      if (event.defaultPrevented) return
      handleSchemaUiChange({ expandedNamespaces })
    },
    [handleSchemaUiChange]
  )

  /* onMount, if an attribute is selected form the URL path, then expand its namespace so it can be scrolled into view,
    so that links will work. */
  useEffect(() => {
    if (attribute) {
      console.log('on mount attribute', attribute)
      const namespace = attribute.split('/')[0]
      if (namespace && !schemaUi.expandedNamespaces.includes(namespace)) {
        console.log('expanding namespace', namespace)
        handleSchemaUiChange({ expandedNamespaces: [...schemaUi.expandedNamespaces, namespace] })
      }
    }
  }, [])

  return (
    <SchemaFuzzyFinderWithTreeView
      schema={schema || []}
      isLoading={isLoading}
      error={error}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      schemaUi={schemaUi}
      handleExpandedItemsChange={handleExpandedItemsChange}
      handleSchemaUiChange={handleSchemaUiChange}
    />
  )
}

export default SchemaViewConnected

/**
 * Todo should add fullText in the left panel.
 * Todo could add  checkbox filters to toggle showing these types.
 * - Ident
 * - Functions
 * - Cardinality one and many
 * - Value Type - one of the following:
 *    - string
 *    - long
 *    - float
 *    - double
 *    - boolean
 *    - date
 *    - uuid
 *    - uri
 *    - email
 */
