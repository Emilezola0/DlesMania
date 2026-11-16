// 耳から覚える 文法トレーニング N2: units 3–4. The book's list of points only; all else written by an AI (Claude).
export default [
  {
    n: 24,
    p: '～に相違ない',
    en: 'There’s no doubt that…, must be…',
    fr: 'Il ne fait aucun doute que…, ce doit être…',
    form: 'V / い-adj (plain) / な-adj / N + に相違ない',
    note: {
      en: 'A written, more formal ～に違いない: the speaker is sure of their guess.',
      fr: 'Un ～に違いない plus écrit et plus soutenu : on est sûr de sa supposition.',
    },
    ex: [
      ['[犯人|はんにん]はこの[男|おとこ]{に[相違|そうい]ない}。', 'This man must be the culprit.', 'Le coupable est forcément cet homme.'],
      ['[彼女|かのじょ]の[話|はなし]は[事実|じじつ]{に[相違|そうい]ない}。', 'There’s no doubt her story is true.', 'Il ne fait aucun doute que son récit est vrai.'],
    ],
  },
  {
    n: 25,
    p: '～得る',
    en: 'Can, it’s possible that…',
    fr: 'Pouvoir, il est possible que…',
    form: 'V-ます stem + 得る (うる／える); 得ない (えない)',
    note: {
      en: 'Says whether something is possible, not whether someone is able to do it. The positive is read うる or える, the negative is always えない. Common: あり得る, あり得ない.',
      fr: 'Dit si une chose est possible, pas si quelqu’un sait la faire. Le positif se lit うる ou える, le négatif toujours えない. Courant : あり得る, あり得ない.',
    },
    ex: [
      ['そんなことは[誰|だれ]にでも[起|お]こり{[得|う]る}。', 'That can happen to anyone.', 'Ça peut arriver à tout le monde.'],
      ['[彼|かれ]が[負|ま]けるなんて、あり{[得|え]ない}。', 'Him losing? That’s impossible.', 'Lui, perdre ? C’est impossible.'],
    ],
  },
  {
    n: 26,
    p: '～がたい',
    en: 'Hard to (bring oneself to)…',
    fr: 'Difficile à…, qu’on a du mal à…',
    form: 'V-ます stem + がたい',
    note: {
      en: 'Hard not because of skill but because of feelings: hard to believe, to forgive, to forget. With ability, use にくい.',
      fr: 'Difficile non par manque de capacité, mais à cause des sentiments : difficile à croire, à pardonner, à oublier. Pour une capacité, on dit にくい.',
    },
    ex: [
      ['あの[人|ひと]がそんなことをしたとは[信|しん]じ{がたい}。', 'It’s hard to believe that person did such a thing.', 'J’ai du mal à croire que cette personne ait fait ça.'],
      ['この[旅|たび]は[忘|わす]れ{がたい}[思|おも]い[出|で]になった。', 'This trip became an unforgettable memory.', 'Ce voyage est devenu un souvenir inoubliable.'],
    ],
  },
  {
    n: 27,
    p: '～一方（で）',
    en: 'While…, on the other hand…',
    fr: 'Tandis que…, d’un autre côté…',
    form: 'V / い-adj (plain) / な-adj な / N である + 一方（で）',
    note: {
      en: 'Sets two sides of one thing side by side, often in contrast. V-dict + 一方だ (another use) means “keeps getting more and more”.',
      fr: 'Met côte à côte deux aspects d’une même chose, souvent opposés. V-dict + 一方だ (autre emploi) veut dire « ne cesse de… ».',
    },
    ex: [
      ['[都会|とかい]は[便利|べんり]な{[一方|いっぽう]で}、[家賃|やちん]が[高|たか]い。', 'The city is convenient, but on the other hand rent is high.', 'La ville est pratique, mais d’un autre côté les loyers sont chers.'],
      ['[彼|かれ]は[仕事|しごと]をする{[一方|いっぽう]}、[夜|よる]は[大学|だいがく]に[通|かよ]っている。', 'While working, he also goes to university at night.', 'Tout en travaillant, il suit des cours à l’université le soir.'],
    ],
  },
  {
    n: 28,
    p: '～につき',
    en: 'Due to…, because of… (notices); per…',
    fr: 'En raison de…, pour cause de… (avis) ; par…',
    form: 'N + につき',
    note: {
      en: 'The formal “because” of signs and notices (工事中につき). Also “per”: 一人につき千円.',
      fr: 'Le « parce que » soutenu des panneaux et des avis (工事中につき). Veut aussi dire « par » : 一人につき千円.',
    },
    ex: [
      ['[工事中|こうじちゅう]{につき}、この[道|みち]は[通|とお]れません。', 'Due to construction, this road is closed.', 'Pour cause de travaux, cette route est fermée.'],
      ['[参加費|さんかひ]は[一人|ひとり]{につき}[千円|せんえん]です。', 'The fee is 1,000 yen per person.', 'La participation est de 1 000 yens par personne.'],
    ],
  },
  {
    n: 29,
    p: '～やら…やら',
    en: '…and…, what with… and… (and more)',
    fr: '…et…, entre… et… (et j’en passe)',
    form: 'N / V-dict / い-adj + やら',
    note: {
      en: 'Lists a few of many things, often with a feeling of being overwhelmed or busy.',
      fr: 'Énumère quelques choses parmi beaucoup, souvent avec un sentiment d’être débordé.',
    },
    ex: [
      ['[引|ひ]っ[越|こ]しの[準備|じゅんび]で、[掃除|そうじ]{やら}[荷造|にづく]り{やら}で[忙|いそが]しい。', 'Getting ready to move, I’m busy with cleaning, packing and all.', 'Avec le déménagement, je suis débordé entre le ménage, les cartons et le reste.'],
      ['[合格|ごうかく]して、うれしい{やら}[恥|は]ずかしい{やら}だった。', 'When I passed, I felt happy and embarrassed at once.', 'Quand j’ai réussi, j’étais à la fois content et gêné.'],
    ],
  },
  {
    n: 30,
    p: '～の／ものやら',
    en: 'I wonder… (with no idea)',
    fr: 'Je me demande… (sans en avoir la moindre idée)',
    form: 'question word … V (plain) + のやら / ものやら',
    note: {
      en: 'An open question the speaker can’t answer, with a nuance of worry or helplessness. Comes with a question word: いつ, どこ, 何.',
      fr: 'Une question ouverte à laquelle on ne peut pas répondre, avec une nuance d’inquiétude. Va avec un mot interrogatif : いつ, どこ, 何.',
    },
    ex: [
      ['[息子|むすこ]は[今|いま]どこにいる{のやら}。', 'I wonder where my son is right now.', 'Je me demande bien où est mon fils en ce moment.'],
      ['この[雨|あめ]はいつやむ{ものやら}。', 'Who knows when this rain will stop.', 'Allez savoir quand cette pluie va cesser.'],
    ],
  },
  {
    n: 31,
    p: '～だの…だの',
    en: '…and…, saying this and that (complaining)',
    fr: '…et…, à dire ceci et cela (en se plaignant)',
    form: 'N / な-adj / V / い-adj (plain) + だの',
    note: {
      en: 'Like ～やら…やら, but with a critical or annoyed tone, often about what someone keeps saying.',
      fr: 'Comme ～やら…やら, mais sur un ton critique ou agacé, souvent à propos de ce que quelqu’un ne cesse de dire.',
    },
    ex: [
      ['[弟|おとうと]は[暑|あつ]い{だの}[疲|つか]れた{だの}、[文句|もんく]ばかり[言|い]う。', 'My little brother keeps complaining: it’s hot, he’s tired…', 'Mon petit frère ne fait que se plaindre : il fait chaud, il est fatigué…'],
      ['[肉|にく]は[嫌|いや]{だの}[魚|さかな]は[苦手|にがて]{だの}、わがままな[子|こ]だ。', 'He won’t eat meat, doesn’t like fish… what a fussy child.', 'Pas de viande, pas de poisson… quel enfant capricieux.'],
    ],
  },
  {
    n: 32,
    p: '～に応え（て）',
    en: 'In response to…, to meet (expectations)',
    fr: 'En réponse à…, pour répondre à (des attentes)',
    form: 'N + に応えて / に応える N',
    note: {
      en: 'Answering what others expect or ask for: 期待, 要望, 声援. Not the same kanji as に応じて (according to).',
      fr: 'Répondre à ce que les autres attendent ou demandent : 期待, 要望, 声援. Pas le même kanji que に応じて (selon).',
    },
    ex: [
      ['[親|おや]の[期待|きたい]{に[応|こた]えて}、[医者|いしゃ]になった。', 'Living up to his parents’ expectations, he became a doctor.', 'Pour répondre aux attentes de ses parents, il est devenu médecin.'],
      ['ファンの[声|こえ]{に[応|こた]えて}、もう[一曲|いっきょく][歌|うた]った。', 'Answering the fans’ calls, she sang one more song.', 'À la demande des fans, elle a chanté une chanson de plus.'],
    ],
  },
  {
    n: 33,
    p: '～のもとで／に',
    en: 'Under (the guidance of)…',
    fr: 'Sous (la direction de)…',
    form: 'N + のもとで / のもとに',
    note: {
      en: 'Under someone’s influence or care (a teacher, a parent), or under a condition or rule.',
      fr: 'Sous l’influence ou la protection de quelqu’un (un professeur, un parent), ou sous une condition ou une règle.',
    },
    ex: [
      ['[有名|ゆうめい]な[先生|せんせい]{のもとで}ピアノを[学|まな]んだ。', 'I studied piano under a famous teacher.', 'J’ai appris le piano auprès d’un professeur célèbre.'],
      ['[青|あお]い[空|そら]{のもとで}、[運動会|うんどうかい]が[開|ひら]かれた。', 'The sports day was held under a blue sky.', 'La fête du sport a eu lieu sous un ciel bleu.'],
    ],
  },
  {
    n: 34,
    p: '～にしては',
    en: 'For (a)…, considering…',
    fr: 'Pour un(e)…, compte tenu de…',
    form: 'V (plain) / N + にしては',
    note: {
      en: 'The result is not what you’d expect from that starting point: “good, for a beginner”.',
      fr: 'Le résultat n’est pas celui qu’on attendrait vu le point de départ : « bien, pour un débutant ».',
    },
    ex: [
      ['[初|はじ]めて{にしては}、よくできました。', 'For a first time, you did well.', 'Pour une première fois, c’est très bien.'],
      ['[十二月|じゅうにがつ]{にしては}[暖|あたた]かい[日|ひ]だ。', 'It’s a warm day for December.', 'Il fait doux pour un mois de décembre.'],
    ],
  },
  {
    n: 35,
    p: '～は／ならともかく（として）',
    en: 'Leaving… aside, … may be one thing, but…',
    fr: '… passe encore, mais… ; laissons… de côté',
    form: 'N + は / ならともかく',
    note: {
      en: 'Sets the first thing aside as not the point, to focus on the second, which matters more.',
      fr: 'Écarte la première chose comme secondaire, pour insister sur la seconde, plus importante.',
    },
    ex: [
      ['[味|あじ]{はともかく}、この[店|みせ]は[値段|ねだん]が[安|やす]い。', 'Taste aside, this place is cheap.', 'Le goût, passe encore ; en tout cas, ce restaurant n’est pas cher.'],
      ['[子供|こども]{ならともかく}、[大人|おとな]がそんなことをするなんて。', 'A child, maybe, but for an adult to do that…', 'Un enfant, passe encore, mais un adulte qui fait ça…'],
    ],
  },
  {
    n: 36,
    p: '～も…ば／なら～も',
    en: 'Both… and…, … as well as…',
    fr: 'Et… et…, aussi bien… que…',
    form: 'N1 も V-ば N2 も; N1 も な-adj なら N2 も',
    note: {
      en: 'Lists two facts of the same kind about something, often to stress that it has everything (or every flaw).',
      fr: 'Énumère deux faits de même nature, souvent pour dire qu’une chose a tout (ou tous les défauts).',
    },
    ex: [
      ['[彼|かれ]は[歌|うた]{も}[歌|うた]え{ば}、ダンス{も}できる。', 'He can both sing and dance.', 'Il sait aussi bien chanter que danser.'],
      ['この[部屋|へや]は[駅|えき]{も}[近|ちか]けれ{ば}、[家賃|やちん]{も}[安|やす]い。', 'This flat is close to the station and cheap as well.', 'Cet appartement est près de la gare, et en plus le loyer est bas.'],
    ],
  },
  {
    n: 37,
    p: '～っぱなし',
    en: 'Left (on, open…), keeps on…',
    fr: 'Laissé (allumé, ouvert…), ne pas arrêter de…',
    form: 'V-ます stem + っぱなし',
    note: {
      en: 'Something done and then left in that state when it shouldn’t be (lights left on), or a state that goes on and on (standing all day). Usually a complaint.',
      fr: 'Une chose faite puis laissée dans cet état alors qu’elle ne devrait pas (lumière laissée allumée), ou un état qui dure (debout toute la journée). Souvent un reproche.',
    },
    ex: [
      ['[電気|でんき]をつけ{っぱなし}で[寝|ね]てしまった。', 'I fell asleep with the light left on.', 'Je me suis endormi en laissant la lumière allumée.'],
      ['[今日|きょう]は[一日中|いちにちじゅう][立|た]ち{っぱなし}だった。', 'I was on my feet all day today.', 'Aujourd’hui, je suis resté debout toute la journée.'],
    ],
  },
  {
    n: 38,
    p: '～っこない',
    en: 'No way…, can’t possibly…',
    fr: 'Pas moyen que…, impossible que…',
    form: 'V-ます stem + っこない',
    note: {
      en: 'Spoken and strong: the speaker is sure something can’t happen. Often with a potential verb (できっこない, 分かりっこない).',
      fr: 'Familier et catégorique : on est sûr qu’une chose ne peut pas arriver. Souvent avec un verbe potentiel (できっこない, 分かりっこない).',
    },
    ex: [
      ['こんな[難|むずか]しい[問題|もんだい]、[解|と]け{っこない}よ。', 'There’s no way I can solve such a hard problem.', 'Un problème aussi dur, pas moyen que je le résolve.'],
      ['[一日|いちにち]で[全部|ぜんぶ]なんて、でき{っこない}。', 'All of it in one day? Impossible.', 'Tout en une journée ? Impossible.'],
    ],
  },
  {
    n: 39,
    p: '～きり',
    en: 'Only…, since… (and not again)',
    fr: 'Seulement…, depuis… (et plus jamais)',
    form: 'N + きり; V-た + きり',
    note: {
      en: 'With a noun: “only” (二人きり). With V-た + きり…ない: something happened once and the expected next step never came (“left and never came back”). Spoken: っきり.',
      fr: 'Avec un nom : « seulement » (二人きり). Avec V-た + きり…ない : une chose est arrivée une fois et la suite attendue n’est jamais venue (« parti, jamais revenu »). À l’oral : っきり.',
    },
    ex: [
      ['[彼|かれ]とは[去年|きょねん][会|あ]った{きり}、[連絡|れんらく]がない。', 'I saw him once last year and haven’t heard from him since.', 'Je l’ai vu une fois l’an dernier, et depuis, plus de nouvelles.'],
      ['[週末|しゅうまつ]は[二人|ふたり]{きり}で[過|す]ごした。', 'We spent the weekend just the two of us.', 'Nous avons passé le week-end rien que tous les deux.'],
    ],
  },
  {
    n: 40,
    p: '～げ',
    en: '…-looking, seeming…',
    fr: 'L’air…, qui semble…',
    form: 'い-adj (−い) / な-adj + げ',
    note: {
      en: 'Describes how someone looks from outside: 楽しげ, 寂しげ, 不安げ. A bit literary; works like a な-adjective.',
      fr: 'Décrit l’air qu’a quelqu’un, vu de l’extérieur : 楽しげ, 寂しげ, 不安げ. Un peu littéraire ; se comporte comme un adjectif en な.',
    },
    ex: [
      ['[子供|こども]たちが[楽|たの]し{げ}に[遊|あそ]んでいる。', 'The children are playing happily.', 'Les enfants jouent d’un air joyeux.'],
      ['[彼女|かのじょ]は[寂|さび]し{げ}な[顔|かお]をしていた。', 'She looked lonely.', 'Elle avait l’air triste et seule.'],
    ],
  },
  {
    n: 41,
    p: '～なんて／とは',
    en: '(Surprise:) to think that…!',
    fr: '(Surprise :) dire que… ! Quand on pense que… !',
    form: 'V / い-adj / な-adj / N (plain) + なんて / とは',
    note: {
      en: 'Shows surprise, shock or disbelief at a fact. なんて is spoken, とは more written.',
      fr: 'Exprime la surprise, le choc ou l’incrédulité devant un fait. なんて est oral, とは plus écrit.',
    },
    ex: [
      ['あの[二人|ふたり]が[結婚|けっこん]する{なんて}、[信|しん]じられない。', 'Those two getting married? I can’t believe it.', 'Ces deux-là, se marier ? Je n’en reviens pas.'],
      ['こんな[所|ところ]で[会|あ]う{とは}[思|おも]わなかった。', 'I never thought I’d meet you here.', 'Je ne pensais pas te croiser ici.'],
    ],
  },
  {
    n: 42,
    p: '～にすぎない',
    en: 'Merely…, no more than…',
    fr: 'Ne… que, n’être qu’un simple…',
    form: 'V / N + にすぎない',
    note: {
      en: 'Plays something down: it is only that, nothing more important.',
      fr: 'Minimise une chose : ce n’est que cela, rien de plus important.',
    },
    ex: [
      ['それは[噂|うわさ]{にすぎない}。', 'That’s nothing more than a rumour.', 'Ce n’est qu’une rumeur.'],
      ['[私|わたし]は[言|い]われたことをした{にすぎない}。', 'I only did what I was told.', 'Je n’ai fait que ce qu’on m’a dit.'],
    ],
  },
  {
    n: 43,
    p: '～あげく',
    en: 'After (a long…), in the end…',
    fr: 'Après (bien des…), au bout du compte…',
    form: 'V-た / N の + あげく（に）',
    note: {
      en: 'After a long, often painful process, the outcome is usually bad or disappointing.',
      fr: 'Après un long processus, souvent pénible, le résultat est en général mauvais ou décevant.',
    },
    ex: [
      ['さんざん[迷|まよ]った{あげく}、[何|なに]も[買|か]わなかった。', 'After dithering for ages, I didn’t buy anything.', 'Après avoir longuement hésité, je n’ai rien acheté.'],
      ['[長|なが]い[話|はな]し[合|あ]いの{あげく}、[計画|けいかく]は[中止|ちゅうし]になった。', 'After long discussions, the plan was dropped.', 'Au bout de longues discussions, le projet a été abandonné.'],
    ],
  },
  {
    n: 44,
    p: '～べき',
    en: 'Should, ought to',
    fr: 'Devoir, il faudrait',
    form: 'V-dict + べきだ (する → するべき / すべき)',
    note: {
      en: 'What is right or necessary, often a moral judgment. べきではない: shouldn’t. Stronger than ほうがいい.',
      fr: 'Ce qui est juste ou nécessaire, souvent un jugement moral. べきではない : il ne faut pas. Plus fort que ほうがいい.',
    },
    ex: [
      ['[約束|やくそく]は[守|まも]る{べきだ}。', 'Promises should be kept.', 'On doit tenir ses promesses.'],
      ['[若|わか]いうちに[色々|いろいろ]な[経験|けいけん]をす{べきだ}。', 'You should try lots of things while you’re young.', 'Il faut vivre toutes sortes d’expériences tant qu’on est jeune.'],
    ],
  },
  {
    n: 45,
    p: '～というより',
    en: 'Rather than…, more… than…',
    fr: 'Plutôt que…, plus… que…',
    form: 'V / い-adj / な-adj / N (plain) + というより',
    note: {
      en: 'Corrects a description with a better one: “not so much A as B”.',
      fr: 'Remplace une description par une plus juste : « moins A que B ».',
    },
    ex: [
      ['[今日|きょう]は[暖|あたた]かい{というより}[暑|あつ]い。', 'Today is hot rather than warm.', 'Aujourd’hui, il fait plus chaud que doux.'],
      ['[彼|かれ]は[友達|ともだち]{というより}[家族|かぞく]のような[存在|そんざい]だ。', 'He’s more like family than a friend.', 'C’est moins un ami qu’un membre de la famille.'],
    ],
  },
  {
    n: 46,
    p: '～にかかわらず／かかわりなく',
    en: 'Regardless of…, whether… or not',
    fr: 'Indépendamment de…, que… ou non',
    form: 'N + にかかわらず; V-dict V-ない + にかかわらず',
    note: {
      en: 'The thing that could vary (age, weather, yes or no) makes no difference. Often with pairs: 有無, 晴雨, 行く行かない.',
      fr: 'Ce qui pourrait varier (âge, météo, oui ou non) ne change rien. Souvent avec des paires : 有無, 晴雨, 行く行かない.',
    },
    ex: [
      ['[年齢|ねんれい]{にかかわらず}、[誰|だれ]でも[参加|さんか]できます。', 'Anyone can take part, regardless of age.', 'Tout le monde peut participer, quel que soit l’âge.'],
      ['[天気|てんき]{にかかわらず}、[試合|しあい]は[行|おこな]われる。', 'The match will be held whatever the weather.', 'Le match aura lieu quel que soit le temps.'],
    ],
  },
  {
    n: 47,
    p: '～にもかかわらず',
    en: 'Despite…, even though…',
    fr: 'Malgré…, bien que…',
    form: 'V / い-adj (plain) / な-adj / N (である) + にもかかわらず',
    note: {
      en: 'Something happens against what you’d expect from the first fact. Formal; the speaker is often surprised or critical.',
      fr: 'Une chose arrive contrairement à ce qu’on attendrait du premier fait. Soutenu ; on est souvent surpris ou critique.',
    },
    ex: [
      ['[雨|あめ]{にもかかわらず}、たくさんの[人|ひと]が[来|き]た。', 'Despite the rain, lots of people came.', 'Malgré la pluie, beaucoup de gens sont venus.'],
      ['[一生懸命|いっしょうけんめい][練習|れんしゅう]した{にもかかわらず}、[負|ま]けてしまった。', 'Even though we trained hard, we lost.', 'Bien que nous nous soyons entraînés dur, nous avons perdu.'],
    ],
  },
  {
    n: 48,
    p: '～あまり（に）',
    en: 'So (much)… that…, out of too much…',
    fr: 'Tellement… que…, par excès de…',
    form: 'V-dict / V-た / な-adj な / N の + あまり（に）',
    note: {
      en: 'A feeling or state so strong that it leads to an unusual, often bad, result.',
      fr: 'Un sentiment ou un état si fort qu’il mène à un résultat inhabituel, souvent mauvais.',
    },
    ex: [
      ['[緊張|きんちょう]の{あまり}、[声|こえ]が[出|で]なかった。', 'I was so nervous my voice wouldn’t come out.', 'J’étais tellement stressé que je n’arrivais plus à parler.'],
      ['[心配|しんぱい]する{あまり}、[眠|ねむ]れなかった。', 'I was so worried I couldn’t sleep.', 'J’étais si inquiet que je n’ai pas pu dormir.'],
    ],
  },
];
