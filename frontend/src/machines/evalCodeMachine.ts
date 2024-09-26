import { setup, assign, fromCallback, EventObject } from 'xstate'
import { useMachine } from '@xstate/react'
import { datomic, createFindQueryBuilder, createPullQueryBuilder } from '../datomicApi.js'

type Error = { message: string; stack: string }
/**
 * State Machine Context for the evalCodeMachine.
 */
type EvalCodeContext = {
  code: string
  apiUrl: string
  result?: any
  error?: Error
}

/**
 * Events that the evalCodeMachine can receive.
 */
type Events =
  | { type: 'INIT'; iframe: HTMLIFrameElement }
  | { type: 'EVAL_CODE'; apiUrl: string }
  | { type: 'SET_CODE'; code: string }
  | { type: 'RESULT'; result: any }
  | { type: 'ERROR'; error: Error }

/**
 * Creates an iframe with the necessary scripts and code to evaluate user code.
 * @param code - The code to evaluate.
 * @returns The iframe element.
 */
const setupIframe = ({ code, apiUrl }: { code: string; apiUrl: string }) => {
  const iframe = document.createElement('iframe')

  const datomicApiCode = `
    const datomic = (function() {
      const createFindQueryBuilder = ${createFindQueryBuilder.toString()};
      const createPullQueryBuilder = ${createPullQueryBuilder.toString()};
      
      return {
        ${Object.entries(datomic)
          .map(([key, value]) => {
            if (typeof value === 'function') {
              return `${key}: ${value.toString()},`
            }
            return `${key}: ${JSON.stringify(value)},`
          })
          .join('\n')}
      };
    })();
  `
  const iframeContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"></script>
          <script>
            ${datomicApiCode}
            function customFunction(input) {
              return input.split('').reverse().join('');
            }
            function sendToApi(body) {
              return fetch('${apiUrl}', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                credentials: 'include',
                mode: 'cors', 
                body: JSON.stringify(body)
              })
              .then((response) => response.json())
              .then((data) => {
                 if (data.error) throw data
                 return data
              })
           }
          </script>
          <script>
            window.onerror = function(message, source, lineno, colno, error) {
              console.log('window.onerror', message, source, lineno, colno, error)
              window.parent.postMessage({ type: 'ERROR', error: { message: message, stack: error.stack } }, '*');
              // Prevents the firing of the default event handler
              return true; 
            };
          </script>
          <script>
            async function runUserCode() { ${code} } 
            try {
              runUserCode().then(output => {
                console.log('user code output', output);
                window.parent.postMessage({ type: 'RESULT', data: output }, '*');
              }).catch(error => {
                 console.log('error in user code promise', error);
                 window.parent.postMessage({ type: 'ERROR', error: { message: error.message, stack: error.stack } }, '*');
              });
          } catch (error) {
            console.log('user code error', error);
            window.parent.postMessage({ type: 'ERROR', error: { message: error.message, stack: error.stack } }, '*');
          }
          </script>

        </head>
        <body></body>
      </html>
    `
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.style.position = 'absolute'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.srcdoc = iframeContent
  return iframe
}

/**
 * Actor that evaluates code in an iframe, sends the result and error back to the parent.
 */
const evaluateCode = fromCallback<EventObject, { code: string; apiUrl: string }>(({ input, sendBack }) => {
  let iframe: HTMLIFrameElement | null = setupIframe({ code: input.code, apiUrl: input.apiUrl })

  const messageHandler = (e: MessageEvent) => {
    if (e.source === iframe?.contentWindow) {
      if (e.data.type === 'RESULT') {
        console.log('iframe sent RESULT', e.data.data)
        sendBack({ type: 'RESULT', result: e.data.data })
      } else if (e.data.type === 'ERROR') {
        console.log('iframe sent ERROR', e.data.error)
        sendBack({ type: 'ERROR', error: e.data.error })
      }
    }
  }

  window.addEventListener('message', messageHandler)
  document.body.appendChild(iframe)

  return () => {
    window.removeEventListener('message', messageHandler)
    iframe?.remove()
    iframe = null
  }
})

/**
 * Machine that manages the evaluation of user provided code within an iframe.
 */
const evalCodeMachine = setup({
  types: {
    context: {} as EvalCodeContext,
    events: {} as Events
  },
  actors: {
    evaluateCode
  },
  actions: {
    setCode: assign({
      code: ({ context, event }) => (event.type === 'SET_CODE' ? event.code : context.code)
    }),
    setApiUrl: assign({
      apiUrl: ({ context, event }) => (event.type === 'EVAL_CODE' ? event.apiUrl : context.apiUrl)
    }),
    setResult: assign({
      result: ({ context, event }) => (event.type === 'RESULT' ? event.result : context.result),
      error: ({ context, event }) => (event.type === 'RESULT' ? undefined : context.error)
    }),
    setError: assign({
      error: ({ context, event }) => (event.type === 'ERROR' ? event.error : context.error),
      result: ({ context, event }) => (event.type === 'ERROR' ? undefined : context.result)
    })
  }
}).createMachine({
  id: 'evalCode',
  initial: 'ready',
  context: { code: '', apiUrl: '' },
  states: {
    ready: {
      on: {
        SET_CODE: {
          target: 'ready',
          actions: 'setCode'
        },
        EVAL_CODE: {
          target: 'evaluating',
          actions: 'setApiUrl'
        }
      }
    },
    evaluating: {
      invoke: {
        id: 'evaluateCode',
        src: 'evaluateCode',
        input: ({ context }: { context: EvalCodeContext }) => ({ code: context.code, apiUrl: context.apiUrl })
      },
      on: {
        RESULT: {
          target: 'ready',
          actions: 'setResult'
        },
        ERROR: {
          target: 'ready',
          actions: 'setError'
        }
      }
    }
  }
})

/**
 * React hook that provides the state and actions for the evalCodeMachine.
 */
export function useEvalCodeState({ apiUrl }: { apiUrl: string }) {
  const [snapshot, send] = useMachine(evalCodeMachine)
  const { code, result, error } = snapshot.context
  const handleCodeChange = (code: string) => send({ type: 'SET_CODE', code })
  const handleEvalCode = () => {
    send({ type: 'EVAL_CODE', apiUrl })
  }
  return { code, result, error, handleCodeChange, handleEvalCode }
}
