import React from 'react'
import { javascript, javascriptLanguage } from '@codemirror/lang-javascript'
import {
  keymap,
  highlightSpecialChars,
  drawSelection,
  highlightActiveLine,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  lineNumbers,
  highlightActiveLineGutter,
  EditorView
} from '@codemirror/view'
import { Extension, EditorSelection, EditorState, Prec } from '@codemirror/state'
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
  syntaxTree
} from '@codemirror/language'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
  CompletionContext,
  Completion
} from '@codemirror/autocomplete'
import { lintKeymap } from '@codemirror/lint'
import { smoothy, coolGlow, dracula } from 'thememirror'
import prettier from 'prettier/standalone'
import parserBabel from 'prettier/plugins/babel'
import estreeParser from 'prettier/plugins/estree'
import { debounce } from 'lodash' // Add this import

/**
 * https://github.com/codemirror/basic-setup/blob/main/src/codemirror.ts
 */
const basicSetup: Extension = (() => [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap
  ])
])()

const prettierOptions = {
  parser: 'babel',
  plugins: [parserBabel, estreeParser],
  singleQuote: true,
  tabWidth: 2,
  endOfLine: 'lf' as const,
  semi: false
}

function formatWithPrettier(text: string, onFormat: (formattedText: string) => void) {
  prettier
    .format(text, prettierOptions)
    .then((formattedText) => {
      // Due to prettier inserting a semicolon at the beginning of the string, we need to remove it
      // to be parsed correctly as a query.

      const formattedContent = formattedText[0] === ';' ? formattedText.slice(1) : formattedText
      if (formattedContent !== text) {
        onFormat(formattedContent)
      }
    })
    .catch((_error) => {
      onFormat(text)
    })
}

function formatWithPrettierInitial(text: string, onFormat: (formattedText: string) => void) {
  prettier
    .format(text, prettierOptions)
    .then((formattedText) => {
      // Remove leading semicolon if present
      let formattedContent = formattedText[0] === ';' ? formattedText.slice(1) : formattedText
      // Always call onFormat callback
      onFormat(formattedContent)
    })
    .catch((_error) => {
      onFormat(text)
    })
}

function formatEditorView(view: EditorView) {
  formatWithPrettier(view.state.doc.toString(), (formattedText) => {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: formattedText }
    })
  })
}

const formatOnBlurExtension = EditorView.domEventHandlers({
  blur: (_event, view) => {
    formatEditorView(view)
    return false
  }
})

// Add this debounced function
const debouncedFormatEditorView = debounce(formatEditorView, 1000) // 1000ms delay

// Replace the formatOnBlurExtension with this new extension
const formatOnChangeExtension = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    debouncedFormatEditorView(update.view)
  }
})

function setFormattedEditorContent(editor: EditorView | null, content: string) {
  console.log('setEditorContent: editor', editor)
  if (editor) {
    console.log('setting editor content to:', content)
    formatWithPrettier(content, (formattedText) => {
      editor.dispatch({
        changes: {
          from: 0,
          to: editor.state.doc.length,
          insert: formattedText
        }
      })
    })
  }
}

function myCompletions(context: CompletionContext) {
  let word = context.matchBefore(/\w*/)
  if (word?.from == word?.to && !context.explicit) return null

  let nodeBefore = syntaxTree(context.state).resolveInner(context.pos, -1)
  console.log('nodeBefore ', nodeBefore)

  // Check if we're in a position to offer completions
  if (nodeBefore.name === 'VariableName' || nodeBefore.name === '.' || nodeBefore.name === 'PropertyName') {
    let textBefore = context.state.sliceDoc(nodeBefore.from - ('datomic'.length + 1), context.pos)
    console.log('textBefore', textBefore)

    let options: Completion[] = []

    if (textBefore === 'datomic.') {
      // Datomic builder API completions
      options = [
        { label: 'find', type: 'method', info: 'Start a find query' },
        { label: 'pullOne', type: 'method', info: 'Start a pull one query' },
        { label: 'pullMany', type: 'method', info: 'Start a pull many query' },
        { label: 'where', type: 'method', info: 'Add where clauses' },
        { label: 'in', type: 'method', info: 'Add input variables' },
        { label: 'keys', type: 'method', info: 'Specify keys for the query' },
        { label: 'build', type: 'method', info: 'Build the final query' },
        { label: 'uuid', type: 'function', info: 'Create a UUID value' },
        { label: 'inst', type: 'function', info: 'Create an instant value' },
        { label: 'rule', type: 'function', info: 'Use a rule in a where clause' }
      ]
    } else {
      // Top-level completions
      options = [
        { label: 'datomic', type: 'variable', info: 'Datomic query builder' },
        { label: 'sendToApi', type: 'keyword', info: 'Send a query to the API' },
        { label: '_', type: 'variable', info: 'Lodash utility library' },
        { label: 'fetch', type: 'function', info: 'Make an HTTP request' },
        { label: 'async', type: 'keyword', info: 'Define an asynchronous function' },
        { label: 'await', type: 'keyword', info: 'Wait for a Promise to resolve' }
      ]
    }

    return {
      from: word?.from ?? context.pos,
      options: options
    }
  }

  return [
    { label: 'datomic', type: 'variable', info: 'Datomic query builder' },
    { label: 'sendToApi', type: 'keyword', info: 'Send a query to the API' },
    { label: '_', type: 'variable', info: 'Lodash utility library' },
    { label: 'fetch', type: 'function', info: 'Make an HTTP request' },
    { label: 'async', type: 'keyword', info: 'Define an asynchronous function' },
    { label: 'await', type: 'keyword', info: 'Wait for a Promise to resolve' }
  ]
}

function createCodeMirrorState({
  initialContent,
  onChange,
  onSubmit,
  minHeight = '150px',
  theme,
  readOnly
}: {
  initialContent: string
  onChange?: (code: string) => void
  onSubmit?: () => void
  readOnly: boolean
  minHeight?: string
  theme: 'light' | 'dark'
}) {
  return EditorState.create({
    doc: initialContent,
    extensions: [
      basicSetup,
      javascript(),
      theme === 'light' ? smoothy : dracula,
      readOnly ? EditorState.readOnly.of(true) : [],
      autocompletion(),
      formatOnBlurExtension,
      javascriptLanguage.data.of({
        autocomplete: myCompletions
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) {
          onChange(update.state.doc.toString())
        }
      }),

      // set's a minimum height for the editor
      EditorView.theme({
        '.cm-content, .cm-gutter': { minHeight: minHeight },
        '.cm-gutters': { margin: '1px' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-wrap': { border: '1px solid silver' }
      }),

      // Add support for cmd+enter/ctrl+enter to trigger onSubmit
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              if (onSubmit) {
                onSubmit()
                return true
              }
              return false
            }
          }
        ])
      )
    ]
  })
}

export type CodeMirrorJsViewProps = {
  code: string
  onChange?: (code: string) => void
  onSubmit?: () => void
  readOnly?: boolean
  minHeight?: string
  theme: 'light' | 'dark'
}

function CodeMirrorJsView({
  code,
  onChange,
  onSubmit,
  readOnly = false,
  minHeight = '150px',
  theme
}: CodeMirrorJsViewProps) {
  const codemirrorRef = React.useRef<HTMLDivElement>(null)
  const codeMirrorViewRef = React.useRef<EditorView | null>(null)
  const didInitialize = React.useRef(false)
  const lastExternalCode = React.useRef(code)

  React.useEffect(() => {
    if (didInitialize.current) return
    didInitialize.current = true
    formatWithPrettierInitial(code, (formattedContent) => {
      const startState = createCodeMirrorState({
        initialContent: formattedContent,
        onChange,
        onSubmit,
        readOnly,
        minHeight,
        theme
      })
      if (!codemirrorRef.current) return
      codeMirrorViewRef.current = new EditorView({
        state: startState,
        parent: codemirrorRef.current
      })
    })
    return () => {
      codeMirrorViewRef.current?.destroy()
    }
  }, [codeMirrorViewRef.current, didInitialize.current])

  React.useEffect(() => {
    if (codeMirrorViewRef.current && code !== lastExternalCode.current) {
      const view = codeMirrorViewRef.current
      const currentCursor = view.state.selection.main
      const currentScrollTop = view.scrollDOM.scrollTop

      // Create a new state with the updated content
      const newState = createCodeMirrorState({
        initialContent: code,
        onChange,
        onSubmit,
        readOnly,
        minHeight,
        theme
      })

      // Calculate the new cursor position
      const newCursor = EditorSelection.cursor(Math.min(currentCursor.head, newState.doc.length))

      // Create a new transaction
      const transaction = newState.update({
        selection: EditorSelection.create([newCursor])
      })

      // Apply the transaction
      view.setState(transaction.state)

      // Restore scroll position after the next render
      setTimeout(() => {
        view.scrollDOM.scrollTop = currentScrollTop
      }, 0)

      lastExternalCode.current = code
    }
  }, [code])

  return <div ref={codemirrorRef} />
}

export default CodeMirrorJsView
