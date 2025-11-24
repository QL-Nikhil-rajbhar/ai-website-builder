export const SHADCN_COMPONENT_LIB = {
    button: `
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "link"
  size?: "default" | "icon"
  asChild?: boolean
}

const buttonVariants = {
  default: "bg-primary text-white px-4 py-2 rounded-md",
  outline: "border border-input bg-transparent hover:bg-accent",
  link: "text-primary underline-offset-4 hover:underline bg-transparent p-0",
}

const buttonSizes = {
  default: "h-10 px-4 py-2",
  icon: "h-10 w-10 flex items-center justify-center p-0",
}

export function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      className={cn(
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  )
}
`,

    card: `import * as React from "react"

export function Card({ className = "", ...props }) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4" {...props} />
  )
}
`,
};
