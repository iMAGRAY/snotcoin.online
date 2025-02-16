import React, { useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from "framer-motion"
import Image from 'next/image'
import { formatSnotValue } from '../../../utils/gameUtils'
import { GameState } from '../../../types/gameTypes'
import { LocalState, LocalAction } from '../../../types/laboratory-types'
import { Database } from 'lucide-react';

const FlyingNumber: React.FC<{ id: number; value: number }> = React.memo(({ id, value }) => {
  const formattedValue = useMemo(() => formatSnotValue(value, 4), [value]);

  return (
    <motion.div
      key={id}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ 
        opacity: [1, 1, 0],
        y: [0, '-10vh'],
        x: ['-50%', '-50%'],
        scale: [1, 1.2, 1],
      }}
      transition={{ 
        duration: 1.5, 
        ease: "easeOut",
        times: [0, 0.7, 1]
      }}
      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[70] pointer-events-none select-none"
    >
      <motion.span
        className="text-[#bbeb25] font-bold text-2xl"
        style={{
          textShadow: '0 0 5px rgba(16, 185, 129, 0.5), 0 0 10px rgba(16, 185, 129, 0.3), 0 2px 3px rgba(0, 0, 0, 0.8)'
        }}
      >
        +{formattedValue}
      </motion.span>
    </motion.div>
  );
});

FlyingNumber.displayName = 'FlyingNumber';

interface BackgroundImageProps {
  store: GameState
  dispatch: React.Dispatch<any>
  localState: LocalState
  localDispatch: React.Dispatch<LocalAction>
  onContainerClick: () => void;
  allowContainerClick: boolean;
  isContainerClicked: boolean;
  id: string;
  containerSnotValue: string;
}

const BackgroundImage: React.FC<BackgroundImageProps> = React.memo(({
  store,
  localState,
  onContainerClick,
  allowContainerClick,
  isContainerClicked,
  id,
  containerSnotValue,
}) => {
  const containerFilling = useMemo(() => {
    return (store.containerSnot / store.Cap) * 100;
  }, [store.containerSnot, store.Cap]);

  const containerSnotValueMemo = useMemo(() => formatSnotValue(store.containerSnot, 4), [store.containerSnot]);

  const handleClick = useCallback(() => {
    if (allowContainerClick) {
      onContainerClick();
    }
  }, [allowContainerClick, onContainerClick]);

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
          backgroundImage: "url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/BackGroundLab2-L6J62hXIqasQsQ4GImBeX6Trmpiwuq.webp')",
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          width: '100%',
          height: '100%',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="relative w-full h-full max-w-[80vmin] max-h-[80vmin]">
          <motion.div 
            className="absolute left-[31%] top-[38%] w-[50%] h-[35%] bg-black/80 rounded-xl backdrop-blur-sm overflow-hidden z-10"
            animate={isContainerClicked ? "clicked" : "idle"}
            variants={{
              idle: { scale: 1 },
              clicked: { scale: 1.02, transition: { type: 'spring', stiffness: 1000, damping: 15, duration: 0.06 } },
            }}
          >
          </motion.div>
          <motion.div
            id={id}
            className={`absolute inset-0 z-30 ${allowContainerClick ? 'cursor-pointer' : ''}`}
            onClick={handleClick}
            style={{ 
              pointerEvents: allowContainerClick ? 'auto' : 'none',
              touchAction: 'manipulation',
            }}
            animate={isContainerClicked ? "clicked" : "idle"}
            whileTap="tapped"
            variants={{
              idle: { scale: 1 },
              clicked: { scale: 1.02, transition: { type: 'spring', stiffness: 1000, damping: 15, duration: 0.06 } },
              tapped: { scale: 0.98, transition: { type: 'spring', stiffness: 1500, damping: 20, duration: 0.03 } }
            }}
          >
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/5-fAIoNsO4S0dYFjXAHFexJ09zRNNm3l.webp"
              layout="fill"
              objectFit="contain"
              alt="Storage Machine"
              priority 
              draggable="false"
            />
            <motion.div
              className="absolute bottom-[10%] left-1/2 transform -translate-x-1/2 z-50 px-4 py-2"
              style={{
                boxShadow: '0 0 20px rgba(75, 85, 99, 0.4), 0 0 40px rgba(75, 85, 99, 0.2), inset 0 0 15px rgba(255, 255, 255, 0.1)',
                borderRadius: '1rem',
                border: '1px solid rgba(128, 128, 128, 0.2)',
                backdropFilter: 'blur(10px)',
                background: 'linear-gradient(to bottom right, rgba(32, 32, 32, 0.8), rgba(42, 42, 42, 0.8))',
              }}
            >
              <motion.span
                className="text-[#bbeb25] font-bold text-2xl tracking-wider"
                style={{
                  textShadow: `
                    0 2px 4px rgba(0, 0, 0, 0.5),
                    0 0 10px rgba(16, 185, 129, 0.5)
                  `
                }}
              >
                {containerSnotValue}
              </motion.span>
            </motion.div>
          </motion.div>
          <div className="absolute inset-0 z-[60] pointer-events-none">
            <AnimatePresence>
              {localState.flyingNumbers.map(({ id, value }) => (
                <FlyingNumber key={id} id={id} value={value} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
});

BackgroundImage.displayName = 'BackgroundImage';

export default BackgroundImage;

