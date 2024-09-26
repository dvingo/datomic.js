// This is a temporary solution to inject the builder API into the iframe that executed user code.
// In the future, the TS code can be compiled and packaged as a library that the frontend app can depend on.
function createFindQueryBuilder(patterns) {
  let query = { find: patterns }

  return {
    in(...inputs) {
      query.in = inputs
      return this
    },

    keys(...inputs) {
      query.keys = inputs
      return this
    },

    where(...patterns) {
      query.where = query.where ? [...query.where, ...patterns] : patterns
      return this
    },

    build(...inputs) {
      if (inputs.length > 0) {
        return { ...query, args: inputs }
      }
      return query
    },

    run(...inputs) {
      if (inputs.length > 0) {
        query.args = query.args ? [...query.args, ...inputs] : inputs
      }
      return sendToApi(query)
    }
  }
}

function createPullQueryBuilder(entity, pullPattern, isPullMany) {
  let query = {
    find: [{ pull: pullPattern, entity }, ...(isPullMany ? ['...'] : ['.'])]
  }

  return {
    in(...inputs) {
      query.in = inputs
      return this
    },

    where(...patterns) {
      query.where = query.where ? [...query.where, ...patterns] : patterns
      return this
    },

    build(...inputs) {
      if (inputs.length > 0) {
        return { ...query, args: inputs }
      }
      return query
    },

    run(...inputs) {
      if (inputs.length > 0) {
        query.args = query.args ? [...query.args, ...inputs] : inputs
      }
      return sendToApi(query)
    }
  }
}

const datomic = {
  find: (...patterns) => createFindQueryBuilder(patterns),
  pullOne: (entity, pullPattern) => createPullQueryBuilder(entity, pullPattern, false),
  pullMany: (entity, pullPattern) => createPullQueryBuilder(entity, pullPattern, true),
  uuid: (value) => ({ type: 'uuid', value }),
  keyword: (value) => ({ type: 'keyword', value }),
  symbol: (value) => ({ type: 'symbol', value }),
  bigint: (value) => ({ type: 'bigint', value: value.toString() }),
  bigdec: (value) => ({ type: 'bigdec', value: value.toString() }),
  instant: (value) => ({
    type: 'instant',
    value: value instanceof Date ? value.toISOString() : value
  }),
  uri: (value) => ({ type: 'uri', value }),
  bytes: (value) => ({
    type: 'bytes',
    value: Array.from(value)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }),
  rule: (ruleName, ...args) => ({
    type: 'rule',
    value: [ruleName, ...args]
  })
}

export { datomic, createFindQueryBuilder, createPullQueryBuilder }
