import React from 'react'
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
import { Extension, EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { lintKeymap } from '@codemirror/lint'
import { smoothy, coolGlow, dracula } from 'thememirror'

import {
  defaultHighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap
} from '@codemirror/language'
import { default_extensions, complete_keymap } from '@nextjournal/clojure-mode'
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

function CodeMirrorClojureView({ content, theme }: { content: string; theme: 'light' | 'dark' }) {
  const codemirrorRef = React.useRef<HTMLDivElement>(null)
  const codemirrorView = React.useRef<EditorView | null>(null)

  React.useEffect(() => {
    const startState = EditorState.create({
      doc: content,
      extensions: [basicSetup, theme === 'light' ? smoothy : dracula, ...default_extensions, keymap.of(complete_keymap)]
    })
    if (!codemirrorRef.current) return

    const view = new EditorView({
      state: startState,
      parent: codemirrorRef.current
    })
    codemirrorView.current = view
    return () => {
      view.destroy()
    }
  }, [])

  return (
    <>
      <div
        css={{
          display: 'flex',
          gap: 20,
          flexDirection: 'column',
          alignItems: 'flex-start',
          '& .cm-content': {
            padding: '16px 24px 0px 2px'
          }
        }}
      >
        <div
          css={{
            width: '100%',
            height: '100%'
          }}
          ref={codemirrorRef}
        />
      </div>
    </>
  )
}

export default CodeMirrorClojureView
