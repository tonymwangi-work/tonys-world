'use strict';
// Original murder mysteries for Case Files.
// Each suspect has motive / means / opportunity clues — only the culprit has all three.
// Evidence with location 'file' is in the case folder from the start.

module.exports = [
  // ─────────────────────────────────────────── CASE 1
  {
    id: 'final-bow',
    title: 'The Final Bow',
    emoji: '🎭',
    difficulty: 'Rookie',
    par: 10,
    tagline: 'Opening night ended with a standing ovation — and a body.',
    intro: [
      'The Rosewood Theatre, 11:20 PM. Opening night of "Midsummer Masquerade" was a triumph — until star actress Vivian Hale was found slumped at her dressing table, a half-finished cup of tea beside her.',
      'Paramedics pronounced her dead at 10:58 PM. The coroner suspects poison. Four people had reason to be backstage tonight. The doors are sealed and the press is gathering outside.',
      'Your job, detectives: work out WHO killed Vivian Hale, HOW, and WHY. Every search and every question costs time — the best detectives crack the case in as few moves as possible.',
    ],
    victim: { name: 'Vivian Hale', desc: 'Lead actress, 38. Adored by audiences, feared by the crew. Drank a cup of chamomile tea after every performance.' },
    suspects: [
      {
        id: 'marcus', name: 'Marcus Pell', role: 'Director', emoji: '🎬',
        bio: 'Charming and ambitious, he built the Rosewood from nothing. Rumour says the theatre is short on money.',
        questions: [
          { id: 'm1', q: 'Where were you during the curtain call?', a: 'Right there on stage, taking my bow with the company. Ask anyone.' },
          { id: 'm2', q: 'How did you get along with Vivian?', a: 'Wonderfully. She was my muse. We had creative disagreements, like all artists, but nothing serious.' },
          { id: 'm3', q: 'The camera shows someone in a grey scarf heading to Vivian\'s room at 10:08. Was that you?', requires: ['camera', 'scarf'], a: 'Lots of people own grey scarves, detective. ...Fine. After my bow I slipped back to congratulate her privately. She wasn\'t there yet. I left straight away.' },
          { id: 'm4', q: 'Why is theatre money being paid to "M.P. Creative Holdings"?', requires: ['ledger'], a: '*He loosens his collar.* Consulting fees. Perfectly legal. I\'d like to speak to my lawyer before we go on.' },
          { id: 'm5', q: 'Your monogrammed handkerchief was in the green-room bin, full of crushed foxglove.', requires: ['hanky'], a: 'Someone must have taken it from my coat! Anyone could have done that. This is a set-up!' },
        ],
      },
      {
        id: 'lena', name: 'Lena Ortiz', role: 'Understudy', emoji: '🌟',
        bio: 'Talented and overlooked for years. With Vivian gone, the lead role is finally hers.',
        questions: [
          { id: 'l1', q: 'What did you do after the show?', a: 'Same as every night: I made Vivian\'s chamomile in the green room and put it on her dressing table at ten. Then I went out front to sign programmes for the fans.' },
          { id: 'l2', q: 'Were you jealous of Vivian?', a: 'Of course I wanted her part — everybody wants the lead. But not like this. Never like this.' },
          { id: 'l3', q: 'Could anyone else have got to the tea?', a: 'It sat in her dressing room from ten until she came off stage. That door is never locked. Anyone backstage could have walked in.' },
          { id: 'l4', q: 'Fan photos put you in the lobby from 10:02 to 10:35.', requires: ['photos'], a: 'See? I told you. I didn\'t go backstage again until I heard the screaming.' },
        ],
      },
      {
        id: 'gregory', name: 'Gregory Hale', role: 'Husband & Florist', emoji: '💐',
        bio: 'Owns the Hale & Petal flower shop. Their marriage was said to be rocky.',
        questions: [
          { id: 'g1', q: 'Did you send Vivian flowers tonight?', a: 'Foxglove — her favourite. Delivered at six. And yes, before you ask, I know foxglove is poisonous. Every florist does. That\'s exactly why I\'d never be stupid enough to use it.' },
          { id: 'g2', q: 'When did you arrive at the theatre?', a: 'Half past ten. I was stuck in traffic and missed the whole show. She\'d have been furious with me.' },
          { id: 'g3', q: 'You hold a large life-insurance policy on Vivian.', requires: ['policy'], a: 'We took out matching policies when we bought the house. Hers on me is just as big. Check for yourself.' },
          { id: 'g4', q: 'The stage-door log has you signing in at 10:31.', requires: ['log'], a: 'Like I said. By then she\'d already been back in her room for ages.' },
        ],
      },
      {
        id: 'theo', name: 'Theo Banks', role: 'Stagehand', emoji: '🔧',
        bio: 'Fired last week after Vivian complained about him. Did not take it well.',
        questions: [
          { id: 't1', q: 'Why were you fired?', a: 'A sandbag dropped near her in rehearsal. An accident! She said I did it on purpose and got me sacked. Twelve years I worked here.' },
          { id: 't2', q: 'Where were you tonight?', a: 'Came to collect my last pay packet and left early, about half nine. Went to the pub over the road.' },
          { id: 't3', q: 'The camera shows you coming back in at 10:50.', requires: ['camera'], a: 'Left my toolbox, didn\'t I. Came back for it and walked straight into the ambulance crew. Rotten luck.' },
          { id: 't4', q: 'You wrote "she\'ll get what\'s coming" on your termination letter.', requires: ['termination'], a: 'I was angry! People say things when they\'re angry. I never meant anything by it.' },
        ],
      },
    ],
    locations: [
      { id: 'dressing', name: 'Vivian\'s Dressing Room', emoji: '🪞', desc: 'Where the body was found. The mirror lights are still glowing.' },
      { id: 'green', name: 'Green Room', emoji: '☕', desc: 'The cast lounge: a kettle, a saggy sofa and an overflowing bin.' },
      { id: 'stagedoor', name: 'Stage Door', emoji: '🚪', desc: 'The only backstage entrance, with a guard\'s sign-in log and a security camera.' },
      { id: 'office', name: 'Director\'s Office', emoji: '🗄️', desc: 'Marcus Pell\'s cluttered office above the stage.' },
      { id: 'lobby', name: 'Front Lobby & Cloakroom', emoji: '🎟️', desc: 'Where fans gathered after the show.' },
    ],
    evidence: [
      { id: 'autopsy', location: 'file', type: 'report', emoji: '🩻', name: 'Coroner\'s Preliminary Report', text: 'Victim: Vivian Hale. Time of death: approx. 10:45 PM.\nCause: heart failure from digitalis-type poisoning, consistent with eating foxglove leaves.\nSymptoms usually begin 20–40 minutes after the poison is swallowed.\nNo wounds. No signs of a struggle.' },
      { id: 'runorder', location: 'file', type: 'document', emoji: '📋', name: 'Stage Manager\'s Running Order', text: '9:58 PM — Final scene ends.\n10:00 PM — Curtain call begins (full cast incl. V. Hale).\n10:06 PM — Director takes his bow, exits stage left.\n10:12 PM — Curtain down. V. Hale returns to her dressing room.\n10:44 PM — V. Hale found unresponsive.' },
      { id: 'teacup', location: 'dressing', type: 'object', emoji: '🍵', name: 'Teacup', text: 'Half-drunk chamomile with lipstick on the rim.\nLAB NOTE: Strong traces of digitalis and shredded green leaf in the cup. The tea tin itself tested clean — the poison was added to this cup only.' },
      { id: 'bouquet', location: 'dressing', type: 'object', emoji: '💐', name: 'Foxglove Bouquet', text: 'A tall bouquet of purple foxglove. Card: "Break a leg, my star. — G."\nSeveral stems at the back have had their leaves stripped off.' },
      { id: 'chocolates', location: 'dressing', type: 'object', emoji: '🍫', name: 'Box of Chocolates', text: 'From "a devoted admirer". Two pieces eaten.\nLAB NOTE: No toxins found.' },
      { id: 'hanky', location: 'green', type: 'object', emoji: '🧻', name: 'Handkerchief in the Bin', text: 'A fine linen handkerchief embroidered "M.P.", balled up around crushed green leaves with purple flecks.\nBOTANIST NOTE: Foxglove.' },
      { id: 'kettle', location: 'green', type: 'document', emoji: '📝', name: 'Note by the Kettle', text: '"Lena — V\'s tea at 10 sharp please, or she\'ll have our heads. Two sugars. — Stage Mgmt"' },
      { id: 'termination', location: 'green', type: 'document', emoji: '✉️', name: 'Theo\'s Termination Letter', text: '"Effective immediately, due to safety concerns raised by Ms. Hale."\nScrawled across the bottom in angry biro: "She\'ll get what\'s coming."' },
      { id: 'log', location: 'stagedoor', type: 'document', emoji: '📒', name: 'Stage-Door Sign-In Log', text: 'M. Pell — IN 5:15 PM — (no sign-out)\nL. Ortiz — IN 5:30 PM — (no sign-out)\nT. Banks — IN 7:40 PM — OUT 9:31 PM\nG. Hale — IN 10:31 PM\nT. Banks — IN 10:50 PM ("forgot toolbox")\nGuard\'s note: "Nobody else came or went between 9:31 and 10:31."' },
      { id: 'camera', location: 'stagedoor', type: 'photo', emoji: '📹', name: 'Security Camera Stills', text: 'Camera faces the dressing-room corridor.\n10:08 PM — A figure in a long dark coat and a GREY WOOL SCARF walks toward Vivian\'s room, face turned away.\n10:11 PM — The same figure walks back out.\n10:50 PM — Theo Banks enters empty-handed; leaves 10:53 carrying a toolbox.' },
      { id: 'ledger', location: 'office', type: 'document', emoji: '📊', name: 'Theatre Accounts Ledger', text: 'Over two years, $214,000 paid to "M.P. Creative Holdings Ltd" for "consulting". No invoices attached.\nSomeone has circled every entry in red pen.' },
      { id: 'letter', location: 'office', type: 'document', emoji: '💌', name: 'Letter in the Desk Drawer', text: 'Handwritten by Vivian, dated yesterday, to the theatre\'s board:\n"I can no longer stay silent about where the money has gone. I have copies of the accounts. Unless Marcus resigns, I will go to the board — and the police — after opening night. — V.H."\nIt was never sent. Why is it in Marcus\'s desk?' },
      { id: 'scarf', location: 'office', type: 'object', emoji: '🧣', name: 'Grey Wool Scarf', text: 'Hanging on the office coat-rack beside a long dark coat. Tiny purple-flecked leaf fragments cling to the fringe.' },
      { id: 'photos', location: 'lobby', type: 'photo', emoji: '📸', name: 'Fan Photos', text: 'Social-media posts timestamped 10:02 PM to 10:35 PM show Lena Ortiz signing programmes in the lobby the whole time — never out of frame for more than a minute or two.' },
      { id: 'policy', location: 'lobby', type: 'document', emoji: '📄', name: 'Insurance Papers', text: 'Found in Gregory Hale\'s coat in the cloakroom: matching $500,000 life-insurance policies on Vivian and Gregory, taken out three years ago when they bought their house.' },
    ],
    weapons: [
      { id: 'foxglove', name: 'Foxglove leaves in her tea' },
      { id: 'chocolates', name: 'Poisoned chocolates' },
      { id: 'sandbag', name: 'A falling stage sandbag' },
      { id: 'pills', name: 'Sleeping pills in a drink' },
    ],
    motives: [
      { id: 'role', name: 'To take her starring role' },
      { id: 'insurance', name: 'To collect life insurance' },
      { id: 'money', name: 'To stop her exposing stolen money' },
      { id: 'revenge', name: 'Revenge for being fired' },
    ],
    solution: {
      culprit: 'marcus', weapon: 'foxglove', motive: 'money',
      explanation: 'Vivian had discovered that Marcus was siphoning theatre money into his own company, "M.P. Creative Holdings", and was going to the board after opening night. After his bow at 10:06, Marcus slipped backstage — caught on camera at 10:08 in his grey scarf. He stripped leaves from Gregory\'s foxglove bouquet, crushed them in his handkerchief and stirred them into the tea Lena had left at 10:00, then dumped the handkerchief in the green-room bin. Lena was in the lobby the whole time, Gregory only arrived at 10:31, and Theo had left at 9:31 and didn\'t return until after Vivian collapsed.',
    },
  },

  // ─────────────────────────────────────────── CASE 2
  {
    id: 'mapleworth',
    title: 'Storm at Mapleworth Manor',
    emoji: '🏰',
    difficulty: 'Detective',
    par: 12,
    tagline: 'The lights went out at 10:50. When they came back, Edmund Ashworth was dead.',
    intro: [
      'Mapleworth Manor, midnight. A fierce storm knocked out the power at 10:50 PM. When the lights flickered back on at 11:20, the butler found the reclusive art collector Edmund Ashworth dead on the library floor.',
      'He had invited guests for the weekend to celebrate his prize painting, "The Lady in Amber". Now one of them is a murderer. The roads are flooded — nobody is leaving.',
      'Find out WHO killed Edmund, WITH WHAT, and WHY — before the storm passes and the killer slips away.',
    ],
    victim: { name: 'Edmund Ashworth', desc: 'Art collector, 71. Wealthy, sharp-eyed and suspicious. Spent the evening alone in his library.' },
    suspects: [
      {
        id: 'clara', name: 'Clara Ashworth', role: 'Niece & Heir', emoji: '💃',
        bio: 'Edmund\'s only relative. Lives lavishly; rumoured to owe money to some very unpleasant people.',
        questions: [
          { id: 'c1', q: 'Where were you when the power went out?', a: 'In the kitchen with Mrs. Pratt, the cook, hunting for candles. We stayed there together until the lights came back.' },
          { id: 'c2', q: 'Do you inherit the estate?', a: 'Most of it, yes. I know how that looks. But Uncle Edmund was already paying my debts. Why would I kill the goose that lays the golden eggs?' },
          { id: 'c3', q: 'We found $80,000 of gambling IOUs in your room.', requires: ['ious'], a: 'Uncle promised to settle them on Monday — he told me at dinner. Ask Hollis, he was serving.' },
        ],
      },
      {
        id: 'moreau', name: 'Dr. Felix Moreau', role: 'Family Doctor', emoji: '🩺',
        bio: 'Edmund\'s physician and chess partner for twenty years. Recently borrowed a large sum from him.',
        questions: [
          { id: 'f1', q: 'Where were you during the blackout?', a: 'At the piano in the drawing room. I play when I\'m nervous, and storms make me very nervous. I didn\'t stop until the lights returned.' },
          { id: 'f2', q: 'Did you owe Edmund money?', a: 'Twenty thousand, for my clinic. He was in no hurry to have it back — we were friends.' },
          { id: 'f3', q: 'Edmund\'s blood contained a sedative.', a: 'A mild sleeping draught. I prescribed it myself — one spoon at ten every night. It wouldn\'t harm a mouse.' },
        ],
      },
      {
        id: 'hollis', name: 'Hollis', role: 'Butler', emoji: '🎩',
        bio: 'Has served the Ashworths for thirty years. Knows every key and every secret in the house.',
        questions: [
          { id: 'h1', q: 'Where were you during the blackout?', a: 'In the wine cellar, fetching port, when the lights failed. I waited down there in the dark. I could hear Dr. Moreau\'s piano through the floor the entire time.' },
          { id: 'h2', q: 'Did Edmund leave you anything?', a: 'A small pension, I believe. He raised my wages only last spring. He was a fair employer, whatever people say.' },
          { id: 'h3', q: 'Did anything odd happen today?', a: 'Mr. Ashworth spent a long while examining "The Lady in Amber" with his magnifying glass this afternoon. He was in a black mood afterwards and asked me to send Miss Lyle to the library at eleven.' },
          { id: 'h4', q: 'Where do the library\'s garden doors lead?', requires: ['footprints'], a: 'Out to the rose garden, and round to the guest-wing terrace. Nobody uses them in weather like this.' },
        ],
      },
      {
        id: 'beatrice', name: 'Beatrice Lyle', role: 'Art Appraiser', emoji: '🖼️',
        bio: 'Hired by Edmund to authenticate and insure his collection. Elegant, precise and very well paid.',
        questions: [
          { id: 'b1', q: 'Where were you during the blackout?', a: 'In my room in the guest wing, reading by candlelight. I never left it.' },
          { id: 'b2', q: 'Did Edmund ask to see you tonight?', a: 'No. Well — he mentioned discussing insurance values at some point. I assumed he meant tomorrow.' },
          { id: 'b3', q: 'Your shoes are soaked and covered in mud and rose petals.', requires: ['shoes'], a: 'I... stepped onto the terrace for some air. Before the storm got bad. Is that a crime now?' },
          { id: 'b4', q: '"The Lady in Amber" is a modern fake — and you certified it.', requires: ['painting', 'certificate'], a: '*Her composure cracks for a second.* Then I was fooled too. Forgers are very good these days. I want a lawyer.' },
        ],
      },
    ],
    locations: [
      { id: 'library', name: 'Library', emoji: '📚', desc: 'Where Edmund died. A fireplace, garden doors and rain lashing the windows.' },
      { id: 'gallery', name: 'Portrait Gallery', emoji: '🖼️', desc: 'A long hall where "The Lady in Amber" hangs under a velvet curtain.' },
      { id: 'guest', name: 'Guest Wing', emoji: '🛏️', desc: 'The bedrooms of Clara, Dr. Moreau and Beatrice Lyle.' },
      { id: 'kitchen', name: 'Kitchen', emoji: '🍳', desc: 'Warm and cluttered. Mrs. Pratt the cook is still up.' },
      { id: 'garden', name: 'Rose Garden', emoji: '🌹', desc: 'Between the library and the guest-wing terrace. Muddy and rain-soaked.' },
    ],
    evidence: [
      { id: 'coroner', location: 'file', type: 'report', emoji: '🩻', name: 'Coroner\'s Notes', text: 'Victim: Edmund Ashworth. Time of death: between 11:00 and 11:15 PM.\nCause: a single heavy blow to the back of the head with a blunt METAL object.\nFine black SOOT found in the wound.\nBlood shows a mild sedative at a normal medicinal dose.' },
      { id: 'statement', location: 'file', type: 'document', emoji: '📋', name: 'Butler\'s Statement', text: 'Power failed at 10:50 PM and returned at 11:20 PM.\nI found Mr. Ashworth on the library floor at 11:24 and raised the alarm.\nThe library door to the hall was locked from the inside. The garden doors were closed, but unlocked.' },
      { id: 'opener', location: 'library', type: 'object', emoji: '🗡️', name: 'Letter Opener on the Desk', text: 'An ornate silver letter opener with a red stain on the tip.\nLAB NOTE: The stain is red INK, not blood. An open bottle of red ink sits on the desk.' },
      { id: 'poker', location: 'library', type: 'object', emoji: '🔥', name: 'Hidden Fireplace Poker', text: 'Found stuffed behind the window curtains and wiped clean — but the hook end is caked in black soot. Its stand by the fireplace is empty.' },
      { id: 'footprints', location: 'library', type: 'photo', emoji: '👣', name: 'Muddy Footprints', text: 'A trail of small muddy footprints with a NARROW HEEL runs from the garden doors to the desk and back again. A crushed red rose petal lies in one print.' },
      { id: 'diary', location: 'library', type: 'document', emoji: '📔', name: 'Edmund\'s Diary', text: 'Today\'s entry: "Examined the Amber Lady under the glass. The cracks are wrong — painted, not aged. Someone sold me a forgery and pocketed two million. I will confront B.L. at eleven tonight. Then the police."' },
      { id: 'painting', location: 'gallery', type: 'object', emoji: '🖼️', name: '"The Lady in Amber"', text: 'Under a magnifying glass, the cracks in the paint look drawn on. A scratch in one corner shows bright titanium white — a pigment not invented until 1921.\nThe painting is supposed to date from 1650.' },
      { id: 'certificate', location: 'gallery', type: 'document', emoji: '📜', name: 'Certificate of Authenticity', text: 'Declares "The Lady in Amber" a genuine 1650 masterpiece.\nSigned: Beatrice Lyle, Lyle Fine Art Appraisals.\nSale price: $2,000,000 — paid through Lyle Fine Art.' },
      { id: 'ious', location: 'guest', type: 'document', emoji: '🃏', name: 'Gambling IOUs', text: 'In Clara\'s room: IOUs totalling $80,000 owed to a private card club.\nClipped to them, a note in Edmund\'s hand: "Paid in full Monday. Last time, Clara. — E."' },
      { id: 'shoes', location: 'guest', type: 'object', emoji: '👠', name: 'Wet Shoes', text: 'Shoved under the bed in Beatrice Lyle\'s room: narrow-heeled shoes, soaked through and caked in garden mud and red rose petals.' },
      { id: 'glove', location: 'guest', type: 'object', emoji: '🧤', name: 'Sooty Glove', text: 'In Beatrice\'s wastepaper basket: a single white evening glove, its palm smeared with black soot.' },
      { id: 'medbag', location: 'guest', type: 'object', emoji: '💼', name: 'Dr. Moreau\'s Medical Bag', text: 'Ordinary supplies and a bottle of sleeping draught labelled "E. Ashworth — 1 spoon at 10 PM".\nExactly one spoonful is missing since the last refill.' },
      { id: 'cook', location: 'kitchen', type: 'document', emoji: '👩‍🍳', name: 'Mrs. Pratt\'s Statement', text: '"Miss Clara came down the moment the lights went out and stayed with me the whole half hour. We found the candles, then sat and listened to the doctor\'s piano. Lovely, it was. He never stopped once."' },
      { id: 'trail', location: 'garden', type: 'photo', emoji: '🌹', name: 'Trail Through the Roses', text: 'Snapped rose stems and narrow heel prints lead from the library garden doors straight across to the guest-wing terrace — ending at the French window of Beatrice Lyle\'s room.' },
    ],
    weapons: [
      { id: 'poker', name: 'Fireplace poker' },
      { id: 'opener', name: 'Silver letter opener' },
      { id: 'sedative', name: 'Overdose of sleeping draught' },
      { id: 'bookend', name: 'Bronze bookend' },
    ],
    motives: [
      { id: 'inherit', name: 'To inherit the estate' },
      { id: 'loan', name: 'To escape repaying a loan' },
      { id: 'forgery', name: 'To hide an art forgery' },
      { id: 'grudge', name: 'An old servant\'s grudge' },
    ],
    solution: {
      culprit: 'beatrice', weapon: 'poker', motive: 'forgery',
      explanation: 'Edmund discovered that "The Lady in Amber" — certified by Beatrice Lyle and sold to him for $2 million — was a modern fake (titanium white paint and drawn-on cracks). He summoned her to the library at eleven. When the blackout hit, Beatrice slipped out of the guest wing, crossed the rose garden in the rain and entered through the garden doors. She struck Edmund with the fireplace poker, wiped it and hid it behind the curtains, then fled the same way — leaving narrow heel prints, rose petals on her shoes and soot on her glove. Clara was with the cook, Dr. Moreau was audibly playing piano throughout, and Hollis had no motive at all.',
    },
  },

  // ─────────────────────────────────────────── CASE 3
  {
    id: 'silver-comet',
    title: 'Midnight on the Silver Comet',
    emoji: '🚂',
    difficulty: 'Chief Inspector',
    par: 13,
    tagline: 'A locked compartment. A dead millionaire. A killer still on board.',
    intro: [
      'The Silver Comet overnight sleeper, somewhere in the mountains. At 6:15 AM the steward knocked on compartment 7 with morning coffee. No answer. Inside, investor Harold Crane lay dead in his berth.',
      'The door was bolted from the inside. There was no sign of a struggle. The train won\'t reach the next station for three hours — and the killer is still aboard.',
      'Work out WHO got into a locked room, HOW they killed him, and WHY.',
    ],
    victim: { name: 'Harold Crane', desc: 'Founder of Crane Capital, 55. A ruthless investor with plenty of enemies. Took a sleeping pill every night.' },
    suspects: [
      {
        id: 'sam', name: 'Sam Whitlock', role: 'Business Partner', emoji: '💼',
        bio: 'Co-founder of Crane Capital. Travelling in compartment 8 — right next door to Harold.',
        questions: [
          { id: 's1', q: 'When did you last see Harold?', a: 'About ten. We had a nightcap in the dining car, talked shop, then I turned in. Slept like a log until all the commotion this morning.' },
          { id: 's2', q: 'How was your partnership?', a: 'Rock solid. Twenty years. Harold was tough, but together we built something incredible.' },
          { id: 's3', q: 'Harold was about to report you to the financial regulators.', requires: ['email'], a: '*His jaw tightens.* A misunderstanding about some accounts. We\'d have sorted it out. Nobody kills over paperwork.' },
          { id: 's4', q: 'Your cufflink was under Harold\'s berth.', requires: ['cufflink'], a: 'I must have dropped it earlier, when we talked business in his compartment before dinner.' },
          { id: 's5', q: 'The connecting door between your compartment and Harold\'s was unbolted on both sides.', requires: ['door', 'door8'], a: 'Was it? I never even noticed there was a door. I certainly didn\'t use it.' },
          { id: 's6', q: 'Why was an insulin pen cap in your bin? You aren\'t diabetic.', requires: ['pencap'], a: '...I\'m not saying another word without my lawyer.' },
        ],
      },
      {
        id: 'nora', name: 'Nora Crane', role: 'Ex-Wife', emoji: '👗',
        bio: 'Divorced Harold two years ago after a bitter court battle. Has type 1 diabetes.',
        questions: [
          { id: 'n1', q: 'Why are you on this train?', a: 'Pure coincidence — or Harold\'s idea of a joke. I\'m visiting my sister. I nearly fainted when I saw him in the dining car.' },
          { id: 'n2', q: 'Where were you last night?', a: 'In the dining car until after two, chatting to the bartender. Then straight to bed in compartment 3, at the far end of the carriage.' },
          { id: 'n3', q: 'Is anything of yours missing?', a: 'Funny you should ask. One of my spare insulin pens has vanished from my handbag. I left the bag on my seat in the dining car for a few minutes last night.' },
          { id: 'n4', q: 'You still inherit Harold\'s shares.', requires: ['lawyer'], a: 'He never changed the paperwork after the divorce. Lazy man. I only found out when his lawyer wrote last month. ...I know how that sounds.' },
        ],
      },
      {
        id: 'iris', name: 'Iris Vance', role: 'Journalist', emoji: '📰',
        bio: 'Investigative reporter writing an explosive exposé on Crane Capital. Harold was suing her.',
        questions: [
          { id: 'i1', q: 'Why are you on this train?', a: 'Following a story. Harold\'s dirty deals. He\'s been suing me into the ground to keep me quiet.' },
          { id: 'i2', q: 'Where were you last night?', a: 'In compartment 5, writing. I stepped into the corridor around a quarter past one to ask the conductor for a blanket. Saw nothing unusual.' },
          { id: 'i3', q: 'Your notebook mentions "S.W." and stolen money.', requires: ['notebook'], a: 'My source says Harold had just discovered his partner was stealing from clients. Harold was going to turn him in to save his own skin. That was my story. Now it\'s a murder story.' },
        ],
      },
      {
        id: 'walter', name: 'Walter Gibbs', role: 'Conductor', emoji: '🧢',
        bio: 'Thirty years on the railway. Carries the only working master key to the compartments.',
        questions: [
          { id: 'w1', q: 'Who has keys to compartment 7?', a: 'The passenger and me. My master key stays on the chain on my belt — never leaves me. Mr. Crane bolted his door himself at 11:30; I heard it go as I passed.' },
          { id: 'w2', q: 'Did Harold cause you any trouble?', a: 'Complained about the coffee, the pillows and me. Said he\'d have me sacked. Passengers like him say that every trip.' },
          { id: 'w3', q: 'Did you notice anything on your rounds?', requires: ['logbook'], a: 'Rounds at midnight, two and four. Compartment 7 dark and quiet every time. The only thing out of the ordinary was Miss Vance wanting a blanket at quarter past one.' },
        ],
      },
    ],
    locations: [
      { id: 'comp7', name: 'Compartment 7', emoji: '🛏️', desc: 'Harold Crane\'s sleeper. Bolted from the inside — the steward had to force the door.' },
      { id: 'comp8', name: 'Compartment 8', emoji: '🧳', desc: 'Sam Whitlock\'s compartment, right next door.' },
      { id: 'dining', name: 'Dining Car', emoji: '🍸', desc: 'Leather booths, a long bar and a very tired bartender.' },
      { id: 'comp3', name: 'Compartment 3', emoji: '👜', desc: 'Nora Crane\'s compartment at the far end of the carriage.' },
      { id: 'cabin', name: 'Conductor\'s Cabin', emoji: '🗝️', desc: 'Walter Gibbs\'s tiny office with his logbook and the key cabinet.' },
    ],
    evidence: [
      { id: 'medex', location: 'file', type: 'report', emoji: '🩻', name: 'Medical Examiner\'s Report', text: 'Victim: Harold Crane. Time of death: between 12:30 and 2:00 AM.\nCause: dangerously low blood sugar caused by a MASSIVE DOSE OF INSULIN.\nA tiny needle puncture was found on the left side of the neck.\nThe victim was NOT diabetic.\nAlso present: one normal dose of his prescription sleeping pill.' },
      { id: 'steward', location: 'file', type: 'document', emoji: '📋', name: 'Steward\'s Statement', text: '"I knocked at 6:15. No answer. The door was bolted from the inside, so I forced it. Mr. Crane was in his berth. The window was shut and latched — it only opens a few inches anyway."' },
      { id: 'pills', location: 'comp7', type: 'object', emoji: '💊', name: 'Sleeping Pills', text: 'Prescription bottle in Harold\'s name: "1 tablet at bedtime." His pill organiser shows he took exactly one last night — his usual dose.' },
      { id: 'whiskey', location: 'comp7', type: 'object', emoji: '🥃', name: 'Whiskey Glass', text: 'A half-finished whiskey on the side table.\nLAB NOTE: Whiskey only. No drugs, no poison.' },
      { id: 'cufflink', location: 'comp7', type: 'object', emoji: '🔗', name: 'Silver Cufflink', text: 'Found under the berth: a silver cufflink engraved "SW".' },
      { id: 'door', location: 'comp7', type: 'photo', emoji: '🚪', name: 'Hidden Connecting Door', text: 'Behind a hanging coat, a narrow door connects compartment 7 to compartment 8. Each side has its own bolt; both must be open to pass through.\nThe bolt on Harold\'s side is drawn back — UNLOCKED.' },
      { id: 'email', location: 'comp7', type: 'document', emoji: '📧', name: 'Scheduled Email', text: 'On Harold\'s laptop, scheduled to send at 9:00 AM today to the Financial Conduct Authority:\n"I have evidence that my partner, Sam Whitlock, has diverted $40 million of client funds. I am prepared to cooperate fully."' },
      { id: 'pencap', location: 'comp8', type: 'object', emoji: '💉', name: 'Insulin Pen Cap', text: 'In the bin of compartment 8: an orange insulin-pen cap. A torn pharmacy label reads "...RA CRANE".' },
      { id: 'door8', location: 'comp8', type: 'photo', emoji: '🚪', name: 'Connecting Door (Sam\'s side)', text: 'The bolt on compartment 8\'s side of the connecting door is also drawn back. Anyone in compartment 8 could walk straight into compartment 7.' },
      { id: 'shirt', location: 'comp8', type: 'object', emoji: '👔', name: 'Dress Shirt', text: 'Sam\'s shirt from last night hangs on a hook. The right cuff is missing its cufflink. The left one is engraved "SW".' },
      { id: 'notebook', location: 'dining', type: 'document', emoji: '📓', name: 'Iris\'s Notebook', text: 'Left in a booth: "Source confirms — S.W. skimming client $$ for years. H.C. found out last week. H.C. plans to throw S.W. to the wolves to save himself. Confront H.C. on the train??"' },
      { id: 'tab', location: 'dining', type: 'document', emoji: '🧾', name: 'Bartender\'s Tab & Notes', text: '"N. Crane — 10:40 PM to 2:10 AM, four gin & tonics. Never left except a quick trip to the restroom about 11 — left her handbag on the booth."\n"Mr. Whitlock (comp 8) left the bar at 11:05 — walked right past her booth on his way out."' },
      { id: 'kit', location: 'comp3', type: 'object', emoji: '🩸', name: 'Nora\'s Insulin Kit', text: 'Her travel kit has slots for three insulin pens. One slot is empty. The remaining pens have orange caps and labels reading "NORA CRANE".' },
      { id: 'lawyer', location: 'comp3', type: 'document', emoji: '✉️', name: 'Letter from Harold\'s Lawyer', text: 'To Nora Crane, dated one month ago: "Please be advised that Mr. Crane\'s share certificates still name you as beneficiary."' },
      { id: 'logbook', location: 'cabin', type: 'document', emoji: '📒', name: 'Conductor\'s Logbook', text: '12:00 AM round — all quiet. Comp 7 locked, dark.\n1:15 AM — Comp 5 (I. Vance) asked for an extra blanket.\n2:00 AM round — all quiet.\n4:00 AM round — all quiet.\nMaster key: on W. Gibbs\'s chain all night.' },
      { id: 'cabinet', location: 'cabin', type: 'object', emoji: '🔐', name: 'Key Cabinet', text: 'The spare master key hangs in a sealed glass cabinet. The seal is unbroken and dated last week.' },
    ],
    weapons: [
      { id: 'insulin', name: 'Insulin injection' },
      { id: 'whiskey', name: 'Poisoned whiskey' },
      { id: 'pillow', name: 'Smothered with a pillow' },
      { id: 'pills', name: 'Sleeping-pill overdose' },
    ],
    motives: [
      { id: 'shares', name: 'To inherit his shares' },
      { id: 'fraud', name: 'To avoid being reported for fraud' },
      { id: 'lawsuit', name: 'To end a ruinous lawsuit' },
      { id: 'job', name: 'Anger over threats to sack him' },
    ],
    solution: {
      culprit: 'sam', weapon: 'insulin', motive: 'fraud',
      explanation: 'Harold had discovered that Sam Whitlock was stealing client money and scheduled an email to the regulators for 9 AM. At 11:05 PM Sam walked past Nora\'s unattended handbag in the dining car and took one of her insulin pens. After Harold took his usual sleeping pill and fell asleep, Sam slipped through the connecting door between compartments 8 and 7 — unbolted on both sides since their business chat that evening — and injected the insulin into Harold\'s neck. The corridor door stayed bolted, creating the "locked room". Sam lost his "SW" cufflink under the berth and threw the pen cap in his own bin. Nora never left the dining car until 2:10, the master keys were never used, and Iris only stepped into the corridor.',
    },
  },
];
