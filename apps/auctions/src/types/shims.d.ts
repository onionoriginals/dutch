declare module "react" {
  const React: any;
  export default React;
  export function useState<T = any>(initial?: T): any;
  export function useEffect(...args: any[]): any;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: any[]): T;
  export function memo<T>(component: T): T;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

