// 中級へ行こう 日本語の文型と表現55 (第2版, スリーエーネットワーク): lessons 1–5. Only the book's list of points (its
// 学習項目一覧: lesson, number, form) comes from it; every meaning, explanation and example here is written for
// Omnidle by an AI (Claude), never taken from the book. `l`: the point's number in the book (lesson-item).
// The 整理 items are recaps: their note compares the forms. Examples: [ja, en, fr], {…} the grammar.
export default [
  {
    n: 1,
    l: '1-1',
    p: 'N1といえば、N2だ',
    en: 'Speaking of N1, (it has to be) N2',
    fr: 'Quand on parle de N1, (c’est forcément) N2',
    form: 'N1 といえば、N2 だ',
    note: {
      en: 'Names the first thing that comes to mind for a topic, the most typical example.',
      fr: 'Donne la première chose qui vient à l’esprit pour un sujet, l’exemple le plus typique.',
    },
    ex: [
      ['[日本|にほん]の[食|た]べ[物|もの]{といえば}、すし{だ}。', 'Speaking of Japanese food, it has to be sushi.', 'La cuisine japonaise, c’est avant tout les sushis.'],
      ['[夏|なつ]{といえば}、やっぱり[花火|はなび]{だ}ね。', 'When you think of summer, it’s fireworks, isn’t it?', 'L’été, c’est les feux d’artifice, non ?'],
    ],
  },
  {
    n: 2,
    l: '1-2',
    p: 'も',
    en: 'As many as…, as much as… (stressing a large number)',
    fr: 'Pas moins de…, jusqu’à… (insiste sur une grande quantité)',
    form: 'number + counter + も',
    note: {
      en: 'After a number, も shows the speaker finds the amount large (or surprising), not “also”.',
      fr: 'Après un nombre, も montre qu’on trouve la quantité grande (ou surprenante) ; ce n’est pas « aussi ».',
    },
    ex: [
      ['ハンバーガーを[五|いつ]つ{も}[食|た]べた。', 'He ate no fewer than five hamburgers.', 'Il a mangé pas moins de cinq hamburgers.'],
      ['[駅|えき]まで[一時間|いちじかん]{も}かかった。', 'It took a whole hour to get to the station.', 'Il a fallu une heure entière pour arriver à la gare.'],
    ],
  },
  {
    n: 3,
    l: '1-3',
    p: 'Nは～こと、～ことだ',
    en: 'The (good/bad) points of N are that… and that…',
    fr: 'Les (atouts/défauts) de N, c’est que… et que…',
    form: 'N の いい点は、～こと、～ことだ',
    note: {
      en: 'Lists features of something by turning each one into a noun with こと: useful for pros and cons.',
      fr: 'Énumère les caractéristiques d’une chose en transformant chacune en nom avec こと : utile pour les avantages et les inconvénients.',
    },
    ex: [
      ['ファストフードのいい[点|てん]{は}、[安|やす]い{こと}、[早|はや]い{ことだ}。', 'The good points of fast food are that it’s cheap and fast.', 'Les atouts de la restauration rapide, c’est que c’est bon marché et rapide.'],
      ['この[町|まち]の[問題|もんだい]{は}、[店|みせ]が[少|すく]ない{こと}、バスが[少|すく]ない{ことだ}。', 'This town’s problems are that there are few shops and few buses.', 'Les problèmes de cette ville, c’est qu’il y a peu de magasins et peu de bus.'],
    ],
  },
  {
    n: 4,
    l: '1-4',
    p: 'Vマス始める・Vマス終わる',
    en: 'To start (doing) / to finish (doing)',
    fr: 'Commencer à (faire) / finir de (faire)',
    form: 'V-ます stem + 始める / 終わる',
    note: {
      en: 'Attached to a verb stem, 始める marks the start of an action, 終わる its end (until it’s complete).',
      fr: 'Accrochés au radical d’un verbe, 始める marque le début d’une action, 終わる sa fin (jusqu’au bout).',
    },
    ex: [
      ['[雨|あめ]が[降|ふ]り{[始|はじ]めた}。', 'It started to rain.', 'Il a commencé à pleuvoir.'],
      ['この[本|ほん]をやっと[読|よ]み{[終|お]わった}。', 'I finally finished reading this book.', 'J’ai enfin fini de lire ce livre.'],
    ],
  },
  {
    n: 5,
    l: '2-1',
    p: '～のでしょうか',
    en: 'I wonder…? (a soft, polite question)',
    fr: 'Est-ce que… ? (question polie et douce)',
    form: 'V / い-adj (plain) / な-adj な / N な + のでしょうか',
    note: {
      en: 'Asks politely for an explanation, or wonders aloud; softer than のですか.',
      fr: 'Demande poliment une explication, ou s’interroge à voix haute ; plus doux que のですか.',
    },
    ex: [
      ['どうして[地震|じしん]が[起|お]きる{のでしょうか}。', 'Why do earthquakes happen, I wonder?', 'Pourquoi les tremblements de terre se produisent-ils ?'],
      ['すみません、この[電車|でんしゃ]は[東京|とうきょう]へ[行|い]く{のでしょうか}。', 'Excuse me, does this train go to Tokyo?', 'Excusez-moi, est-ce que ce train va à Tokyo ?'],
    ],
  },
  {
    n: 6,
    l: '2-2',
    p: '「自動詞・他動詞」の整理',
    en: 'Recap: intransitive and transitive verbs',
    fr: 'Récap : verbes intransitifs et transitifs',
    form: 'N が + intransitive (開く); N を + transitive (開ける)',
    note: {
      en: 'Many verbs come in pairs: the intransitive says something happens by itself (ドアが開く), the transitive says someone does it (ドアを開ける). が goes with the first, を with the second.',
      fr: 'Beaucoup de verbes vont par paires : l’intransitif dit qu’une chose se fait d’elle-même (ドアが開く), le transitif que quelqu’un la fait (ドアを開ける). が va avec le premier, を avec le second.',
    },
    ex: [
      ['[地震|じしん]で[窓|まど]{が[割|わ]れた}。', 'The window broke in the earthquake.', 'La fenêtre s’est brisée pendant le séisme.'],
      ['[子供|こども]がボールで[窓|まど]{を[割|わ]った}。', 'A child broke the window with a ball.', 'Un enfant a cassé la fenêtre avec un ballon.'],
    ],
  },
  {
    n: 7,
    l: '2-3',
    p: 'V（よ）うとしても、Vナイない',
    en: 'Even if I try to…, I can’t',
    fr: 'J’ai beau essayer de…, je n’y arrive pas',
    form: 'V-よう + としても、V-potential ない',
    note: {
      en: 'An attempt that doesn’t work. Often the same verb twice, the second in the potential negative.',
      fr: 'Une tentative qui ne marche pas. Souvent le même verbe deux fois, le second au potentiel négatif.',
    },
    ex: [
      ['[揺|ゆ]れが[大|おお]きくて、[立|た]と{うとしても}[立|た]て{ない}。', 'The shaking is so strong that even if I try to stand, I can’t.', 'Ça secoue tellement que j’ai beau essayer de me lever, je n’y arrive pas.'],
      ['[忘|わす]れよ{うとしても}、[忘|わす]れられ{ない}。', 'Even if I try to forget, I can’t.', 'J’ai beau essayer d’oublier, je n’y arrive pas.'],
    ],
  },
  {
    n: 8,
    l: '2-4',
    p: '～のは～だ',
    en: 'What… is… (focus)',
    fr: 'Ce qui…, c’est… (mise en relief)',
    form: 'V / い-adj (plain) / な-adj な + のは + N だ',
    note: {
      en: 'Turns the first part into a noun with の to put the focus on what comes after は: “what scared me most was…”.',
      fr: 'Transforme la première partie en nom avec の pour mettre en relief ce qui suit は : « ce qui m’a le plus fait peur, c’est… ».',
    },
    ex: [
      ['いちばん[怖|こわ]かった{のは}、[夜|よる]の[地震|じしん]{だ}。', 'What scared me most was the earthquake at night.', 'Ce qui m’a fait le plus peur, c’est le séisme de la nuit.'],
      ['[私|わたし]が[生|う]まれた{のは}[大阪|おおさか]{だ}。', 'Where I was born is Osaka.', 'C’est à Osaka que je suis né.'],
    ],
  },
  {
    n: 9,
    l: '2-5',
    p: '「自動詞－ている・他動詞－てある／ておく」の整理',
    en: 'Recap: intransitive ている, transitive てある / ておく',
    fr: 'Récap : intransitif ている, transitif てある / ておく',
    form: 'N が V(intr.)-ている; N が V(tr.)-てある; N を V(tr.)-ておく',
    note: {
      en: 'ている after an intransitive verb: a state, nobody in mind (窓が開いている). てある after a transitive one: a state someone left on purpose (窓が開けてある). ておく: doing it in advance (窓を開けておく).',
      fr: 'ている après un intransitif : un état, sans penser à quelqu’un (窓が開いている). てある après un transitif : un état laissé exprès par quelqu’un (窓が開けてある). ておく : le faire à l’avance (窓を開けておく).',
    },
    ex: [
      ['[電気|でんき]が{ついている}。', 'The light is on.', 'La lumière est allumée.'],
      ['[水|みず]が[買|か]っ{てある}から、[地震|じしん]が[来|き]ても[大丈夫|だいじょうぶ]だ。', 'Water has been bought, so we’ll be fine even if an earthquake comes.', 'On a acheté de l’eau, donc ça ira même en cas de séisme.'],
      ['[懐中電灯|かいちゅうでんとう]を[用意|ようい]し{ておこう}。', 'Let’s get a torch ready in advance.', 'Préparons une lampe de poche à l’avance.'],
    ],
  },
  {
    n: 10,
    l: '3-1',
    p: 'V［普通形］ようなN',
    en: 'A N that (seems to)…, the kind of N that…',
    fr: 'Un N qui (semble)…, le genre de N qui…',
    form: 'V (plain) + ような + N',
    note: {
      en: 'Describes a noun by an example of what it does or is like, a bit vaguely: “the kind of game that…”.',
      fr: 'Décrit un nom par un exemple de ce qu’il fait ou de ce à quoi il ressemble, de façon un peu vague : « le genre de jeu qui… ».',
    },
    ex: [
      ['[子供|こども]が[夢中|むちゅう]になる{ような}ゲームが[多|おお]い。', 'There are lots of games that children get hooked on.', 'Il y a beaucoup de jeux du genre dont les enfants raffolent.'],
      ['みんなが[驚|おどろ]く{ような}ニュースがあった。', 'There was the kind of news that surprises everyone.', 'Il y a eu une nouvelle à surprendre tout le monde.'],
    ],
  },
  {
    n: 11,
    l: '3-2',
    p: 'Nばかり・Vテばかりいる',
    en: 'Nothing but N / doing nothing but…',
    fr: 'Rien que N / ne faire que…',
    form: 'N + ばかり; V-て + ばかりいる',
    note: {
      en: 'Says someone does only this, too much, usually as a criticism.',
      fr: 'Dit que quelqu’un ne fait que ça, trop, en général comme un reproche.',
    },
    ex: [
      ['[弟|おとうと]はお[菓子|かし]{ばかり}[食|た]べている。', 'My brother eats nothing but sweets.', 'Mon frère ne mange que des sucreries.'],
      ['[最近|さいきん]の[子供|こども]はゲームをし{てばかりいる}。', 'Children these days do nothing but play games.', 'Les enfants d’aujourd’hui ne font que jouer aux jeux vidéo.'],
    ],
  },
  {
    n: 12,
    l: '3-3',
    p: 'Nを欲しがる・Vマスたがる・Vマスたがらない',
    en: '(Someone else) wants N / wants to… / doesn’t want to…',
    fr: '(Quelqu’un d’autre) veut N / veut… / ne veut pas…',
    form: 'N を欲しがる; V-ます stem + たがる / たがらない',
    note: {
      en: '欲しい and ～たい are for the speaker’s own wishes. For a third person’s, as seen from outside, use 欲しがる and ～たがる.',
      fr: '欲しい et ～たい servent pour ses propres envies. Pour celles d’une autre personne, vues de l’extérieur, on emploie 欲しがる et ～たがる.',
    },
    ex: [
      ['[妹|いもうと]は[新|あたら]しいスマホ{を[欲|ほ]しがっている}。', 'My little sister wants a new smartphone.', 'Ma petite sœur veut un nouveau smartphone.'],
      ['[息子|むすこ]は[野菜|やさい]を[食|た]べ{たがらない}。', 'My son doesn’t want to eat vegetables.', 'Mon fils ne veut pas manger de légumes.'],
    ],
  },
  {
    n: 13,
    l: '3-4',
    p: 'ついVテしまう',
    en: 'To end up (doing) without meaning to',
    fr: 'Finir par (faire) sans le vouloir',
    form: 'つい + V-て しまう',
    note: {
      en: 'Something done by habit or impulse that the speaker knows they shouldn’t.',
      fr: 'Une chose faite par habitude ou par impulsion, qu’on sait ne pas devoir faire.',
    },
    ex: [
      ['[夜|よる][遅|おそ]くまで{つい}ゲームをし{てしまう}。', 'I end up playing games late into the night without meaning to.', 'Je finis toujours par jouer tard le soir sans le vouloir.'],
      ['[安|やす]いと、{つい}[買|か]っ{てしまう}。', 'When it’s cheap, I just can’t help buying it.', 'Quand c’est pas cher, je ne peux pas m’empêcher d’acheter.'],
    ],
  },
  {
    n: 14,
    l: '3-5',
    p: '～（の）は～からだ',
    en: 'The reason (that)… is because…',
    fr: 'Si…, c’est parce que…',
    form: 'V / adj (plain) + のは + reason + からだ',
    note: {
      en: 'States a fact first, then its cause, putting the stress on the reason.',
      fr: 'Énonce d’abord un fait, puis sa cause, en mettant l’accent sur la raison.',
    },
    ex: [
      ['[子供|こども]が[外|そと]で[遊|あそ]ばない{のは}、[公園|こうえん]が[少|すく]ない{からだ}。', 'The reason children don’t play outside is that there are few parks.', 'Si les enfants ne jouent pas dehors, c’est parce qu’il y a peu de parcs.'],
      ['[遅|おく]れた{のは}、[電車|でんしゃ]が[止|と]まった{からだ}。', 'I was late because the train stopped.', 'Si je suis en retard, c’est parce que le train s’est arrêté.'],
    ],
  },
  {
    n: 15,
    l: '3-6',
    p: 'Nのようだ・Nのように（V／A／Na）・N1のようなN2',
    en: 'Like N, as if N',
    fr: 'Comme N, tel un N',
    form: 'N のようだ; N のように + V / adj; N1 のような N2',
    note: {
      en: 'Compares something to N. のようだ ends a sentence, のように goes before a verb or adjective, のような before a noun.',
      fr: 'Compare une chose à N. のようだ termine une phrase, のように précède un verbe ou un adjectif, のような un nom.',
    },
    ex: [
      ['あの[子|こ]はまるで[大人|おとな]{のようだ}。', 'That child is just like an adult.', 'Cet enfant est vraiment comme un adulte.'],
      ['[彼女|かのじょ]は[歌手|かしゅ]{のように}[歌|うた]が[上手|じょうず]だ。', 'She sings as well as a singer.', 'Elle chante aussi bien qu’une chanteuse.'],
      ['[雪|ゆき]{のような}[白|しろ]い[花|はな]が[咲|さ]いた。', 'Flowers as white as snow bloomed.', 'Des fleurs blanches comme la neige ont fleuri.'],
    ],
  },
  {
    n: 16,
    l: '4-1',
    p: 'Vテいく・Vテきた',
    en: '(A change) will go on… / has been… until now',
    fr: '(Un changement) va continuer… / s’est fait… jusqu’ici',
    form: 'V-て + いく (from now on); V-て + きた (up to now)',
    note: {
      en: 'With verbs of change: ていく looks to the future (it will keep changing), てきた looks back at a change up to now.',
      fr: 'Avec des verbes de changement : ていく regarde vers l’avenir (ça va continuer), てきた regarde un changement jusqu’à aujourd’hui.',
    },
    ex: [
      ['[日本|にほん]に[来|く]る[外国人|がいこくじん]は[増|ふ]え{てきた}。', 'The number of foreigners coming to Japan has been rising.', 'Le nombre d’étrangers qui viennent au Japon a augmenté.'],
      ['これからも[増|ふ]え{ていく}だろう。', 'It will probably keep rising from now on.', 'Il va sans doute continuer d’augmenter.'],
    ],
  },
  {
    n: 17,
    l: '4-2',
    p: '［表／グラフ］で見ると、～ことがわかる',
    en: 'Looking at the (table/graph), we can see that…',
    fr: 'Si l’on regarde le (tableau/graphique), on voit que…',
    form: '表 / グラフ で見ると、～ことがわかる',
    note: {
      en: 'A set phrase to present data: say where you look, then what it shows.',
      fr: 'Une tournure pour présenter des données : on dit où l’on regarde, puis ce que ça montre.',
    },
    ex: [
      ['このグラフで[見|み]ると、[旅行者|りょこうしゃ]が[増|ふ]えている{ことがわかる}。', 'Looking at this graph, we can see that travellers are increasing.', 'D’après ce graphique, on voit que les voyageurs sont en hausse.'],
      ['[表|ひょう]{で[見|み]ると}、[東京|とうきょう]が[一番|いちばん][多|おお]い{ことがわかる}。', 'Looking at the table, we can see Tokyo has the most.', 'Le tableau montre que c’est Tokyo qui en a le plus.'],
    ],
  },
  {
    n: 18,
    l: '4-3',
    p: 'N1のようなN2',
    en: 'N2 such as N1, N2 like N1 (example)',
    fr: 'N2 tel que N1, N2 comme N1 (exemple)',
    form: 'N1 のような N2',
    note: {
      en: 'Here のような gives an example of a kind, not a comparison: “cities like Kyoto” (Kyoto is one of them).',
      fr: 'Ici, のような donne un exemple d’une catégorie, pas une comparaison : « des villes comme Kyoto » (Kyoto en fait partie).',
    },
    ex: [
      ['[京都|きょうと]{のような}[古|ふる]い[町|まち]が[好|す]きだ。', 'I like old towns like Kyoto.', 'J’aime les vieilles villes comme Kyoto.'],
      ['すし{のような}[和食|わしょく]は[海外|かいがい]でも[人気|にんき]だ。', 'Japanese food such as sushi is popular abroad too.', 'La cuisine japonaise, comme les sushis, est populaire aussi à l’étranger.'],
    ],
  },
  {
    n: 19,
    l: '4-4',
    p: 'XはYほど～ない',
    en: 'X is not as… as Y',
    fr: 'X n’est pas aussi… que Y',
    form: 'X は Y ほど + adj / V (negative)',
    note: {
      en: 'A negative comparison: X does not reach Y’s level.',
      fr: 'Une comparaison négative : X n’atteint pas le niveau de Y.',
    },
    ex: [
      ['[大阪|おおさか]{は}[東京|とうきょう]{ほど}[大|おお]きく{ない}。', 'Osaka isn’t as big as Tokyo.', 'Osaka n’est pas aussi grande que Tokyo.'],
      ['[今年|ことし]の[夏|なつ]{は}[去年|きょねん]{ほど}[暑|あつ]く{ない}。', 'This summer isn’t as hot as last year’s.', 'Cet été n’est pas aussi chaud que l’an dernier.'],
    ],
  },
  {
    n: 20,
    l: '4-5',
    p: '「比較」の整理',
    en: 'Recap: comparisons',
    fr: 'Récap : la comparaison',
    form: 'A は B より～; A より B のほうが～; A は B ほど～ない; A と B と どちらが～; ～の中で ～が一番～',
    note: {
      en: 'より: “more than”; のほうが: which one is more; ほど…ない: “not as… as”; どちら: asking between two; 一番: the most among many.',
      fr: 'より : « plus que » ; のほうが : lequel l’est plus ; ほど…ない : « pas aussi… que » ; どちら : choisir entre deux ; 一番 : le plus, parmi plusieurs.',
    },
    ex: [
      ['[電車|でんしゃ]{のほうが}バス{より}[速|はや]い。', 'The train is faster than the bus.', 'Le train est plus rapide que le bus.'],
      ['[日本|にほん]の[山|やま]{の[中|なか]で}、[富士山|ふじさん]{が[一番|いちばん]}[高|たか]い。', 'Of all Japan’s mountains, Fuji is the highest.', 'De toutes les montagnes du Japon, le Fuji est la plus haute.'],
    ],
  },
  {
    n: 21,
    l: '5-1',
    p: 'A／Naさ',
    en: '-ness: turning an adjective into a noun',
    fr: 'Le suffixe さ : faire d’un adjectif un nom',
    form: 'い-adj (−い) / な-adj + さ',
    note: {
      en: 'Makes a noun of degree from an adjective: 高い → 高さ (height), 大切 → 大切さ (importance). いい becomes よさ.',
      fr: 'Fait d’un adjectif un nom de degré : 高い → 高さ (la hauteur), 大切 → 大切さ (l’importance). いい devient よさ.',
    },
    ex: [
      ['[睡眠|すいみん]の[大切|たいせつ]{さ}を[知|し]った。', 'I learned how important sleep is.', 'J’ai compris l’importance du sommeil.'],
      ['この[山|やま]の[高|たか]{さ}は[三千|さんぜん]メートルだ。', 'This mountain is three thousand metres high.', 'Cette montagne fait trois mille mètres de haut.'],
    ],
  },
  {
    n: 22,
    l: '5-2',
    p: '連用中止',
    en: 'Linking clauses with the stem (written style)',
    fr: 'Relier des propositions avec le radical (style écrit)',
    form: 'V-ます stem、… ; い-adj く、… (instead of て-form)',
    note: {
      en: 'In writing, the stem of a verb (or く of an adjective) links two clauses like the て-form: 起き、食べ、出かける.',
      fr: 'À l’écrit, le radical d’un verbe (ou le く d’un adjectif) relie deux propositions comme la forme en て : 起き、食べ、出かける.',
    },
    ex: [
      ['[毎朝|まいあさ][六時|ろくじ]に[起|お]{き}、[七時|しちじ]に[家|いえ]を[出|で]る。', 'Every morning I get up at six and leave home at seven.', 'Chaque matin, je me lève à six heures et je pars à sept.'],
      ['[夜|よる]は[短|みじか]{く}、[昼|ひる]は[長|なが]い。', 'The nights are short and the days long.', 'Les nuits sont courtes, et les journées longues.'],
    ],
  },
  {
    n: 23,
    l: '5-3',
    p: '～ものだ',
    en: 'That’s how… is (a general truth)',
    fr: 'C’est ainsi que… (une vérité générale)',
    form: 'V / い-adj (plain) / な-adj な + ものだ',
    note: {
      en: 'States what is naturally or generally true about something, sometimes with a feeling of resignation.',
      fr: 'Énonce ce qui est naturellement ou généralement vrai, parfois avec une nuance de fatalité.',
    },
    ex: [
      ['[疲|つか]れていると、よく[眠|ねむ]れる{ものだ}。', 'When you’re tired, you sleep well: that’s how it is.', 'Quand on est fatigué, on dort bien : c’est comme ça.'],
      ['[時間|じかん]が[経|た]つのは[早|はや]い{ものだ}。', 'Time really does fly.', 'Le temps passe vite, c’est bien connu.'],
    ],
  },
  {
    n: 24,
    l: '5-4',
    p: '「もの・こと」の整理',
    en: 'Recap: もの and こと',
    fr: 'Récap : もの et こと',
    form: 'もの: things you can see or touch; こと: facts, events, actions',
    note: {
      en: 'もの is a concrete thing (食べ物, 好きなもの); こと is something that happens, is done or is known (大事なこと, 好きなことをする). Many set forms use one or the other: ことにする, ものだ…',
      fr: 'もの est une chose concrète (食べ物, 好きなもの) ; こと est ce qui arrive, se fait ou se sait (大事なこと, 好きなことをする). Beaucoup de tournures prennent l’un ou l’autre : ことにする, ものだ…',
    },
    ex: [
      ['[寝|ね]る[前|まえ]に[甘|あま]い{もの}を[食|た]べないほうがいい。', 'It’s better not to eat sweet things before bed.', 'Mieux vaut ne pas manger de sucreries avant de dormir.'],
      ['よく[寝|ね]るのは[大切|たいせつ]な{こと}だ。', 'Sleeping well is an important thing.', 'Bien dormir, c’est important.'],
    ],
  },
  {
    n: 25,
    l: '5-5',
    p: '～ということだ',
    en: 'I hear that…, it is said that…; that means…',
    fr: 'Il paraît que…, on dit que… ; ça veut dire que…',
    form: 'V / adj / N (plain) + ということだ',
    note: {
      en: 'Reports what one heard or read (like そうだ), or draws a conclusion: “so that means…”.',
      fr: 'Rapporte ce qu’on a entendu ou lu (comme そうだ), ou tire une conclusion : « ça veut donc dire que… ».',
    },
    ex: [
      ['[調査|ちょうさ]によると、[日本人|にほんじん]の[睡眠|すいみん][時間|じかん]は[短|みじか]い{ということだ}。', 'According to a survey, the Japanese sleep little.', 'D’après une enquête, les Japonais dorment peu.'],
      ['[電気|でんき]が[消|き]えている。もう[寝|ね]た{ということだ}。', 'The light is off. That means he’s already asleep.', 'La lumière est éteinte : ça veut dire qu’il dort déjà.'],
    ],
  },
  {
    n: 26,
    l: '5-6',
    p: '長い文の練習',
    en: 'Building long sentences',
    fr: 'Construire des phrases longues',
    form: 'clause + て / stem、 + clause + から / ので / が、 + main clause',
    note: {
      en: 'A long Japanese sentence keeps its main verb at the very end; the parts before it are linked by て, the stem, から, ので, が, and nouns are described by whole clauses placed before them.',
      fr: 'Une longue phrase japonaise garde son verbe principal tout à la fin ; ce qui précède est relié par て, le radical, から, ので, が, et les noms sont décrits par des propositions entières placées devant eux.',
    },
    ex: [
      ['[昨日|きのう]は[遅|おそ]くまで[仕事|しごと]をし{て}、[家|いえ]に[帰|かえ]ってからも[眠|ねむ]れなかった{ので}、[今日|きょう]はとても[眠|ねむ]い。', 'I worked late yesterday and couldn’t sleep even after getting home, so today I’m very sleepy.', 'Hier, j’ai travaillé tard, puis je n’ai pas réussi à dormir une fois rentré : aujourd’hui, je tombe de sommeil.'],
    ],
  },
];
