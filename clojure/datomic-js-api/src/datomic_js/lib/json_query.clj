(ns datomic-js.lib.json-query
  "JSON query format transformation to Clojure data format.
   Support for using Datomic using only JSON to make the database available to non-Clojure clients."
  (:require
    [clojure.pprint :refer [pprint]]
    [datomic.api :as d]
    [clojure.instant :as clj.instant]
    [clojure.string :as str]))

(defn pprint-str [v] (with-out-str (pprint v)))

(defonce schema-attributes_ (atom {}))
(defn attr-type [attr] (get @schema-attributes_ attr))

(defn get-attributes-that-have-values
  "Used to build mapping of attributes to their value type."
  [db]
  (d/q '[:find ?ident ?type
         :where
         [?e :db/ident ?ident]
         [?e :db/valueType ?type-e]
         [?type-e :db/ident ?type]]
    db))

(defn index-schema-attributes
  "Creates a hashmap of attribute ident to its db/valueType"
  [db]
  (into {} (get-attributes-that-have-values db)))

;; Initialize schema index only if it hasn't been initialized yet
(let [initialized (atom false)]
  (defn initialize-schema-index! [db]
    (when-not @initialized
      (println "Initializing schema index")
      (reset! schema-attributes_ (index-schema-attributes db))
      (reset! initialized true))))

(comment (index-schema-attributes db'))

(comment (get-attributes-that-have-values db'))

(defn logic-var? [value]
  (and (string? value)
    (or (= "_" value) (str/starts-with? value "?"))))

(defn transform-binding [value]
  (if (logic-var? value) (symbol value) value))

(defn str->keyword [v]
  (if (str/starts-with? v ":")
    (keyword (subs v 1))
    (keyword v)))

(defn transform-var [value]
  (if (logic-var? value)
    (symbol value)
    (str->keyword value)))

(defn complex-value? [value]
  (and (map? value) (contains? value :value) (contains? value :type)))

(defn string->datomic-attr-type [value-type value]
  (case value-type
    ("uuid" :uuid :db.type/uuid) (java.util.UUID/fromString value)
    ("instant" :instant :db.type/instant) (clj.instant/read-instant-date value)
    ("keyword" :keyword :db.type/keyword) (keyword value)
    ("symbol" :symbol :db.type/symbol) (symbol value)
    ("bigint" :bigint :db.type/bigint) (bigint value)
    ("bigdec" :bigdec :db.type/bigdec) (bigdec value)
    value))

(comment
  (string->datomic-attr-type (attr-type :artist/name) "f9967a39-xxx6"))

(defn parse-complex-value [v]
  (string->datomic-attr-type (:type v) (:value v)))

(defn transform-value-for-attr
  [attr-ident value]
  (cond
    (logic-var? value) (symbol value)
    (keyword? attr-ident) (string->datomic-attr-type (attr-type attr-ident) value)
    (str/starts-with? value ":") (keyword (subs value 1))
    (complex-value? value) (parse-complex-value value)
    :else value))

(defn transform-transaction [tx]
  (cond
    (logic-var? tx) (symbol tx)
    :else tx))

(defn transform-operation [operation]
  (cond
    (logic-var? operation) (symbol operation)
    (= "true" operation) true
    (= "false" operation) false
    :else operation))

(defn datomic-ref? [value]
  (and
    (vector? value)
    (= 2 (count value))
    (qualified-keyword? (first value))))

(defn datomic-ref-json? [value]
  (and
    (vector? value)
    (= 2 (count value))
    (or
      (string? (first value))
      (qualified-keyword? (first value)))))

(defn transform-pull-item [item]
  (cond
    (= item "*") (symbol item)
    (string? item) (keyword item)

    (and (map? item) (= 2 (count item)) (contains? item :key) (contains? item :selector))
    {(mapv transform-pull-item (:key item)) (mapv transform-pull-item (:selector item))}

    (map? item) (let [[k v] (first item)] {k (mapv transform-pull-item v)})
    (vector? item) (mapv transform-pull-item item)
    :else (throw (ex-info "unknown pull type: " item {:item item}))))

(defn transform-pull [{:keys [pull entity]}]
  (list 'pull (symbol entity)
    (mapv transform-pull-item pull)))

(defn transform-function-arg-value [arg]
  (cond
    (complex-value? arg) (parse-complex-value arg)
    (logic-var? arg) (symbol arg)
    (str/starts-with? arg ":") (keyword (subs arg 1))
    :else arg))

(defn transform-function-invocation
  [[[fn-op & args] & bindings]]
  (into [(list* (symbol fn-op) (mapv transform-function-arg-value args))]
    (mapv transform-binding bindings)))

(defn transform-predicate-invocation
  [[[fn-op & args]]]
   [(list* (symbol fn-op) (mapv transform-function-arg-value args))])

(defn transform-rule-invocation [{:keys [value]}]
  (let[[rule-name & args] value]
    (list* (symbol rule-name) (mapv transform-function-arg-value args))))

(defn transform-entity [value]
  (cond
    (datomic-ref-json? value)
    (let [[k v] value]
      [(if (string? k) (str->keyword k) k)
       (if (complex-value? v) (string->datomic-attr-type (:type v) (:value v)) v)])
    (number? value) value
    (logic-var? value) (symbol value)
    (keyword? value) value
    :else (str->keyword value)))

(defn rule-clause? [clause]
  (and
    (map? clause)
    (contains? clause :value)
    (contains? clause :type)
    (= "rule" (:type clause))))

(defn transform-plain-clause [clause]
  (let [[entity attr value transaction operation] clause
        entity' (transform-entity entity)
        attr' (transform-var attr)
        value' (transform-value-for-attr attr' value)
        transaction' (transform-transaction transaction)
        operation' (transform-operation operation)]
    (cond-> [entity']
      attr' (conj attr')
      value' (conj value')
      transaction' (conj transaction')
      operation' (conj operation'))))

(defn plain-clause? [clause]
  (and (vector? clause) (str/starts-with? (first clause) "?")))

(defn predicate-clause? [clause]
  (and (vector? clause) (vector? (first clause))
    (= 1 (count clause))))

(defn function-clause? [clause]
  (and (vector? clause) (vector? (first clause))
    (< 1 (count clause))))

(defn transform-where-clause
  [clause]
  (cond
    (plain-clause? clause) (transform-plain-clause clause)
    (predicate-clause? clause) (transform-predicate-invocation clause)
    (function-clause? clause) (transform-function-invocation clause)
    (rule-clause? clause) (transform-rule-invocation clause)
    :else clause))

(defn transform-where [clauses]
  (mapv transform-where-clause clauses))

(defn transform-find [find]
  (let [out
        (mapv #(cond
                 (and (map? %) (:pull %)) (transform-pull %)
                 (= "..." %) '...
                 :else (symbol %)) find)]
    (if (< 0 (.indexOf out '...))
      [out]
      out)))

(defn transform-in [in]
  (into ['$] (mapv symbol in)))

;; todo - a version that supports different db values
(defn transform-args [args]
  (mapv #(cond-> % (complex-value? %) parse-complex-value) args))

(defn transform-query [{:keys [find in where]}]
  (let [find' (transform-find find)
        in' (transform-in in)
        where' (transform-where where)
        args' (transform-args args)]
    {:find find' :in in' :where where' :args args'}))

(defn transform-query-to-pprint-str [query]
  (-> query transform-query pprint-str))

(defn run-query [query args]
  (d/query {:query query :args args}))
