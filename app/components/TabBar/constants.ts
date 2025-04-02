import { TabInfo } from "./types"
import { ICONS } from "../../constants/uiConstants"

export const tabs: TabInfo[] = [
  {
    id: "merge",
    label: "mergeTab",
    icon: ICONS.MERGE.MAIN,
  },
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

