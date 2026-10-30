// Equipped cards that react to the play: a Legendary or Mythic icon pops up beside the header with
// a word in its own character's voice (sometimes on a right answer, sometimes on a mistake, always on
// a big moment — a mythic then says its voice line, out loud), and a Legendary or Mythic background
// lights up, winces or bursts behind the page. Hears every game through the sound cues (lib/sfx onCue);
// the player can turn it off (Account page).
import { useEffect, useRef, useState } from 'react';
import { onCue, type Cue } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CardClip } from './CardClip';
import { CARD_BY_ID, RARITY_INFO, RARITY_LIGHT, type Card } from './cards';
import { CardAvatar } from './Perks';
import { isAwake } from './CardView';
import { playVoice, voiceOf } from './voice';

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
  jlpt: { good: ['Yoku dekimashita!', 'Sugoi!', 'Perfect stroke order!'], bad: ['Chigaimasu…', 'Back to the textbook!', 'Ganbatte!'] },
  balatro: { good: ['Nice hand!', 'That one scored!', 'Mult go brrr!'], bad: ['Bust!', 'Not enough chips…', 'Should have discarded that.'] },
  destiny: { good: ['Eyes up, Guardian!', 'An Exotic drop!', 'The Light holds!'], bad: ['Your Ghost is reviving you…', 'Another blue engram…', 'Back to orbit…'] },
  forhonor: { good: ['Guard break!', 'A worthy duel!', 'Execution!'], bad: ['Parried…', 'Your guard is open!', 'Back to the war camp…'] },
  forts: { good: ['Direct hit!', 'Reactor breached!', 'Fort holding strong.'], bad: ['Bracing down!', 'Incoming fire!', 'Repair crews, now!'] },
  inazuma: { good: ['GOAL!', "That's teamwork!", 'What a save!'], bad: ['Offside!', 'The keeper got that one…', 'Back to practice!'] },
};

/** A big moment's animation: how long it stays once playing, how long its clip may take to start, its fade out, and at least how long between two. */
const MOMENT_MS = 6000;
const MOMENT_WAIT_MS = 20_000;
const MOMENT_OUT_MS = 1200;
const MOMENT_GAP_MS = 45_000;

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

/** The icon's reaction: a bubble by the header, the card's face and a word. */
export function CardReactions() {
  const enabled = useProgress((s) => s.cardReactions ?? true);
  const avatar = useProgress((s) => showy(s.avatar, s.cards));
  const [bubble, setBubble] = useState<{ kind: Cue; text: string; key: number } | null>(null);
  const last = useRef(0);
  /** The icon's animation, on a big moment now and then. */
  const [moment, setMoment] = useState<{ clip?: string; key: number; waiting: boolean; leaving: boolean } | null>(null);
  const lastMoment = useRef(0);
  const momentTimer = useRef(0);
  const clipWait = useRef(false);
  const failedClips = useRef(new Set<string>());
  const endMoment = (after: number) => {
    window.clearTimeout(momentTimer.current);
    momentTimer.current = window.setTimeout(() => {
      clipWait.current = false;
      setMoment((m) => m && { ...m, waiting: false, leaving: true });
      momentTimer.current = window.setTimeout(() => setMoment(null), MOMENT_OUT_MS);
    }, after);
  };
  /** The wait is over, the clip playing or not: the moment's full length from now. */
  const clipSettled = (clip?: string) => {
    if (!clipWait.current) return;
    clipWait.current = false;
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
    if (!enabled || !avatar) return;
    let timer = 0;
    const off = onCue((kind) => {
      const now = Date.now();
      // Big moments always; otherwise now and then, so fast games don't drown in bubbles.
      if (kind !== 'great' && (now - last.current < 6000 || Math.random() > 0.45)) return;
      last.current = now;
      const lines = CHARACTER_LINES[avatar.name] ?? REACTIONS[avatar.set] ?? { good: ['Nice!'], bad: ['Oops…'] };
      const text = kind === 'great' && avatar.voice ? (voiceOf(avatar).line ?? avatar.voice) : pick(kind === 'bad' ? lines.bad : lines.good);
      setBubble({ kind, text, key: now });
      // A mythic's big moment: its voice line, heard.
      if (kind === 'great' && avatar.voice) playVoice(avatar);
      // A win, a finished game: the page's background comes alive, now and then. Not where cards already show theirs.
      const own = isAwake(avatar, useProgress.getState().bosses) ? avatar.awaken?.clip : avatar.awaken ? undefined : avatar.clip;
      const clip = own && !failedClips.current.has(own) ? own : undefined;
      if (kind === 'great' && now - lastMoment.current > MOMENT_GAP_MS && !/\/(shop|album)/.test(window.location.hash) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        lastMoment.current = now;
        // A clip can be slow to start (above all one kept on YouTube or TikTok): the light glows until it does, and it still plays.
        clipWait.current = !!clip;
        setMoment({ clip, key: now, waiting: !!clip, leaving: false });
        endMoment(clip ? MOMENT_WAIT_MS : MOMENT_MS - MOMENT_OUT_MS);
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setBubble(null), 2600);
    });
    return () => {
      off();
      window.clearTimeout(timer);
      window.clearTimeout(momentTimer.current);
      clipWait.current = false;
      setMoment(null);
    };
  }, [enabled, avatar]);

  if ((!bubble && !moment) || !avatar) return null;
  const light = RARITY_LIGHT[avatar.rarity];
  return (
    <>
      {/* The whole page's background comes alive: light turning in the card's colour, its clip playing behind. */}
      {moment && (
        <div key={`moment-${moment.key}`} className={`moment-bg ${moment.waiting ? 'moment-wait' : ''} ${moment.leaving ? 'moment-out' : ''}`} style={{ ['--glow' as string]: light }} aria-hidden>
          <div className="moment-rays" />
          <div className="moment-glow" />
          {moment.clip && (
            <div className="moment-clip">
              <CardClip
                src={moment.clip}
                onFail={() => {
                  failedClips.current.add(moment.clip!);
                  clipSettled();
                  setMoment((m) => m && { ...m, clip: undefined });
                }}
                onPlaying={() => clipSettled(moment.clip)}
                className="size-full object-cover"
              />
            </div>
          )}
        </div>
      )}
      {bubble && (
    <div key={`bubble-${bubble.key}`} className="react-in pointer-events-none fixed right-3 top-14 z-40 flex max-w-[16rem] items-center gap-2" aria-live="polite">
      <p className="rounded-2xl rounded-tr-sm border-2 bg-card px-3 py-1.5 text-sm font-bold shadow-xl" style={{ borderColor: bubble.kind === 'bad' ? '#f87171' : light }}>
        <span className={avatar.rarity === 'mythic' && bubble.kind === 'great' ? 'card-mythic-name' : ''}>{bubble.text}</span>
      </p>
      <span className={`react-${bubble.kind} shrink-0 rounded-full`} style={{ ['--glow' as string]: light }}>
        <CardAvatar card={avatar} className="size-12" />
      </span>
    </div>
      )}
    </>
  );
}
