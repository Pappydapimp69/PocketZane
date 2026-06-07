import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";

const PLAYER_SPEED = 300;

/**
 * The single starter scene.
 *
 * It draws a movable player with no external assets (a generated texture), so
 * the project runs immediately. Replace `preload` with real asset loading and
 * grow `create` / `update` as your game takes shape.
 */
export class MainScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;

  constructor() {
    super("MainScene");
  }

  preload(): void {
    // Generate a simple 40x40 player texture at runtime — no asset files needed.
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x4ade80, 1);
    g.fillRoundedRect(0, 0, 40, 40, 8);
    g.generateTexture("player", 40, 40);
    g.destroy();
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, 40, "Phaser Starter", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#e2e8f0",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 80, "Move with arrow keys or WASD", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#94a3b8",
      })
      .setOrigin(0.5);

    this.player = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "player");
    this.player.setCollideWorldBounds(true);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  update(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;

    if (left) body.setVelocityX(-PLAYER_SPEED);
    else if (right) body.setVelocityX(PLAYER_SPEED);

    if (up) body.setVelocityY(-PLAYER_SPEED);
    else if (down) body.setVelocityY(PLAYER_SPEED);

    // Normalize so diagonal movement isn't faster.
    body.velocity.normalize().scale(PLAYER_SPEED);
  }
}
