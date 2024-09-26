import { Box, Typography, Button } from '@mui/material'
import CodeMirrorJsView from './CodeMirrorJsView'
import { useThemeState } from '../machines/appStateMachine'

function Documentation({ onSelectQuery }: { onSelectQuery: (query: string) => void }) {
  const theme = useThemeState().palette.mode
  const examples = [
    {
      title: 'Find all artist names',
      query: `return datomic.find("?e", "?name")
      .where(['?e', "artist/name", "?name"])
      .run()`
    },
    {
      title: 'Pull all artists',
      query: `return datomic.pullMany("?e", [['artist/name', 'as', 'name']])
      .where(['?e', "artist/name", "?name"])
      .run()`
    },
    {
      title: 'Pull one artist',
      query: `return datomic.pullOne("?e", [['artist/name', 'as', 'name']])
      .where(['?e', "artist/name", "?name"])
      .run()`
    },
    {
      title: 'Basic Find Query',
      query: `datomic
      .find('?e', '?name')
      .keys('personDbId', 'name')
      .where(['?e', 'user/name', '?name'])
      .build()`
    },
    {
      title: 'Query with Rule',
      query: `datomic.find("?e", "?name").where(datomic.rule("user-rule", "?e", 500, "?userId")).build()`
    },
    {
      title: 'Query with Input',
      query: `datomic.find("?e", "?name").in(["?ids", "..."]).where(["?e", "user/id", "?ids"]).build()`
    },
    {
      title: 'Basic find query',
      query: `const query = datomic
.find('?e', { pull: ['user/name'], entity: '?e' })
.where(['?e', 'user/id'])
.in('$', '?name')
.build()`
    },
    {
      title: 'Pull query with complex value',
      query: `const complexQuery = datomic
.pullOne('?e', ['*'])
.where(['?e', 'user/id', '?userId'])
.in('?userId')
.build(datomic.uuid('9252e453-4439-4681-8baf-3a800f98c739'))`
    },
    {
      title: 'Query with predicate invocation',
      query: `const predicateQuery = datomic
.find('?e', '?name')
.where(['?e', 'user/id', '_', '?tx', true])
.where(['?tx', 'db/txInstant', '?time'])
.where([['<', datomic.inst('2020-01-01'), '?time']])
.where(['?e', 'user/name', '?name'])
.build()`
    },
    {
      title: 'Query with rules',
      query: `const ruleQuery = datomic
.find('?e', '?name')
.where(datomic.rule('user-rule', '?e', 500, '?userId'))
.build()`
    }
  ]
  return (
    <Box display="flex" flexDirection="column" gap={2} mb={2}>
      <Typography variant="h6">Datomic Query Builder API Documentation</Typography>
      <Typography variant="body1">Use the following examples to construct queries in the editor:</Typography>
      {examples.map((example, index) => (
        <Box key={index}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">{example.title}</Typography>
            <Button variant="outlined" size="small" onClick={() => onSelectQuery(example.query)}>
              Send to Editor
            </Button>
          </Box>
          <Box sx={{ backgroundColor: '#f5f5f5', borderRadius: 1, mt: 1 }}>
            <CodeMirrorJsView code={example.query} readOnly={true} minHeight="50px" theme={theme} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export default Documentation
