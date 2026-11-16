// 耳から覚える 日本語能力試験 文法トレーニング N2 (改訂版, ALC): units 1–2. Only the book's list of grammar points (its
// table of contents: number, form) comes from it; every meaning, explanation and example here is written for
// Omnidle by an AI (Claude), never taken from the book. Examples: [ja, en, fr]; in ja, {…} marks the grammar,
// [漢字|かな] the reading of a kanji run.
export default [
  {
    n: 1,
    p: '～ことだ',
    en: 'You should…, the best thing is to… (advice)',
    fr: 'Il faut…, le mieux est de… (conseil)',
    form: 'V-dict / V-ない + ことだ',
    note: {
      en: 'Advice given to one person about what they should do, often by someone older or more experienced. Not used for rules or for oneself.',
      fr: 'Un conseil donné à quelqu’un sur ce qu’il devrait faire, souvent par une personne plus âgée ou plus expérimentée. Pas pour une règle, ni pour soi-même.',
    },
    ex: [
      ['[試験|しけん]に[合格|ごうかく]したいなら、[毎日|まいにち][勉強|べんきょう]する{ことだ}。', 'If you want to pass the exam, you should study every day.', 'Si tu veux réussir l’examen, le mieux est d’étudier tous les jours.'],
      ['[風邪|かぜ]のときは、[無理|むり]をしない{ことだ}。', 'When you have a cold, the best thing is not to overdo it.', 'Quand on a un rhume, le mieux est de ne pas forcer.'],
    ],
  },
  {
    n: 2,
    p: '～ことだから',
    en: 'Knowing (someone) as I do…, since it’s…',
    fr: 'Connaissant (quelqu’un)…, vu que c’est…',
    form: 'N の + ことだから',
    note: {
      en: 'Draws a guess from what everyone knows about a person: “it’s him, so surely…”. The noun is almost always a person.',
      fr: 'Tire une supposition de ce qu’on sait d’une personne : « c’est lui, donc sûrement… ». Le nom est presque toujours une personne.',
    },
    ex: [
      ['[真面目|まじめ]な[田中|たなか]さんの{ことだから}、[約束|やくそく]を[忘|わす]れるはずがない。', 'Tanaka is so serious, he can’t have forgotten the appointment.', 'Tanaka est si sérieux qu’il n’a pas pu oublier le rendez-vous.'],
      ['[姉|あね]の{ことだから}、また[遅|おく]れて[来|く]るだろう。', 'Knowing my sister, she’ll be late again.', 'Connaissant ma sœur, elle va encore arriver en retard.'],
    ],
  },
  {
    n: 3,
    p: '～ことに',
    en: 'What is (surprising, sad…) is that…',
    fr: 'Ce qui est (étonnant, triste…), c’est que…',
    form: 'V-た / い-adj / な-adj な + ことに',
    note: {
      en: 'Puts the speaker’s feeling first, then the fact that causes it. Used with words of emotion: 驚いた, 残念な, うれしい, 不思議な…',
      fr: 'Donne d’abord le sentiment, puis le fait qui le cause. S’emploie avec des mots d’émotion : 驚いた, 残念な, うれしい, 不思議な…',
    },
    ex: [
      ['[驚|おどろ]いた{ことに}、[彼|かれ]は[一人|ひとり]で[山|やま]に[登|のぼ]った。', 'Surprisingly, he climbed the mountain alone.', 'Chose étonnante, il a gravi la montagne tout seul.'],
      ['[残念|ざんねん]な{ことに}、[旅行|りょこう]は[中止|ちゅうし]になった。', 'Sadly, the trip was cancelled.', 'Malheureusement, le voyage a été annulé.'],
    ],
  },
  {
    n: 4,
    p: '～ことなく',
    en: 'Without (doing)',
    fr: 'Sans (faire)',
    form: 'V-dict + ことなく',
    note: {
      en: 'A written, more formal ～ないで: something that could have happened did not, often to praise effort or constancy.',
      fr: 'Un ～ないで plus écrit et plus soutenu : ce qui aurait pu arriver n’est pas arrivé, souvent pour saluer un effort ou une constance.',
    },
    ex: [
      ['[彼女|かのじょ]は[一日|いちにち]も[休|やす]む{ことなく}[働|はたら]いた。', 'She worked without taking a single day off.', 'Elle a travaillé sans prendre un seul jour de repos.'],
      ['[迷|まよ]う{ことなく}、この[道|みち]を[選|えら]んだ。', 'I chose this path without hesitating.', 'J’ai choisi cette voie sans hésiter.'],
    ],
  },
  {
    n: 5,
    p: '～ものの',
    en: 'Although…, even though… (but it didn’t go on as expected)',
    fr: 'Bien que…, même si… (mais la suite n’est pas celle attendue)',
    form: 'V / い-adj (plain) / な-adj な / N である + ものの',
    note: {
      en: 'Admits the first fact, then says what follows is not what you would expect. Rather written; the second part is often a disappointment.',
      fr: 'Reconnaît le premier fait, puis dit que la suite n’est pas celle qu’on attendrait. Plutôt écrit ; la seconde partie est souvent une déception.',
    },
    ex: [
      ['[車|くるま]を[買|か]った{ものの}、[忙|いそが]しくてほとんど[乗|の]っていない。', 'Although I bought a car, I’m so busy I hardly drive it.', 'J’ai beau avoir acheté une voiture, je suis si occupé que je ne la conduis presque pas.'],
      ['[約束|やくそく]はした{ものの}、[行|い]けるかどうか[分|わ]からない。', 'I did promise, but I don’t know if I can go.', 'J’ai bien promis, mais je ne sais pas si je pourrai y aller.'],
    ],
  },
  {
    n: 6,
    p: '～ものだ／ではない',
    en: 'One should… / one shouldn’t… (what is right, in general)',
    fr: 'On doit… / on ne doit pas… (ce qui se fait, en général)',
    form: 'V-dict / V-ない + ものだ; V-dict + ものではない',
    note: {
      en: 'States a general rule of good manners or common sense, not a personal opinion. ものだ can also express a strong feeling (“how time flies!”) or a memory (V-た + ものだ).',
      fr: 'Énonce une règle générale de politesse ou de bon sens, pas un avis personnel. ものだ peut aussi dire une émotion forte (« comme le temps passe ! ») ou un souvenir (V-た + ものだ).',
    },
    ex: [
      ['[人|ひと]の[話|はなし]は[最後|さいご]まで[聞|き]く{ものだ}。', 'You should listen to people until they finish.', 'On doit écouter les gens jusqu’au bout.'],
      ['[人|ひと]の[悪口|わるぐち]を[言|い]う{ものではない}。', 'You shouldn’t speak ill of others.', 'On ne doit pas dire du mal des autres.'],
    ],
  },
  {
    n: 7,
    p: '～ないものか／だろうか',
    en: 'Isn’t there some way to…? I wish I could…',
    fr: 'N’y aurait-il pas moyen de… ? Si seulement on pouvait…',
    form: 'V-ない + ものか / ものだろうか',
    note: {
      en: 'A strong wish for something hard to make happen, said as a question to oneself. Often with 何とか or どうにか.',
      fr: 'Un fort souhait pour une chose difficile à obtenir, dit comme une question à soi-même. Souvent avec 何とか ou どうにか.',
    },
    ex: [
      ['[何|なん]とかして[彼|かれ]を[助|たす]けられ{ないものか}。', 'Isn’t there some way we could help him?', 'N’y aurait-il pas un moyen de l’aider ?'],
      ['もっと[安|やす]く[旅行|りょこう]でき{ないものだろうか}。', 'I wonder if there’s no way to travel more cheaply.', 'N’y aurait-il pas moyen de voyager moins cher ?'],
    ],
  },
  {
    n: 8,
    p: '～ばかりか',
    en: 'Not only… but also',
    fr: 'Non seulement… mais aussi',
    form: 'V / い-adj (plain) / な-adj な / N + ばかりか',
    note: {
      en: 'Adds a second, often more surprising, thing to the first. The second part often has も or まで.',
      fr: 'Ajoute à la première chose une seconde, souvent plus surprenante. La seconde partie a souvent も ou まで.',
    },
    ex: [
      ['[彼|かれ]は[英語|えいご]{ばかりか}、[中国語|ちゅうごくご]も[話|はな]せる。', 'He speaks not only English but Chinese as well.', 'Il parle non seulement anglais, mais aussi chinois.'],
      ['[雨|あめ]が[降|ふ]った{ばかりか}、[風|かぜ]まで[強|つよ]くなった。', 'Not only did it rain, the wind got strong too.', 'Non seulement il a plu, mais en plus le vent s’est levé.'],
    ],
  },
  {
    n: 9,
    p: '～ばかりだ',
    en: 'Keeps on (getting worse…), only goes one way',
    fr: 'Ne fait que (empirer…), va toujours dans le même sens',
    form: 'V-dict + ばかりだ',
    note: {
      en: 'A change that keeps going in one direction, usually a bad one. Often with verbs of change: 増える, 減る, 悪くなる.',
      fr: 'Un changement qui continue dans un seul sens, le plus souvent mauvais. Souvent avec des verbes de changement : 増える, 減る, 悪くなる.',
    },
    ex: [
      ['[物価|ぶっか]は[上|あ]がる{ばかりだ}。', 'Prices just keep going up.', 'Les prix ne font qu’augmenter.'],
      ['[祖父|そふ]の[病気|びょうき]は[悪|わる]くなる{ばかりだ}。', 'My grandfather’s illness only gets worse.', 'La maladie de mon grand-père ne fait qu’empirer.'],
    ],
  },
  {
    n: 10,
    p: '～上（に）',
    en: 'On top of…, besides…',
    fr: 'En plus de…, non content de…',
    form: 'V / い-adj (plain) / な-adj な / N の + 上（に）',
    note: {
      en: 'Adds a second point of the same kind (good + good, bad + bad). Close to ～ばかりか but more neutral.',
      fr: 'Ajoute un second point de même nature (bien + bien, mal + mal). Proche de ～ばかりか, mais plus neutre.',
    },
    ex: [
      ['この[店|みせ]は[安|やす]い{[上|うえ]に}、おいしい。', 'This restaurant is cheap, and on top of that it’s good.', 'Ce restaurant est bon marché, et en plus il est bon.'],
      ['[道|みち]に[迷|まよ]った{[上|うえ]に}、[雨|あめ]にも[降|ふ]られた。', 'I got lost, and on top of that I got caught in the rain.', 'Je me suis perdu, et en plus j’ai pris la pluie.'],
    ],
  },
  {
    n: 11,
    p: '～以上（は）／上は',
    en: 'Since…, now that… (you must)',
    fr: 'Puisque…, du moment que… (il faut)',
    form: 'V (plain) / N である + 以上（は）; V + 上は',
    note: {
      en: 'Once a situation is set, the speaker draws what must follow: a duty, a resolve, or a strong guess. 上は is more formal.',
      fr: 'Une fois une situation établie, on en tire ce qui doit suivre : un devoir, une résolution ou une forte supposition. 上は est plus soutenu.',
    },
    ex: [
      ['[約束|やくそく]した{[以上|いじょう]}、[守|まも]らなければならない。', 'Since I promised, I have to keep my word.', 'Puisque j’ai promis, je dois tenir parole.'],
      ['[学生|がくせい]である{[以上|いじょう]は}、[勉強|べんきょう]が[一番|いちばん][大切|たいせつ]だ。', 'As long as you are a student, studying comes first.', 'Du moment qu’on est étudiant, les études passent avant tout.'],
    ],
  },
  {
    n: 12,
    p: '～上で',
    en: 'After (doing), once… / in (doing), for…',
    fr: 'Après (avoir fait), une fois… / pour (faire), en matière de…',
    form: 'V-た / N の + 上で (after); V-dict / N の + 上で (in doing)',
    note: {
      en: 'With V-た: do one thing first, then the next on that basis (“after thinking it over”). With V-dict: “when it comes to doing…”.',
      fr: 'Avec V-た : faire d’abord une chose, puis la suivante sur cette base (« après réflexion »). Avec V-dict : « quand il s’agit de… ».',
    },
    ex: [
      ['よく[考|かんが]えた{[上|うえ]で}、[返事|へんじ]をします。', 'I’ll answer after thinking it over carefully.', 'Je répondrai après y avoir bien réfléchi.'],
      ['[外国語|がいこくご]を[学|まな]ぶ{[上|うえ]で}、[辞書|じしょ]は[欠|か]かせない。', 'When learning a foreign language, a dictionary is a must.', 'Pour apprendre une langue étrangère, un dictionnaire est indispensable.'],
    ],
  },
  {
    n: 13,
    p: '～まで',
    en: 'Even (as far as)…',
    fr: 'Même, jusqu’à…',
    form: 'N + まで',
    note: {
      en: 'Shows that something goes further than expected: “even my parents came”. Not the まで of time or place (“until”).',
      fr: 'Montre qu’une chose va plus loin que prévu : « même mes parents sont venus ». Ce n’est pas le まで du temps ou du lieu (« jusqu’à »).',
    },
    ex: [
      ['[子供|こども]{まで}その[歌|うた]を[知|し]っている。', 'Even children know that song.', 'Même les enfants connaissent cette chanson.'],
      ['[親友|しんゆう]に{まで}[嘘|うそ]をつかれた。', 'Even my best friend lied to me.', 'Même mon meilleur ami m’a menti.'],
    ],
  },
  {
    n: 14,
    p: '～でも',
    en: '…or something (a light suggestion); even…',
    fr: '…ou quelque chose comme ça (suggestion légère) ; même…',
    form: 'N + でも',
    note: {
      en: 'Softens a suggestion by giving one example among others (“how about tea or something?”). Can also mean “even” for an extreme case.',
      fr: 'Adoucit une proposition en donnant un exemple parmi d’autres (« un thé, ou autre chose ? »). Peut aussi vouloir dire « même », pour un cas extrême.',
    },
    ex: [
      ['お[茶|ちゃ]{でも}[飲|の]みませんか。', 'Shall we have some tea or something?', 'On prend un thé, ou autre chose ?'],
      ['この[問題|もんだい]は[子供|こども]{でも}[分|わ]かる。', 'Even a child can understand this problem.', 'Même un enfant peut comprendre ce problème.'],
    ],
  },
  {
    n: 15,
    p: '～ながら（も）',
    en: 'Although…, while (being)…',
    fr: 'Bien que…, tout en (étant)…',
    form: 'V-ます stem / い-adj / な-adj / N + ながら（も）',
    note: {
      en: 'Not “while doing”, but a contrast: two things that don’t go together are both true. Common set phrases: 残念ながら, 狭いながらも.',
      fr: 'Pas « pendant que », mais une opposition : deux choses qui ne vont pas ensemble sont vraies toutes les deux. Tournures courantes : 残念ながら, 狭いながらも.',
    },
    ex: [
      ['[狭|せま]い{ながらも}、[楽|たの]しい[我|わ]が[家|や]だ。', 'Though small, it’s our happy home.', 'Elle a beau être petite, c’est notre maison et on y est heureux.'],
      ['[悪|わる]いと[知|し]り{ながら}、[嘘|うそ]をついてしまった。', 'I lied, even though I knew it was wrong.', 'J’ai menti, tout en sachant que c’était mal.'],
    ],
  },
  {
    n: 16,
    p: '～さえ…ば／たら',
    en: 'If only…, as long as… (then that’s enough)',
    fr: 'Il suffit que…, du moment que… (alors ça suffit)',
    form: 'N さえ + V-ば; V-ます stem + さえすれば',
    note: {
      en: 'One condition is all that’s needed for the result. さえ marks that single condition.',
      fr: 'Une seule condition suffit pour le résultat. さえ marque cette condition unique.',
    },
    ex: [
      ['[時間|じかん]{さえ}あれ{ば}、[旅行|りょこう]に[行|い]きたい。', 'If only I had the time, I’d like to travel.', 'Si seulement j’avais le temps, j’aimerais voyager.'],
      ['この[薬|くすり]を[飲|の]み{さえ}すれ{ば}、すぐ[治|なお]りますよ。', 'Just take this medicine and you’ll get better soon.', 'Il suffit de prendre ce médicament, et ça ira vite mieux.'],
    ],
  },
  {
    n: 17,
    p: '～を…として',
    en: 'As…, taking (A) as (B)',
    fr: 'En tant que…, en prenant (A) comme (B)',
    form: 'N1 を N2 として',
    note: {
      en: 'Gives something a role or a status: “with X as the goal / as the leader”.',
      fr: 'Donne un rôle ou un statut à quelque chose : « avec X pour but / comme chef ».',
    },
    ex: [
      ['[留学|りゅうがく]{を}[目標|もくひょう]{として}、[毎日|まいにち][勉強|べんきょう]している。', 'I study every day with studying abroad as my goal.', 'J’étudie tous les jours avec pour objectif d’aller étudier à l’étranger.'],
      ['[田中|たなか]さん{を}リーダー{として}、チームを[作|つく]った。', 'We formed a team with Tanaka as leader.', 'Nous avons formé une équipe avec Tanaka comme chef.'],
    ],
  },
  {
    n: 18,
    p: '～に応じ（て）／応じ',
    en: 'According to…, depending on…',
    fr: 'Selon…, en fonction de…',
    form: 'N + に応じて / に応じた N',
    note: {
      en: 'Something changes to fit something else that varies: age, budget, season, demand.',
      fr: 'Une chose s’adapte à une autre qui varie : l’âge, le budget, la saison, la demande.',
    },
    ex: [
      ['[年齢|ねんれい]{に[応|おう]じて}、[料金|りょうきん]が[変|か]わる。', 'The price changes depending on age.', 'Le tarif change selon l’âge.'],
      ['[予算|よさん]{に[応|おう]じた}プランを[選|えら]んでください。', 'Please choose a plan that fits your budget.', 'Choisissez une formule adaptée à votre budget.'],
    ],
  },
  {
    n: 19,
    p: '～に沿って／沿い',
    en: 'Along…, in line with…',
    fr: 'Le long de…, conformément à…',
    form: 'N + に沿って / に沿った N',
    note: {
      en: 'Literally “along” a river or road; figuratively, following a plan, a wish or a rule.',
      fr: 'Au sens propre, « le long de » une rivière ou d’une route ; au figuré, en suivant un plan, un souhait ou une règle.',
    },
    ex: [
      ['[川|かわ]{に[沿|そ]って}[桜|さくら]が[咲|さ]いている。', 'Cherry trees are blooming along the river.', 'Les cerisiers fleurissent le long de la rivière.'],
      ['[計画|けいかく]{に[沿|そ]って}[工事|こうじ]を[進|すす]める。', 'The work goes ahead according to the plan.', 'Les travaux avancent conformément au plan.'],
    ],
  },
  {
    n: 20,
    p: '～をめぐって／めぐり',
    en: 'Over…, concerning… (a dispute)',
    fr: 'Au sujet de…, autour de… (un débat)',
    form: 'N + をめぐって / をめぐる N',
    note: {
      en: 'A topic around which people argue or compete: debates, conflicts, rival opinions.',
      fr: 'Un sujet autour duquel les gens débattent ou s’affrontent : discussions, conflits, avis opposés.',
    },
    ex: [
      ['[新|あたら]しい[法律|ほうりつ]{をめぐって}、[議論|ぎろん]が[続|つづ]いている。', 'The debate over the new law goes on.', 'Le débat sur la nouvelle loi se poursuit.'],
      ['[遺産|いさん]{をめぐる}[争|あらそ]いが[起|お]きた。', 'A dispute broke out over the inheritance.', 'Une querelle a éclaté autour de l’héritage.'],
    ],
  },
  {
    n: 21,
    p: '～といった',
    en: 'Such as…, like… (examples)',
    fr: 'Tels que…, comme… (exemples)',
    form: 'N1 や N2 といった N3',
    note: {
      en: 'Lists a few examples of a larger group, then names the group.',
      fr: 'Donne quelques exemples d’un groupe plus grand, puis nomme ce groupe.',
    },
    ex: [
      ['[京都|きょうと]や[奈良|なら]{といった}[古|ふる]い[町|まち]が[好|す]きだ。', 'I like old towns such as Kyoto and Nara.', 'J’aime les vieilles villes comme Kyoto ou Nara.'],
      ['テニスやサッカー{といった}スポーツをよくする。', 'I often play sports like tennis and soccer.', 'Je fais souvent des sports comme le tennis ou le football.'],
    ],
  },
  {
    n: 22,
    p: '～てしようがない／しかたがない',
    en: 'Terribly, can’t help (feeling)…',
    fr: 'Terriblement, ne pas pouvoir s’empêcher (de ressentir)…',
    form: 'V-て / い-adj くて / な-adj で + しょうがない / しかたがない',
    note: {
      en: 'A feeling or sensation so strong you can’t hold it back: sleepy, worried, want to… しようがない is the spoken form of しょうがない.',
      fr: 'Un sentiment ou une sensation si fort qu’on ne peut pas le retenir : sommeil, inquiétude, envie… しようがない est la forme orale de しょうがない.',
    },
    ex: [
      ['[昨日|きのう][寝|ね]なかったので、[眠|ねむ]く{てしょうがない}。', 'I didn’t sleep last night, so I’m terribly sleepy.', 'Je n’ai pas dormi hier, je tombe de sommeil.'],
      ['[結果|けっか]が[気|き]になっ{てしかたがない}。', 'I can’t stop worrying about the result.', 'Je ne peux pas m’empêcher de penser au résultat.'],
    ],
  },
  {
    n: 23,
    p: '～ぬき（で／に）／（を）ぬきにして',
    en: 'Without…, leaving out…',
    fr: 'Sans…, en laissant de côté…',
    form: 'N + ぬきで / ぬきの N / をぬきにして',
    note: {
      en: 'Something usually there is left out: no breakfast, no formalities. をぬきにしては…ない: “without X, Y is impossible”.',
      fr: 'Une chose habituellement présente est laissée de côté : pas de petit-déjeuner, pas de formalités. をぬきにしては…ない : « sans X, Y est impossible ».',
    },
    ex: [
      ['[今日|きょう]は[朝|あさ]ご[飯|はん]{ぬきで}[出|で]かけた。', 'Today I left without breakfast.', 'Aujourd’hui, je suis parti sans petit-déjeuner.'],
      ['[冗談|じょうだん]{はぬきにして}、[本当|ほんとう]の[話|はなし]をしよう。', 'Joking aside, let’s talk seriously.', 'Trêve de plaisanteries, parlons sérieusement.'],
    ],
  },
];
