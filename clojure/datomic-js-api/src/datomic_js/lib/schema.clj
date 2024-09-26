(ns datomic-js.lib.schema
  (:require
   [clojure.pprint :refer [pprint]]
   [clojure.set :as set]
   [clojure.string :as str]
   [datomic.api :as d]
   [malli.provider]))

(defn pprint-str [v] (with-out-str (pprint v)))

(defn all-db-entities-with-idents [db]
  (d/qseq {:query '[:find ?time (pull ?schema-entity [*
                                                      {:db/valueType [*]}
                                                      {:db/cardinality [*]}
                                                      {:db/unique [*]}])
                    :where
                    [?schema-entity :db/ident _ ?tx true]
                    [?tx :db/txInstant ?time]]
           :args [db]}))

(defn make-function-str [attr-ident {:keys [imports requires params code]}]
  (str
   (when (seq imports) (str "(import " (str/join "\n    " imports) ")\n"))
   (when (seq requires) (str "(require \n    " (str/join "\n    " requires) ")\n\n"))
   "(fn " (name attr-ident) " " params "\n  "
   (-> code read-string pprint-str str/trim-newline) ")\n"))

(defn cleanup-attr [[last-tx-time attr]]
  (let [attribute? (boolean (:db/valueType attr))
        function? (boolean (:db/fn attr))
        unique? (boolean (:db/unique attr))
        component? (boolean (:db/isComponent attr))
        ident? (and (not function?) (not attribute?))
        lift-ident (fn [item k] (cond-> item (k item) (update k :db/ident)))]
    (-> attr
        (dissoc :db/id :db/isComponent)
        (assoc :namespace (or (and (:db/ident attr) (namespace (:db/ident attr))) "N/A")
               :updatedAt last-tx-time
               :isAttribute attribute?
               :isUnique unique?
               :isComponent component?
               :isFunction function?
               :isIdent ident?)
        (lift-ident :db/valueType)
        (lift-ident :db/cardinality)
        (lift-ident :db/unique)
        (set/rename-keys {:db/ident :ident
                          :db/valueType :valueType
                          :db/cardinality :cardinality
                          :db/unique :unique
                          :db/doc :doc})
        (cond-> (:db/cardinality attr) (update :cardinality name)
                (:db/fn attr) (-> (assoc :function (make-function-str (:db/ident attr) (:db/fn attr)))
                                  (dissoc :db/fn))
                (:db/unique attr) (update :unique (fn [kw] (str (str/replace (namespace kw) "db." "") "/" (name kw))))
                (:db/valueType attr) (update :valueType name))
        (into (sorted-map)))))

(defn get-datomic-schema [db]
  (->>
   (all-db-entities-with-idents db)
   (map cleanup-attr)
    ;; meta-schema/attributes in datomic
   (remove (comp #{"db"
                   "db.part"
                   "db.sys"
                   "db.alter"
                   "db.schema"
                   "db.boostrap"
                   "db.cardinality"
                   "db.excise"
                   "db.install"
                   "db.type"
                   "db.unique"
                   "fressian"}
                 :namespace))
   (sort-by (juxt :namespace :ident))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Malli Provider to determine entity shapes.
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

 (defn get-unique-attrs [db]
  (sort (map :db/ident
          (filter :db/unique (get-full-datomic-schema db)))))

(def provider (malli.provider/provider))

(defn provide-entity [limit db ident]
  (provider
    (mapv (fn [{:keys [e]}] (d/pull db '[*] e))
      (take limit (d/datoms db :aevt ident)))))

(let [provided-entities_ (atom nil)]
  (defn get-provided-entities
    [limit db]
    (if @provided-entities_
      @provided-entities_
      (let [provided-schemas
            (mapv (fn [ident]
                    (let [schema (provide-entity limit db ident)]
                      {:uniqueAttribute ident
                       :schema (when-not (= schema :any)
                                 (malli/ast schema))}))
              (get-unique-attrs db))]
        (reset! provided-entities_ provided-schemas)))))


(comment
  (all-db-entities-with-idents db')

  (->>
   (all-db-entities-with-idents db')
   (remove :db/fn))

  (get-datomic-schema db')

  (->>
   (get-datomic-schema db')
   (filter :isFunction))
  )

