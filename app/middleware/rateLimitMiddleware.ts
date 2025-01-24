import type { NextApiRequest, NextApiResponse } from "next"
import rateLimit from "express-rate-limit"

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // ограничить каждый IP до 100 запросов на окно
})

export function rateLimitMiddleware(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    return new Promise((resolve, reject) => {
      limiter(req, res, (result: any) => {
        if (result instanceof Error) {
          return reject(result)
        }
        return resolve(handler(req, res))
      })
    })
  }
}

