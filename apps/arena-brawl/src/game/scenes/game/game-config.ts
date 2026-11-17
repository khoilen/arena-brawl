export const GAME_WIDTH = 800
export const GAME_HEIGHT = 600
export const ARENA_BOUNDS = { left: 24, right: 776, top: 104, bottom: 576 }

export type CombatAction = 'punch' | 'kick' | 'dash' | 'special'
export type AttackAction = Exclude<CombatAction, 'dash'>
export type EnemyState = 'CHASE' | 'ATTACK' | 'DODGE' | 'DEAD'

export type ActionConfig = {
  staminaCost: number
  cooldownMs: number
  damage: number
  range: number
  minFacingDot: number
  color: number
  effectRadius: number
}

export const COMBAT = {
  playerRadius: 18,
  playerSpeed: 250,
  playerHealth: 100,
  enemyHealth: 100,
  maxStamina: 100,
  staminaRegenPerSecond: 15,
  dashDistance: 150,
  barWidth: 220,
  normal: {
    enemySpeedMultiplier: 0.75,
    reactionDelayMs: 300,
    aiDecisionIntervalMs: 300,
    dodgeProbability: 0.25,
    dodgeDurationMs: 240,
    playerAttackWindupMs: 420,
    enemyAttackWindupMs: 240,
  },
  actions: {
    punch: {
      staminaCost: 0,
      cooldownMs: 400,
      damage: 10,
      range: 86,
      minFacingDot: 0.35,
      color: 0x48e4c3,
      effectRadius: 24,
    },
    kick: {
      staminaCost: 0,
      cooldownMs: 700,
      damage: 15,
      range: 116,
      minFacingDot: 0.25,
      color: 0xffbc66,
      effectRadius: 34,
    },
    dash: {
      staminaCost: 20,
      cooldownMs: 1000,
      damage: 0,
      range: 0,
      minFacingDot: 0,
      color: 0x70a8ff,
      effectRadius: 0,
    },
    special: {
      staminaCost: 30,
      cooldownMs: 2000,
      damage: 25,
      range: 148,
      minFacingDot: 0.2,
      color: 0xc78bff,
      effectRadius: 54,
    },
  } satisfies Record<CombatAction, ActionConfig>,
} as const

export const ACTION_FOR_KEY: Record<string, CombatAction> = {
  KeyJ: 'punch',
  KeyK: 'kick',
  KeyL: 'dash',
  Space: 'special',
}
