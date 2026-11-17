import type { Scene } from 'phaser'

export type FighterAnimationState =
  | 'idle'
  | 'walk'
  | 'punch'
  | 'kick'
  | 'dodge'
  | 'special'
  | 'hurt'
  | 'knockout'

const priority: Record<FighterAnimationState, number> = {
  idle: 0,
  walk: 1,
  dodge: 2,
  punch: 3,
  kick: 3,
  special: 4,
  hurt: 5,
  knockout: 6,
}

const duration: Partial<Record<FighterAnimationState, number>> = {
  kick: 340,
  dodge: 240,
  special: 500,
  hurt: 230,
}

/** Boxer artwork is flattened, so non-punch states use clear whole-sprite motion. */
export function createBoxerVisual(scene: Scene, enemy = false) {
  const fighter = scene.add.container(0, 0)
  const shadow = scene.add.ellipse(0, 4, 82, 20, 0x050407, 0.52)
    .setName('boxer-shadow')
  const boxer = scene.add.sprite(0, 0, 'boxer')
    .setName('boxer-sprite')
    .setOrigin(0.5, 0.94)
    .setDisplaySize(184, 168)
  if (enemy) boxer.setTint(0x8fcaff)

  fighter.add([shadow, boxer])
  fighter.setSize(184, 168)
  fighter.setData('animationState', 'idle' satisfies FighterAnimationState)
  return fighter
}

/** Shared state controller for player and enemy; locomotion cannot interrupt actions. */
export class FighterAnimationController {
  private readonly sprite: Phaser.GameObjects.Sprite
  private readonly baseY: number
  private readonly baseScaleX: number
  private readonly baseScaleY: number
  private moving = false
  private state: FighterAnimationState = 'idle'
  private release?: Phaser.Time.TimerEvent
  private direction = 1

  constructor(
    private readonly scene: Scene,
    private readonly fighter: Phaser.GameObjects.Container,
  ) {
    this.sprite = fighter.getByName('boxer-sprite') as Phaser.GameObjects.Sprite
    this.baseY = this.sprite.y
    this.baseScaleX = this.sprite.scaleX
    this.baseScaleY = this.sprite.scaleY
    this.startIdle()
  }

  setMovement(moving: boolean, direction: number) {
    this.moving = moving
    this.setFacing(direction)
    if (priority[this.state] <= priority.walk) this.setLocomotion()
  }

  setFacing(direction: number) {
    if (direction !== 0) this.direction = direction < 0 ? -1 : 1
    this.sprite.setFlipX(this.direction < 0)
  }

  play(state: Exclude<FighterAnimationState, 'idle' | 'walk'>, direction = this.direction) {
    this.setFacing(direction)
    if (priority[state] < priority[this.state]) return false
    this.release?.remove(false)
    this.release = undefined
    this.stopMotion()
    this.state = state
    this.fighter.setData('animationState', state)

    if (state === 'knockout') {
      this.scene.tweens.add({
        targets: this.fighter,
        angle: this.direction * 82,
        alpha: 0.68,
        duration: 440,
        ease: 'Cubic.Out',
      })
      return true
    }

    if (state === 'punch') {
      this.sprite.setTexture('boxer-punch')
      this.sprite.setDisplaySize(184, 168)
      this.sprite.play('boxer-punch', true)
      this.sprite.once('animationcomplete-boxer-punch', () => {
        if (this.state !== 'punch') return
        this.restoreBoxer()
        this.finishAction()
      })
      return true
    }

    if (state === 'kick') {
      this.scene.tweens.add({
        targets: this.sprite,
        angle: this.direction * 24,
        scaleX: this.baseScaleX * 1.12,
        scaleY: this.baseScaleY * 0.84,
        duration: 150,
        yoyo: true,
        ease: 'Cubic.Out',
      })
    } else if (state === 'dodge') {
      this.scene.tweens.add({
        targets: this.sprite,
        x: -this.direction * 17,
        scaleX: this.baseScaleX * 0.76,
        scaleY: this.baseScaleY * 0.88,
        alpha: 0.72,
        duration: 95,
        yoyo: true,
        ease: 'Cubic.Out',
      })
    } else if (state === 'special') {
      this.scene.tweens.add({
        targets: this.sprite,
        y: this.baseY - 15,
        angle: this.direction * 17,
        scaleX: this.baseScaleX * 1.12,
        scaleY: this.baseScaleY * 1.12,
        duration: 250,
        yoyo: true,
        ease: 'Back.Out',
      })
    } else if (state === 'hurt') {
      this.scene.tweens.add({
        targets: this.sprite,
        x: -this.direction * 12,
        angle: -this.direction * 12,
        alpha: 0.55,
        duration: 55,
        yoyo: true,
        repeat: 1,
      })
    }

    this.release = this.scene.time.delayedCall(duration[state] ?? 160, () => {
      if (this.state === state) this.finishAction()
    })
    return true
  }

  private setLocomotion() {
    const next = this.moving ? 'walk' : 'idle'
    if (this.state === next) return
    this.stopMotion()
    this.state = next
    this.fighter.setData('animationState', next)
    this.sprite.setAlpha(1).setAngle(0).setPosition(0, this.baseY).setScale(this.baseScaleX, this.baseScaleY)
    if (next === 'walk') {
      this.scene.tweens.add({
        targets: this.sprite,
        y: this.baseY - 5,
        scaleY: this.baseScaleY * 0.97,
        duration: 100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      })
    } else this.startIdle()
  }

  private startIdle() {
    this.state = 'idle'
    this.fighter.setData('animationState', 'idle')
    this.sprite.setAlpha(1).setAngle(0).setPosition(0, this.baseY).setScale(this.baseScaleX, this.baseScaleY)
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.baseY - 2,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    })
  }

  private finishAction() {
    this.release?.remove(false)
    this.release = undefined
    this.stopMotion()
    if (this.state === 'punch') this.restoreBoxer()
    this.setLocomotion()
  }

  private restoreBoxer() {
    this.sprite.stop()
    this.sprite.setTexture('boxer').setDisplaySize(184, 168)
  }

  private stopMotion() {
    this.scene.tweens.killTweensOf(this.sprite)
    this.sprite.setPosition(0, this.baseY).setAngle(0).setScale(this.baseScaleX, this.baseScaleY).setAlpha(1)
  }
}

export function flashBoxer(scene: Scene, fighter: Phaser.GameObjects.Container) {
  const sprite = fighter.getByName('boxer-sprite')
  if (!sprite || !('setTintFill' in sprite)) return

  const boxerSprite = sprite as Phaser.GameObjects.Sprite
  boxerSprite.setTintFill()
  scene.time.delayedCall(90, () => {
    if (!boxerSprite.active) return
    boxerSprite.clearTint()
    if (fighter.getData('isEnemy')) boxerSprite.setTint(0x8fcaff)
  })
}
