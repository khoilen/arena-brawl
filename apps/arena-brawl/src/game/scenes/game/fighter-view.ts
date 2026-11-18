import { TintModes, type Scene } from 'phaser'

export const FIGHTERS = [
  { texture: 'fighter-ninja', walkTexture: 'fighter-ninja-walk', label: 'NINJA', originY: 0.92 },
  { texture: 'fighter-striker', walkTexture: 'fighter-striker-walk', label: 'STRIKER', originY: 0.8 },
  { texture: 'fighter-boxer', walkTexture: 'fighter-boxer-walk', label: 'BOXER', originY: 0.84 },
] as const

export type FighterAnimationState =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'punch'
  | 'kick'
  | 'dodge'
  | 'special'
  | 'hurt'
  | 'knockout'

const priority: Record<FighterAnimationState, number> = {
  idle: 0,
  walk: 1,
  jump: 2,
  dodge: 2,
  punch: 3,
  kick: 3,
  special: 4,
  hurt: 5,
  knockout: 6,
}

const duration: Partial<Record<FighterAnimationState, number>> = {
  jump: 380,
  kick: 340,
  dodge: 240,
  special: 500,
  hurt: 230,
}

const fighterDisplayWidth = 256
const fighterDisplayHeight = 220

/** Build a shared fighter visual from one of the selectable sprite sheets. */
export function createFighterVisual(scene: Scene, characterIndex = 0) {
  const character = FIGHTERS[characterIndex] ?? FIGHTERS[0]
  const fighter = scene.add.container(0, 0)
  const shadow = scene.add.ellipse(0, 4, 82, 20, 0x050407, 0.52)
    .setName('fighter-shadow')
  const sprite = scene.add.sprite(0, 0, character.texture, 0)
    .setName('fighter-sprite')
    .setOrigin(0.5, character.originY)
    .setDisplaySize(fighterDisplayWidth, fighterDisplayHeight)

  fighter.add([shadow, sprite])
  fighter.setSize(fighterDisplayWidth, fighterDisplayHeight)
  fighter.setData('characterIndex', characterIndex)
  fighter.setData('animationState', 'idle' satisfies FighterAnimationState)
  return fighter
}

/** Shared state controller for player and enemy; locomotion cannot interrupt actions. */
export class FighterAnimationController {
  private readonly sprite: Phaser.GameObjects.Sprite
  private readonly shadow: Phaser.GameObjects.Ellipse
  private characterIndex: number
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
    this.sprite = fighter.getByName('fighter-sprite') as Phaser.GameObjects.Sprite
    this.shadow = fighter.getByName('fighter-shadow') as Phaser.GameObjects.Ellipse
    this.characterIndex = fighter.getData('characterIndex') ?? 0
    this.baseY = this.sprite.y
    this.baseScaleX = this.sprite.scaleX
    this.baseScaleY = this.sprite.scaleY
    this.startIdle()
  }

  setMovement(moving: boolean, direction: number, speedRatio = 1) {
    this.moving = moving
    this.setFacing(direction)
    if (priority[this.state] <= priority.walk) this.setLocomotion()
    if (moving && this.state === 'walk') {
      const normalizedSpeed = Math.max(0, Math.min(1, speedRatio))
      this.sprite.anims.timeScale = 0.68 + normalizedSpeed * 0.58
    }
  }

  setFacing(direction: number) {
    if (direction !== 0) this.direction = direction < 0 ? -1 : 1
    this.sprite.setFlipX(this.direction < 0)
  }

  setCharacter(index: number) {
    const nextIndex = Math.max(0, Math.min(FIGHTERS.length - 1, Math.floor(index)))
    if (nextIndex === this.characterIndex) return
    this.release?.remove(false)
    this.release = undefined
    this.scene.tweens.killTweensOf(this.fighter)
    this.stopMotion()
    this.characterIndex = nextIndex
    this.fighter.setData('characterIndex', nextIndex)
    this.state = 'idle'
    if (this.moving) this.setLocomotion()
    else this.startIdle()
  }

  private get character() {
    return FIGHTERS[this.characterIndex] ?? FIGHTERS[0]
  }

  play(state: Exclude<FighterAnimationState, 'idle' | 'walk'>, direction = this.direction) {
    if (state === 'jump' && this.state === 'jump') return false
    this.setFacing(direction)
    if (priority[state] < priority[this.state]) return false
    this.release?.remove(false)
    this.release = undefined
    this.restoreCharacter()
    this.stopMotion()
    this.state = state
    this.fighter.setData('animationState', state)

    if (state === 'knockout') {
      this.sprite.setFrame(10)
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
      const animation = `${this.character.texture}-punch`
      this.sprite.setFrame(4).play(animation, true)
      this.sprite.once(`animationcomplete-${animation}`, () => {
        if (this.state !== 'punch') return
        this.finishAction()
      })
      return true
    }

    if (state === 'jump') {
      this.sprite
        .setFrame(3)
      this.scene.tweens.add({
        targets: this.sprite,
        y: this.baseY - 36,
        angle: this.direction * 5,
        duration: 190,
        yoyo: true,
        ease: 'Sine.Out',
      })
      this.scene.tweens.add({
        targets: this.shadow,
        scaleX: 0.72,
        scaleY: 0.66,
        alpha: 0.28,
        duration: 190,
        yoyo: true,
        ease: 'Sine.Out',
      })
      this.release = this.scene.time.delayedCall(duration.jump ?? 380, () => {
        if (this.state === 'jump') this.finishAction()
      })
      return true
    }

    if (state === 'kick') {
      this.sprite.setFrame(6).play(`${this.character.texture}-kick`, true)
      this.scene.tweens.add({
        targets: this.sprite,
        x: this.direction * 8,
        y: this.baseY - 3,
        angle: this.direction * 3,
        duration: 170,
        yoyo: true,
        ease: 'Cubic.Out',
      })
    } else if (state === 'dodge') {
      this.sprite.setFrame(8)
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
      this.sprite.setFrame(11)
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
      this.sprite.setFrame(9)
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
    this.restoreCharacter()
    this.stopMotion()
    this.state = next
    this.fighter.setData('animationState', next)
    this.sprite.setAlpha(1).setAngle(0).setPosition(0, this.baseY).setScale(this.baseScaleX, this.baseScaleY)
    if (next === 'walk') {
      this.sprite
        .setTexture(this.character.walkTexture, 0)
        .setOrigin(0.5, 0.95)
        .setDisplaySize(fighterDisplayWidth, fighterDisplayHeight)
        .play(`${this.character.texture}-walk`)
      this.sprite.anims.timeScale = 0.8
    } else this.startIdle()
  }

  private startIdle() {
    this.state = 'idle'
    this.fighter.setData('animationState', 'idle')
    this.restoreCharacter()
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
    this.restoreCharacter()
    this.setLocomotion()
  }

  private restoreCharacter() {
    this.sprite.stop()
    this.sprite
      .setTexture(this.character.texture, 0)
      .setOrigin(0.5, this.character.originY)
      .setDisplaySize(fighterDisplayWidth, fighterDisplayHeight)
  }

  private stopMotion() {
    this.scene.tweens.killTweensOf(this.sprite)
    this.scene.tweens.killTweensOf(this.shadow)
    this.shadow.setScale(1).setAlpha(0.52)
    this.sprite.setPosition(0, this.baseY).setAngle(0).setScale(this.baseScaleX, this.baseScaleY).setAlpha(1)
  }
}

export function flashCharacter(scene: Scene, fighter: Phaser.GameObjects.Container) {
  const sprite = fighter.getByName('fighter-sprite')
  if (!sprite || !('setTint' in sprite)) return

  const characterSprite = sprite as Phaser.GameObjects.Sprite
  characterSprite.setTint(0xffffff).setTintMode(TintModes.FILL)
  scene.time.delayedCall(90, () => {
    if (!characterSprite.active) return
    characterSprite.clearTint()
    characterSprite.setTintMode(TintModes.MULTIPLY)
  })
}
