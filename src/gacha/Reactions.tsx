// Equipped cards that react to the play, each to its own part. The icon is the face and the voice: a Legendary or
// better icon pops up beside the header with a word in its own character's voice (sometimes on a right answer, sometimes
// on a mistake, always on a win — then its voice line, out loud). The background is the win's moment: a Legendary or
// better one lights up, winces or bursts behind the page, and on a win its video plays over the page, once through.
// Hears every game through the sound cues (lib/sfx onCue); the player can turn it off (Account page).
import { useEffect, useRef, useState } from 'react';
import { onCue, type Cue } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CardClip } from './CardClip';
import { CARD_BY_ID, RARITY_INFO, RARITY_LIGHT, clipHasSound, type Card } from './cards';
import { CardAvatar } from './Perks';
import { isAwake } from './CardView';
import { cardVolumeOf, playVoice, voiceOf } from './voice';

/**
 * Each legendary character in their own voice (written for Omnidle, nods to their catchphrases
 * included): a right answer, a mistake. A mythic speaks as its star does.
 */
export const CHARACTER_LINES: Record<string, { good: string[]; bad: string[] }> = {
  "Jimbo": { good: ["Nice hand, friend!","Look at that Mult go!"], bad: ["Should have discarded that.","High Card? Really?"] },
  "Oryx": { good: ["Even a king must mark this in his ledger.","The sword logic favours you."], bad: ["Taken.","Your light is mine now."] },
  "Ozai": { good: ["Even the Phoenix King must admit it.","You burn brighter than I thought."], bad: ["Pathetic.","You are no match for the Fire Nation."] },
  "Aang": { good: ["Yeah! Airbending master!","That was awesome!"], bad: ["Whoops… let’s try again.","Even Monk Gyatso missed sometimes."] },
  "Apollyon": { good: ["A wolf among sheep, at last.","That is how war is waged."], bad: ["A sheep, after all.","The Legion expected more."] },
  "Kensei": { good: ["A clean cut.","The way of the blade."], bad: ["Your stance was off.","Breathe. Strike again."] },
  "Phantom": { good: ["You saw that coming? Impressive.","Cloak holding. Good call."], bad: ["Fooled by a decoy.","You aimed at nothing at all."] },
  "Eagle Eye": { good: ["Clean shot.","Right between the plates."], bad: ["Missed. Check your sights.","Wind took that one."] },
  "Architect": { good: ["Solid foundations.","Built to last."], bad: ["That bracing will not hold.","Back to the drawing board."] },
  "Baron Nashor": { good: ["*a low rumble from the pit* …Acceptable.","The Rift trembles at your answer."], bad: ["*the pit hisses* Weak.","The Baron devours the unprepared."] },
  "Ahri": { good: ["Mm, clever. I like clever.","You caught that faster than I catch hearts."], bad: ["Aww, so close, darling.","Even a fox trips sometimes."] },
  "Yasuo": { good: ["Like the wind — swift and clean.","Hasagi! A true strike."], bad: ["A sword is poor company for that answer.","Even the wind loses its way."] },
  "Doomfist": { good: ["Strength recognises strength.","Conflict sharpens you. Good."], bad: ["Weakness. Talon has no use for it.","One punch, and you fold?"] },
  "Tracer": { good: ["Ooh, brilliant!","Right on the money, love!"], bad: ["Whoops! Fancy a rewind?","Oi, I'll pretend I didn't see that!"] },
  "Mercy": { good: ["Heroes never die — and neither does that streak!","Wunderbar!"], bad: ["Hold still — I'll patch that up.","Don't worry, I've got you."] },
  "Ender Dragon": { good: ["*a roar echoes across the End*","The End acknowledges you, crafter."], bad: ["*the dragon circles, amused*","Back to the Overworld with you."] },
  "Creeper": { good: ["Sss… sss… nice.","*a proud, quiet hiss*"], bad: ["Ssss… BOOM.","*hisses right behind you*"] },
  "Enderman": { good: ["*vwoop* …acceptable.","*picks up a block, satisfied*"], bad: ["Don't look at me like that.","*teleports away in disgust*"] },
  "Kaido": { good: ["Wororo! Not bad, rookie!","You've got some spine!"], bad: ["Wororororo! Pathetic!","Is that all? I'm still bored!"] },
  "Monkey D. Luffy": { good: ["Shishishi! That was awesome!","Yosh! Meat party after this!"], bad: ["Eh?! That's not it?!","Doesn't matter — we keep sailing!"] },
  "Roronoa Zoro": { good: ["Hmph. Not bad.","That one cut clean."], bad: ["…Wrong way again. Happens.","Nothing happened. Got it?"] },
  "Frieza": { good: ["Ohoho… impressive, for a monkey.","My, my. You might be useful after all."], bad: ["Ohohoho! How disappointing.","Did you really think that would work?"] },
  "Goku": { good: ["Wow, you're strong! Let's go again!","Hey, that was awesome!"], bad: ["Aw man, now I'm hungry.","Don't worry, I'll train you up!"] },
  "Vegeta": { good: ["Hmph. That's the pride of a Saiyan.","Not bad… for a lower-class warrior."], bad: ["Clown! Are you even trying?!","Pathetic. Get up and fight!"] },
  "Madara Uchiha": { good: ["Interesting… you've made it this far.","Now this is a dance worth dancing."], bad: ["Wake up to reality.","You lack resolve — and the answer."] },
  "Naruto Uzumaki": { good: ["Yatta! That's my ninja way!","Believe it — you nailed it!"], bad: ["Aw man, so close!","I never go back on my word — try again!"] },
  "Sasuke Uchiha": { good: ["Hn. Acceptable.","You're not as weak as I thought."], bad: ["You're annoying.","Hn. Too slow."] },
  "Darth Vader": { good: ["Impressive. Most impressive.","The Force is strong with this one."], bad: ["I find your lack of knowledge disturbing.","You have failed me… for now."] },
  "Yoda": { good: ["Strong with the Force, you are.","Hmm. Learned well, you have."], bad: ["Clouded, your answer is.","Patience. Try again, you must."] },
  "Chewbacca": { good: ["RRAAAWR! (That means \"nice!\")","*a delighted Wookiee roar*"], bad: ["*a sad Wookiee groan*","Hrrrnnn… (Chewie is not impressed.)"] },
  "Lord Voldemort": { good: ["Clever… almost worthy of Slytherin.","You show… promise."], bad: ["Foolish child.","You disappoint me. Again."] },
  "Harry Potter": { good: ["Brilliant, that was!","That's worth a Quidditch cup!"], bad: ["Not quite… happens to the best of us.","Even I got detention sometimes."] },
  "Hermione Granger": { good: ["Honestly, that was textbook!","Ten points — at least!"], bad: ["It's Levi-O-sa, not Levio-SA!","Have you even read the book?"] },
  "Sauron": { good: ["The Eye sees your cunning.","You serve me well, little one."], bad: ["You cannot hide your mistakes from me.","Darkness takes another."] },
  "Frodo Baggins": { good: ["Sam would be proud of that one!","Onward — even the smallest step counts."], bad: ["I wish the Ring had never come to me…","It's a long road. We keep going."] },
  "Gandalf": { good: ["Splendid, my friend!","A wizard is never late — and neither was that."], bad: ["Fool of a Took!","You shall not pass… not with that answer."] },
  "Thanos": { good: ["Perfectly balanced, as all things should be.","Impressive. You have my respect."], bad: ["Dread it. Run from it. The miss arrives all the same.","I know what it is to lose."] },
  "Iron Man": { good: ["Genius. Obviously.","Not bad — I'd have done it faster."], bad: ["JARVIS, log that as a miss.","Sometimes you gotta run before you walk."] },
  "Captain America": { good: ["That's how it's done.","I could do this all day — and so could you!"], bad: ["Language! …and also, wrong.","Get back up. We keep fighting."] },
  "Master Hand": { good: ["*snaps its fingers approvingly*","A worthy challenger."], bad: ["*flicks you off the stage*","GAME… over, for that one."] },
  "Mario": { good: ["Wahoo!","Here we go!"], bad: ["Mamma mia…","Oh no!"] },
  "Link": { good: ["*triumphant item-get fanfare*","Hyah!"], bad: ["*a silent, heroic sigh*","It's dangerous to go alone — try again."] },
  "Il Dottore": { good: ["Fascinating. Record that result.","A promising specimen."], bad: ["A failed experiment. Again.","How… disappointing. Next subject."] },
  "Diluc": { good: ["Not bad.","Justice served."], bad: ["Hmph. Sloppy.","Get yourself together."] },
  "Jean": { good: ["Well done! The Knights are proud.","Excellent work, as expected."], bad: ["Don't overwork yourself — try again.","Mondstadt believes in you."] },
  "The Lich King": { good: ["Your strength serves me well.","Rise… and keep going."], bad: ["Frostmourne hungers.","You will kneel before the end."] },
  "Tyrande Whisperwind": { good: ["Elune smiles upon you.","Swift as the moonlight."], bad: ["Elune guide your next step.","Steady your aim, sister."] },
  "Illidan Stormrage": { good: ["You are prepared!","Impressive… for a mortal."], bad: ["You are not prepared!","I have no time for failure."] },
  "Ray Dark": { good: ["Hmph. A lucky shot.","So you have some talent after all."], bad: ["Soccer is a tool — and you misused it.","Just as I planned."] },
  "Mark Evans": { good: ["Great save! Let's keep it up!","That's the spirit — let's play some soccer!"], bad: ["Don't give up! The match isn't over!","Shake it off — the next one's ours!"] },
  "Axel Blaze": { good: ["Fire Tornado!","A clean finish."], bad: ["…Just a warm-up.","I'll score the next one."] },
};

/** A franchise's spirit, for a card with no lines of its own. */
export const REACTIONS: Record<string, { good: string[]; bad: string[] }> = {
  lol: { good: ['Outplayed!', "That's how you carry.", 'Clean as a pentakill.'], bad: ['Back to the fountain…', 'That was a misplay.', 'Report the jungler?'] },
  overwatch: { good: ['Play of the game!', 'Nice shot!', "Group up — we've got this."], bad: ['We need healing!', 'Ouch — wrong call.', 'Regroup and push again.'] },
  minecraft: { good: ['Diamonds!', 'Achievement get!', 'Perfectly crafted.'], bad: ['*hiss*… missed.', 'Fell in the lava…', 'Respawn and try again.'] },
  onepiece: { good: ['Shishishi! Nice one!', "That's my nakama!", 'Full speed ahead!'], bad: ['Oi oi, focus!', "The sea's rough today…", "Don't give up, captain!"] },
  dbz: { good: ['Your power level is rising!', "That's a Saiyan's answer!", 'Over nine thousand!'], bad: ['You need more training.', 'Back to the Time Chamber!', 'Your ki slipped…'] },
  naruto: { good: ["That's the ninja way!", 'A real shinobi move!', 'Not bad — for a genin!'], bad: ['Not your best jutsu…', 'Train harder!', 'Never give up — never!'] },
  starwars: { good: ['The Force is with you.', "A Jedi's answer.", 'Strong with knowledge, you are.'], bad: ['A disturbance in the Force…', 'Clouded, your mind is.', 'Trust your instincts.'] },
  harrypotter: { good: ['Ten points to your house!', 'Brilliant!', "That's proper magic."], bad: ['Ten points from your house…', 'Wrong spell!', "Even the best wizards miss a spell."] },
  lotr: { good: ['A fine choice, friend.', 'The Fellowship is proud.', 'Even the smallest can win.'], bad: ['One does not simply… miss.', 'The road goes ever on.', 'Second breakfast, then try again.'] },
  mcu: { good: ['Avengers material!', 'Nailed it.', 'Assemble!'], bad: ['Not this time.', 'Back to the lab.', 'We lost that one — regroup.'] },
  smash: { good: ['GAME!', 'Perfect combo!', 'A new champion!'], bad: ['Self-destruct…', 'Shield break!', 'Off the stage…'] },
  genshin: { good: ['Elemental reaction!', 'Five-star play!', 'Luck is on your side.'], bad: ['Only three stars…', 'Pity counter +1.', 'Out of stamina…'] },
  wow: { good: ['Epic loot!', 'Level up!', 'For Azeroth!'], bad: ['Wipe! Run back…', 'Repair your gear and retry.', 'Pulled too many…'] },
  unreal: { good: ['Compiled successfully!', 'Clean graph!', 'Zero warnings.'], bad: ['Accessed None…', 'Infinite loop detected!', 'Compile error.'] },
  avatar: { good: ['Perfectly balanced!', 'Your bending is getting stronger!', 'Yip yip!'], bad: ['That was a cabbage-level mistake…', 'Back to the Air Temple to train…', 'The elements are not with you.'] },
  jlpt: { good: ['Sugoi!', 'Gōkaku!', 'Perfect stroke order!'], bad: ['Chigau…', 'Back to the textbook!', 'One more time!'] },
  balatro: { good: ['Nice hand!', 'That one scored!', 'Mult go brrr!'], bad: ['Bust!', 'Not enough chips…', 'Should have discarded that.'] },
  hsr: { good: ['Weakness Break!', 'Next stop, the stars!', 'Ultimate ready!'], bad: ['Downed…', 'Back to the Express…', 'Out of Trailblaze Power!'] },
  hollowknight: { good: ['Shaw!', 'Soul gathered!', 'Geo secured!'], bad: ['Mask broken…', 'Back to the bench…', 'Your shade remains…'] },
  mha: { good: ['Plus Ultra!', 'Smash!', 'Go beyond!'], bad: ['Quirk erased…', 'Back to class…', 'Not hero material… yet.'] },
  hxh: { good: ['Jajanken: rock!', 'Godspeed!', 'License earned!'], bad: ['Out of aura…', 'Exam failed…', 'Back to Whale Island…'] },
  shrek: { good: ['Layers, like an onion!', 'True love’s kiss!', 'Far Far Away, here we come!'], bad: ['Get out of my swamp!', 'Are we there yet?', 'Back to the dungeon…'] },
  bg3: { good: ['Natural 20!', 'Critical hit!', 'Inspiration gained!'], bad: ['Natural 1…', 'Back to camp…', 'Long rest needed…'] },
  deadlock: { good: ['Souls secured!', 'Guardian down!', 'Clean last hit!'], bad: ['Picked off…', 'Back to spawn…', 'Out of souls!'] },
  arcraiders: { good: ['Extracted!', 'Thruster down!', 'Loot secured!'], bad: ['Downed…', 'Shredded!', 'Back to Speranza…'] },
  ufouria: { good: ['Uppo!', 'Butt stomp!', 'Bumyon cleaned up!'], bad: ['Bumyon’d…', 'Splat!', 'Back to bed, Hebe.'] },
  destiny: { good: ['Eyes up, Guardian!', 'An Exotic drop!', 'The Light holds!'], bad: ['Your Ghost is reviving you…', 'Another blue engram…', 'Back to orbit…'] },
  forhonor: { good: ['Guard break!', 'A worthy duel!', 'Execution!'], bad: ['Parried…', 'Your guard is open!', 'Back to the war camp…'] },
  forts: { good: ['Direct hit!', 'Reactor breached!', 'Fort holding strong.'], bad: ['Bracing down!', 'Incoming fire!', 'Repair crews, now!'] },
  inazuma: { good: ['GOAL!', "That's teamwork!", 'What a save!'], bad: ['Offside!', 'The keeper got that one…', 'Back to practice!'] },
};

/** A big moment's animation: how long it stays once playing, how long its clip may take to start, its fade out. Every win
 * has one (none over one still playing: a streak and its victory are one win). */
const MOMENT_MS = 6000;
const MOMENT_WAIT_MS = 20_000;
const MOMENT_OUT_MS = 1200;
/** A win's video plays once through, to its very end (the owner's call: never cut). This only keeps a video that never
 * says it has ended (stalled) from holding the page for ever. */
const MOMENT_MAX_MS = 10 * 60_000;
/** Omnis whose first form plays no clip behind a win (only awakened): the Creeper, Aang, the Doorman. */
const FIRST_FORM_STILL = new Set(['minecraft:omni', 'avatar:omni', 'deadlock:omni']);

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
/** Legendary or better, and in the album. */
const showy = (id: string | null, cards: Record<string, number>): Card | undefined => {
  const c = id && cards[id] ? CARD_BY_ID.get(id) : undefined;
  return c && RARITY_INFO[c.rarity].rank >= 3 ? c : undefined;
};

/** The equipped background, if it reacts: the cue to show (kind and a key to replay it). */
export function useBackdropCue(card: Card | undefined): { kind: Cue; key: number } | null {
  const enabled = useProgress((s) => s.cardReactions ?? true);
  const [cue, setCue] = useState<{ kind: Cue; key: number } | null>(null);
  const last = useRef(0);
  useEffect(() => {
    if (!enabled || !card || RARITY_INFO[card.rarity].rank < 3) return;
    let timer = 0;
    const off = onCue((kind) => {
      const now = Date.now();
      if (kind !== 'great' && now - last.current < 700) return;
      last.current = now;
      setCue({ kind, key: now });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCue(null), kind === 'great' ? 1600 : 900);
    });
    return () => (off(), window.clearTimeout(timer));
  }, [enabled, card]);
  return cue;
}

/** The background card, if it can stand behind the page (Rare or better, and in the album). */
const backdropOf = (id: string | null, cards: Record<string, number>): Card | undefined => {
  const c = id && cards[id] ? CARD_BY_ID.get(id) : undefined;
  return c && c.rarity !== 'common' ? c : undefined;
};

const momentPlaying = () => document.documentElement.classList.contains('moment-on');

/** Whether a win's moment is on (the background card's video over the page): while it is, the background doesn't change. */
export function useMomentOn(): boolean {
  const [on, setOn] = useState(momentPlaying);
  useEffect(() => {
    const watch = new MutationObserver(() => setOn(momentPlaying()));
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => watch.disconnect();
  }, []);
  return on;
}

/**
 * The equipped cards reacting to the play, each to its own part (the owner's call):
 * - the **icon** is the face and the talk: a bubble by the header with a word (its voice line on a win only with no background);
 * - the **background** is the win's moment, every win: the light turning over the page and, behind it, the background
 *   card's video with its own sound (a silent one with the card's voice line; never the icon's), the video played once through (a short loop at least MOMENT_MS, a long video to its end too). Never the icon's video.
 * The cards are read when a cue comes, not held by the listener: a card changed meanwhile (by hand, or by its rotation:
 * src/gacha/Rotation.tsx) never cuts a moment short. The moment plays on with the card it started with, the page's
 * background picture waits for its end too (CardBackdrop, useMomentOn), and the next win plays the new card's video.
 */
export function CardReactions() {
  const enabled = useProgress((s) => s.cardReactions ?? true);
  const avatar = useProgress((s) => showy(s.avatar, s.cards));
  const backdrop = useProgress((s) => backdropOf(s.backdrop, s.cards));
  const cardsNow = useRef({ avatar, backdrop });
  cardsNow.current = { avatar, backdrop };
  const [bubble, setBubble] = useState<{ card: Card; kind: Cue; text: string; key: number } | null>(null);
  const last = useRef(0);
  /** The page's big moment: the background card (card) and its video. */
  const [moment, setMoment] = useState<{ card: Card; clip?: string; key: number; waiting: boolean; leaving: boolean; heard?: boolean } | null>(null);
  /** The clip couldn't be heard after all (its sound blocked, or it failed): the background card's voice from its own player, once. */
  const voiceApart = () => {
    const m = moment;
    setMoment((x) => x && { ...x, heard: false });
    // A clip with a sound of its own doesn't hand over to the voice line: the moment just goes on silent.
    if (!m || clipHasSound(m.card, m.clip)) return void (voiceUntil.current = 0);
    playVoice(m.card, false, () => (voiceUntil.current = 0));
  };
  const momentTimer = useRef(0);
  const clipWait = useRef(false);
  const failedClips = useRef(new Set<string>());
  /** Until when the card's voice line keeps the moment going (0: not speaking): a long line (Sokka's whole clip) isn't cut. */
  const voiceUntil = useRef(0);
  /** Until when the video keeps the moment going (0: played once through, or no telling — a YouTube or TikTok one). */
  const clipUntil = useRef(0);
  const endMoment = (after: number) => {
    window.clearTimeout(momentTimer.current);
    momentTimer.current = window.setTimeout(function close() {
      // Still speaking, or the video not through yet: the moment plays on, checked again in a moment.
      const now = Date.now();
      if (now < voiceUntil.current || now < clipUntil.current) return void (momentTimer.current = window.setTimeout(close, 300));
      clipWait.current = false;
      setMoment((m) => m && { ...m, waiting: false, leaving: true });
      momentTimer.current = window.setTimeout(() => setMoment(null), MOMENT_OUT_MS);
    }, after);
  };
  /** The wait is over, the clip playing or not: the moment's full length from now (at least MOMENT_MS, the video once through). */
  const clipSettled = (clip?: string) => {
    if (!clipWait.current) return;
    clipWait.current = false;
    clipUntil.current = clip && !/^(youtube|tiktok):/.test(clip) ? Date.now() + MOMENT_MAX_MS - MOMENT_OUT_MS : 0;
    setMoment((m) => m && { ...m, clip, waiting: false });
    endMoment(MOMENT_MS - MOMENT_OUT_MS);
  };
  // The page itself turns see-through while it lasts.
  useEffect(() => {
    if (!moment) return;
    document.documentElement.classList.add('moment-on');
    return () => document.documentElement.classList.remove('moment-on');
  }, [moment]);
  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const off = onCue((kind) => {
      const { avatar, backdrop } = cardsNow.current;
      if (!avatar && !backdrop) return;
      const now = Date.now();
      // Big moments always; otherwise now and then, so fast games don't drown in bubbles.
      if (kind !== 'great' && (now - last.current < 6000 || Math.random() > 0.45)) return;
      last.current = now;
      // A win over a moment still playing (a streak, then its victory): one win, already under way.
      if (kind === 'great' && momentPlaying()) return;
      // The background, on a win, speaks (its voice line, with its video): the icon then says a word of its own, not a voice line.
      const backSpeaks = kind === 'great' && !!backdrop?.voice;
      // The icon: its face and a word.
      if (avatar) {
        const lines = CHARACTER_LINES[avatar.name] ?? REACTIONS[avatar.set] ?? { good: ['Nice!'], bad: ['Oops…'] };
        const text = kind === 'great' && avatar.voice && !backSpeaks ? (voiceOf(avatar).line ?? avatar.voice) : pick(kind === 'bad' ? lines.bad : lines.good);
        setBubble({ card: avatar, kind, text, key: now });
        window.clearTimeout(timer);
        timer = window.setTimeout(() => setBubble(null), 2600);
      }
      if (kind !== 'great') return;
      // A win: the background comes alive — its video and its voice line, both the background card's (the owner's call), never
      // the icon's. Not where cards already show theirs (the shop, the album): there, its voice alone. The form the player
      // has: awakened, its own clip (or its first form's if it has none); otherwise the card's.
      const st = useProgress.getState();
      const card = backdrop;
      const awake = !!card && isAwake(card, st.bosses);
      // The owner's call: these Omnis' first forms play nothing behind a win (awakened, their awakened clip).
      const own = !card ? undefined : awake ? (card.awaken?.clip ?? card.clip) : FIRST_FORM_STILL.has(card.id) ? undefined : card.clip;
      const clip = own && !failedClips.current.has(own) ? own : undefined;
      const showMoment = !!card && !/\/(shop|album)/.test(window.location.hash) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const soundOn = st.sound && st.voiceLines !== false;
      // Heard from the clip itself (the owner's rule: a video that has sound always plays with it, and no voice line over
      // it): a clip with its own sound (Steve's song, Gogeta's, every clip hosted with the site), or a clip that is one of
      // the card's voice recordings (the same MP4). The voice line is left to a silent clip (Tenor's, a GIF) or no clip.
      const ownSound = !!card && clipHasSound(card, clip);
      const clipIsVoice = !!card && !!clip && (card.audio === clip || !!card.voiceClips?.some((v) => v.audio === clip));
      const heard = showMoment && soundOn && !!clip && (ownSound || clipIsVoice);
      // Who speaks: the background card (the icon only with no background behind the page). While it speaks, the moment stays: they end together.
      const speaker = card ?? avatar;
      if (heard) voiceUntil.current = Date.now() + MOMENT_MAX_MS;
      else if (speaker?.voice) {
        voiceUntil.current = Date.now() + 60_000;
        playVoice(speaker, false, () => (voiceUntil.current = 0));
      }
      if (showMoment && card) {
        // A clip can be slow to start (above all one kept on YouTube or TikTok): the light glows until it does, and it still plays.
        clipWait.current = !!clip;
        clipUntil.current = 0;
        setMoment({ card, clip, key: now, waiting: !!clip, leaving: false, heard });
        endMoment(clip ? MOMENT_WAIT_MS : MOMENT_MS - MOMENT_OUT_MS);
      }
    });
    // Turned off: no new reactions — but a win's video already playing plays on to its end (only a refresh stops one).
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, [enabled]);
  useEffect(() => () => window.clearTimeout(momentTimer.current), []);

  if (!bubble && !moment) return null;
  return (
    <>
      {/* The whole page's background comes alive: light turning in the background card's colour, its video playing behind. */}
      {moment && (
        <div key={`moment-${moment.key}`} className={`moment-bg ${moment.waiting ? 'moment-wait' : ''} ${moment.leaving ? 'moment-out' : ''}`} style={{ ['--glow' as string]: RARITY_LIGHT[moment.card.rarity] }} aria-hidden>
          <div className="moment-rays" />
          <div className="moment-glow" />
          {moment.clip && (
            <div className="moment-clip">
              <CardClip
                src={moment.clip}
                sound={moment.heard ? { volume: Math.min(100, useProgress.getState().sfxVolume) * cardVolumeOf(moment.card.id, clipHasSound(moment.card, moment.clip) ? 'clip' : 'voice'), onEnded: () => (voiceUntil.current = 0), onNoSound: voiceApart } : undefined}
                onFail={() => {
                  if (moment.heard) voiceApart();
                  failedClips.current.add(moment.clip!);
                  clipSettled();
                  clipUntil.current = 0;
                  setMoment((m) => m && { ...m, clip: undefined });
                }}
                onPlaying={() => clipSettled(moment.clip)}
                onOnce={() => (clipUntil.current = 0)}
                className="size-full object-cover"
              />
            </div>
          )}
        </div>
      )}
      {bubble && (
        <div key={`bubble-${bubble.key}`} className="react-in pointer-events-none fixed right-3 top-14 z-40 flex max-w-[16rem] items-center gap-2" aria-live="polite">
          <p className="rounded-2xl rounded-tr-sm border-2 bg-card px-3 py-1.5 text-sm font-bold shadow-xl" style={{ borderColor: bubble.kind === 'bad' ? '#f87171' : RARITY_LIGHT[bubble.card.rarity] }}>
            <span className={bubble.card.rarity === 'mythic' && bubble.kind === 'great' ? 'card-mythic-name' : ''}>{bubble.text}</span>
          </p>
          <span className={`react-${bubble.kind} shrink-0 rounded-full`} style={{ ['--glow' as string]: RARITY_LIGHT[bubble.card.rarity] }}>
            <CardAvatar card={bubble.card} className="size-12" />
          </span>
        </div>
      )}
    </>
  );
}
