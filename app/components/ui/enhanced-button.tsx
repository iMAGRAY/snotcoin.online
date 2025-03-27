import * as React from "react"
import { motion } from "framer-motion"
import { Button, type ButtonProps } from "./button"
import { cn } from "../../lib/utils"

// Дополнительные варианты для EnhancedButton
export const enhancedButtonStyles = {
  animation: {
    none: "",
    pulse: "animate-pulse",
    bounce: "animate-bounce",
    ping: "animate-ping",
    spin: "animate-spin",
  },
  elevation: {
    none: "",
    sm: "shadow-sm",
    md: "shadow-md",
    lg: "shadow-lg",
    xl: "shadow-xl",
  },
  rounded: {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    full: "rounded-full",
  },
}

export type AnimationType = keyof typeof enhancedButtonStyles.animation;
export type ElevationType = keyof typeof enhancedButtonStyles.elevation;
export type RoundedType = keyof typeof enhancedButtonStyles.rounded;

// Расширяем свойства базовой кнопки
export interface EnhancedButtonProps extends ButtonProps {
  // Дополнительные опции стилизации из enhancedButtonStyles
  animation?: AnimationType;
  elevation?: ElevationType;
  rounded?: RoundedType;
  
  // Свойства для анимации с Framer Motion
  whileHover?: React.ComponentProps<typeof motion.div>["whileHover"];
  whileTap?: React.ComponentProps<typeof motion.div>["whileTap"];
  initial?: React.ComponentProps<typeof motion.div>["initial"];
  animate?: React.ComponentProps<typeof motion.div>["animate"];
  transition?: React.ComponentProps<typeof motion.div>["transition"];
  
  // Для отслеживания долгого нажатия
  onLongPress?: () => void;
  longPressThreshold?: number;
}

export const EnhancedButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  (
    {
      className,
      variant,
      size,
      animation = "none",
      elevation = "none",
      rounded = "none",
      whileHover,
      whileTap,
      initial,
      animate,
      transition,
      onLongPress,
      longPressThreshold = 500,
      children,
      ...props
    },
    ref
  ) => {
    // Состояние и таймер для отслеживания долгого нажатия
    const [isLongPressing, setIsLongPressing] = React.useState(false)
    const longPressTimer = React.useRef<NodeJS.Timeout | null>(null)

    // Обработчики долгого нажатия
    const handlePointerDown = React.useCallback(() => {
      if (onLongPress) {
        setIsLongPressing(true)
        longPressTimer.current = setTimeout(() => {
          onLongPress()
          setIsLongPressing(false)
        }, longPressThreshold)
      }
    }, [onLongPress, longPressThreshold])

    const handlePointerUp = React.useCallback(() => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
      setIsLongPressing(false)
    }, [])

    // Очистка таймера при размонтировании
    React.useEffect(() => {
      return () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current)
        }
      }
    }, [])

    // Дополнительные классы для стилей
    const buttonClassName = cn(
      enhancedButtonStyles.animation[animation],
      enhancedButtonStyles.elevation[elevation],
      enhancedButtonStyles.rounded[rounded],
      isLongPressing && "opacity-70",
      className
    )

    // Обработчики событий для долгого нажатия
    const longPressHandlers = onLongPress
      ? {
          onPointerDown: handlePointerDown,
          onPointerUp: handlePointerUp,
          onPointerLeave: handlePointerUp,
        }
      : {}

    // Базовая кнопка с дополнительными свойствами
    const buttonElement = (
      <Button
        ref={ref}
        className={buttonClassName}
        variant={variant}
        size={size}
        {...longPressHandlers}
        {...props}
      >
        {children}
      </Button>
    )

    // Если есть анимации, оборачиваем в motion.div
    if (whileHover || whileTap || initial || animate) {
      // Создаем объект с пропсами, исключая undefined
      const motionProps: any = { style: { display: "inline-block" } };
      if (whileHover) motionProps.whileHover = whileHover;
      if (whileTap) motionProps.whileTap = whileTap;
      if (initial) motionProps.initial = initial;
      if (animate) motionProps.animate = animate;
      if (transition) motionProps.transition = transition;
      
      return (
        <motion.div {...motionProps}>
          {buttonElement}
        </motion.div>
      )
    }

    // Иначе возвращаем обычную кнопку
    return buttonElement
  }
)

EnhancedButton.displayName = "EnhancedButton" 