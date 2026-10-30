// What a franchise's characters say to one another about the player's game: little exchanges, not
// catchphrases (those are the voice lines). Any two owned cards can hold one, so a line never assumes who is
// speaking; {other} is whoever they're talking to. (Written for Omnidle.)
import type { Cue } from '../lib/sfx';

/** One exchange: each line goes to the next speaker in turn. */
type Exchange = string[];
type Talk = Record<Cue, Exchange[]>;

export const DIALOGUE: Record<string, Talk> = {
  lol: {
    good: [['{other}, did you see that? No flash, nothing.', 'I saw. Still taking the credit in chat.'], ['They actually checked the minimap.', 'Then this might be the game, {other}.']],
    bad: [['Should we ping them?', 'Ping them, {other}. Gently. Five times.'], ['Whose lane was that?', 'Nobody’s, apparently. Back to the fountain.']],
    great: [['That was a pentakill in all but name.', 'Screenshot it, {other}.', 'Already on the fan wiki.']],
  },
  overwatch: {
    good: [['Nice pick. Did you get that, {other}?', 'Got it. Pushing up!'], ['They’re on fire out there.', 'Then stay close and keep them that way.']],
    bad: [['{other}, they walked straight into it.', 'I know. I’m on my way.'], ['Was that the plan?', 'There was a plan?']],
    great: [['Play of the game, surely.', 'No contest, {other}.', 'Save the replay.']],
  },
  minecraft: {
    good: [['{other}, they found diamonds.', 'Without digging straight down?'], ['A clean build, that one.', 'Not one block out of place.']],
    bad: [['They dug straight down, {other}.', 'Everyone does, once.'], ['Was that lava?', 'That was lava.']],
    great: [['Achievement get!', 'And they kept their inventory, {other}!', 'Now that’s rare.']],
  },
  onepiece: {
    good: [['Oi {other}, they’re good!', 'Then they’re buying the meat tonight.'], ['That one’s going on the bounty poster.', 'Make the number bigger, {other}.']],
    bad: [['We’re off course, {other}.', 'We’re always off course. Keep sailing.'], ['Did they just sink?', 'Fish them out. We don’t leave nakama behind.']],
    great: [['THAT’S our captain!', 'Who told you to call them captain, {other}?', 'Everyone. Just now.']],
  },
  dbz: {
    good: [['{other}, their power level just moved.', 'I felt it. Not bad.'], ['Is that all they’ve got?', 'No. Watch.']],
    bad: [['They need a year in the Time Chamber.', 'A day in there is a year, {other}. Give them two.'], ['Their ki just dropped.', 'Someone find a senzu bean.']],
    great: [['What?! Impossible!', 'It’s over nine thousand, {other}!', 'You always say that.']],
  },
  naruto: {
    good: [['Did you see those hand signs, {other}?', 'Too fast for me. That’s saying something.'], ['Not bad for a genin.', 'Don’t tell them that. They’ll want a mission.']],
    bad: [['They forgot the third seal, {other}.', 'Back to the Academy, then.'], ['Should we step in?', 'No. A shinobi gets back up alone.']],
    great: [['That’s Kage-level!', 'Careful, {other}. They’ll want the hat.', 'They’ve earned the hat.']],
  },
  starwars: {
    good: [['I felt that, {other}.', 'A ripple in the Force. A good one.'], ['Never tell me the odds.', 'I wasn’t going to, {other}. They beat them anyway.']],
    bad: [['I have a bad feeling about this.', 'You always do, {other}.'], ['Was that the right hyperspace lane?', 'It was not.']],
    great: [['Now THAT is how you blow up a Death Star.', 'One shot, {other}!', 'They’re a legend in the Outer Rim by morning.']],
  },
  harrypotter: {
    good: [['{other}, was that wandless?', 'Don’t tell McGonagall. She’ll want them on the team.'], ['Ten points, surely.', 'Twenty, if Snape isn’t looking.']],
    bad: [['Did it explode, {other}?', 'A little. Only the eyebrows.'], ['That’s not in the textbook.', 'Nothing about that is in any textbook.']],
    great: [['That’s the House Cup!', 'Someone tell the portraits, {other}!', 'They already know. They’re gossiping.']],
  },
  lotr: {
    good: [['Well struck! Did you see, {other}?', 'I counted that one. That’s my point, not yours.'], ['There’s more to them than meets the eye.', 'There often is, {other}.']],
    bad: [['Wrong road, {other}.', 'Then we walk back. It is not far. It is very far.'], ['Should we stop for second breakfast?', 'After that? We should.']],
    great: [['They’ll sing of this in the Golden Hall.', 'Badly, {other}.', 'But loudly!']],
  },
  mcu: {
    good: [['{other}, you seeing this?', 'I’m seeing it. Tell Fury to pay up.'], ['Not bad for a rookie.', 'Don’t recruit them yet.']],
    bad: [['Who’s cleaning that up?', 'Damage Control, {other}. Again.'], ['Was that part of the plan?', 'We have a plan?']],
    great: [['We have a new Avenger.', 'Get them a jacket, {other}.', 'And a very long contract.']],
  },
  smash: {
    good: [['Clean combo! Did you catch it, {other}?', 'Caught it. Then it caught me.'], ['That read was frame-perfect.', 'Or lucky, {other}. Could be lucky.']],
    bad: [['They went off the stage, {other}.', 'On purpose?'], ['Did they just miss the ledge?', 'Twice.']],
    great: [['GAME!', 'No items, {other}. Final Destination!', 'We’re going to need a rematch.']],
  },
  genshin: {
    good: [['That reaction was perfect, {other}!', 'Vaporize? No: pure talent.'], ['They didn’t even check the guide.', 'Then who’s the Traveler now?']],
    bad: [['They’re out of stamina, {other}.', 'Halfway up the cliff, too.'], ['Is that a three-star result?', 'It’s a learning experience.']],
    great: [['A five-star moment!', 'And no pity needed, {other}!', 'Write this down for the Adventurers’ Guild.']],
  },
  wow: {
    good: [['{other}, did that just drop?', 'Roll need. I’m rolling need.'], ['That’s a clean pull.', 'Don’t jinx it. Someone always pulls extra.']],
    bad: [['Wipe. Everyone run back.', 'Who pulled that, {other}?'], ['Do we have a healer?', 'We had one.']],
    great: [['Server first!', 'Link it in guild chat, {other}!', 'At least they have chicken.']],
  },
  inazuma: {
    good: [['What a pass! Did you see, {other}?', 'Saw it. I’m open next time!'], ['That’s our new ace.', 'Hands off. I’m the ace, {other}.']],
    bad: [['Own goal, {other}?', 'We don’t say that word. Shake it off.'], ['Back to the training ground?', 'Tire drills. All night.']],
    great: [['GOOOAL!', 'From there?! Did you see that, {other}?', 'Let’s play some more soccer!']],
  },
  forts: {
    good: [['Direct hit, {other}! Right on the reactor.', 'Keep that gun loaded.'], ['Nice bracing.', 'First time it hasn’t fallen over.']],
    bad: [['Who cut the wrong strut?', 'Don’t look at me, {other}. Get the repair crew.'], ['Are we leaning?', 'We are leaning.']],
    great: [['Their whole fort’s coming down!', 'Fire again, {other}!', 'Nothing left to hit!']],
  },
  forhonor: {
    good: [['A clean parry. You saw, {other}?', 'I saw. Keep your own guard up.'], ['That one has fought before.', 'Or they’ve lost often enough to learn.']],
    bad: [['Guard break, and they stood still.', 'Tell them to move, {other}.'], ['Did they just fall off the ledge?', 'The ledge wins again.']],
    great: [['An execution worthy of the sagas!', 'Sing it loud, {other}!', 'Which faction claims them?']],
  },
  avatar: {
    good: [['Did you see that form, {other}?', 'Better than mine. Don’t tell anyone.'], ['That was balance itself.', 'Or luck. Luck is an element now?']],
    bad: [['My cabbages!', 'It wasn’t even near your cabbages, {other}.'], ['They need to work on their stance.', 'Everyone says that to everyone.']],
    great: [['The whole world felt that one.', 'Yip yip, {other}!', 'Someone tell Uncle. He’ll make tea.']],
  },
  unreal: {
    good: [['{other}, that compiled first try.', 'Don’t touch it. Don’t even look at it.'], ['Those wires are almost straight.', 'Almost.']],
    bad: [['Accessed None, {other}.', 'Of course it did. Who cast it?'], ['Is that an infinite loop?', 'Depends. Is the editor still frozen?']],
    great: [['Zero errors. Zero warnings.', 'Ship it, {other}!', 'It’s Friday. Ship it Monday.']],
  },
  destiny: {
    good: [['Good shot, Guardian. You see that, {other}?', 'Saw it. Eyes up.'], ['That’s a clean Super.', 'And they still have ammo. A miracle.']],
    bad: [['Their Ghost is getting tired, {other}.', 'He’s revived them four times.'], ['Another blue engram?', 'Dismantle it. Don’t tell them.']],
    great: [['An Exotic! A real one!', 'Don’t ask Cayde to hold it, {other}.', 'Whether we wanted it or not.']],
  },
  balatro: {
    good: [['That scored, {other}.', 'It scored a lot.'], ['Did they keep the right joker?', 'For once.']],
    bad: [['Why did they discard that, {other}?', 'I stopped asking on Ante 2.'], ['High Card.', 'High Card, {other}.']],
    great: [['Look at that Mult!', 'That’s not a number any more, {other}!', 'One more run. Just one.']],
  },
};

/** For a franchise with no lines of its own. */
const ANY: Talk = {
  good: [['Did you see that, {other}?', 'I saw. Not bad at all.']],
  bad: [['That didn’t go well, {other}.', 'They’ll get the next one.']],
  great: [['Now THAT was something!', 'Did you see that, {other}?', 'Everyone saw.']],
};

/** An exchange for this moment, its lines ready to say (`addressee(i)`: who line i is said to). */
export function pickExchange(set: string, kind: Cue, addressee: (line: number) => string): string[] {
  const options = (DIALOGUE[set] ?? ANY)[kind];
  const exchange = options[Math.floor(Math.random() * options.length)];
  return exchange.map((line, i) => line.replace('{other}', addressee(i)));
}
