// Shared-module shim: remote plugins import 'react' through the page's import map and
// get the shell's own React instance (two copies would break hooks). The shell
// initializes globalThis.__flamapyShared in src/main.jsx before any plugin loads.
const React = globalThis.__flamapyShared?.react;
if (!React) {
  throw new Error("flamapy shared modules are not initialized (react)");
}
export default React;
export const {
  Children,
  Component,
  Fragment,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
} = React;
