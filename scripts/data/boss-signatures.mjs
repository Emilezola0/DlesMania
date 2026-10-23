#!/usr/bin/env node
// Writes each boss's Signature challenge (Hard's secret phase) into src/data/bosses.json: clues on
// one very specific side of the franchise, answered in a row. Some come from data the app already
// has (One Piece laugh clips, Genshin constellations, MCU actors) or from Riot's Data Dragon (League
// items, described by their stats and price); the rest are hand-written lists of facts below.
// Re-run after rebuilding the Specialist data or after a League patch.
//
//   node scripts/data/boss-signatures.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, getJson } from '../lib.mjs';

const FILE = join(ROOT, 'src', 'data', 'bosses.json');
const read = (f) => JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'specialist', f), 'utf8'));
const text = (pairs) => pairs.map(([clue, answer]) => ({ text: clue, answer }));

// ── Generated ────────────────────────────────────────────────────────────────────

/** One Piece: the Specialist's laugh clips, played in full. */
function onePiece() {
  const { characters, laughs } = read('onepiece.json');
  const byId = new Map(characters.map((c) => [c.id, c]));
  return laughs
    .filter((l) => l.youtubeId)
    .map((l) => {
      const c = byId.get(l.character);
      return { audio: { youtubeId: l.youtubeId, start: 0 }, answer: [c.name, ...c.aliases].join('|') };
    });
}

/** Genshin: the name of a character's constellation. */
function genshin() {
  return read('genshin.json').characters.filter((c) => c.constellation).map((c) => ({ text: `✦ ${c.constellation} ✦`, answer: [c.name, ...c.aliases].join('|') }));
}

/** MCU: the actor, for roles one actor clearly owns. */
function mcu() {
  return read('marvel.json')
    .characters.slice(0, 120)
    .filter((c) => c.castable && c.actor)
    .map((c) => ({ text: `Played by ${c.actor}`, answer: [c.name, ...c.aliases].join('|') }));
}

/** League: a finished Summoner's Rift item, by its stats and price (unique combinations only). */
async function league() {
  const version = (await getJson('https://ddragon.leagueoflegends.com/api/versions.json'))[0];
  const items = Object.values((await getJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`)).data);
  const STATS = [
    ['FlatPhysicalDamageMod', 'Attack Damage'], ['FlatMagicDamageMod', 'Ability Power'], ['PercentAttackSpeedMod', 'Attack Speed', true],
    ['FlatCritChanceMod', 'Critical Strike Chance', true], ['FlatHPPoolMod', 'Health'], ['FlatArmorMod', 'Armor'], ['FlatSpellBlockMod', 'Magic Resist'],
    ['FlatMPPoolMod', 'Mana'], ['PercentLifeStealMod', 'Life Steal', true], ['PercentMovementSpeedMod', 'Move Speed', true], ['FlatMovementSpeedMod', 'Move Speed'],
    ['FlatHPRegenMod', 'Health Regen'],
  ];
  const clues = new Map();
  const seen = new Map();
  for (const it of items) {
    if (!it.maps?.['11'] || !it.gold?.purchasable || it.gold.total < 2200 || it.into?.length || it.requiredChampion || it.inStore === false) continue;
    if (/consumable|trinket/i.test((it.tags ?? []).join(' ')) || /\(|Quick|Pick/.test(it.name)) continue;
    const parts = STATS.filter(([k]) => it.stats?.[k]).map(([k, label, pct]) => `+${pct ? Math.round(it.stats[k] * 100) + '%' : it.stats[k]} ${label}`);
    if (parts.length < 2) continue;
    const clue = `${parts.join(' · ')} · ${it.gold.total.toLocaleString('en-US')} gold`;
    seen.set(clue, (seen.get(clue) ?? 0) + 1);
    clues.set(clue, [it.name, it.name.replace(/'/g, '')].filter((n, i, a) => a.indexOf(n) === i).join('|'));
  }
  // Two items with the same stats and price can't be told apart: neither is used.
  return [...clues].filter(([c]) => seen.get(c) === 1).map(([clue, answer]) => ({ text: clue, answer }));
}

// ── Hand-written facts ───────────────────────────────────────────────────────────

const HAND = {
  wow: {
    label: 'Raid', prompt: 'Who is the final boss of this raid?',
    clues: text([
      ['Molten Core', 'Ragnaros|Ragnaros the Firelord'], ["Onyxia's Lair", 'Onyxia'], ['Blackwing Lair', 'Nefarian|Victor Nefarius'], ['Naxxramas', "Kel'Thuzad|Kelthuzad"],
      ["Temple of Ahn'Qiraj", "C'Thun|Cthun"], ["Zul'Gurub", 'Hakkar|Hakkar the Soulflayer'], ['Karazhan', 'Prince Malchezaar|Malchezaar'], ["Gruul's Lair", 'Gruul|Gruul the Dragonkiller'],
      ['Serpentshrine Cavern', 'Lady Vashj|Vashj'], ['Tempest Keep', "Kael'thas Sunstrider|Kael'thas|Kaelthas"], ['Black Temple', 'Illidan Stormrage|Illidan'],
      ['Sunwell Plateau', "Kil'jaeden|Kiljaeden"], ['Ulduar', 'Yogg-Saron|Yogg Saron'], ['The Eye of Eternity', 'Malygos'], ['Trial of the Crusader', "Anub'arak|Anubarak"],
      ['Icecrown Citadel', 'The Lich King|Lich King|Arthas'], ['The Ruby Sanctum', 'Halion'], ['Firelands', 'Ragnaros|Ragnaros the Firelord'], ['Dragon Soul', 'Deathwing|Madness of Deathwing'],
      ['Throne of Thunder', 'Lei Shen'], ['Siege of Orgrimmar', 'Garrosh Hellscream|Garrosh'], ['Blackrock Foundry', 'Blackhand'], ['Hellfire Citadel', 'Archimonde'],
      ['The Emerald Nightmare', 'Xavius'], ['The Nighthold', "Gul'dan|Guldan"], ['Tomb of Sargeras', "Kil'jaeden|Kiljaeden"], ['Antorus, the Burning Throne', 'Argus|Argus the Unmaker'],
      ['Uldir', "G'huun|Ghuun"], ["Ny'alotha, the Waking City", "N'Zoth|Nzoth|N'Zoth the Corruptor"], ['The Eternal Palace', 'Queen Azshara|Azshara'],
      ['Castle Nathria', 'Sire Denathrius|Denathrius'], ['Sanctum of Domination', 'Sylvanas Windrunner|Sylvanas'], ['Sepulcher of the First Ones', 'The Jailer|Jailer|Zovaal'],
      ['Vault of the Incarnates', 'Raszageth'], ["Amirdrassil, the Dream's Hope", 'Fyrakk|Fyrakk the Blazing'], ['Nerub-ar Palace', 'Queen Ansurek|Ansurek'],
    ]),
  },
  overwatch: {
    label: 'Ultimate', prompt: 'Whose ultimate is this?',
    clues: text([
      ['Dragonblade', 'Genji'], ['Deadeye', 'Cassidy|McCree'], ['Self-Destruct', 'D.Va|Dva'], ['Death Blossom', 'Reaper|Faucheur'],
      ['Barrage', 'Pharah'], ['Pulse Bomb', 'Tracer'], ['Earthshatter', 'Reinhardt'], ['Graviton Surge', 'Zarya'], ['Nano Boost', 'Ana'],
      ['Sound Barrier', 'Lúcio|Lucio'], ['Valkyrie', 'Mercy|Ange'], ['Dragonstrike', 'Hanzo'], ['RIP-Tire', 'Junkrat|Chacal'], ['Whole Hog', 'Roadhog|Chopper'],
      ['Blizzard', 'Mei'], ['Primal Rage', 'Winston'], ['Coalescence', 'Moira'], ['Infra-Sight', 'Widowmaker|Fatale'], ['Transcendence', 'Zenyatta'],
      ['Tactical Visor', 'Soldier: 76|Soldier 76|Soldat 76'], ['Minefield', 'Wrecking Ball|Hammond|Bouldozer'], ['Kitsune Rush', 'Kiriko'], ['Rally', 'Brigitte'],
      ['EMP', 'Sombra'], ['Duplicate', 'Echo'], ['B.O.B.', 'Ashe'], ['Gravitic Flux', 'Sigma'], ['Amplification Matrix', 'Baptiste'], ['Meteor Strike', 'Doomfist'],
      ['Rampage', 'Junker Queen|Reine des Junkers'], ['Annihilation', 'Ramattra'], ['Tree of Life', 'Lifeweaver'], ['Captive Sun', 'Illari'], ['Cage Fight', 'Mauga'],
    ]),
  },
  minecraft: {
    label: 'Drop', prompt: 'Which mob drops this?',
    clues: text([
      ['Ender Pearl', 'Enderman'], ['Blaze Rod', 'Blaze'], ['Ghast Tear', 'Ghast'], ['Slimeball', 'Slime'], ['Magma Cream', 'Magma Cube|Cube de magma'],
      ['Phantom Membrane', 'Phantom|Fantôme'], ['Shulker Shell', 'Shulker'], ['Nether Star', 'Wither'], ['Totem of Undying', 'Evoker|Évocateur'],
      ['Wither Skeleton Skull', 'Wither Skeleton|Squelette wither'], ['Ink Sac', 'Squid|Poulpe'], ['Glow Ink Sac', 'Glow Squid|Poulpe luisant'],
      ['Wet Sponge', 'Elder Guardian|Grand gardien'], ["Rabbit's Foot", 'Rabbit|Lapin'], ['Armadillo Scute', 'Armadillo|Tatou'], ['Breeze Rod', 'Breeze'],
      ['Sculk Catalyst', 'Warden|Gardien des profondeurs'], ['Trident', 'Drowned|Noyé'],
    ]),
  },
  dbz: {
    label: 'Technique', prompt: 'Whose signature technique is this?',
    clues: text([
      ['Final Flash', 'Vegeta'], ['Galick Gun', 'Vegeta'], ['Big Bang Attack', 'Vegeta'], ['Special Beam Cannon', 'Piccolo'], ['Hellzone Grenade', 'Piccolo'],
      ['Destructo Disc', 'Krillin|Krilin'], ['Masenko', 'Gohan|Son Gohan'], ['Tri-Beam', 'Tien|Tenshinhan|Tien Shinhan'], ['Death Ball', 'Frieza|Freezer|Freeza'],
      ['Spirit Bomb', 'Goku|Son Goku'], ['Instant Transmission', 'Goku|Son Goku'], ['Wolf Fang Fist', 'Yamcha'], ['Burning Attack', 'Trunks'],
      ['Super Ghost Kamikaze Attack', 'Gotenks'], ['Eraser Cannon', 'Broly'], ['Body Change', 'Captain Ginyu|Ginyu'], ['Chocolate Beam', 'Majin Buu|Buu'],
    ]),
  },
  naruto: {
    label: 'Jutsu', prompt: 'Whose jutsu is this?',
    clues: text([
      ['Rasenshuriken', 'Naruto|Naruto Uzumaki'], ['Sexy Jutsu', 'Naruto|Naruto Uzumaki'], ['Raikiri', 'Kakashi|Kakashi Hatake'], ['Kirin', 'Sasuke|Sasuke Uchiha'],
      ['Tsukuyomi', 'Itachi|Itachi Uchiha'], ['Shadow Possession Jutsu', 'Shikamaru|Shikamaru Nara'], ['Mind Transfer Jutsu', 'Ino|Ino Yamanaka'],
      ['Sand Coffin', 'Gaara'], ['Fang over Fang', 'Kiba|Kiba Inuzuka'], ['Shinra Tensei', 'Pain|Nagato'], ['Explosive Clay', 'Deidara'],
      ['Eight Trigrams Sixty-Four Palms', 'Neji|Neji Hyuga'], ['Paper Person of God', 'Konan'], ['Crow puppet', 'Kankuro'], ['Insect Clone Jutsu', 'Shino|Shino Aburame'],
    ]),
  },
  starwars: {
    label: 'Ship', prompt: 'Whose ship is this?',
    clues: text([
      ['Slave I', 'Boba Fett|Jango Fett'], ['Razor Crest', 'Din Djarin|The Mandalorian|Mando'], ['Ghost', 'Hera Syndulla|Hera'], ['Red Five', 'Luke Skywalker|Luke'],
      ['TIE Advanced x1', 'Darth Vader|Vader|Anakin Skywalker'], ['Scimitar', 'Darth Maul|Maul'], ['Tantive IV', 'Leia Organa|Leia|Princess Leia|Bail Organa'],
      ['Millennium Falcon', 'Han Solo|Han|Lando Calrissian|Lando'], ['Home One', 'Admiral Ackbar|Ackbar'], ['Executor', 'Darth Vader|Vader'],
    ]),
  },
  harrypotter: {
    label: 'Patronus', prompt: 'Whose Patronus is this?',
    clues: text([
      ['A stag', 'Harry Potter|Harry|James Potter'], ['An otter', 'Hermione Granger|Hermione'], ['A Jack Russell terrier', 'Ron Weasley|Ron'],
      ['A doe', 'Severus Snape|Snape|Lily Potter|Lily'], ['A hare', 'Luna Lovegood|Luna'], ['A phoenix', 'Albus Dumbledore|Dumbledore'],
      ['A lynx', 'Kingsley Shacklebolt|Kingsley'], ['A swan', 'Cho Chang|Cho'], ['A horse', 'Ginny Weasley|Ginny'], ['A tabby cat', 'Minerva McGonagall|McGonagall'],
      ['A wolf', 'Remus Lupin|Lupin'], ['A weasel', 'Arthur Weasley'], ['A goat', 'Aberforth Dumbledore|Aberforth'],
    ]),
  },
  lotr: {
    label: 'Weapon', prompt: 'Who wields this?',
    clues: text([
      ['Sting', 'Frodo Baggins|Frodo|Bilbo Baggins|Bilbo|Samwise Gamgee|Sam'], ['Andúril', 'Aragorn'], ['Glamdring', 'Gandalf'], ['Orcrist', 'Thorin Oakenshield|Thorin|Legolas'],
      ['Herugrim', 'Théoden|Theoden'], ['Guthwinë', 'Éomer|Eomer'], ['Narsil', 'Isildur|Elendil'], ['Aeglos', 'Gil-galad'], ['Hadhafang', 'Arwen'],
      ['A Morgul-blade', 'Witch-king of Angmar|Witch-king|Witch King'], ['The One Ring', 'Sauron'],
    ]),
  },
  smash: {
    label: 'Final Smash', prompt: 'Whose Final Smash is this?',
    clues: text([
      ['Giga Bowser Punch', 'Bowser'], ['Volt Tackle', 'Pikachu'], ['Mario Finale', 'Mario'], ['Super Sonic', 'Sonic'], ['Ultra Sword', 'Kirby'],
      ['Galaxia Darkness', 'Meta Knight'], ['Octopus', 'Mr. Game & Watch|Mr Game and Watch|Game & Watch'], ['Great Aether', 'Ike'], ['Black Hole Laser', 'Palutena'],
      ['Supernova', 'Sephiroth'], ['Omnislash Ver. Sonic', 'Cloud'], ['Gigaslash', 'Hero'], ['All-Out Attack', 'Joker'], ['PK Starstorm', 'Ness|Lucas'],
      ['Zero Laser', 'Samus'], ['Critical Hit', 'Marth|Lucina'],
    ]),
  },
  inazuma: {
    label: 'Hissatsu', prompt: 'Who uses this hissatsu?',
    clues: text([
      ['Main Céleste (God Hand)', 'Mark Evans|Endou Mamoru|Endou'], ['Main Magique (Majin The Hand)', 'Mark Evans|Endou Mamoru|Endou'],
      ['Tornade de Feu (Fire Tornado)', 'Axel Blaze|Gouenji Shuuya|Gouenji'], ['Tourbillon de Feu (Bakunetsu Screw)', 'Axel Blaze|Gouenji Shuuya|Gouenji'],
      ['Ballon Illusoire (Illusion Ball)', 'Jude Sharp|Kidou Yuuto|Kidou'], ['Blizzard Éternel (Eternal Blizzard)', 'Shawn Froste|Fubuki Shirou|Fubuki'],
      ['Le Mur (The Wall)', 'Jack Wallside|Kabeyama Heigorou|Kabeyama'], ['Scie Circulaire (Spinning Cut)', 'Bobby Shearer|Domon Asuka|Domon'],
      ['Tir Céleste (Heaven Drive)', 'Byron Love|Afuro Terumi|Afuro'],
    ]),
  },
};

// ── Write ────────────────────────────────────────────────────────────────────────

const GENERATED = {
  onepiece: { label: 'Laugh', prompt: 'Whose laugh is this?', clues: onePiece() },
  genshin: { label: 'Constellation', prompt: 'Whose constellation is this?', clues: genshin() },
  mcu: { label: 'Cast', prompt: 'Which character does this actor play?', clues: mcu() },
  lol: { label: 'Item', prompt: 'Which item has these stats?', clues: await league() },
};

const bosses = JSON.parse(readFileSync(FILE, 'utf8'));
for (const b of bosses) {
  const sig = GENERATED[b.id] ?? HAND[b.id];
  if (!sig) {
    console.log(`  ✗ ${b.id}: no Signature written yet`);
    continue;
  }
  b.signature = sig;
  console.log(`  ${b.id.padEnd(12)} ${sig.label.padEnd(14)} ${sig.clues.length} clues`);
}
writeFileSync(FILE, JSON.stringify(bosses, null, 2) + '\n');
