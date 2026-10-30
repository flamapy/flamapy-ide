import React from 'react'
import * as ReactNamespace from 'react'
import * as ReactDOMNamespace from 'react-dom'
import * as jsxRuntime from 'react/jsx-runtime'
import * as pluginApi from '@flamapy/ide-plugin-api'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Publish the shell's own module instances for remotely loaded plugins: the import-map
// shims in public/shared/ re-export from this global, so a remote ESM bundle built with
// react/react-dom/react\/jsx-runtime/@flamapy\/ide-plugin-api as externals shares the
// shell's React (a second copy would break hooks).
globalThis.__flamapyShared = {
  react: ReactNamespace,
  reactDom: ReactDOMNamespace,
  jsxRuntime,
  pluginApi,
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
