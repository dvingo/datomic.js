# Datomic.js

The goal of this project is to provide a set of tools to help you build a datomic application using javascript/typescript, either in a nodejs environment or in the browser.

The project is made of three parts:

1. A clojure library that takes as input clojure datastructures that are supported by JSON and converts these to valid datomic queries and transactions.
2. A TypeScriprt library with types that describe a JSON version of the Datomic query API, as well as a tiny builder API to help construct valid queries,
   without needing to write the JSON by hand.
3. A frontend application that lets you configure and send queries to the backend, with results rendered in a UI. The application also includes features not
   directly related to the above two parts for exploring the database's schema and the shapes of the entities in the database.

This is still a work in progress and is not yet feature complete.

# Development

## Prerequisites

- NodeJS 20.12.0 or later
- Yarn 1.22.19 or later
- Java 11 or later
- Clojure 1.11.1 or later
- Datomic Pro

## Backend Clojure/Datomic

### Install Datomic

To get a version of the datomic database running with the sample data you have to download the datomic pro version as a zip from:

https://docs.datomic.com/setup/pro-setup.html

unzip the file and then run the following command to start the database

```shell
cd datomic-pro-<version>
./bin/transactor config/samples/dev-transactor-template.properties
```

The included sample queries in the client application match the music brainz database.

To set that up follow the restore instructions on the github page:

https://github.com/Datomic/mbrainz-sample?tab=readme-ov-file#getting-the-data

This will give you some sample data to work with if you don't have a database of your own and want to try the app.

### Clojure Backend

The `clojure` directory contains the backend code for interacting with the datomic database and the API.

There is a sample set of routes that call the library functions which show how you can
use the library in an existing Clojure+Datomic project.

### Frontend

The frontend is a Vite project that can be run with

```shell
cd frontend
yarn
yarn dev
```
