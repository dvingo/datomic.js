import { describe, it, expect } from 'vitest'
import { datomic, Query } from './datomicApi'

describe('datomicApi', () => {
  describe('Query schema', () => {
    it('should validate a correct query object', () => {
      const validQuery = {
        find: ['?e', { pull: ['user/name', { 'user/address': ['*'] }], entity: '?e' }],
        where: [['?e', 'user/id']]
      }

      const result = Query.safeParse(validQuery)
      expect(result.success).toBe(true)
    })

    it('should reject an invalid query object', () => {
      const invalidQuery = {
        find: ['?e', { pull: ['user/name', { 'user/address': ['*'] }], entity: 123 }], // entity should be a string
        where: [['?e', 'user/id']]
      }

      const result = Query.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })
  })

  describe('datomic query builders', () => {
    it('should build a find query correctly', () => {
      const query = datomic
        .find('?e', { pull: ['user/name'], entity: '?e' })
        .where(['?e', 'user/id'])
        .in('$', '?name')
        .build()

      expect(query).toEqual({
        find: ['?e', { pull: ['user/name'], entity: '?e' }],
        where: [['?e', 'user/id']],
        in: ['$', '?name']
      })
    })

    // const pullExpr: PullPattern = ['*', { 'person/address': ['*'] }, { 'person/orders': ['order/id', 'order/date'] }]

    //     const samplePullExpression: Query = {
    //       find: [
    //         {
    //           entity: '?e',
    //           pull: [{ 'person/address': ['*'] }, ['myAttr/name', 'as', 'X']]
    //         },
    //         '...'
    //       ],
    //       in: ['$', '?name'],
    //       where: [['?e', 'person/name', '?name']]
    //     }
    it('should support passing a ref as an input', () => {
      const query = datomic.find('?userId').in('?e').where(['?e', 'user/id', '?userId']).build(['user/id', '1234'])

      expect(query).toEqual({
        find: ['?userId'],
        where: [['?e', 'user/id', '?userId']],
        in: ['?e'],
        args: [['user/id', '1234']]
      })
    })

    it('should build a pullOne query correctly', () => {
      const query = datomic.pullOne('?e', ['*']).where(['?e', 'user/id']).in('$', '?subId').build()

      expect(query).toEqual({
        find: [{ pull: ['*'], entity: '?e' }, '.'],
        where: [['?e', 'user/id']],
        in: ['$', '?subId']
      })
    })

    it('should create complex values', () => {
      const complexValue = datomic.uuid('9252e453-4439-4681-8baf-3a800f98c739')
      expect(complexValue).toEqual({ type: 'uuid', value: '9252e453-4439-4681-8baf-3a800f98c739' })
    })

    it('should support passing complex value types', () => {
      const query = datomic
        .pullOne('?e', ['*'])
        .where(['?e', 'user/id', '?userId'])
        .in('?userId')
        .build(datomic.uuid('9252e453-4439-4681-8baf-3a800f98c739'))

      expect(query).toEqual({
        find: [{ pull: ['*'], entity: '?e' }, '.'],
        where: [['?e', 'user/id', '?userId']],
        in: ['?userId'],
        args: [{ type: 'uuid', value: '9252e453-4439-4681-8baf-3a800f98c739' }]
      })
    })

    it('should build a pullMany query correctly', () => {
      const query = datomic.pullMany('?e', ['user/name', 'user/email']).where(['?e', 'user/active', true]).build()

      expect(query).toEqual({
        find: [{ pull: ['user/name', 'user/email'], entity: '?e' }, '...'],
        where: [['?e', 'user/active', true]]
      })
    })

    it('should build a where clause with a predicate invocation', () => {
      const query = datomic
        .find('?e', '?name')
        .where(['?e', 'user/id', '_', '?tx', true])
        .where(['?tx', 'db/txInstant', '?time'])
        .where([['<', datomic.instant('2020-01-01'), '?time']], ['?e', 'user/name', '?name'])
        .build()

      expect(query).toEqual({
        find: ['?e', '?name'],
        where: [
          ['?e', 'user/id', '_', '?tx', true],
          ['?tx', 'db/txInstant', '?time'],
          [['<', { type: 'instant', value: '2020-01-01' }, '?time']],
          ['?e', 'user/name', '?name']
        ]
      })
    })

    it('should support keys', () => {
      const query = datomic.find('?e', '?name').keys('person', 'name').build()

      expect(query).toEqual({
        find: ['?e', '?name'],
        keys: ['person', 'name']
      })
    })

    it('should support rules', () => {
      const query = datomic
        .find('?e', '?name')
        .where(datomic.rule('user-rule', '?e', 500, '?userId'))
        .build()

      expect(query).toEqual({
        find: ['?e', '?name'],
        where: [{ type: 'rule', value: ['user-rule', '?e', 500, '?userId'] }]
      })
    })

    it('should support binding forms', () => {
      const query = datomic
        .find('?e', '?name')
        .where(['?e', 'user/id', '_', '?tx', true])
        .where(['?tx', 'db/txInstant', '?time'])
        .where([
          ['some-function', datomic.instant('2020-01-01')],
          ['?time', '_', '?other']
        ])
        .build()

      expect(query).toEqual({
        find: ['?e', '?name'],
        where: [
          ['?e', 'user/id', '_', '?tx', true],
          ['?tx', 'db/txInstant', '?time'],
          [
            ['some-function', { type: 'instant', value: '2020-01-01' }],
            ['?time', '_', '?other']
          ]
        ]
      })

      const query2 = datomic.find('?e', '?name').in(['?ids', '...']).where(['?e', 'user/id', '?ids']).build()

      expect(query2).toEqual({
        find: ['?e', '?name'],
        in: [['?ids', '...']],
        where: [['?e', 'user/id', '?ids']]
      })

      const query3 = datomic
        .find('?e', '?name')
        .in(['?ids', '...'])
        .where(['?e', 'user/id', '?ids'])
        .build(['1234', '2345', '3456'])

      expect(query3).toEqual({
        find: ['?e', '?name'],
        in: [['?ids', '...']],
        where: [['?e', 'user/id', '?ids']],
        args: [['1234', '2345', '3456']]
      })
    })

    it('should build a where clause with a function invocation', () => {
      const query = datomic
        .find('?e', '?name', '?output')
        .where(['?e', 'user/name', '?name'])
        .where([['a-clojure-function', { type: 'instant', value: '2020-01-01' }, '?name'], '?output'])
        .build()

      expect(query).toEqual({
        find: ['?e', '?name', '?output'],
        where: [
          ['?e', 'user/name', '?name'],
          [['a-clojure-function', { type: 'instant', value: '2020-01-01' }, '?name'], '?output']
        ]
      })
    })
  })
})
