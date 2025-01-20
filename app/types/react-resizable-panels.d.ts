declare module "react-resizable-panels" {
  import type React from "react"

  export interface PanelProps {
    children: React.ReactNode
    defaultSize?: number
    minSize?: number
    maxSize?: number
    order?: number
    [key: string]: any
  }

  export interface PanelGroupProps {
    children: React.ReactNode
    direction?: "horizontal" | "vertical"
    [key: string]: any
  }

  export interface PanelResizeHandleProps {
    [key: string]: any
  }

  export const Panel: React.FC<PanelProps>
  export const PanelGroup: React.FC<PanelGroupProps>
  export const PanelResizeHandle: React.FC<PanelResizeHandleProps>
}

