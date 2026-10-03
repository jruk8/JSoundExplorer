/// <reference types="vite/client" />

declare const __APP_VERSION__: string

declare module 'node:child_process' {
  export function execSync(
    command: string,
    options: { encoding: 'utf8'; stdio: [string, string, string] },
  ): string
}
