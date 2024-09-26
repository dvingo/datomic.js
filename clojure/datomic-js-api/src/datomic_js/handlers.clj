(ns datomic-js.handlers
  (:require [reitit.ring :as ring]
            [reitit.swagger :as swagger]
            [reitit.swagger-ui :as swagger-ui]
            [muuntaja.core :as m]
            [datomic.api :as d]
            [datomic-js.lib.json-query :as lib.json-query]
            [datomic-js.lib.schema :as lib.schema]
            [clojure.java.io :as io]))

(defn options-handler []
  {:summary "Preflight response"
   :responses {200 {:body string?}}
   :handler (fn [_] {:status 200 :body "ok"
                     :headers {"Access-Control-Allow-Origin" "*"
                               "Access-Control-Allow-Methods" "GET, POST, PUT, DELETE, OPTIONS"
                               "Access-Control-Allow-Headers" "Content-Type, Authorization"} })})
                               
(defn routes
  []
  [["/query"
    {:options (options-handler)
     :post {:summary "Proxy datomic query"
            :responses {200 {:body {:data any?}}}
            :handler (fn [{query :body-params
                           db :db
                           :as req}]
                       (lib.json-query/initialize-schema-index! db)
                       (let [query' (lib.json-query/transform-query query)
                             result (lib.json-query/run-query db query')]
                         {:status 200
                          :body {:data result}}))}}] 
   ["/translate-query"
    {:options (options-handler)
     :post {:summary "Translate query from JSON format to Clojure format and return as a formatted string."
            :responses {200 {:body {:data any?}}}
            :handler (fn [{query :body-params
                           db :db
                           :as req}]
                       {:status 200
                        :body {:data (lib.json-query/transform-query-to-pprint-str query)}})}}]

   ["/entity-shapes"
    {:options (options-handler)
     :get {:summary "Get shapes of entities for all unique attributes."
           :responses {200 {:body {:data any?}}}
           :handler (fn [{db :db}]
                      {:status 200
                       :body {:data (lib.schema/get-provided-entities 1000 db)}})}}]

   ["/schema"
    {:options (options-handler)
     :get {:summary "Returns all Datomic attribute schema"
           :responses {200 {:body {:data any?}}}
           :handler (fn [{db :db}]
                      (let [schema (lib.schema/get-datomic-schema db)]
                        {:status 200
                         :body {:data schema}}))}}]])
