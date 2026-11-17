import type { AttackAction, ActionConfig } from './game-config'

export type Point = { x: number; y: number }

export type PendingAttack = {
  attacker: 'player' | 'enemy'
  action: AttackAction
  resolvesAt: number
  origin: Point
  facing: Point
}

export function attackHits(
  origin: Point,
  facing: Point,
  target: Point,
  config: Pick<ActionConfig, 'range' | 'minFacingDot'>,
) {
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  const distance = Math.hypot(dx, dy)
  const facingDot =
    distance === 0 ? 1 : (dx * facing.x + dy * facing.y) / distance

  return distance <= config.range && facingDot >= config.minFacingDot
}
