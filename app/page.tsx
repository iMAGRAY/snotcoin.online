import dynamic from "next/dynamic"
import LoadingScreen from "./components/LoadingScreen"

// Динамический импорт HomeContent без SSR
const HomeContent = dynamic(() => import("./components/HomeContent"), {
  ssr: false,
  loading: () => <LoadingScreen progress={0} statusMessage="Loading game..." />,
})

export default function Home() {
  return <HomeContent />
}

