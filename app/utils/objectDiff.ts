export function objectDiff(obj1: any, obj2: any): any {
  if (obj1 === obj2) return {}
  if (typeof obj1 !== "object" || typeof obj2 !== "object") return obj2

  const diff: any = {}
  for (const key in obj2) {
    if (obj1[key] !== obj2[key]) {
      if (typeof obj2[key] === "object" && typeof obj1[key] === "object") {
        const nestedDiff = objectDiff(obj1[key], obj2[key])
        if (Object.keys(nestedDiff).length > 0) {
          diff[key] = nestedDiff
        }
      } else {
        diff[key] = obj2[key]
      }
    }
  }
  return diff
}

