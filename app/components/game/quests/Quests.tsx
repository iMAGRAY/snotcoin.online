"use client"

import { ICONS } from "../../../constants/uiConstants"

export default function Quests() {
  return (
    <div className="relative flex flex-col h-full w-full overflow-auto">
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