"use client"

import { motion } from "framer-motion"
import type { HTMLMotionProps } from "framer-motion"

export const MotionDiv = motion.div
export const MotionButton = motion.button

// Типы для пропсов
export type MotionDivProps = HTMLMotionProps<"div">
export type MotionButtonProps = HTMLMotionProps<"button">

