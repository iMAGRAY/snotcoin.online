"use client"

import React from "react"
import Image from "next/image"

export default function TestBall() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h3>Монета:</h3>
        <div className="relative w-40 h-40 border border-red-500">
          <Image
            src="/images/common/coins/coin.webp"
            alt="Coin"
            width={100}
            height={100}
            priority
          />
        </div>
      </div>
      
      <div>
        <h3>Шар:</h3>
        <div className="relative w-40 h-40 border border-blue-500">
          <Image
            src="/images/merge/Balls/1.webp"
            alt="Ball"
            width={100}
            height={100}
            priority
          />
        </div>
      </div>
      
      <div>
        <h3>Шар поверх монеты:</h3>
        <div className="relative w-40 h-40">
          <div className="absolute inset-0">
            <Image
              src="/images/common/coins/coin.webp"
              alt="Coin"
              width={100}
              height={100}
              priority
            />
          </div>
          <div className="absolute inset-0" style={{ transform: "translate(-20%, -20%)" }}>
            <Image
              src="/images/merge/Balls/1.webp"
              alt="Ball"
              width={80}
              height={80}
              priority
            />
          </div>
        </div>
      </div>
    </div>
  )
} 