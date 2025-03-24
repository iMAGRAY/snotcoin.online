"use client"

import { ICONS } from "../../../constants/uiConstants"

export default function Quests() {
  return (
    <div className="h-full w-full relative overflow-hidden">
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage:
            `url('${ICONS.QUESTS.BACKGROUND}')`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      />
    </div>
  )
} 