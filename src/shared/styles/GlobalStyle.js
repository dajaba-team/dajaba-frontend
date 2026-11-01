import { createGlobalStyle } from "styled-components"
import "./tokens.css"

// 기본 요소와 접근성 규칙만 공유합니다. 화면별 배치는 각 기능 CSS에 둡니다.
export const GlobalStyle = createGlobalStyle`
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--color-canvas); color: var(--color-text); font-family: var(--font-family); font-size: var(--font-body); line-height: 1.6; }
  a { color: var(--color-primary); text-underline-offset: var(--space-1); }
  h1 { font-size: var(--font-title); line-height: 1.3; }
  h2 { font-size: var(--font-section); }
  h1, h2, h3, p { overflow-wrap: anywhere; }
  button, input, select, textarea { font: inherit; }
  button, select, textarea, input:not([type="checkbox"]) { border: var(--border-width) solid var(--color-control-border); border-radius: var(--radius-control); padding: var(--space-2) var(--space-3); background: var(--color-surface); color: var(--color-text); max-width: 100%; }
  button, select { min-height: var(--control-height); }
  button { cursor: pointer; }
  button:hover:enabled { background: var(--color-soft); }
  button:disabled { cursor: not-allowed; color: var(--color-muted); background: var(--color-soft); }
  textarea { display: block; width: 100%; min-height: 10rem; margin-block: var(--space-2) var(--space-4); resize: vertical; }
  input[type="checkbox"] { accent-color: var(--color-primary); }
  :focus-visible { outline: var(--focus-width) solid var(--color-focus); outline-offset: var(--space-1); }
  .preserve-lines { white-space: pre-wrap; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none; transition: none; scroll-behavior: auto; }
  }
`
