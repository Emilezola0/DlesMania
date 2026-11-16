// 耳から覚える 文法トレーニング N3: units 5–6. The book's list of points only; all else written by an AI (Claude).
export default [
  {
    n: 39,
    p: '～に違いない',
    en: 'Must be…, there’s no doubt that…',
    fr: 'Ce doit être…, il ne fait pas de doute que…',
    form: 'V / い-adj (plain) / な-adj / N + に違いない',
    note: {
      en: 'A strong guess the speaker is sure of, based on what they see or know.',
      fr: 'Une supposition forte dont on est sûr, d’après ce qu’on voit ou sait.',
    },
    ex: [
      ['[電気|でんき]がついている。[彼|かれ]は[家|いえ]にいる{に[違|ちが]いない}。', 'The light is on. He must be home.', 'La lumière est allumée. Il est sûrement chez lui.'],
      ['あの[店|みせ]は[人気|にんき]がある。おいしい{に[違|ちが]いない}。', 'That place is popular. It must be good.', 'Ce restaurant est très fréquenté. Ça doit être bon.'],
    ],
  },
  {
    n: 40,
    p: '～とは／というのは',
    en: 'What… means is…, (X) is… (definition)',
    fr: 'Ce que veut dire…, c’est… (définition)',
    form: 'N + とは / というのは + definition (～ことだ, ～という意味だ)',
    note: {
      en: 'Introduces a word or idea to define or explain it.',
      fr: 'Introduit un mot ou une idée pour le définir ou l’expliquer.',
    },
    ex: [
      ['「[花見|はなみ]」{とは}、[桜|さくら]を[見|み]て[楽|たの]しむことだ。', '“Hanami” means enjoying the cherry blossoms.', '« Hanami », c’est le fait d’admirer les cerisiers en fleurs.'],
      ['「スマホ」{というのは}、スマートフォンのことだ。', '“Sumaho” means a smartphone.', '« Sumaho », ça veut dire smartphone.'],
    ],
  },
  {
    n: 41,
    p: '～たとたん（に）',
    en: 'The moment…, just as…',
    fr: 'Au moment même où…, dès que…',
    form: 'V-た + とたん（に）',
    note: {
      en: 'Right after the first action, something unexpected happens. Not for the speaker’s planned actions.',
      fr: 'Juste après la première action, une chose inattendue se produit. Pas pour une action qu’on a prévue soi-même.',
    },
    ex: [
      ['[家|いえ]を[出|で]{たとたん}、[雨|あめ]が[降|ふ]り[出|だ]した。', 'The moment I left the house, it started to rain.', 'À peine sorti de chez moi, il s’est mis à pleuvoir.'],
      ['ベッドに[入|はい]っ{たとたんに}[寝|ね]てしまった。', 'I fell asleep the moment I got into bed.', 'Je me suis endormi dès que je me suis couché.'],
    ],
  },
  {
    n: 42,
    p: '～につれ（て）',
    en: 'As…, the more…',
    fr: 'À mesure que…, plus…',
    form: 'V-dict / N + につれて / につれ',
    note: {
      en: 'One change follows another gradually: as time passes, as you grow up…',
      fr: 'Un changement en suit un autre progressivement : avec le temps, en grandissant…',
    },
    ex: [
      ['[時間|じかん]がたつ{につれて}、[悲|かな]しみも[消|き]えていった。', 'As time went by, the sadness faded.', 'Avec le temps, la tristesse s’est dissipée.'],
      ['[山|やま]を[登|のぼ]る{につれ}、[空気|くうき]が[冷|つめ]たくなった。', 'The higher we climbed, the colder the air got.', 'Plus on montait, plus l’air se rafraîchissait.'],
    ],
  },
  {
    n: 43,
    p: '～にしたがって／したがい',
    en: 'As…; in accordance with…',
    fr: 'À mesure que… ; conformément à…',
    form: 'V-dict / N + にしたがって / にしたがい',
    note: {
      en: 'Like につれて for a gradual change, and also “following” an instruction or rule.',
      fr: 'Comme につれて pour un changement progressif, et aussi « en suivant » une consigne ou une règle.',
    },
    ex: [
      ['[年|とし]をとる{にしたがって}、[体力|たいりょく]が[落|お]ちる。', 'As you get older, your strength declines.', 'À mesure qu’on vieillit, on perd des forces.'],
      ['[係員|かかりいん]の[指示|しじ]{にしたがって}、[避難|ひなん]してください。', 'Please evacuate following the staff’s instructions.', 'Évacuez en suivant les consignes du personnel.'],
    ],
  },
  {
    n: 44,
    p: '～最中',
    en: 'Right in the middle of…',
    fr: 'En plein milieu de…, en pleine…',
    form: 'V-ている / N の + 最中（に / だ）',
    note: {
      en: 'Stresses being in the middle of something, often when interrupted.',
      fr: 'Insiste sur le fait d’être au beau milieu d’une chose, souvent quand on est interrompu.',
    },
    ex: [
      ['[会議|かいぎ]の{[最中|さいちゅう]}に、[電話|でんわ]が[鳴|な]った。', 'The phone rang right in the middle of the meeting.', 'Le téléphone a sonné en pleine réunion.'],
      ['[食事|しょくじ]をしている{[最中|さいちゅう]}に、[地震|じしん]が[起|お]きた。', 'An earthquake struck right as we were eating.', 'Un séisme a eu lieu en plein repas.'],
    ],
  },
  {
    n: 45,
    p: '～てからでないと／なければ…ない',
    en: 'Not until…, only after…',
    fr: 'Pas avant de…, seulement après…',
    form: 'V-て + からでないと / からでなければ + …ない',
    note: {
      en: 'The first thing must be done before the second becomes possible.',
      fr: 'La première chose doit être faite avant que la seconde soit possible.',
    },
    ex: [
      ['[宿題|しゅくだい]をし{てからでないと}、[遊|あそ]べ{ない}。', 'You can’t play until you’ve done your homework.', 'Pas de jeux avant d’avoir fait tes devoirs.'],
      ['[実物|じつぶつ]を[見|み]{てからでなければ}、[買|か]え{ない}。', 'I can’t buy it until I’ve seen the real thing.', 'Je ne peux pas l’acheter sans l’avoir vu en vrai.'],
    ],
  },
  {
    n: 46,
    p: '～て以来',
    en: 'Ever since…',
    fr: 'Depuis que…',
    form: 'V-て + 以来; N + 以来',
    note: {
      en: 'A state that began at a past moment and has continued until now.',
      fr: 'Un état qui a commencé à un moment passé et dure jusqu’à aujourd’hui.',
    },
    ex: [
      ['[日本|にほん]に[来|き]{て[以来|いらい]}、ずっと[東京|とうきょう]に[住|す]んでいる。', 'Ever since I came to Japan, I’ve lived in Tokyo.', 'Depuis que je suis au Japon, j’habite à Tokyo.'],
      ['[卒業|そつぎょう]し{て[以来|いらい]}、[彼|かれ]に[会|あ]っていない。', 'I haven’t seen him since we graduated.', 'Je ne l’ai pas revu depuis la fin de nos études.'],
    ],
  },
  {
    n: 47,
    p: '～一方だ',
    en: 'Keeps (getting worse/more)…',
    fr: 'Ne cesse de…, ne fait que…',
    form: 'V-dict + 一方だ',
    note: {
      en: 'A change that keeps going in one direction, usually unwelcome.',
      fr: 'Un changement qui continue dans un seul sens, en général fâcheux.',
    },
    ex: [
      ['[仕事|しごと]は[増|ふ]える{[一方|いっぽう]だ}。', 'My workload just keeps growing.', 'Mon travail ne cesse d’augmenter.'],
      ['この[町|まち]の[人口|じんこう]は[減|へ]る{[一方|いっぽう]だ}。', 'This town’s population keeps shrinking.', 'La population de cette ville ne fait que baisser.'],
    ],
  },
  {
    n: 48,
    p: '～しかない／ほかない／よりない',
    en: 'Have no choice but to…, can only…',
    fr: 'Ne pas avoir d’autre choix que de…',
    form: 'V-dict + しかない / ほかない / よりない / よりほかない / ほかしかたがない',
    note: {
      en: 'All mean there is no other way. しかない is the most common; the others are more written.',
      fr: 'Tous veulent dire qu’il n’y a pas d’autre solution. しかない est le plus courant ; les autres sont plus écrits.',
    },
    ex: [
      ['[終電|しゅうでん]がないから、タクシーで[帰|かえ]る{しかない}。', 'There are no more trains, so I’ve no choice but to take a taxi.', 'Il n’y a plus de train : je n’ai pas d’autre choix que le taxi.'],
      ['[自分|じぶん]で[決|き]める{ほかない}。', 'There’s nothing for it but to decide myself.', 'Il ne reste plus qu’à décider moi-même.'],
    ],
  },
  {
    n: 49,
    p: '～はもちろん／もとより…も',
    en: 'Not to mention…, … of course, and also…',
    fr: 'Sans parler de…, … bien sûr, et aussi…',
    form: 'N1 はもちろん / はもとより、N2 も',
    note: {
      en: 'The first thing is obvious; the point is that the second is included too. もとより is more formal.',
      fr: 'La première chose va de soi ; l’important, c’est que la seconde est incluse aussi. もとより est plus soutenu.',
    },
    ex: [
      ['この[店|みせ]は[味|あじ]{はもちろん}、[値段|ねだん]{も}いい。', 'This place has great food, of course, and good prices too.', 'Ce restaurant est bon, bien sûr, et en plus il n’est pas cher.'],
      ['[子供|こども]{はもとより}、[大人|おとな]{も}[楽|たの]しめる。', 'Children, of course, but adults can enjoy it too.', 'Les enfants, évidemment, mais les adultes aussi peuvent s’amuser.'],
    ],
  },
  {
    n: 50,
    p: '～ついでに',
    en: 'While (I’m) at it…, on the way…',
    fr: 'Au passage…, tant qu’à faire…',
    form: 'V-dict / V-た / N の + ついでに',
    note: {
      en: 'Taking the chance of one action to do something else as well.',
      fr: 'Profiter d’une action pour en faire une autre en même temps.',
    },
    ex: [
      ['[買|か]い[物|もの]の{ついでに}、[郵便局|ゆうびんきょく]に[寄|よ]った。', 'While I was out shopping, I stopped by the post office.', 'En faisant les courses, je suis passé à la poste.'],
      ['[掃除|そうじ]をする{ついでに}、[窓|まど]もふいた。', 'While I was cleaning, I wiped the windows too.', 'Tant qu’à faire le ménage, j’ai aussi nettoyé les fenêtres.'],
    ],
  },
  {
    n: 51,
    p: '～ということだ',
    en: 'I hear that…; that means…',
    fr: 'Il paraît que… ; ça veut dire que…',
    form: 'plain form + ということだ; A ということは B ということだ',
    note: {
      en: 'Reports something heard, or draws a conclusion: “A means B”.',
      fr: 'Rapporte ce qu’on a entendu, ou tire une conclusion : « A, ça veut dire B ».',
    },
    ex: [
      ['[天気予報|てんきよほう]によると、[明日|あした]は[雪|ゆき]だ{ということだ}。', 'According to the forecast, it will snow tomorrow.', 'D’après la météo, il neigera demain.'],
      ['[返事|へんじ]がない{ということは}、[来|こ]ない{ということだ}。', 'No answer means he isn’t coming.', 'Pas de réponse, ça veut dire qu’il ne vient pas.'],
    ],
  },
  {
    n: 52,
    p: '～ことはない',
    en: 'There’s no need to…',
    fr: 'Pas besoin de…, inutile de…',
    form: 'V-dict + ことはない',
    note: {
      en: 'Reassures or advises: it isn’t necessary to do or feel that.',
      fr: 'Rassure ou conseille : il n’est pas nécessaire de faire ou de ressentir cela.',
    },
    ex: [
      ['[心配|しんぱい]する{ことはない}よ。', 'There’s no need to worry.', 'Pas la peine de t’inquiéter.'],
      ['タクシーで[行|い]く{ことはない}。[歩|ある]いて[十分|じゅっぷん]だから。', 'No need to take a taxi: it’s ten minutes on foot.', 'Inutile de prendre un taxi : c’est à dix minutes à pied.'],
    ],
  },
  {
    n: 53,
    p: '～こと',
    en: '(You) must… (written rules)',
    fr: '(Il faut)… (consignes écrites)',
    form: 'V-dict / V-ない + こと',
    note: {
      en: 'Ends a sentence with こと to give an instruction or rule, as on a notice or in school rules.',
      fr: 'Termine une phrase par こと pour donner une consigne ou une règle, comme sur un panneau ou un règlement.',
    },
    ex: [
      ['[教室|きょうしつ]では[携帯電話|けいたいでんわ]を[使|つか]わない{こと}。', 'Do not use mobile phones in the classroom.', 'Ne pas utiliser de téléphone portable en classe.'],
      ['[明日|あした]までにレポートを[出|だ]す{こと}。', 'Hand in your report by tomorrow.', 'Rendre le rapport d’ici demain.'],
    ],
  },
  {
    n: 54,
    p: '～ないことはない／もない',
    en: 'It’s not that… not, (it) is possible',
    fr: 'Ce n’est pas impossible que…, on peut bien…',
    form: 'V-ない / adj-ない + ことはない / こともない',
    note: {
      en: 'A double negative giving a cautious yes: “I can, sort of”.',
      fr: 'Une double négation qui donne un oui prudent : « je peux, à la rigueur ».',
    },
    ex: [
      ['[辛|から]い[料理|りょうり]も、[食|た]べられ{ないことはない}。', 'It’s not that I can’t eat spicy food.', 'Les plats épicés, je peux en manger, à la rigueur.'],
      ['[急|いそ]げば、[間|ま]に[合|あ]わ{ないこともない}。', 'If we hurry, we might just make it.', 'En se dépêchant, on pourrait encore y arriver.'],
    ],
  },
  {
    n: 55,
    p: '～もの／もん',
    en: '…because (excuse, casual)',
    fr: '…parce que (excuse, familier)',
    form: 'plain form + もの / もん (often だって…もん)',
    note: {
      en: 'Gives a reason in a childish or plaintive way, often to justify oneself. もん is more casual.',
      fr: 'Donne une raison sur un ton enfantin ou plaintif, souvent pour se justifier. もん est plus familier.',
    },
    ex: [
      ['だって、[眠|ねむ]かったんだ{もん}。', 'Well, I was sleepy!', 'Ben, j’avais sommeil, moi !'],
      ['[行|い]きたくない。[寒|さむ]い{もの}。', 'I don’t want to go. It’s cold.', 'J’ai pas envie d’y aller. Il fait froid.'],
    ],
  },
  {
    n: 56,
    p: '～ものだから／もので',
    en: 'Because… (excuse, explanation)',
    fr: 'C’est que…, comme… (excuse, justification)',
    form: 'V / adj (plain, な-adj な, N な) + ものだから / もので',
    note: {
      en: 'Gives a reason as an excuse, often when apologising.',
      fr: 'Donne une raison comme excuse, souvent en s’excusant.',
    },
    ex: [
      ['[電車|でんしゃ]が[遅|おく]れた{ものだから}、[遅刻|ちこく]してしまいました。', 'The train was delayed, so I was late.', 'C’est que le train avait du retard, je suis arrivé en retard.'],
      ['[道|みち]がわからなかった{もので}、すみません。', 'Sorry, I didn’t know the way.', 'Désolé, c’est que je ne connaissais pas le chemin.'],
    ],
  },
  {
    n: 57,
    p: '～ものか／もんか',
    en: 'As if…!, no way (I will)…!',
    fr: 'Pas question que… !, jamais je ne… !',
    form: 'V-dict / adj + ものか / もんか',
    note: {
      en: 'A strong, emotional denial. もんか is casual; ものですか is the polite form.',
      fr: 'Une négation forte et émotive. もんか est familier ; ものですか est la forme polie.',
    },
    ex: [
      ['あんな[店|みせ]、[二度|にど]と[行|い]く{もんか}。', 'I’ll never go to that place again!', 'Ce restaurant ? Jamais je n’y remettrai les pieds !'],
      ['こんな[問題|もんだい]、[難|むずか]しい{ものか}。', 'This problem? Hard? Not at all!', 'Ce problème, difficile ? Pas du tout !'],
    ],
  },
  {
    n: 58,
    p: '～たところ',
    en: 'When I (did)…, (I found that)…',
    fr: 'Quand j’ai (fait)…, (j’ai constaté que)…',
    form: 'V-た + ところ',
    note: {
      en: 'After doing something, a result or discovery follows, often unexpected.',
      fr: 'Après avoir fait une chose, un résultat ou une découverte s’ensuit, souvent inattendu.',
    },
    ex: [
      ['[先生|せんせい]に[相談|そうだん]し{たところ}、いい[方法|ほうほう]を[教|おし]えてくれた。', 'When I consulted my teacher, she told me a good way.', 'Quand j’en ai parlé à mon professeur, il m’a donné une bonne méthode.'],
      ['[店|みせ]に[電話|でんわ]し{たところ}、もう[閉|し]まっていた。', 'When I called the shop, it was already closed.', 'Quand j’ai appelé le magasin, il était déjà fermé.'],
    ],
  },
  {
    n: 59,
    p: '～ところに／へ／を／で',
    en: 'Just when…, at the moment…',
    fr: 'Juste au moment où…',
    form: 'V-dict / V-ている / V-た + ところに / ところへ / ところを / ところで',
    note: {
      en: 'Something happens at a precise moment of another action: ところへ (someone arrives), ところを (seen, caught), ところで (stopping at that point).',
      fr: 'Une chose arrive à un moment précis d’une autre action : ところへ (quelqu’un arrive), ところを (être vu, surpris), ところで (s’arrêter à ce point).',
    },
    ex: [
      ['[出|で]かけようとしている{ところへ}、[友達|ともだち]が[来|き]た。', 'Just as I was about to leave, a friend came over.', 'Au moment où j’allais sortir, un ami est arrivé.'],
      ['[寝|ね]ている{ところを}[起|お]こされた。', 'I was woken up while I was sleeping.', 'On m’a réveillé en plein sommeil.'],
    ],
  },
  {
    n: 60,
    p: '～ところだった',
    en: 'Almost…, nearly…',
    fr: 'Avoir failli…',
    form: 'V-dict + ところだった',
    note: {
      en: 'Something (usually bad) nearly happened, but didn’t. Often with もう少しで.',
      fr: 'Une chose (souvent mauvaise) a failli arriver, mais non. Souvent avec もう少しで.',
    },
    ex: [
      ['もう[少|すこ]しで[車|くるま]にひかれる{ところだった}。', 'I was nearly hit by a car.', 'J’ai bien failli me faire renverser par une voiture.'],
      ['[寝坊|ねぼう]して、[飛行機|ひこうき]に[乗|の]り[遅|おく]れる{ところだった}。', 'I overslept and nearly missed my plane.', 'Je ne me suis pas réveillé et j’ai failli rater mon avion.'],
    ],
  },
  {
    n: 61,
    p: '～ほど／～ほど…はない',
    en: 'So… that…; nothing is as… as…',
    fr: 'Tellement… que… ; rien n’est aussi… que…',
    form: 'V / adj + ほど; N ほど + adj + N はない',
    note: {
      en: 'ほど gives a degree (“so tired I can’t walk”). N ほど…はない: N is the most…',
      fr: 'ほど donne un degré (« si fatigué que je ne peux plus marcher »). N ほど…はない : rien n’est plus… que N.',
    },
    ex: [
      ['[足|あし]が[痛|いた]くて[歩|ある]けない{ほど}だ。', 'My feet hurt so much I can’t walk.', 'J’ai tellement mal aux pieds que je ne peux plus marcher.'],
      ['[家族|かぞく]{ほど}[大切|たいせつ]なもの{はない}。', 'Nothing is as precious as family.', 'Rien n’est aussi précieux que la famille.'],
    ],
  },
  {
    n: 62,
    p: '～ば～ほど',
    en: 'The more…, the more…',
    fr: 'Plus…, plus…',
    form: 'V-ば V-dict ほど; い-adj-ければ い-adj ほど',
    note: {
      en: 'The same word twice: first in the ば form, then before ほど. One thing grows with the other.',
      fr: 'Le même mot deux fois : d’abord à la forme en ば, puis devant ほど. L’un augmente avec l’autre.',
    },
    ex: [
      ['[練習|れんしゅう]すれ{ば}する{ほど}、[上手|じょうず]になる。', 'The more you practise, the better you get.', 'Plus on s’entraîne, plus on progresse.'],
      ['[考|かんが]えれ{ば}[考|かんが]える{ほど}、わからなくなる。', 'The more I think about it, the less I understand.', 'Plus j’y pense, moins je comprends.'],
    ],
  },
  {
    n: 63,
    p: '～ほど',
    en: 'The more…, the more… (shorter form)',
    fr: 'Plus…, plus… (forme courte)',
    form: 'V-dict / adj / N + ほど + …',
    note: {
      en: 'A short form of ～ば～ほど, without the ば part: “the higher, the colder”.',
      fr: 'Une forme courte de ～ば～ほど, sans la partie en ば : « plus c’est haut, plus il fait froid ».',
    },
    ex: [
      ['[高|たか]い[山|やま]{ほど}、[登|のぼ]るのが[大変|たいへん]だ。', 'The higher the mountain, the harder the climb.', 'Plus la montagne est haute, plus l’ascension est dure.'],
      ['[若|わか]い[人|ひと]{ほど}、[新|あたら]しい[言葉|ことば]をよく[使|つか]う。', 'The younger people are, the more they use new words.', 'Plus on est jeune, plus on emploie de mots nouveaux.'],
    ],
  },
];
