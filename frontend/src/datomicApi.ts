import { z } from 'zod'

type AttrName = string
type Wildcard = '*'
type RecursionLimit = number | '...'

type Keyword = `:${string}`
type QualifiedAttrName = `${string}/${string}` | `:${string}/${string}`
type AsExpr = [QualifiedAttrName, 'as', string]
type LimitExpr = [QualifiedAttrName, 'limit', number]
type DefaultExpr = [QualifiedAttrName, 'default', string]
type AttrOption = AsExpr | LimitExpr | DefaultExpr
type AttrExpr = AttrOption

type MapSpec =
  | {
      [attrName: QualifiedAttrName]: AttrSpec[] | RecursionLimit
    }
  | {
      key: QualifiedAttrName | AttrExpr
      selector: AttrSpec[]
    }

type AttrSpec = AttrName | Wildcard | MapSpec | AttrExpr

type EntityLiteral = string | number | DatomicRef | Keyword | KeywordValue

type DatomicRef = [string, string | number]

type LogicVariable = `?${string}`
// The main pull pattern type
type PullPattern = AttrSpec[]

type PullExpr = {
  pull: PullPattern
  entity: LogicVariable
}
type KeywordValue = {
  type: 'keyword'
  value: string
}

type SymbolValue = {
  type: 'symbol'
  value: string
}

type ComplexValue =
  | {
      type: 'uuid' | 'bigint' | 'bigdec' | 'instant' | 'uri' | 'bytes'
      value: string
    }
  | (KeywordValue | SymbolValue)

type DatalogValueLiteral = string | number | boolean | ComplexValue
type TransactionValue = number | LogicVariable
type WhereIdentifier = QualifiedAttrName | LogicVariable | KeywordValue | SymbolValue

type WhereUnaryPattern = [LogicVariable | EntityLiteral]
type WhereBinaryPattern = [LogicVariable | EntityLiteral, WhereIdentifier]
type WhereTernaryPattern = [LogicVariable | EntityLiteral, WhereIdentifier, DatalogValueLiteral]
type WhereQuaternaryPattern = [LogicVariable | EntityLiteral, WhereIdentifier, DatalogValueLiteral, TransactionValue]
type WhereQuinaryPattern = [
  LogicVariable | EntityLiteral,
  WhereIdentifier,
  DatalogValueLiteral,
  TransactionValue,
  DatalogValueLiteral
]
type FunctionValue = string | WhereIdentifier | DatalogValueLiteral
type LogicVariableOrBlank = LogicVariable | '_'
type RuleUsage = { type: 'rule'; value: [string, ...(LogicVariable | EntityLiteral | DatalogValueLiteral)[]] }

type BindingForm =
  | LogicVariable
  | [LogicVariableOrBlank, ...LogicVariableOrBlank[]]
  | [LogicVariable, '...']
  | [[LogicVariableOrBlank, LogicVariableOrBlank]]
type WherePredicateCall = [[string, ...FunctionValue[]]]
type WhereFunctionCall = [[string, ...FunctionValue[]], BindingForm]
type WhereClausePattern =
  | WhereUnaryPattern
  | WhereBinaryPattern
  | WhereTernaryPattern
  | WhereQuaternaryPattern
  | WhereQuinaryPattern
  | WherePredicateCall
  | WhereFunctionCall
  | RuleUsage

type InputValues = Array<DatalogValueLiteral | EntityLiteral | Array<DatalogValueLiteral>>

type Query = {
  find: Array<string | PullExpr>
  keys: Array<string>
  in: BindingForm[]
  where: Array<WhereClausePattern>
  args: InputValues
}

// Define the Zod schema for the Query type
const QualifiedAttrName = z.string().regex(/^[^/]+\/[^/]+$/) // Matches "string/string" format
const Wildcard = z.literal('*')
const RecursionLimit = z.union([z.number(), z.literal('...')])

const AsExpr = z.tuple([QualifiedAttrName, z.literal('as'), z.string()])
const LimitExpr = z.tuple([QualifiedAttrName, z.literal('limit'), z.number()])
const DefaultExpr = z.tuple([QualifiedAttrName, z.literal('default'), z.string()])
const AttrOption = z.union([AsExpr, LimitExpr, DefaultExpr])
const AttrExpr = AttrOption

// const MapSpecRuntime = z.lazy(() => z.record(QualifiedAttrName, z.union([z.array(AttrSpecRuntime), RecursionLimit])))

// const AttrSpecRuntime = z.lazy(() => z.union([QualifiedAttrName, Wildcard, MapSpecRuntime, AttrExpr]))
// Declare the recursive types using z.lazy
const AttrSpecRuntime: z.ZodType<any> = z.lazy(() => z.union([QualifiedAttrName, Wildcard, MapSpecRuntime, AttrExpr]))

const KeySelectorPair = z.object({
  key: AttrExpr,
  selector: z.array(AttrSpecRuntime)
})

const MapSpecRuntime: z.ZodType<any> = z.lazy(() =>
  z.union([z.record(QualifiedAttrName, z.union([z.array(AttrSpecRuntime), RecursionLimit])), KeySelectorPair])
)

// The main pull pattern type
const PullPattern = z.array(AttrSpecRuntime)
const PullEntity = z.string().regex(/^\?[a-zA-Z0-9]+$/)

const PullExpr = z.object({
  pull: PullPattern,
  entity: PullEntity
})

const WhereTriplePattern = z.tuple([z.string(), QualifiedAttrName, z.string()])
const WhereTuplePattern = z.tuple([z.string(), QualifiedAttrName])
const WhereClausePattern = z.union([WhereTriplePattern, WhereTuplePattern])

const LogicVariableOrBlank = z.union([z.string().regex(/^\?[a-zA-Z0-9]+$/), z.literal('_')])
const BindingForm = z.union([LogicVariableOrBlank, z.array(LogicVariableOrBlank)])

const Query = z.object({
  find: z.array(z.union([z.string(), PullExpr])),
  in: z.array(BindingForm).optional(),
  where: z.array(WhereClausePattern)
})

/** 
// Example usage
const queryObject = {
  find: ['?e', { pull: ['name/as', 'user/name', { 'user/address': ['*'] }], entity: '?e' }],
  where: [['?e', 'user/id']]
}

// Validate the query object
const result = Query.safeParse(queryObject)

if (result.success) {
  console.log('Valid Query:', result.data)
} else {
  console.error('Invalid Query:', result.error.format())
}
*/

export { Query }

function createFindQueryBuilder(patterns: Array<string | PullExpr>) {
  let query: Partial<Query> = { find: patterns }

  return {
    in(...inputs: BindingForm[]) {
      query.in = inputs
      return this
    },

    keys(...inputs: Array<string>) {
      query.keys = inputs
      return this
    },

    where(...patterns: Array<WhereClausePattern>) {
      query.where = query.where ? [...query.where, ...patterns] : patterns
      return this
    },

    build(...inputs: InputValues) {
      if (inputs.length > 0) {
        return { ...query, args: inputs }
      }
      return query
    },

    run(...inputs: InputValues) {
      if (inputs.length > 0) {
        query.args = query.args ? [...query.args, ...inputs] : inputs
      }
      // This is a placeholder for the actual execution logic
      console.log('Executing query:', query)
      return Promise.resolve(query)
    }
  }
}

function createPullQueryBuilder(entity: LogicVariable, pullPattern: PullPattern, isPullMany: boolean) {
  let query: Partial<Query> = {
    find: [{ pull: pullPattern, entity }, ...(isPullMany ? ['...'] : ['.'])]
  }

  return {
    in(...inputs: BindingForm[]) {
      query.in = inputs
      return this
    },

    where(...patterns: Array<WhereClausePattern>) {
      query.where = query.where ? [...query.where, ...patterns] : patterns
      return this
    },

    build(...inputs: InputValues) {
      if (inputs.length > 0) {
        return { ...query, args: inputs }
      }
      return query
    },

    run(...inputs: InputValues) {
      if (inputs.length > 0) {
        query.args = query.args ? [...query.args, ...inputs] : inputs
      }
      // This is a placeholder for the actual execution logic
      console.log('Executing query:', query)
      return Promise.resolve(query)
    }
  }
}

const datomic = {
  find: (...patterns: Array<string | PullExpr>) => createFindQueryBuilder(patterns),
  pullOne: (entity: LogicVariable, pullPattern: PullPattern) => createPullQueryBuilder(entity, pullPattern, false),
  pullMany: (entity: LogicVariable, pullPattern: PullPattern) => createPullQueryBuilder(entity, pullPattern, true),
  uuid: (value: string): ComplexValue => ({ type: 'uuid', value }),
  keyword: (value: string): KeywordValue => ({ type: 'keyword', value }),
  symbol: (value: string): SymbolValue => ({ type: 'symbol', value }),
  bigint: (value: string | number | bigint): ComplexValue => ({ type: 'bigint', value: value.toString() }),
  bigdec: (value: string | number): ComplexValue => ({ type: 'bigdec', value: value.toString() }),
  instant: (value: string | Date): ComplexValue => ({
    type: 'instant',
    value: value instanceof Date ? value.toISOString() : value
  }),
  uri: (value: string): ComplexValue => ({ type: 'uri', value }),
  // This function converts a Uint8Array or number[] to a hexadecimal string representation
  // It's used to represent binary data as a string to send over the wire.
  bytes: (value: Uint8Array | number[]) => ({
    type: 'bytes',
    value: Array.from(value)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }),
  rule: (ruleName: string, ...args: (LogicVariable | EntityLiteral | DatalogValueLiteral)[]): RuleUsage => ({
    type: 'rule',
    value: [ruleName, ...args]
  })
}

// datomic.pullOne('?e', ['*']).where(['?e', 'user/id']).in('$', '?subId').build()
// datomic.pullMany('?e', ['*']).where(['?e', 'user/id']).build()

export { datomic }
