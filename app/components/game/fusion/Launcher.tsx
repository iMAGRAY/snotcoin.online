import type React from "react"
import Image from "next/image"

interface BallProps {
  currentBall: {
    image: string | null
    // other properties
  }
}

const Ball: React.FC<BallProps> = ({ currentBall }) => {
  return <Image src={currentBall.image || ""} alt="Ball" width={64} height={64} />
}

export default Ball

