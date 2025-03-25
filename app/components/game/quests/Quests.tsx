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
      <div className="relative z-10 w-full h-full overflow-auto pb-24">
        {/* Здесь должен быть контент квестов */}
      </div>
    </div>
  )
} 