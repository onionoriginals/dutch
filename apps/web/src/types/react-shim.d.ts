// Temporary shim to satisfy type checker in environments without installed React types.
// Do not ship to production without proper @types/react and @types/react-dom.

declare module 'react' {
  const React: any
  export default React
  export const useState: any
  export const useMemo: any
  export const useEffect: any
  export const useRef: any
  export const useCallback: any
  export const useId: any
}

declare module 'react/jsx-runtime' {
  export const jsx: any
  export const jsxs: any
  export const Fragment: any
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any
  }
}

