export type Point = {
  x: number
  y: number
}

export type MovementBounds = {
  left: number
  right: number
  top: number
  bottom: number
}

export type DashResult = {
  position: Point
  direction: Point
}

export function normalizeDirection(direction: Point): Point {
  const length = Math.hypot(direction.x, direction.y)
  if (length === 0) return { x: 0, y: 0 }

  return { x: direction.x / length, y: direction.y / length }
}

export function clampPosition(
  position: Point,
  bounds: MovementBounds,
  radius = 0,
): Point {
  return {
    x: Math.max(
      bounds.left + radius,
      Math.min(bounds.right - radius, position.x),
    ),
    y: Math.max(
      bounds.top + radius,
      Math.min(bounds.bottom - radius, position.y),
    ),
  }
}

export function moveWithinBounds(
  position: Point,
  direction: Point,
  speed: number,
  deltaMs: number,
  bounds: MovementBounds,
  radius = 0,
): Point {
  const normalized = normalizeDirection(direction)

  return clampPosition(
    {
      x: position.x + normalized.x * speed * (deltaMs / 1000),
      y: position.y + normalized.y * speed * (deltaMs / 1000),
    },
    bounds,
    radius,
  )
}

export function dashWithinBounds(
  position: Point,
  movementDirection: Point,
  facingDirection: Point,
  distance: number,
  bounds: MovementBounds,
  radius = 0,
): DashResult {
  const movement = normalizeDirection(movementDirection)
  const facing = normalizeDirection(facingDirection)
  const direction = movement.x === 0 && movement.y === 0 ? facing : movement

  return {
    direction,
    position: clampPosition(
      {
        x: position.x + direction.x * distance,
        y: position.y + direction.y * distance,
      },
      bounds,
      radius,
    ),
  }
}
