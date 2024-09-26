(ns datomic-js.server
  (:require [aleph.http :as http]
            [reitit.ring :as ring]
            [reitit.core :as reitit]
            [ring.util.codec]
            [ring.middleware.keyword-params :as keyword-params]
            [malli.util :as mu]
            [muuntaja.core :as m]
            [muuntaja.format.json :as json-format]
            [reitit.coercion.spec]
            reitit.coercion.malli
            [reitit.ring.coercion :as ring.coercion]
            [reitit.ring.middleware.muuntaja :as middleware.muuntaja]
            [reitit.ring.middleware.parameters :as middleware.parameters]
            [reitit.ring.middleware.exception :as middleware.exception]
            [ring.middleware.cors :refer [wrap-cors]]
            [datomic-js.handlers :as handlers]
            [datomic.api :as d]))

(defn app
  []
  (ring/ring-handler
   (ring/router
    [["/api/datomic" (handlers/routes)]]
    {:data {:muuntaja m/instance
            :middleware [[wrap-cors
                          :access-control-allow-origin #".*"
                          :access-control-allow-credentials true
                          :access-control-allow-headers ["Content-Type" "Authorization" "Origin" "X-Requested-With" "Accept"]
                          :access-control-allow-methods [:get :post :put :delete :options]]
                         [middleware.parameters/parameters-middleware]
                         [keyword-params/wrap-keyword-params]
                         [middleware.muuntaja/format-middleware]
                         [reitit.ring.middleware.exception/exception-middleware]
                         [ring.coercion/coerce-request-middleware]
                         [ring.coercion/coerce-response-middleware]
                         [ring.coercion/coerce-exceptions-middleware]]}})
   (ring/create-default-handler)))

(defn start-server [port]
  (let [conn (d/connect "datomic:dev://localhost:4334/mbrainz-1968-1973")]
    (http/start-server
     (fn [req]
       (println "Got Request" (:request-method req) (:uri req))
       (let [resp ((app) (assoc req :db (d/db conn)))]
         (println "Got Response" resp)
         resp))
     {:port port})))

(comment 
  (def conn (d/connect "datomic:dev://localhost:4334/mbrainz-1968-1973"))
  ((app) {:uri "/", :request-method :get, :server-port 3001, :db (d/db conn)})

   (.close server_)
   (def server_ (start-server 3001))
 )

(defn -main [& args]
  (let [port (or (some-> args first Integer/parseInt) 3000)]
    (println (str "Server starting on port " port))
    (start-server port)))
