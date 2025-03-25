import { TabInfo } from "./types"
import { ICONS } from "../../constants/uiConstants"

export const tabs: TabInfo[] = [
  // {
  //   id: "fusion",
  //   label: "fusionTab",
  //   icon: "/images/fusion/fusion.webp",
  // },
  {
    id: "laboratory",
    label: "laboratoryTab",
    icon: ICONS.LABORATORY.MAIN,
  },
  {
    id: "storage",
    label: "storageTab",
    icon: ICONS.STORAGE.MAIN,
  },
  {
    id: "quests",
    label: "questsTab",
    icon: ICONS.QUESTS.MAIN,
  },
  {
    id: "profile",
    label: "profile",
    icon: ICONS.PROFILE.MAIN,
  },
]

