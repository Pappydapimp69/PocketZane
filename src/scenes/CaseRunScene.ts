import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../dimensions";
import { COLORS, CSS, DISPLAY, BODY, MONO, fs, uiScale } from "../theme";
import { Button } from "../ui";
import { MergedCase } from "../game/merged";
import { Interview } from "../game/interview";
import { WebInquiry } from "../game/web";
import { WELLS } from "../game/mergedcase";
import { generateMergedCase } from "../game/generateweb";
import { dailySeed, DAILY_OPTS, optsForNight, nightSeed, randomSeed, freeOpts } from "../game/ladder";
import { incBreaks, markDeepest, rankFor, getTotalBreaks, weirdnessBias, getBest, setBest, getNarration, getDifficulty, getReduceMotion, markCleanCase } from "../game/save";
import { SFX, startAmbience, stopSpeech, speak, toggleMute } from "../game/audio";
import { addAtmosphere, addRain } from "../game/textures";
import { paintPortrait, suspectName, temperament, Mood, Temperament } from "../game/portrait";
import { paintScene } from "../game/scenery";
import { verifyWeb } from "../game/verify";
import { todayStamp } from "../game/rng";
import { PAD } from "../input";

const LEFT = 30;
const WRAP = GAME_WIDTH - 60;

/** The merged loop: the interview (five questions, three rounds) → the
 *  constraint-web confrontation. */
export class CaseRunScene extends Phaser.Scene {
  private interview!: Interview;
  private web?: WebInquiry;
  private confronting = false;
  private title!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private hud!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private btnL!: Button;
  private btnR!: Button;
  private portrait?: Phaser.GameObjects.Image;
  private portraitBase = { x: 60, y: 96 };
  private mood: Mood = "neutral";
  private suspect = "";
  private role = "";
  private temper!: Temperament;
  private tense = false;
  private showHints = false; // structural confrontation cues — lenient difficulty only

  private paintSuspect(mood: Mood, blink = false): void {
    paintPortrait(this, "suspect", this.seedVal, mood, blink, this.tense && mood === "neutral");
  }

  private marks!: Phaser.GameObjects.Graphics;
  private selected: string | null = null;
  // confront render
  private blocks: Phaser.GameObjects.GameObject[] = [];
  // interview render
  private interviewRows: { id: string; y: number; h: number; selectable: boolean }[] = [];

  private busy = false;
  private overlayClose: (() => void) | null = null;
  private pickHandler: ((i: number) => void) | null = null;

  private theCase: MergedCase = WELLS;
  private seedVal = 1;
  private mode: "free" | "daily" | "endless" = "free";
  private night = 1;
  private runBase = 1;
  private standing = 3; // endless: marks of standing left; a sloppy break costs one
  private contentTop = 250; // where the testimony / web begins, below the header (scales with text size)
  private recorded = false;
  private confrontEntered = false;

  // two-detective match state (shared seed, hot-seat)
  private vsMode?: "versus" | "coop";
  private matchSeed = 0;
  private playerIdx = 0;
  private scores: number[] = [];
  private moves = 0;
  private coopTurn = 0;
  private matchBanner?: Phaser.GameObjects.Text;

  constructor() {
    super("CaseRun");
  }

  /** Fold the player's weirdness preference into a case's generation opts. */
  private withWeirdness<T extends { weirdness?: number }>(opts: T): T {
    return { ...opts, weirdness: Math.min(0.92, (opts.weirdness ?? 0) + weirdnessBias()) };
  }

  init(data: { generate?: boolean; seed?: number; fixed?: boolean; mode?: "free" | "daily" | "endless"; night?: number; runBase?: number; standing?: number; vsMode?: "versus" | "coop"; matchSeed?: number; playerIdx?: number; scores?: number[] }): void {
    this.mode = data?.mode ?? "free";
    this.recorded = false;
    this.moves = 0;
    this.coopTurn = 0;
    this.vsMode = data?.vsMode;
    if (this.vsMode) {
      // Both detectives play the identical case; versus scores it, co-op shares it.
      this.matchSeed = data?.matchSeed ?? randomSeed();
      this.playerIdx = data?.playerIdx ?? 0;
      this.scores = data?.scores ?? [];
      this.seedVal = this.matchSeed;
      this.theCase = generateMergedCase(this.seedVal, freeOpts(this.seedVal));
      return;
    }
    if (this.mode === "daily") {
      this.seedVal = dailySeed();
      this.theCase = generateMergedCase(this.seedVal, DAILY_OPTS);
    } else if (this.mode === "endless") {
      this.night = Math.max(1, data?.night ?? 1);
      this.runBase = data?.runBase ?? ((Date.now() & 0x7fffffff) >>> 0);
      this.standing = data?.standing ?? 3;
      this.seedVal = nightSeed(this.runBase, this.night);
      this.theCase = generateMergedCase(this.seedVal, this.withWeirdness(optsForNight(this.night)));
    } else if (data?.generate) {
      this.seedVal = data?.seed ?? randomSeed();
      // a curated file (fixed) plays exactly as listed; a fresh one folds in weirdness
      const opts = freeOpts(this.seedVal);
      this.theCase = generateMergedCase(this.seedVal, data?.fixed ? opts : this.withWeirdness(opts));
    } else {
      // The crafted reference case (reachable via the N shortcut).
      this.seedVal = data?.seed ?? 1;
      this.theCase = WELLS;
    }
  }

  create(): void {
    stopSpeech();
    this.cameras.main.fadeIn(360);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    addAtmosphere(this, { lamp: true });
    addRain(this, -1, 1);
    startAmbience();
    this.interview = new Interview(this.theCase.questions ?? [], this.theCase.rounds ?? 3);
    this.web = undefined;
    this.confronting = false;
    this.marks = this.add.graphics().setDepth(5);
    this.busy = false;

    const c = this.theCase;
    // The case may already name its subject ("Name — role"); a generated one gives
    // only a role ("the night porter"), so we supply a seeded name to go with it.
    if (c.subject.includes("—")) {
      const [n, r] = c.subject.split("—");
      this.suspect = n.trim();
      this.role = r.trim();
    } else if (/^the\b/i.test(c.subject)) {
      this.suspect = suspectName(this.seedVal);
      this.role = c.subject;
    } else {
      this.suspect = c.subject;
      this.role = "";
    }
    this.temper = temperament(this.seedVal);
    this.tense = /nervous|rattled/.test(this.temper.name);
    this.showHints = getDifficulty() === 0; // only lenient spells out the web's structure
    this.paintSuspect("neutral");
    paintScene(this, "crime", this.seedVal);
    this.mood = "neutral";

    this.cornerLink(14, 14, 0, "← leave", () => this.scene.start("TitleScene"));
    this.cornerLink(GAME_WIDTH - 14, 14, 1, "the file  (Y)", () => this.showFile(false));

    if (this.vsMode === "versus") {
      this.add.text(GAME_WIDTH / 2, 15, `DUEL  ·  Detective ${this.playerIdx === 0 ? "One" : "Two"}`, { fontFamily: MONO, fontSize: fs(10), color: CSS.amber }).setOrigin(0.5);
    } else if (this.vsMode === "coop") {
      this.matchBanner = this.add.text(GAME_WIDTH / 2, 15, "", { fontFamily: MONO, fontSize: fs(10), color: CSS.amber }).setOrigin(0.5);
    }

    // Character-profile header: the suspect's photo under the lamp, his particulars beside it.
    const px = this.portraitBase.x;
    const py = this.portraitBase.y;
    const frame = this.add.graphics().setDepth(5);
    frame.fillStyle(0x000000, 0.55);
    frame.fillRoundedRect(px - 46, py - 58, 92, 116, 4);
    frame.lineStyle(1.5, COLORS.panelEdge, 0.9);
    frame.strokeRoundedRect(px - 46, py - 58, 92, 116, 4);
    this.portrait = this.add.image(px, py, "suspect").setDisplaySize(84, 108).setDepth(6);

    // Header + content flow grows with the text-size setting so nothing collides.
    const s = uiScale();
    const ix = 120;
    const tag = this.mode === "daily" ? "today's subject" : this.mode === "endless" ? `night ${this.night}  ·  ${"◆".repeat(Math.max(0, this.standing))}${"◇".repeat(Math.max(0, 3 - this.standing))}` : "the subject";
    let hy = 46;
    this.add.text(ix, hy, this.suspect, { fontFamily: DISPLAY, fontSize: fs(19), color: CSS.ink }).setOrigin(0, 0);
    hy += 26 * s;
    this.add.text(ix, hy, this.role ? `${tag}  ·  ${this.role}` : tag, { fontFamily: MONO, fontSize: fs(11), color: CSS.faint, wordWrap: { width: GAME_WIDTH - ix - 14 } }).setOrigin(0, 0);
    hy += 18 * s;
    this.add.text(ix, hy, c.title, { fontFamily: DISPLAY, fontSize: fs(13), color: CSS.muted, fontStyle: "italic" }).setOrigin(0, 0);
    hy += 22 * s;
    // once the header has dropped past the portrait (large text sizes), the HUD
    // can use the full width instead of the narrow column beside the photo.
    const hudX = hy > py + 58 ? LEFT : ix;
    this.hud = this.add.text(hudX, hy, "", { fontFamily: MONO, fontSize: fs(12), color: CSS.faint }).setOrigin(0, 0);
    hy += 16 * s;

    const ruleY = Math.max(158, Math.round(hy + 8)); // clear both the portrait and the header text
    const rule = this.add.graphics();
    rule.fillStyle(COLORS.panelEdge, 0.6);
    rule.fillRect(40, ruleY, GAME_WIDTH - 80, 1);
    const titleY = ruleY + Math.round(24 * s);
    this.title = this.add.text(GAME_WIDTH / 2, titleY, "", { fontFamily: DISPLAY, fontSize: fs(18), color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5);
    const promptY = titleY + Math.round(22 * s);
    this.prompt = this.add.text(GAME_WIDTH / 2, promptY, "", { fontFamily: BODY, fontSize: fs(13), color: CSS.muted, align: "center", wordWrap: { width: 430 } }).setOrigin(0.5);
    this.contentTop = promptY + Math.round(46 * s);

    this.status = this.add.text(GAME_WIDTH / 2, 748, "", { fontFamily: BODY, fontSize: fs(14), color: CSS.muted, fontStyle: "italic", align: "center", wordWrap: { width: 444 } }).setOrigin(0.5);
    this.btnL = new Button(this, 116, 810, { w: 200, h: 50, label: "", fontSize: 13, accent: COLORS.slate, onClick: () => this.actL() });
    this.btnR = new Button(this, 332, 810, { w: 200, h: 50, label: "", fontSize: 13, accent: COLORS.crimson, onClick: () => this.actR() });

    this.setupInput();
    this.startIdle();
    this.enterMode();
    this.showFile(true);
  }

  /** Small involuntary life: the suspect breathes, and blinks now and then. */
  private startIdle(): void {
    const p = this.portrait;
    if (!p || getReduceMotion()) return;
    this.breathe();
    this.time.addEvent({
      delay: this.temper?.blinkMs ?? 3400,
      loop: true,
      callback: () => {
        if (this.busy || this.mood !== "neutral") return;
        this.paintSuspect("neutral", true);
        this.time.delayedCall(120, () => {
          if (this.mood === "neutral") this.paintSuspect("neutral", false);
        });
      },
    });
  }

  private enterMode(): void {
    this.selected = null;
    this.marks.clear();
    this.blocks.forEach((b) => b.destroy());
    this.blocks = [];
    if (this.confronting) {
      this.title.setText("The Confrontation");
      this.prompt.setText("He gives it to you whole now. A head-on hit will deflect — find what's propping each lie up.");
      this.btnL.setLabel("PRESS HIM  (A)");
      this.btnR.setLabel("THE FILE  (X)");
      this.renderWeb();
      if (!this.confrontEntered) {
        this.confrontEntered = true;
        SFX.heart(); // a single thump as he commits to the whole story
      }
    } else {
      this.title.setText("The Interview");
      this.prompt.setText("Three questions of five. Read his answers — where two don't square, press the lie.");
      this.btnR.setLabel("THE FILE  (X)");
      this.renderInterview();
    }
    this.setMood("neutral");
    this.updateHud();
    this.updateCoopBanner();
    this.setStatus("");
  }

  private updateCoopBanner(): void {
    if (this.vsMode !== "coop" || !this.matchBanner) return;
    this.matchBanner.setText(`PARTNERS  ·  ▶ Detective ${this.coopTurn === 0 ? "One" : "Two"}'s move`);
  }

  /** Count a committed action; in co-op, hand the pad to the other detective. */
  private tick(): void {
    this.moves++;
    if (this.vsMode === "coop") {
      this.coopTurn ^= 1;
      this.updateCoopBanner();
    }
  }

  /** Drive the portrait's expression and posture from the interrogation. */
  private setMood(m: Mood): void {
    if (m === this.mood) return;
    this.mood = m;
    this.paintSuspect(m);
    const p = this.portrait;
    if (!p) return;
    this.tweens.killTweensOf(p);
    const b = this.portraitBase;
    if (m === "evasive") {
      this.tweens.add({ targets: p, x: b.x - 5, y: b.y, angle: -4, alpha: 1, duration: 260, ease: "Sine.easeOut" });
    } else if (m === "pressed") {
      p.setPosition(b.x, b.y).setAngle(0).setAlpha(1);
      this.tweens.add({ targets: p, x: { from: b.x - 3, to: b.x + 3 }, duration: 55, yoyo: true, repeat: 5, onComplete: () => p.setX(b.x) });
    } else if (m === "broken") {
      this.tweens.add({ targets: p, x: b.x, y: b.y + 7, angle: 4, alpha: 0.9, duration: 440, ease: "Sine.easeOut" });
    } else {
      this.tweens.add({ targets: p, x: b.x, y: b.y, angle: 0, alpha: 1, duration: 300, ease: "Sine.easeOut", onComplete: () => this.breathe() });
    }
  }

  private breathe(): void {
    const p = this.portrait;
    if (!p || getReduceMotion()) return;
    const base = 108 / 280; // the displaySize scaleY
    p.scaleY = base;
    this.tweens.add({ targets: p, scaleY: { from: base, to: base * 1.02 }, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private updateHud(): void {
    if (this.confronting && this.web) {
      this.hud.setText(`alibi  ${this.web.brokenCount}/${this.web.total} broken    ·    leads ${this.web.heldEvidence().length}`);
    } else {
      const left = this.interview.roundsLeft;
      const dots = "●".repeat(left) + "○".repeat(Math.max(0, this.interview.rounds - left));
      this.hud.setText(`questions ${dots}    ·    leads ${this.interview.heldLevers().length}`);
    }
  }

  private setStatus(msg: string, color: string = CSS.muted): void {
    this.status.setText(msg).setColor(color);
  }

  // ---- input -----------------------------------------------------------------

  private setupInput(): void {
    const kb = this.input.keyboard;
    kb?.on("keydown-UP", () => this.onPad(PAD.UP));
    kb?.on("keydown-DOWN", () => this.onPad(PAD.DOWN));
    kb?.on("keydown-ENTER", () => this.onPad(PAD.A));
    kb?.on("keydown-SPACE", () => this.onPad(PAD.A));
    kb?.on("keydown-X", () => this.onPad(PAD.X));
    kb?.on("keydown-Y", () => this.onPad(PAD.Y));
    kb?.on("keydown-F", () => this.scale.toggleFullscreen());
    kb?.on("keydown-M", () => void toggleMute());
    this.input.gamepad?.on("down", (_p: Phaser.Input.Gamepad.Gamepad, b: Phaser.Input.Gamepad.Button) => this.onPad(b.index));
  }

  private onPad(i: number): void {
    if (this.busy) {
      if (this.pickHandler) {
        this.pickHandler(i);
        return;
      }
      if ((i === PAD.A || i === PAD.B || i === PAD.START || i === PAD.Y) && this.overlayClose) this.overlayClose();
      return;
    }
    if (this.confronting) {
      if (i === PAD.A || i === PAD.LT) this.doPresent();
      else if (i === PAD.X || i === PAD.Y) this.showFile(false);
      return;
    }
    if (i === PAD.UP) this.moveSelection(-1);
    else if (i === PAD.DOWN) this.moveSelection(1);
    else if (i === PAD.A) this.doAct();
    else if (i === PAD.Y) this.showFile(false);
  }
  private actL(): void {
    if (this.confronting) this.doPresent();
    else this.doAct();
  }
  private actR(): void {
    this.showFile(false);
  }

  // ---- interview: five questions, three rounds -------------------------------

  private renderInterview(): void {
    this.blocks.forEach((b) => b.destroy());
    this.blocks = [];
    this.interviewRows = [];
    const s = uiScale();
    let y = this.contentTop;

    // The list reads as a transcript: an asked question keeps his answer beneath
    // it, so the player can re-read his own words and spot what doesn't square.
    for (const q of this.interview.questions) {
      const asked = this.interview.isAsked(q.id);
      const caught = q.kind === "lie" && this.interview.isCaught(q.id);
      const pressable = this.interview.canPress(q.id);
      const locked = !asked && this.interview.roundsLeft <= 0;
      // an asked lie can always be *challenged* (the press only lands if you're
      // right); unasked questions can be asked while rounds remain.
      const challengeable = asked && q.kind === "lie" && !caught;
      const selectable = (!asked && this.interview.roundsLeft > 0) || challengeable;
      const top = y;

      let prefix = "▸ ";
      let qColor: string = CSS.ink;
      let qLabel = q.ask;
      if (caught) {
        prefix = "✓ ";
        qColor = CSS.crimsonBright;
      } else if (asked) {
        prefix = "· ";
        qColor = CSS.muted;
        // only lenient names the slip and what to do; at standard the player must
        // notice the conflict in the transcript and challenge the right claim.
        if (pressable && this.showHints) {
          prefix = "‣ ";
          qColor = CSS.amber;
          qLabel = this.interview.pressVia(q.id) === "contradiction" ? `${q.ask}   — his own words don't square; press` : `${q.ask}   — press him on it`;
        }
      } else if (locked) {
        prefix = "  ";
        qColor = CSS.faint;
        qLabel = "— a question you'll never get to ask —";
      }

      const qt = this.add.text(LEFT + 6, y, prefix + qLabel, { fontFamily: BODY, fontSize: fs(15), color: qColor, fontStyle: asked && !caught ? "normal" : "normal", wordWrap: { width: GAME_WIDTH - 64 }, lineSpacing: 2 }).setDepth(6);
      if (selectable) {
        qt.setInteractive({ useHandCursor: true });
        qt.on("pointerup", () => this.onQuestionTap(q.id));
      }
      this.blocks.push(qt);
      y += qt.height + 2;

      // his recorded answer beneath the question
      if (asked) {
        const aColor = caught ? CSS.faint : q.kind === "dud" ? CSS.faint : CSS.amber;
        const at = this.add.text(LEFT + 22, y, `“${q.answer}”`, { fontFamily: BODY, fontSize: fs(13), color: aColor, fontStyle: "italic", wordWrap: { width: GAME_WIDTH - 80 }, lineSpacing: 2 }).setDepth(6);
        if (selectable) {
          at.setInteractive({ useHandCursor: true });
          at.on("pointerup", () => this.onQuestionTap(q.id));
        }
        this.blocks.push(at);
        y += at.height + 2;
      }

      this.interviewRows.push({ id: q.id, y: top, h: y - top, selectable });
      y += Math.round(10 * s);
    }

    this.updateInterviewButton();
    this.drawSelection();
  }

  private updateInterviewButton(): void {
    this.btnL.setLabel(this.interviewExhausted() ? "CONFRONT HIM  (A)" : "ASK / PRESS  (A)");
  }
  private interviewExhausted(): boolean {
    return this.interview.roundsLeft <= 0 && !this.interview.questions.some((q) => this.interview.canPress(q.id));
  }

  private interviewSelectable(): string[] {
    return this.interviewRows.filter((r) => r.selectable).map((r) => r.id);
  }
  private moveSelection(dir: number): void {
    if (this.confronting) return;
    const ids = this.interviewSelectable();
    if (ids.length === 0) return;
    const cur = this.selected ? ids.indexOf(this.selected) : -1;
    const next = cur < 0 ? (dir > 0 ? 0 : ids.length - 1) : Phaser.Math.Wrap(cur + dir, 0, ids.length);
    this.selected = ids[next];
    this.drawSelection();
    SFX.select();
  }
  private onQuestionTap(id: string): void {
    if (this.busy || this.confronting) return;
    this.selected = id;
    this.drawSelection();
    SFX.select();
    this.doAct();
  }
  private drawSelection(): void {
    const g = this.marks;
    g.clear();
    const row = this.interviewRows.find((r) => r.id === this.selected);
    if (row) {
      g.fillStyle(COLORS.amber, 0.14);
      g.fillRoundedRect(LEFT - 2, row.y - 3, GAME_WIDTH - 2 * LEFT + 8, row.h + 6, 4);
    }
  }

  private doAct(): void {
    if (this.busy) return;
    const sel = this.selected ?? this.interviewSelectable()[0];
    if (!sel) {
      this.startConfront();
      return;
    }
    if (!this.interview.isAsked(sel)) {
      this.doAsk(sel);
      return;
    }
    // an already-asked claim: a challenge. It only lands if his words back it up.
    if (this.interview.canPress(sel)) this.doPress(sel);
    else this.doWrongPress(sel);
  }

  /** Challenging a claim his own answers do NOT actually undercut — he rebuffs it.
   *  No catch, no cost: the interview is a place to test your reading, not a trap. */
  private doWrongPress(id: string): void {
    const q = this.interview.questions.find((x) => x.id === id);
    if (!q || q.kind !== "lie") return;
    SFX.deny();
    this.setMood("neutral");
    this.setStatus("His answers square well enough there. Nothing to break — find where they don't.", CSS.slate);
  }

  private doAsk(id: string): void {
    const before = this.interview.contradictions().length;
    const r = this.interview.ask(id);
    if (r.kind === "none") return;
    this.tick();
    this.selected = null;
    SFX.murmur(this.seedVal);

    this.say(r.q.answer);
    if (r.kind === "lever") {
      this.setMood("evasive");
      this.renderInterview();
      this.time.delayedCall(450, () => this.centerToast("A lever:  " + this.leadLabel(r.q.evId!)));
      this.setStatus("A record he can't wave off. It breaks one of his claims.", CSS.amber);
    } else if (r.kind === "lie") {
      this.setMood(this.interview.canPress(id) ? "pressed" : "neutral");
      this.renderInterview();
      this.setStatus("He commits to it. Watch it against the rest.", CSS.muted);
    } else if (r.kind === "tell") {
      this.setMood("neutral");
      this.renderInterview();
      // lenient nudges toward the mechanic; standard just records his answer
      this.setStatus(this.showHints ? "Mark that — weigh it against the rest of what he's said." : "He offers that without prompting.", CSS.muted);
    } else {
      this.setMood("neutral");
      this.renderInterview();
      this.setStatus("Nothing in that. A round spent.", CSS.slate);
    }
    // When two of his own answers collide, ONLY lenient announces it. At standard
    // the conflict is the player's to spot in the transcript — the game says nothing.
    const fresh = this.interview.contradictions();
    if (this.showHints && fresh.length > before) {
      const c = fresh[fresh.length - 1];
      this.shake(120, 0.003);
      this.time.delayedCall(r.kind === "lever" ? 1500 : 550, () => this.centerToast("His own words don't square — " + (c.tell.clash ?? "two answers collide")));
      this.setStatus("His own words don't square. No record needed — press that lie.", CSS.crimsonBright);
    }
    this.updateHud();
  }

  private doPress(id: string): void {
    const via = this.interview.pressVia(id);
    const r = this.interview.press(id);
    if (r.kind !== "caught") return;
    this.tick();
    const name = this.theCase.web.segments.find((sg) => sg.id === r.q.seg)?.name ?? "his story";
    SFX.pin();
    SFX.break();
    this.flash(COLORS.crimson, 0.22);
    this.shake(180, 0.005);
    this.setMood("pressed");
    this.selected = null;
    // the catch lands at once — the prop is struck, the toast hits
    this.renderInterview();
    this.updateHud();
    this.centerToast(via === "contradiction" ? `Caught in his own words — ${name} was a lie.` : `Caught — ${name} was a lie.`);
    this.setStatus("Caught him cold. That prop's down before he's even confronted.", CSS.crimsonBright);
    // …and a beat later he patches the hole with a fresh lie (a non-blocking flourish)
    this.time.delayedCall(750, () => {

      this.say(r.patch);
      this.setMood("evasive");
      this.renderInterview();
    });
  }

  private leadLabel(evId: string): string {
    return this.theCase.web.evidence.find((e) => e.id === evId)?.label ?? evId;
  }

  private startConfront(): void {
    this.busy = true;
    this.web = this.interview.toWeb(this.theCase.web, this.seedVal);
    const o = this.add.container(0, 0).setDepth(110);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.9));
    o.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, "— he gives you the whole of it —", { fontFamily: DISPLAY, fontSize: fs(20), color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    o.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 16, "Now break what he's left standing.", { fontFamily: BODY, fontSize: fs(14), color: CSS.muted }).setOrigin(0.5));
    this.time.delayedCall(1500, () => {
      o.destroy();
      this.busy = false;
      this.confronting = true;
      this.enterMode();
    });
  }

  // ---- confront: the web -----------------------------------------------------

  private renderWeb(): void {
    this.blocks.forEach((b) => b.destroy());
    this.blocks = [];
    const views = this.web!.segments();
    const broken = new Set(views.filter((v) => v.broken).map((v) => v.id));
    const baseOf = new Map(this.theCase.web.segments.map((s) => [s.id, s.base]));
    // tighten for big webs so they never run past the status line
    const big = views.length > 5;
    const bodyPx = big ? 15 : 16;
    const gap = Math.round((big ? 14 : 22) * uiScale());
    const lg = Math.round(18 * uiScale()); // label-to-body offset, scaled
    let y = this.contentTop;
    for (const s of views) {
      // once a claim has deflected, its text becomes his fresh excuse — show it as his words
      const deflected = !s.broken && s.text !== baseOf.get(s.id);
      const label = this.add.text(LEFT, y, `「 ${s.name}${s.key ? " ✦" : ""} 」`, { fontFamily: MONO, fontSize: fs(11), color: s.broken ? CSS.faint : CSS.muted }).setDepth(6);
      this.blocks.push(label);
      const body = this.add.text(LEFT, y + lg, deflected ? `“${s.text}”` : s.text, { fontFamily: BODY, fontSize: fs(bodyPx), color: s.broken ? CSS.faint : deflected ? CSS.amber : CSS.ink, fontStyle: deflected ? "italic" : "normal", wordWrap: { width: WRAP }, lineSpacing: 2 }).setDepth(6);
      this.blocks.push(body);
      let cy = y + lg + body.height + 4;
      if (s.broken) {
        const g = this.add.graphics().setDepth(7);
        g.lineStyle(1.6, COLORS.crimson, 0.9);
        g.lineBetween(LEFT, y + lg + body.height / 2, LEFT + body.width, y + lg + body.height / 2);
        this.blocks.push(g);
      } else if (this.showHints && s.leansOn) {
        // lenient only: spell out the dependency so newcomers can learn the shape
        const gone = broken.has(s.leansOn);
        const txt = gone ? `↳ its cover (${this.web!.segmentName(s.leansOn)}) is gone — press it now` : `↳ leaning on ${this.web!.segmentName(s.leansOn)} — break that first`;
        const note = this.add.text(LEFT + 12, cy, txt, { fontFamily: MONO, fontSize: fs(11), color: gone ? CSS.crimsonBright : CSS.amber }).setDepth(6);
        this.blocks.push(note);
        cy += note.height + 2;
      } else if (this.showHints && s.propsUp.length > 0) {
        const note = this.add.text(LEFT + 12, cy, `↑ this is holding up ${s.propsUp.map((p) => this.web!.segmentName(p)).join(", ")}`, { fontFamily: MONO, fontSize: fs(11), color: CSS.amber }).setDepth(6);
        this.blocks.push(note);
        cy += note.height + 2;
      }
      y = cy + gap;
    }
  }

  private doPresent(): void {
    if (this.busy) return;
    if (this.web!.heldEvidence().length === 0) {
      this.setStatus("Your file is empty.", CSS.muted);
      return;
    }
    this.showPicker();
  }

  private resolve(evId: string): void {
    this.tick();
    const r = this.web!.present(evId);
    switch (r.kind) {
      case "deflect": {
        SFX.flicker();
        SFX.murmur(this.seedVal ^ 0x55);
        this.renderWeb();
        this.updateHud();
        this.setMood("evasive");
        const via = this.web!.segmentName(r.via);
        const tgt = this.web!.segmentName(r.target);
        this.say(r.text);
        this.setStatus(this.showHints ? `He slips it. ${tgt} hides behind ${via} — so take ${via} apart first.` : `He slips it. ${tgt} hides behind ${via}.`, CSS.amber);
        if (r.revealed) this.time.delayedCall(900, () => this.centerToast("That shakes loose:  " + r.revealed!.label));
        break;
      }
      case "break": {
        SFX.pin();
        this.renderWeb();
        this.updateHud();
        this.setMood(r.solved || (r.keystone && r.cascaded && r.cascaded.length) ? "broken" : "pressed");
        if (r.keystone && r.cascaded && r.cascaded.length) {
          SFX.break();
          this.shake(320, 0.008);
          this.flash(COLORS.crimson, 0.32);
          this.setStatus("It evaporates — there was never a floor under it. Everything leaning on it comes down at once.", CSS.crimsonBright);
        } else {
          this.setStatus(r.solved ? "It caves — and the whole story with it." : this.showHints ? `${this.web!.segmentName(r.target)} collapses. Whatever it covered is exposed now — press it.` : `${this.web!.segmentName(r.target)} collapses.`, CSS.crimsonBright);
        }
        if (r.solved) {
          this.flash(COLORS.amber, 0.22);
          this.time.delayedCall(1100, () => this.solve());
        }
        break;
      }
      case "already":
        SFX.deny();
        this.setStatus("That's already in pieces.", CSS.muted);
        break;
      default:
        SFX.deny();
        this.setStatus("He shrugs it off — that doesn't bear on this.", CSS.slate);
    }
  }

  // ---- overlays --------------------------------------------------------------

  /** A small corner link with a finger-sized tap zone (touch-first). */
  private cornerLink(x: number, y: number, originX: 0 | 1, label: string, onTap: () => void): void {
    const t = this.add.text(x, y, label, { fontFamily: MONO, fontSize: fs(11), color: CSS.faint }).setOrigin(originX, 0).setDepth(7);
    const zone = this.add.rectangle(x + (originX === 1 ? -t.width / 2 : t.width / 2), y + 8, t.width + 36, 40, 0x000000, 0).setInteractive({ useHandCursor: true });
    zone.on("pointerover", () => t.setColor(CSS.muted));
    zone.on("pointerout", () => t.setColor(CSS.faint));
    zone.on("pointerup", onTap);
  }

  /** Voice a suspect's line when narration is on (accessibility / immersion). */
  private say(line: string): void {
    if (getNarration() && line) speak(line);
  }

  /** A brief full-screen colour wash — for the moment the floor gives out. */
  private flash(color: number, alpha: number): void {
    const r = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, color, getReduceMotion() ? alpha * 0.5 : alpha).setDepth(95);
    this.tweens.add({ targets: r, alpha: 0, duration: getReduceMotion() ? 260 : 520, ease: "Quad.easeOut", onComplete: () => r.destroy() });
  }

  private shake(duration: number, intensity: number): void {
    if (!getReduceMotion()) this.cameras.main.shake(duration, intensity);
  }

  private centerToast(msg: string): void {
    const t = this.add.text(GAME_WIDTH / 2, 700, msg, { fontFamily: MONO, fontSize: fs(12), color: CSS.amber, align: "center", wordWrap: { width: 440 } }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, delay: 2200, duration: 700, onComplete: () => t.destroy() });
  }

  private showPicker(): void {
    this.busy = true;
    const leads = this.web!.heldEvidence();
    const o = this.add.container(0, 0).setDepth(120);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.96));
    o.add(this.add.text(GAME_WIDTH / 2, 100, "press him with what?", { fontFamily: DISPLAY, fontSize: fs(23), color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    const rows: Button[] = [];
    let y = 156;
    leads.forEach((e) => {
      const b = new Button(this, GAME_WIDTH / 2, y, { w: 430, h: 46, label: e.label, fontSize: 12, accent: COLORS.slate, onClick: () => choose(e.id) });
      rows.push(b);
      o.add(b);
      // lenient only: name the claim each lead bears on; otherwise that's for you to work out
      if (this.showHints) o.add(this.add.text(GAME_WIDTH / 2, y + 27, `bears on  ${this.web!.segmentName(e.targets)}`, { fontFamily: MONO, fontSize: fs(10), color: CSS.faint }).setOrigin(0.5));
      y += 66;
    });
    const cancelBtn = new Button(this, GAME_WIDTH / 2, Math.min(y + 8, GAME_HEIGHT - 56), { w: 180, h: 46, label: "CANCEL  (B)", accent: COLORS.crimson, onClick: () => close() });
    o.add(cancelBtn);
    const items = [...rows, cancelBtn];
    let focus = 0;
    const paint = () => items.forEach((b, idx) => b.setActive2(idx === focus));
    paint();
    const close = () => {
      o.destroy();
      this.busy = false;
      this.overlayClose = null;
      this.pickHandler = null;
    };
    const choose = (id: string) => {
      close();
      this.resolve(id);
    };
    this.overlayClose = close;
    this.pickHandler = (i: number) => {
      if (i === PAD.UP) {
        focus = Phaser.Math.Wrap(focus - 1, 0, items.length);
        paint();
        SFX.select();
      } else if (i === PAD.DOWN) {
        focus = Phaser.Math.Wrap(focus + 1, 0, items.length);
        paint();
        SFX.select();
      } else if (i === PAD.A || i === PAD.X) {
        if (focus < rows.length) choose(leads[focus].id);
        else close();
      } else if (i === PAD.B) close();
    };
  }

  private showFile(initial: boolean): void {
    const c = this.theCase;
    this.busy = true;
    const o = this.add.container(0, 0).setDepth(120);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 1));
    o.add(this.add.text(GAME_WIDTH / 2, 38, "the file", { fontFamily: DISPLAY, fontSize: fs(24), color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));

    // the scene-of-the-fall photograph, clipped in a paper frame
    if (this.textures.exists("crime")) {
      const cw = GAME_WIDTH - 48;
      const ch = (cw / 440) * 210;
      const cyTop = 64;
      const fr = this.add.graphics();
      fr.lineStyle(2, COLORS.panelEdge, 0.9);
      fr.strokeRect(24, cyTop, cw, ch);
      o.add(fr);
      o.add(this.add.image(GAME_WIDTH / 2, cyTop + ch / 2, "crime").setDisplaySize(cw, ch));
      o.add(this.add.text(GAME_WIDTH / 2, cyTop + ch - 12, "the scene, as found", { fontFamily: MONO, fontSize: fs(10), color: CSS.faint }).setOrigin(0.5));
    }

    // suspect mug + particulars
    const mugY = 318;
    if (this.textures.exists("suspect")) {
      const fr2 = this.add.graphics();
      fr2.fillStyle(0x000000, 0.5);
      fr2.fillRoundedRect(28, mugY - 50, 80, 100, 3);
      fr2.lineStyle(1.5, COLORS.panelEdge, 0.9);
      fr2.strokeRoundedRect(28, mugY - 50, 80, 100, 3);
      o.add(fr2);
      o.add(this.add.image(68, mugY, "suspect").setDisplaySize(74, 94));
    }
    o.add(this.add.text(122, mugY - 48, this.suspect, { fontFamily: DISPLAY, fontSize: fs(18), color: CSS.ink }).setOrigin(0, 0));
    o.add(this.add.text(122, mugY - 24, this.role || c.subject, { fontFamily: MONO, fontSize: fs(11), color: CSS.amber }).setOrigin(0, 0));
    o.add(this.add.text(122, mugY - 6, this.temper.tell, { fontFamily: BODY, fontSize: fs(12), color: CSS.muted, fontStyle: "italic", wordWrap: { width: 330 } }).setOrigin(0, 0));
    const partic = this.add.text(122, mugY + 30, `${c.brief.where}  ${c.brief.when}`, { fontFamily: MONO, fontSize: fs(10), color: CSS.faint, lineSpacing: 3, wordWrap: { width: 330 } }).setOrigin(0, 0);
    o.add(partic);

    // brief flows below whichever runs longer — the mug or the particulars — so
    // it never collides as the text size grows.
    const bodyY = Math.max(mugY + 56, partic.y + partic.height + 14);
    const body = `${c.brief.what}\n\n${c.brief.why}\n\n— ${c.brief.goal}`;
    o.add(this.add.text(GAME_WIDTH / 2, bodyY, body, { fontFamily: BODY, fontSize: fs(14), color: CSS.ink, align: "left", wordWrap: { width: 408 }, lineSpacing: 6 }).setOrigin(0.5, 0));
    const leads = this.confronting ? this.web!.heldEvidence().map((e) => e.label) : [];
    const ev = this.confronting && leads.length ? "leads in hand:\n" + leads.map((l) => "•  " + l).join("\n") : "";
    if (ev) o.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 150, ev, { fontFamily: MONO, fontSize: fs(11), color: CSS.muted, align: "left", wordWrap: { width: 408 }, lineSpacing: 4 }).setOrigin(0.5, 1));
    const close = () => {
      o.destroy();
      this.busy = false;
      this.overlayClose = null;
    };
    this.overlayClose = close;
    o.add(new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 64, { w: 220, h: 50, label: initial ? "BEGIN  (A)" : "CLOSE  (A/Y)", accent: COLORS.crimson, onClick: close }));
  }

  /** Solving a case feeds the record: a break toward rank, plus depth in endless. */
  private recordWin(): void {
    if (this.recorded || this.vsMode) return; // matches don't touch the solo record
    this.recorded = true;
    incBreaks();
    if (this.mode === "endless") markDeepest(this.night);
  }

  // ---- two-detective match endings ------------------------------------------

  private versusEnd(): void {
    this.busy = true;
    const score = this.moves;
    const next = [...this.scores, score];
    if (this.playerIdx === 0) {
      this.matchOverlay("Detective One has it", `Cracked in ${score} moves.`, "Pass the pad — Detective Two gets the same case, the same lies.", "DETECTIVE TWO  (A)", () =>
        this.scene.start("CaseRun", { vsMode: "versus", matchSeed: this.matchSeed, playerIdx: 1, scores: next }),
      );
    } else {
      const a = this.scores[0];
      const b = score;
      const verdict = a === b ? "A dead heat" : a < b ? "Detective One takes it" : "Detective Two takes it";
      this.matchOverlay(verdict, `One: ${a} moves     Two: ${b} moves`, "Fewer moves is the cleaner break.", "DONE  (A)", () => this.scene.start("TitleScene"));
    }
  }

  private coopEnd(): void {
    this.busy = true;
    this.matchOverlay("Partners — closed", `Solved together in ${this.moves} moves.`, "Two minds, one confession.", "DONE  (A)", () => this.scene.start("TitleScene"));
  }

  private matchOverlay(title: string, score: string, flavor: string, btnLabel: string, onGo: () => void): void {
    SFX.break();
    const o = this.add.container(0, 0).setDepth(150);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 1));
    if (this.textures.exists("grain")) o.add(this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "grain").setOrigin(0).setAlpha(0.5));
    if (this.textures.exists("vignette")) o.add(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "vignette"));
    o.add(this.add.text(GAME_WIDTH / 2, 96, title, { fontFamily: DISPLAY, fontSize: fs(26), color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    o.add(this.add.text(GAME_WIDTH / 2, 134, score, { fontFamily: MONO, fontSize: fs(14), color: CSS.ink }).setOrigin(0.5));
    if (this.textures.exists("suspect")) {
      this.paintSuspect("broken");
      const fr = this.add.graphics();
      fr.fillStyle(0x000000, 0.5);
      fr.fillRoundedRect(GAME_WIDTH / 2 - 36, 160, 72, 92, 4);
      fr.lineStyle(1.5, COLORS.panelEdge, 0.9);
      fr.strokeRoundedRect(GAME_WIDTH / 2 - 36, 160, 72, 92, 4);
      o.add(fr);
      o.add(this.add.image(GAME_WIDTH / 2, 206, "suspect").setDisplaySize(66, 84));
      o.add(this.inkStamp(GAME_WIDTH / 2 + 20, 188, "CASE CLOSED"));
    }
    o.add(this.add.text(GAME_WIDTH / 2, 268, this.theCase.resolution, { fontFamily: BODY, fontSize: fs(14), color: CSS.muted, align: "left", wordWrap: { width: 408 }, lineSpacing: 6 }).setOrigin(0.5, 0));
    o.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 150, flavor, { fontFamily: MONO, fontSize: fs(11), color: CSS.faint, align: "center", wordWrap: { width: 408 } }).setOrigin(0.5));
    this.overlayClose = onGo;
    o.add(new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 72, { w: 240, h: 50, label: btnLabel, accent: COLORS.crimson, onClick: onGo }));
  }

  /** Rate the run against the solver's par: phases (a question+pin each) plus the
   * number of lies that had to fall. Records a personal best for repeatable cases. */
  private gradeRun(): { par: number; rating: string; best: number | null; clean: boolean } {
    const order = verifyWeb(this.theCase.web, this.theCase.web.startEvidence).order;
    const par = Math.max(2, (this.theCase.rounds ?? 3) + 0 + order.length);
    const ratio = this.moves / par;
    const clean = this.moves <= par; // at or under the solver's par
    const rating = clean ? "a clean break  ✦" : ratio <= 1.5 ? "workmanlike" : ratio <= 2.1 ? "the long way round" : "you got there in the end";
    let best: number | null = null;
    if (this.mode === "daily" || this.mode === "free") {
      // daily key matches the record screen's lookup (daily-YYYY-MM-DD)
      const key = this.mode === "daily" ? `daily-${todayStamp()}` : `case-${this.seedVal}`;
      const prev = getBest(key);
      setBest(key, this.moves);
      if (clean) markCleanCase(key);
      best = prev != null ? Math.min(prev, this.moves) : null;
    }
    return { par, rating, best, clean };
  }

  /** A rotated crimson rubber-stamp, drawn in code. */
  private inkStamp(cx: number, cy: number, text: string): Phaser.GameObjects.Container {
    const c = this.add.container(cx, cy).setAngle(-13).setAlpha(0.72);
    const t = this.add.text(0, 0, text, { fontFamily: DISPLAY, fontSize: fs(20), color: "#b23a2e", fontStyle: "bold" }).setOrigin(0.5);
    const g = this.add.graphics();
    g.lineStyle(2.5, 0xb23a2e, 0.9);
    g.strokeRoundedRect(-t.width / 2 - 10, -t.height / 2 - 5, t.width + 20, t.height + 10, 4);
    c.add([g, t]);
    c.setScale(0.2);
    this.tweens.add({ targets: c, scale: 1, duration: getReduceMotion() ? 0 : 260, ease: "Back.easeOut", delay: 360 });
    return c;
  }

  private solve(): void {
    if (this.vsMode === "versus") return this.versusEnd();
    if (this.vsMode === "coop") return this.coopEnd();
    this.busy = true;
    this.recordWin();
    // Efficiency grade, computed once. In endless only a genuinely inefficient
    // break (worse than "workmanlike" — past 1.5x the solver's par) costs standing,
    // so a competent run carries on; sloppiness is what ends the night.
    const grade = this.gradeRun();
    if (this.mode === "endless" && this.moves > grade.par * 1.5) this.standing -= 1;
    const runOver = this.mode === "endless" && this.standing <= 0;
    const o = this.add.container(0, 0).setDepth(140);
    o.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.97));
    if (this.textures.exists("grain")) o.add(this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "grain").setOrigin(0).setAlpha(0.5));
    if (this.textures.exists("vignette")) o.add(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "vignette"));
    if (runOver) SFX.heart();
    else SFX.break();

    const reso = this.add.container(0, 0);
    reso.add(this.add.text(GAME_WIDTH / 2, 84, runOver ? "the night beats you" : "the story breaks", { fontFamily: DISPLAY, fontSize: fs(26), color: runOver ? CSS.slate : CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    if (this.textures.exists("suspect")) {
      this.paintSuspect("broken");
      const fr = this.add.graphics();
      fr.fillStyle(0x000000, 0.5);
      fr.fillRoundedRect(GAME_WIDTH / 2 - 44, 120, 88, 112, 4);
      fr.lineStyle(1.5, COLORS.panelEdge, 0.9);
      fr.strokeRoundedRect(GAME_WIDTH / 2 - 44, 120, 88, 112, 4);
      reso.add(fr);
      reso.add(this.add.image(GAME_WIDTH / 2, 176, "suspect").setDisplaySize(80, 104));
      reso.add(this.add.text(GAME_WIDTH / 2, 244, this.suspect, { fontFamily: DISPLAY, fontSize: fs(15), color: CSS.ink }).setOrigin(0.5));
      // a struck ink stamp across the photo — case closed (or, if the run ended, unsolved-on-time)
      if (!runOver) reso.add(this.inkStamp(GAME_WIDTH / 2 + 24, 150, "CASE CLOSED"));
    }
    reso.add(this.add.text(GAME_WIDTH / 2, 272, this.theCase.resolution, { fontFamily: BODY, fontSize: fs(14), color: CSS.ink, align: "left", wordWrap: { width: 408 }, lineSpacing: 6 }).setOrigin(0.5, 0));

    // Efficiency grade: the player's moves against the solver's par.
    reso.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 176, `broke it in ${this.moves}  ·  par ${grade.par}${grade.best != null ? `  ·  best ${grade.best}` : ""}`, { fontFamily: MONO, fontSize: fs(12), color: CSS.ink }).setOrigin(0.5));
    reso.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 158, grade.rating, { fontFamily: DISPLAY, fontSize: fs(15), color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    if (this.mode === "endless") {
      const dots = "◆".repeat(Math.max(0, this.standing)) + "◇".repeat(Math.max(0, 3 - this.standing));
      const tail = runOver ? `the run ends at night ${this.night}` : `night ${this.night} closed  ·  standing ${dots}`;
      reso.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 138, `${tail}  ·  rank ${rankFor(getTotalBreaks())}`, { fontFamily: MONO, fontSize: fs(11), color: runOver ? CSS.slate : CSS.faint }).setOrigin(0.5));
    }
    const diagram = this.buildDiagram().setVisible(false);
    o.add([reso, diagram]);

    const toTitle = () => this.scene.start("TitleScene");
    const nextNight = () => this.scene.start("CaseRun", { mode: "endless", night: this.night + 1, runBase: this.runBase, standing: this.standing });
    const onward = this.mode === "endless" && !runOver ? nextNight : toTitle;
    const showBoard = () => {
      reso.setVisible(false);
      diagram.setVisible(true);
      this.overlayClose = backToReso;
    };
    const backToReso = () => {
      diagram.setVisible(false);
      reso.setVisible(true);
      this.overlayClose = onward;
    };
    this.overlayClose = onward;

    reso.add(new Button(this, 132, GAME_HEIGHT - 68, { w: 220, h: 50, label: "▦  THE WEB", fontSize: 14, accent: COLORS.slate, onClick: showBoard }));
    reso.add(
      this.mode === "endless" && !runOver
        ? new Button(this, 350, GAME_HEIGHT - 68, { w: 200, h: 50, label: "NEXT NIGHT  (A)", fontSize: 13, accent: COLORS.crimson, onClick: nextNight })
        : new Button(this, 350, GAME_HEIGHT - 68, { w: 200, h: 50, label: runOver ? "DONE  (A)" : "CLOSE  (A)", fontSize: 13, accent: COLORS.crimson, onClick: toTitle }),
    );
    diagram.add(new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 56, { w: 200, h: 46, label: "BACK  (B)", accent: COLORS.slate, onClick: backToReso }));
  }

  /** A win-screen "case board" laid out from the actual web graph. */
  private buildDiagram(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    c.add(this.add.text(GAME_WIDTH / 2, 64, "the web", { fontFamily: DISPLAY, fontSize: fs(24), color: CSS.amber, fontStyle: "italic" }).setOrigin(0.5));
    c.add(this.add.text(GAME_WIDTH / 2, 90, "one lie holding up another", { fontFamily: MONO, fontSize: fs(11), color: CSS.muted }).setOrigin(0.5));

    const segs = this.theCase.web.segments;
    const evs = this.theCase.web.evidence;
    const brokenSet = new Set(this.web!.segments().filter((s) => s.broken).map((s) => s.id));
    // the order the lies have to fall — from the solver, for ①②③ labels
    const order = verifyWeb(this.theCase.web, this.theCase.web.startEvidence).order;
    const orderOf = new Map(order.map((id, i) => [id, i + 1]));

    // support edges (d props target) and per-segment "support depth"
    const supportsOf = (id: string) => evs.filter((e) => e.targets === id).flatMap((e) => e.deflectableBy);
    const memo = new Map<string, number>();
    const level = (id: string): number => {
      if (memo.has(id)) return memo.get(id)!;
      const sup = supportsOf(id);
      const v = sup.length ? 1 + Math.max(...sup.map(level)) : 0;
      memo.set(id, v);
      return v;
    };
    const maxL = Math.max(0, ...segs.map((s) => level(s.id)));

    const distribute = (n: number, w: number): number[] => {
      const gap = 16;
      const total = n * w + (n - 1) * gap;
      const x0 = (GAME_WIDTH - total) / 2 + w / 2;
      return Array.from({ length: n }, (_, i) => x0 + i * (w + gap));
    };

    // lie node positions, by level row
    const lieW = maxL > 0 ? 178 : 220;
    const topY = 300;
    const rowGap = 130;
    const pos = new Map<string, { x: number; y: number }>();
    for (let L = 0; L <= maxL; L++) {
      const row = segs.filter((s) => level(s.id) === L);
      const xs = distribute(row.length, lieW);
      row.forEach((s, i) => pos.set(s.id, { x: xs[i], y: topY + (maxL - L) * rowGap }));
    }
    // evidence row above the top lies
    const evXs = distribute(evs.length, 104);
    const evY = 168;
    const evPos = new Map<string, { x: number; y: number }>();
    evs.forEach((e, i) => evPos.set(e.id, { x: evXs[i], y: evY }));

    const g = this.add.graphics();
    c.add(g);
    const lieH = 52;
    // support edges (amber)
    const seen = new Set<string>();
    for (const e of evs) {
      for (const d of e.deflectableBy) {
        const key = `${d}->${e.targets}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const a = pos.get(d)!;
        const b = pos.get(e.targets)!;
        this.arrow(g, a.x, a.y - lieH / 2, b.x, b.y + lieH / 2, COLORS.amber, 0.9);
      }
    }
    // attack edges (crimson)
    for (const e of evs) {
      const a = evPos.get(e.id)!;
      const b = pos.get(e.targets)!;
      this.arrow(g, a.x, a.y + 18, b.x, b.y - lieH / 2, COLORS.crimson, 0.8);
    }

    // evidence nodes
    for (const e of evs) {
      const p = evPos.get(e.id)!;
      this.node(c, p.x, p.y, 104, 36, e.short ?? e.label, { evidence: true });
    }
    // lie nodes
    for (const s of segs) {
      const p = pos.get(s.id)!;
      this.node(c, p.x, p.y, lieW, lieH, s.name, { key: s.key, broken: brokenSet.has(s.id), order: orderOf.get(s.id) });
    }

    c.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 130, "① the order they had to fall  ·  amber holds it up  ·  crimson takes it down", { fontFamily: MONO, fontSize: fs(10), color: CSS.faint, align: "center", wordWrap: { width: 440 } }).setOrigin(0.5));
    return c;
  }

  private node(c: Phaser.GameObjects.Container, cx: number, cy: number, w: number, h: number, name: string, opts: { evidence?: boolean; key?: boolean; broken?: boolean; order?: number }): void {
    const g = this.add.graphics();
    const edge = opts.broken ? COLORS.crimson : opts.evidence ? COLORS.panelEdge : COLORS.slate;
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 7);
    g.lineStyle(opts.broken ? 2 : 1.4, edge, opts.broken ? 0.85 : 1);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 7);
    c.add(g);
    if (opts.order) {
      const circled = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"][opts.order - 1] ?? `${opts.order}`;
      c.add(this.add.text(cx - w / 2 + 2, cy - h / 2 - 9, circled, { fontFamily: MONO, fontSize: fs(15), color: CSS.amber }).setOrigin(0.5));
    }
    const label = `${opts.key ? "✦ " : ""}${name}`;
    const t = this.add.text(cx, cy, label, { fontFamily: opts.evidence ? MONO : BODY, fontSize: opts.evidence ? "11px" : "14px", color: opts.broken ? CSS.faint : CSS.ink, align: "center", wordWrap: { width: w - 14 } }).setOrigin(0.5);
    c.add(t);
    if (opts.broken) {
      const s = this.add.graphics();
      s.lineStyle(1.5, COLORS.crimson, 0.9);
      s.lineBetween(cx - w / 2 + 10, cy, cx + w / 2 - 10, cy);
      c.add(s);
    }
  }

  private arrow(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, color: number, alpha: number): void {
    g.lineStyle(2, color, alpha);
    g.lineBetween(x1, y1, x2, y2);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const s = 7;
    g.fillStyle(color, alpha);
    g.fillTriangle(
      x2,
      y2,
      x2 - s * Math.cos(ang - 0.4),
      y2 - s * Math.sin(ang - 0.4),
      x2 - s * Math.cos(ang + 0.4),
      y2 - s * Math.sin(ang + 0.4),
    );
  }
}
