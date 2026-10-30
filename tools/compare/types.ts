export type Verdict = 'yes' | 'part' | 'no'
export type ToolId = 'us' | 'nbviewer' | 'github' | 'colab' | 'jupyterlab' | 'vscode'
export type GroupId = 'privacy' | 'access' | 'reading' | 'sharing' | 'editing'
export type PageId = 'home' | 'compare'

export interface Tool { id: ToolId; name: string; job: 'Reads' | 'Shows' | 'Runs'; docs: string; choose: { lead: string; rest: string } }
export interface Group { id: GroupId; name: string }
export interface Cell { v: Verdict; say: string; more?: string; src?: string }
export interface Row { id: string; group: GroupId; label: string; cells: Record<ToolId, Cell> }

/** A block placed by `<!--compare:name-->` or `<!--compare:name:variant-->`. */
export interface Part {
  pages: readonly PageId[]
  variants?: readonly string[]
  html: (variant?: string) => string
  md: (variant?: string) => string
}
