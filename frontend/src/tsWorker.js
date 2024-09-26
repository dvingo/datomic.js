// This isn't working yet, but the goal is to get typescript support in codemirror.

// import * as ts from 'typescript'
// import * as Comlink from 'comlink'

// const worker = {
//   async initialize() {
//     const compilerOptions: ts.CompilerOptions = {
//       target: ts.ScriptTarget.ES2015,
//       module: ts.ModuleKind.CommonJS,
//       strict: true
//     }

//     const host = ts.createCompilerHost(compilerOptions)
//     const service = ts.createLanguageService(host)

//     return {
//       getCompletions: (fileName: string, position: number, content: string) => {
//         host.getSourceFile = (name) =>
//           name === fileName ? ts.createSourceFile(name, content, compilerOptions.target!) : undefined

//         const completions = service.getCompletionsAtPosition(fileName, position, undefined)
//         return completions?.entries.map((entry) => ({
//           label: entry.name,
//           type: entry.kind
//         }))
//       }
//     }
//   }
// }

// Comlink.expose(worker)

import * as ts from 'typescript'
import * as Comlink from 'comlink'

const worker = {
  async initialize() {
    const compilerOptions = {
      target: ts.ScriptTarget.ES2015,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      lib: ['lib.es2015.d.ts', 'lib.dom.d.ts', 'datomicApi.ts']
    }

    // const host = ts.createCompilerHost(compilerOptions)
    // const service = ts.createLanguageService(host)

    return {
      getCompletions: (fileName, position, content) => {
        console.log('in worker!')
        // const sourceFile = ts.createSourceFile(fileName, content, compilerOptions.target!)
        const host = {
          getCompilationSettings: () => compilerOptions,
          getScriptFileNames: () => [fileName],
          getScriptVersion: () => '1',
          getScriptSnapshot: (name) => {
            if (name === fileName) {
              return ts.ScriptSnapshot.fromString(content)
            }
            return undefined
          },
          getCurrentDirectory: () => '/',
          getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
          readFile: (path) => (path === fileName ? content : undefined),
          fileExists: (path) => path === fileName
        }
        // host.getSourceFile = (name) => (name === fileName ? sourceFile : undefined)
        const service = ts.createLanguageService(host)

        const completions = service.getCompletionsAtPosition(fileName, position, undefined)
        return completions?.entries.map((entry) => ({
          name: entry.name,
          kind: entry.kind,
          kindModifiers: entry.kindModifiers
        }))
      }
    }
  }
}

Comlink.expose(worker)
