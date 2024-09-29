(ns ts-datomic.lib.json-query-test
  (:require [clojure.test :refer [deftest is are]]
            [datomic.api :as d]
            [ts-datomic.lib.json-query :as sut]))

(comment
  (clojure.test/run-tests)
  (clojure.test/run-test-var (var transform-entity-test))
  (clojure.test/run-test-var (var transform-plain-clause-test))
  )

;; (def db (d/db (d/create-database "datomic:mem://test")))

(deftest transform-var-test
  (are [in out] (= (sut/transform-var in) out)
    ":hi" :hi
    "hi" :hi
    ":abcd/hi" :abcd/hi
    "abcd/hi" :abcd/hi
    "_" '_
    "?_" '?_
    "?hi" '?hi))

(deftest transform-operation-test
  (are [in out] (= (sut/transform-operation in) out)
    "_" '_
    "?_" '?_
    "?added" '?added
    "true" true
    true true
    "false" false
    false false))

(deftest transform-entity-test
  (are [in out] (= (sut/transform-entity in) out)
    [":a/unique-attr" "some value"]
    [:a/unique-attr "some value"],
    [":a/unique-attr" {:type "uuid" :value "11d25f58-ea3d-48db-ab00-78c037f0a35c"}]
    [:a/unique-attr #uuid "11d25f58-ea3d-48db-ab00-78c037f0a35c"],
    1234143 1234143,
    :a/entity-ident :a/entity-ident
    ":a/entity-ident" :a/entity-ident
    "a/entity-ident" :a/entity-ident
    "?abcd" '?abcd))

(deftest transform-plain-clause-test
  (with-redefs [sut/attr-type (fn [attr] ({:user/id :db.type/uuid} attr))]
    (are [in out] (= (sut/transform-plain-clause in) out)
      ["?e" "user/id" "_"]
      ['?e :user/id '_],
      ["?e" ":user/id" "f9967a39-bf26-43b7-b5c9-7b432938f3e9"]
      ['?e :user/id #uuid"f9967a39-bf26-43b7-b5c9-7b432938f3e9"],
      ["?e" "user/id" "f9967a39-bf26-43b7-b5c9-7b432938f3e9"]
      ['?e :user/id #uuid "f9967a39-bf26-43b7-b5c9-7b432938f3e9"],
      ["?e" "user/id" "_" "_"]
      ['?e :user/id '_ '_],
      ["?e" "?user" "_" "_"]
      '[?e ?user _ _])))

(comment
  (clojure.test/run-test-var (var query-transform-test1))

  (clojure.test/run-test-var (var transform-plain-clause-test))
  )

(deftest query-transform-test1
  (are [input output] (= (sut/transform-query input) output)
    {:find [{:pull ["user/given-name"
                    ["user/id" "as" "userId"]
                    {:selector ["*"], :key ["user/points" "as" "points"]}],
             :entity "?e"} "..."],
     :where [["?e" "user/id"]]}
    '{:find [[(pull ?e [:user/given-name [:user/id :as :userId] {[:user/points :as :points] [*]}]) ...]],
      :in [$]
      :where [[?e :user/id]]}

    {:find ["?e" "?name"],
     :where [["?e" "user/id" "_" "?tx" true]
             ["?tx" "db/txInstant" "?time"]
             [["<" {:value "2020-01-01", :type "instant"} "?time"]]
             ["?e" "user/name" "?name"]]}
    '{:find [?e ?name]
      :in [$]
      :where [[?e :user/id _ ?tx true]
              [?tx :db/txInstant ?time]
              [(< #inst "2020-01-01" ?time)]
              [?e :user/name ?name]]}
      {:find ["?e" "?name", "?street"],
       :in ["?e" "?name"],
       :where [["?e" "user/name" "?name"]
               ["?e" "user/street" "?street"] ]}
      '{:find [?e ?name ?street],
        :in [$ ?e ?name],
        :where [[?e :user/name ?name]
                [?e :user/street ?street]]}))

(comment (sut/transform-query
    {:find ["?e" "?name", "?street"],
     :in ["?e" "?name"],
     :where [["?e" "user/name" "?name"]
             ["?e" "user/street" "?street"]
             ]})
             )

(deftest transform-rule-invocation-test 
  (are [in out] (= (sut/transform-rule-invocation in) out)
    {:type "rule" :value ["user-rule" "?e" 500 "?userId"]}
    '(user-rule ?e 500 ?userId)
    {:type "rule" :value ["user-rule" "?e" true "?userId"]}
    '(user-rule ?e true ?userId)
    {:type "rule" :value ["user-rule" "?e" {:type "bigint" :value "500"} "?userId"]}
    '(user-rule ?e 500N ?userId))

  (are [in out] (= (sut/transform-query in) out)
    {:find ["?e" "?name"],
     :where [{:value ["user-rule" "?e" 500 "?userId"],
              :type "rule"}]}
    '{:find [?e ?name]
      :in [$]
      :where [(user-rule ?e 500 ?userId)]}))

(deftest transform-function-invocation-test
  (are [in out] (= (sut/transform-function-invocation in) out)
    [["some-function" {:value "2020-01-01", :type "instant"} "?time"] "?output"]
    '[(some-function #inst "2020-01-01" ?time) ?output]))

(comment

(sut/transform-function-invocation
    [["some-function" {:value "2020-01-01", :type "instant"} "?time"] "?output"])
(sut/transform-query
{:find ["?e" "?name"],
     :where [{:value ["user-rule" "?e" 500 "?userId"],
              :type "rule"}]}
)

  (clojure.test/run-tests)
  (clojure.test/run-test-var (var transform-rule-invocation-test))
  (clojure.test/run-test-var (var transform-entity-test))
  (clojure.test/run-test-var (var transform-plain-clause-test))
  (clojure.test/run-test-var (var transform-function-invocation-test))
  (sut/transform-query
    {:find ["?e" "?name"],
     :where [["?e" "user/id" "_" "?tx" true]
             ["?tx" "db/txInstant" "?time"]
             [["<" {:value "2020-01-01", :type "instant"} "?time"]]
             ["?e" "user/name" "?name"]]}
    )

  )
(comment
  (transform-where-clause
    [["<" {:value "2020-01-01", :type "instant"} "?time"]]
    )
  (transform-find ["?e" "?name"])
  (transform-query
    {:find ["?e" "?name"],
     :where [["?e" "user/id" "_" "?tx" true]
             ["?tx" "db/txInstant" "?time"]
             [["<" {:value "2020-01-01", :type "instant"} "?time"]]
             ["?e" "user/name" "?name"]]}))