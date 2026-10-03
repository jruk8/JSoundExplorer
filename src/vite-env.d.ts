/// <reference types="vite/client" />

declare const __APP_VERSION__: string

declare module '*.mid?url' {
  const src: string
  export default src
}

declare module '*.midi?url' {
  const src: string
  export default src
}

declare module 'node:child_process' {
  export function execSync(
    command: string,
    options: { encoding: 'utf8'; stdio: [string, string, string] },
  ): string
}
