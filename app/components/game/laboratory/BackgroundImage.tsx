"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { formatSnotValue } from "../../../utils/formatters"
import { calculateFillingPercentage } from "../../../utils/resourceUtils"
import type { BackgroundImageProps } from "../../../types/laboratory-types"
import { ICONS } from "../../../constants/uiConstants"

const BackgroundImage: React.FC<BackgroundImageProps> = React.memo(
  ({ store, onContainerClick, allowContainerClick, isContainerClicked, id, containerSnotValue, containerFilling }) => {
    const containerFillingMemo = useMemo(() => {
      if (!store?.inventory) return 0;
      
      return calculateFillingPercentage(store.inventory);
    }, [store?.inventory])

    const containerSnotValueMemo = useMemo(() => {
      const containerSnot = Math.max(0, store?.inventory?.containerSnot ?? 0);
      
      if (isNaN(containerSnot)) {
        return "0";
      }
      
      return formatSnotValue(containerSnot, 4);
    }, [store?.inventory?.containerSnot])

    const handleContainerClick = (e: React.MouseEvent) => {
      if (onContainerClick && allowContainerClick) {
        onContainerClick();
      }
    };

    return (
      <div className="fixed inset-0 w-full h-full overflow-hidden">
        <style jsx>{`
        :root {
          --container-fill: ${containerFilling}%;
        }
        .drop-shadow-glow-green {
          filter: drop-shadow(0 0 5px rgba(187, 235, 37, 0.7));
        }
      `}</style>
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage:
              `url('${ICONS.LABORATORY.BACKGROUND}')`,
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
            width: "100%",
            height: "100%",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="relative w-full h-full max-w-[80vmin] max-h-[80vmin]">
            <motion.div
              className="absolute left-[31%] top-[38%] w-[50%] h-[35%] bg-black/80 rounded-xl backdrop-blur-sm overflow-hidden z-10"
              animate={isContainerClicked ? "clicked" : "idle"}
              variants={{
                idle: { scale: 1 },
                clicked: { scale: 1.02, transition: { type: "spring", stiffness: 1000, damping: 15, duration: 0.06 } },
              }}
            >
              <div
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#bbeb25] to-[#a3d119] transition-all duration-300 ease-in-out"
                style={{ height: `${containerFillingMemo}%` }}
              />
            </motion.div>
            <motion.div
              id={id}
              className={`absolute inset-0 z-30 ${allowContainerClick ? "cursor-pointer" : ""}`}
              onClick={handleContainerClick}
              style={{
                pointerEvents: allowContainerClick ? "auto" : "none",
                touchAction: "manipulation",
              }}
              animate={isContainerClicked ? "clicked" : "idle"}
              whileTap="tapped"
              variants={{
                idle: { scale: 1 },
                clicked: { scale: 1.02, transition: { type: "spring", stiffness: 1000, damping: 15, duration: 0.06 } },
                tapped: { scale: 0.98, transition: { type: "spring", stiffness: 1500, damping: 20, duration: 0.03 } },
              }}
            >
              <Image
                src={ICONS.LABORATORY.MACHINE}
                layout="fill"
                objectFit="contain"
                alt="Storage Machine"
                priority
                draggable="false"
              />
              <motion.div
                className="absolute bottom-[10%] left-1/2 transform -translate-x-1/2 z-50 px-4 py-2"
                style={{
                  boxShadow:
                    "0 0 20px rgba(75, 85, 99, 0.4), 0 0 40px rgba(75, 85, 99, 0.2), inset 0 0 15px rgba(255, 255, 255, 0.1)",
                  borderRadius: "1rem",
                  border: "1px solid rgba(128, 128, 128, 0.2)",
                  backdropFilter: "blur(10px)",
                  background: "linear-gradient(to bottom right, rgba(32, 32, 32, 0.8), rgba(42, 42, 42, 0.8))",
                }}
              >
                <motion.span
                  className="text-[#bbeb25] font-bold text-2xl tracking-wider"
                  style={{
                    textShadow: `
                    0 2px 4px rgba(0, 0, 0, 0.5),
                    0 0 10px rgba(16, 185, 129, 0.5)
                  `,
                  }}
                >
                  {containerSnotValueMemo}
                </motion.span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    )
  },
)

BackgroundImage.displayName = "BackgroundImage"

export default BackgroundImage

