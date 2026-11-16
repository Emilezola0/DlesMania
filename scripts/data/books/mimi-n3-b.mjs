// 耳から覚える 文法トレーニング N3: units 3–4. The book's list of points only; all else written by an AI (Claude).
export default [
  {
    n: 16,
    p: '～から～にかけて',
    en: 'From… through…, over (a span)',
    fr: 'De… à…, sur toute la période / zone',
    form: 'N1 から N2 にかけて',
    note: {
      en: 'A rough span of time or space, without exact limits: “from evening into the night”.',
      fr: 'Une étendue de temps ou d’espace approximative, sans limites précises : « du soir jusque dans la nuit ».',
    },
    ex: [
      ['[今夜|こんや]から[明日|あした]の[朝|あさ]{にかけて}、[雨|あめ]が[降|ふ]るでしょう。', 'It will rain from tonight through tomorrow morning.', 'Il pleuvra de ce soir jusqu’à demain matin.'],
      ['[関東|かんとう]{から}[東北|とうほく]{にかけて}[雪|ゆき]が[降|ふ]った。', 'Snow fell over the area from Kanto to Tohoku.', 'Il a neigé du Kanto jusqu’au Tohoku.'],
    ],
  },
  {
    n: 17,
    p: '～だらけ',
    en: 'Full of…, covered in… (bad)',
    fr: 'Plein de…, couvert de… (négatif)',
    form: 'N + だらけ',
    note: {
      en: 'Covered with or full of something unwelcome: mud, mistakes, rubbish.',
      fr: 'Couvert ou rempli de quelque chose de désagréable : boue, fautes, déchets.',
    },
    ex: [
      ['[子供|こども]は[泥|どろ]{だらけ}になって[帰|かえ]ってきた。', 'The child came home covered in mud.', 'L’enfant est rentré couvert de boue.'],
      ['この[作文|さくぶん]は[間違|まちが]い{だらけ}だ。', 'This essay is full of mistakes.', 'Cette rédaction est truffée de fautes.'],
    ],
  },
  {
    n: 18,
    p: '～おかげだ／おかげで',
    en: 'Thanks to…',
    fr: 'Grâce à…',
    form: 'V / adj (plain) / N の + おかげで / おかげだ',
    note: {
      en: 'A good result and its cause, often with gratitude. Used ironically, it can also mean a bad result.',
      fr: 'Un bon résultat et sa cause, souvent avec reconnaissance. Ironique, il peut aussi désigner un mauvais résultat.',
    },
    ex: [
      ['[先生|せんせい]の{おかげで}、[試験|しけん]に[合格|ごうかく]できた。', 'Thanks to my teacher, I passed the exam.', 'Grâce à mon professeur, j’ai réussi l’examen.'],
      ['[薬|くすり]を[飲|の]んだ{おかげで}、[熱|ねつ]が[下|さ]がった。', 'Thanks to the medicine, my fever went down.', 'Grâce au médicament, ma fièvre est tombée.'],
    ],
  },
  {
    n: 19,
    p: '～せいだ／せいで／せいか',
    en: 'Because of… (blame); perhaps because of…',
    fr: 'À cause de… (reproche) ; peut-être à cause de…',
    form: 'V / adj (plain) / N の + せいで / せいだ / せいか',
    note: {
      en: 'The opposite of おかげで: a bad result and who or what is to blame. せいか adds doubt: “maybe because of…”.',
      fr: 'L’inverse de おかげで : un mauvais résultat et ce qui en est responsable. せいか ajoute un doute : « peut-être à cause de… ».',
    },
    ex: [
      ['[雨|あめ]の{せいで}、[試合|しあい]が[中止|ちゅうし]になった。', 'Because of the rain, the match was cancelled.', 'À cause de la pluie, le match a été annulé.'],
      ['[寝不足|ねぶそく]の{せいか}、[頭|あたま]が[痛|いた]い。', 'Perhaps because I didn’t sleep enough, I have a headache.', 'Peut-être par manque de sommeil, j’ai mal à la tête.'],
    ],
  },
  {
    n: 20,
    p: '～とおり（に）／どおり（に）',
    en: 'As…, just like…, according to…',
    fr: 'Comme…, exactement selon…',
    form: 'V-dict / V-た / N の + とおり（に）; N + どおり（に）',
    note: {
      en: 'Doing or happening exactly as something said or planned. After a noun directly, it becomes どおり: 予定どおり.',
      fr: 'Faire ou se passer exactement comme on l’a dit ou prévu. Directement après un nom, cela devient どおり : 予定どおり.',
    },
    ex: [
      ['[説明書|せつめいしょ]に[書|か]いてある{とおりに}[作|つく]った。', 'I made it just as the instructions say.', 'Je l’ai fait exactement comme l’indique la notice.'],
      ['[電車|でんしゃ]は[時間|じかん]{どおり}に[着|つ]いた。', 'The train arrived on time.', 'Le train est arrivé à l’heure.'],
    ],
  },
  {
    n: 21,
    p: '～について／つき',
    en: 'About…, concerning…',
    fr: 'Au sujet de…, concernant…',
    form: 'N + について / についての N / につき (formal)',
    note: {
      en: 'Gives the topic of speaking, thinking, research. につき is the written, formal form.',
      fr: 'Donne le sujet dont on parle, auquel on pense, qu’on étudie. につき est la forme écrite et soutenue.',
    },
    ex: [
      ['[日本|にほん]の[歴史|れきし]{について}[調|しら]べている。', 'I’m researching Japanese history.', 'Je fais des recherches sur l’histoire du Japon.'],
      ['この[件|けん]{につき}、ご[説明|せつめい]いたします。', 'Let me explain this matter.', 'Permettez-moi de vous expliquer cette affaire.'],
    ],
  },
  {
    n: 22,
    p: '～に関し（て）',
    en: 'Regarding…, in relation to…',
    fr: 'Concernant…, relatif à…',
    form: 'N + に関して / に関する N',
    note: {
      en: 'A more formal について, common in news, reports and questions to an office.',
      fr: 'Un について plus soutenu, courant dans les informations, les rapports et les demandes officielles.',
    },
    ex: [
      ['[環境|かんきょう]{に[関|かん]して}、[意見|いけん]を[聞|き]かせてください。', 'Please tell us your views on the environment.', 'Donnez-nous votre avis sur l’environnement.'],
      ['[事故|じこ]{に[関|かん]する}ニュースを[見|み]た。', 'I saw the news about the accident.', 'J’ai vu les informations concernant l’accident.'],
    ],
  },
  {
    n: 23,
    p: '～に比べ（て）',
    en: 'Compared with…',
    fr: 'Par rapport à…, comparé à…',
    form: 'N + に比べて / に比べ',
    note: {
      en: 'Sets something against a reference point to compare.',
      fr: 'Met une chose en regard d’un point de référence pour comparer.',
    },
    ex: [
      ['[去年|きょねん]{に[比|くら]べて}、[今年|ことし]は[雪|ゆき]が[少|すく]ない。', 'Compared with last year, there’s little snow this year.', 'Par rapport à l’an dernier, il y a peu de neige cette année.'],
      ['[都会|とかい]{に[比|くら]べ}、[田舎|いなか]は[物価|ぶっか]が[安|やす]い。', 'Compared with the city, prices are low in the countryside.', 'Comparée à la ville, la campagne est moins chère.'],
    ],
  },
  {
    n: 24,
    p: '～に加え（て）',
    en: 'In addition to…, on top of…',
    fr: 'En plus de…, s’ajoutant à…',
    form: 'N + に加えて / に加え',
    note: {
      en: 'Adds one more thing of the same kind; rather formal.',
      fr: 'Ajoute une chose de même nature ; plutôt soutenu.',
    },
    ex: [
      ['[雨|あめ]{に[加|くわ]えて}、[風|かぜ]も[強|つよ]くなってきた。', 'On top of the rain, the wind is getting stronger.', 'En plus de la pluie, le vent s’est levé.'],
      ['[英語|えいご]{に[加|くわ]え}、[中国語|ちゅうごくご]も[勉強|べんきょう]している。', 'In addition to English, I’m studying Chinese.', 'En plus de l’anglais, j’étudie le chinois.'],
    ],
  },
  {
    n: 25,
    p: 'Aは～に対し（て）',
    en: 'While A…, B on the other hand… (contrast)',
    fr: 'Alors que A…, B en revanche… (contraste)',
    form: 'A は ～ のに対して、B は ～',
    note: {
      en: 'Contrasts two things side by side. (Point 34 is the other use: “toward”.)',
      fr: 'Oppose deux choses côte à côte. (Le point 34 est l’autre emploi : « envers ».)',
    },
    ex: [
      ['[兄|あに]{は}[外|そと]で[遊|あそ]ぶのが[好|す]きな{のに[対|たい]して}、[弟|おとうと]は[本|ほん]が[好|す]きだ。', 'My older brother likes playing outside, whereas my younger one likes books.', 'Mon grand frère aime jouer dehors, alors que le petit préfère les livres.'],
      ['[東京|とうきょう]{は}[人|ひと]が[多|おお]い{のに[対|たい]し}、この[町|まち]は[静|しず]かだ。', 'Tokyo is crowded, while this town is quiet.', 'Tokyo est bondée, alors que cette ville est calme.'],
    ],
  },
  {
    n: 26,
    p: '～たびに',
    en: 'Every time…, whenever…',
    fr: 'Chaque fois que…',
    form: 'V-dict / N の + たびに',
    note: {
      en: 'Each time the first thing happens, the second follows.',
      fr: 'Chaque fois que la première chose arrive, la seconde suit.',
    },
    ex: [
      ['この[歌|うた]を[聞|き]く{たびに}、[故郷|ふるさと]を[思|おも]い[出|だ]す。', 'Every time I hear this song, I think of home.', 'Chaque fois que j’entends cette chanson, je pense à mon pays.'],
      ['[旅行|りょこう]の{たびに}、お[土産|みやげ]を[買|か]ってくる。', 'Every time he travels, he brings back souvenirs.', 'À chaque voyage, il rapporte des souvenirs.'],
    ],
  },
  {
    n: 27,
    p: 'たとえ～ても',
    en: 'Even if…',
    fr: 'Même si…',
    form: 'たとえ + V-て / adj-くて / N で + も',
    note: {
      en: 'たとえ stresses the hypothesis: whatever happens, the conclusion stands.',
      fr: 'たとえ insiste sur l’hypothèse : quoi qu’il arrive, la conclusion tient.',
    },
    ex: [
      ['{たとえ}[雨|あめ]が[降|ふ]っ{ても}、[試合|しあい]はある。', 'Even if it rains, the match is on.', 'Même s’il pleut, le match a lieu.'],
      ['{たとえ}[反対|はんたい]され{ても}、[自分|じぶん]の[夢|ゆめ]をあきらめない。', 'Even if people oppose me, I won’t give up my dream.', 'Même si on s’y oppose, je ne renoncerai pas à mon rêve.'],
    ],
  },
  {
    n: 28,
    p: '～って',
    en: '(They say) that…; (it’s) called…; as for… (spoken)',
    fr: '(Il paraît) que… ; (ça) s’appelle… ; quant à… (oral)',
    form: 'plain form + って; N + って',
    note: {
      en: 'Spoken shortcut for と, という or は: reporting what was said, naming, or bringing up a topic.',
      fr: 'Raccourci oral de と, という ou は : rapporter ce qui a été dit, nommer, ou introduire un sujet.',
    },
    ex: [
      ['[田中|たなか]さん、[今日|きょう]は[来|こ]ない{って}。', 'Tanaka says he’s not coming today.', 'Tanaka dit qu’il ne vient pas aujourd’hui.'],
      ['「[積読|つんどく]」{って}[何|なん]ですか。', 'What does “tsundoku” mean?', 'C’est quoi, « tsundoku » ?'],
    ],
  },
  {
    n: 29,
    p: '～くらい',
    en: 'About…; so… that; at least…',
    fr: 'Environ… ; tellement… que ; au moins…',
    form: 'number + くらい; V / adj + くらい',
    note: {
      en: 'An approximate amount, a degree (“so hungry I could eat a horse”), or a minimum (“at least that much”). Also ぐらい.',
      fr: 'Une quantité approximative, un degré (« tellement faim que… »), ou un minimum (« au moins ça »). Aussi ぐらい.',
    },
    ex: [
      ['[駅|えき]まで[十分|じゅっぷん]{くらい}かかる。', 'It takes about ten minutes to the station.', 'Il faut environ dix minutes jusqu’à la gare.'],
      ['[泣|な]きたい{くらい}うれしかった。', 'I was so happy I could have cried.', 'J’étais si heureux que j’en aurais pleuré.'],
    ],
  },
  {
    n: 30,
    p: '～くらいなら',
    en: 'Rather than…, if it comes to… (I’d prefer)',
    fr: 'Plutôt que de…, s’il faut… (je préfère)',
    form: 'V-dict + くらいなら',
    note: {
      en: 'Rejects an option the speaker finds very bad, and prefers another.',
      fr: 'Écarte une option qu’on trouve vraiment mauvaise, et en préfère une autre.',
    },
    ex: [
      ['[嘘|うそ]をつく{くらいなら}、[黙|だま]っていたほうがいい。', 'Rather than lie, it’s better to keep quiet.', 'Plutôt que de mentir, mieux vaut se taire.'],
      ['あんな[店|みせ]で[食|た]べる{くらいなら}、[家|いえ]で[作|つく]る。', 'Rather than eat at that place, I’ll cook at home.', 'Plutôt que de manger dans ce restaurant, je cuisine chez moi.'],
    ],
  },
  {
    n: 31,
    p: '～うちに',
    en: 'While (still)…, before (it changes)…',
    fr: 'Tant que…, pendant que… (avant que ça change)',
    form: 'V-dict / V-ている / V-ない / adj / N の + うちに',
    note: {
      en: 'Do something while a state lasts, before it ends: “while it’s still hot”. With ないうちに: “before it…”.',
      fr: 'Faire une chose tant qu’un état dure, avant qu’il ne finisse : « tant que c’est chaud ». Avec ないうちに : « avant que… ».',
    },
    ex: [
      ['[温|あたた]かい{うちに}[食|た]べてください。', 'Please eat it while it’s warm.', 'Mangez-le tant que c’est chaud.'],
      ['[暗|くら]くならない{うちに}[帰|かえ]ろう。', 'Let’s go home before it gets dark.', 'Rentrons avant qu’il fasse nuit.'],
    ],
  },
  {
    n: 32,
    p: '～を中心に／として／にして',
    en: 'Centred on…, with… at the core',
    fr: 'Centré sur…, avec… au cœur',
    form: 'N + を中心に / を中心として / を中心にして',
    note: {
      en: 'Gives the centre, main part or focus of an activity or area.',
      fr: 'Indique le centre, la partie principale ou le cœur d’une activité ou d’une zone.',
    },
    ex: [
      ['この[町|まち]は[駅|えき]{を[中心|ちゅうしん]に}[発展|はってん]した。', 'This town grew up around the station.', 'Cette ville s’est développée autour de la gare.'],
      ['[若者|わかもの]{を[中心|ちゅうしん]に}、その[歌|うた]が[人気|にんき]になった。', 'The song became popular, mainly among young people.', 'La chanson est devenue populaire, surtout chez les jeunes.'],
    ],
  },
  {
    n: 33,
    p: '～をはじめ',
    en: 'Starting with…, including…',
    fr: 'À commencer par…, notamment…',
    form: 'N + をはじめ（として） / をはじめとする N',
    note: {
      en: 'Names the main or most typical example, then the others: “Tokyo and other big cities”.',
      fr: 'Cite l’exemple principal ou le plus typique, puis les autres : « Tokyo et les autres grandes villes ».',
    },
    ex: [
      ['[東京|とうきょう]{をはじめ}、[大|おお]きな[町|まち]は[家賃|やちん]が[高|たか]い。', 'Starting with Tokyo, rent is high in big cities.', 'À commencer par Tokyo, les grandes villes ont des loyers élevés.'],
      ['[社長|しゃちょう]{をはじめ}、[社員|しゃいん]みんなが[喜|よろこ]んだ。', 'Everyone, from the president down, was delighted.', 'Tout le monde s’est réjoui, à commencer par le président.'],
    ],
  },
  {
    n: 34,
    p: '～に対し（て）',
    en: 'Toward…, to…, against…',
    fr: 'Envers…, à l’égard de…, contre…',
    form: 'N + に対して / に対する N',
    note: {
      en: 'The person or thing an action or feeling is aimed at: kind to, a question to, protest against.',
      fr: 'La personne ou la chose visée par une action ou un sentiment : gentil envers, question à, protestation contre.',
    },
    ex: [
      ['[彼|かれ]はお[年寄|としよ]り{に[対|たい]して}とても[親切|しんせつ]だ。', 'He is very kind to the elderly.', 'Il est très gentil envers les personnes âgées.'],
      ['[質問|しつもん]{に[対|たい]する}[答|こた]えを[書|か]いてください。', 'Please write the answer to the question.', 'Écrivez la réponse à la question.'],
    ],
  },
  {
    n: 35,
    p: '～において',
    en: 'In…, at… (formal: place, time, field)',
    fr: 'Dans…, à… (soutenu : lieu, époque, domaine)',
    form: 'N + において / における N',
    note: {
      en: 'A formal で for where or when something takes place, or in what field.',
      fr: 'Un で soutenu pour le lieu, l’époque ou le domaine où une chose a lieu.',
    },
    ex: [
      ['[卒業式|そつぎょうしき]は[大|だい]ホール{において}[行|おこな]われる。', 'The graduation ceremony will be held in the main hall.', 'La cérémonie de remise des diplômes aura lieu dans le grand hall.'],
      ['[現代|げんだい]{における}[家族|かぞく]の[形|かたち]は[様々|さまざま]だ。', 'Families today take many forms.', 'De nos jours, la famille prend des formes très variées.'],
    ],
  },
  {
    n: 36,
    p: '～にわたって／わたり',
    en: 'Over (a long span), throughout…',
    fr: 'Pendant (toute une durée), sur (toute une étendue)',
    form: 'N (period, area) + にわたって / にわたり / にわたる N',
    note: {
      en: 'Stresses that something covers a long time or a wide area.',
      fr: 'Insiste sur le fait qu’une chose couvre une longue durée ou une grande étendue.',
    },
    ex: [
      ['[会議|かいぎ]は[三時間|さんじかん]{にわたって}[続|つづ]いた。', 'The meeting went on for three hours.', 'La réunion a duré trois heures entières.'],
      ['[広|ひろ]い[範囲|はんい]{にわたり}、[雨|あめ]が[降|ふ]った。', 'It rained over a wide area.', 'Il a plu sur une vaste zone.'],
    ],
  },
  {
    n: 37,
    p: '～にとって',
    en: 'For…, to… (from someone’s standpoint)',
    fr: 'Pour… (du point de vue de quelqu’un)',
    form: 'N + にとって',
    note: {
      en: 'The person or group from whose point of view something is judged: important, difficult, precious…',
      fr: 'La personne ou le groupe du point de vue duquel on juge une chose : important, difficile, précieux…',
    },
    ex: [
      ['[私|わたし]{にとって}、[家族|かぞく]が[一番|いちばん][大切|たいせつ]だ。', 'For me, family is what matters most.', 'Pour moi, la famille compte plus que tout.'],
      ['[外国人|がいこくじん]{にとって}、[漢字|かんじ]は[難|むずか]しい。', 'For foreigners, kanji are hard.', 'Pour les étrangers, les kanji sont difficiles.'],
    ],
  },
  {
    n: 38,
    p: '～による／より／よって／によっては',
    en: 'By…, due to…, depending on…; in some cases…',
    fr: 'Par…, en raison de…, selon… ; dans certains cas…',
    form: 'N + によって / により / による N; N + によっては',
    note: {
      en: 'Cause, means, the maker in a passive, or what things vary with. によっては: “depending on…, (sometimes) even…”.',
      fr: 'Cause, moyen, auteur d’un passif, ou ce selon quoi les choses varient. によっては : « selon…, il arrive même que… ».',
    },
    ex: [
      ['[台風|たいふう]{により}、[電車|でんしゃ]が[止|と]まった。', 'The trains stopped due to the typhoon.', 'Les trains se sont arrêtés en raison du typhon.'],
      ['[場合|ばあい]{によっては}、[中止|ちゅうし]になることもある。', 'Depending on the case, it may even be cancelled.', 'Selon les cas, il se peut même que ce soit annulé.'],
    ],
  },
];
