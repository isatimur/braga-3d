// The balcony coder's scripted replies (src/balcony-coder.js draws him and
// the chat panel). No server and no AI: a message is matched to an intent by
// keywords in every language, and a reply is picked from that intent's
// variants in the visitor's language, never the same line twice in a row.
// Pure logic, no DOM: scripts/balcony-coder.test.mjs runs it in Node.
//
// Style: the site's builder in his chat sessions with Claude Code. Terse,
// warm, often lowercase, a casual imperative now and then, Russian slipping
// into the other languages. No personal data: no names, places he lives,
// employer or contacts. He is an easter egg and says so.

export const LANGS = ['en', 'pt', 'ru'];

// normalise for matching: lower case, accents off (й -> и, ё -> е as well;
// the keywords go through the same function), apostrophes dropped
export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '');
}
const words = (s) => norm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// ---- language
const PT_WORDS = new Set(['ola', 'oi', 'bom', 'boa', 'dia', 'obrigado', 'obrigada', 'voce', 'tu', 'nao', 'sim', 'estas', 'esta', 'fazes', 'fazer', 'quem', 'onde', 'isto', 'isso', 'tudo', 'bem', 'adeus', 'tchau', 'ate', 'logo', 'fixe', 'muito', 'uma', 'um', 'que', 'como', 'para', 'com', 'és', 'es', 'teu', 'tua', 'seu', 'sua', 'porque', 'mapa', 'cidade', 'cafe', 'noite', 'tarde', 'valeu', 'pois', 'aqui', 'mas', 'meu', 'eu', 'o', 'os', 'as', 'do', 'da', 'dos', 'das', 'no', 'na', 'e']);
const EN_WORDS = new Set(['the', 'you', 'are', 'what', 'who', 'is', 'hi', 'hello', 'hey', 'how', 'doing', 'thanks', 'thank', 'bye', 'your', 'this', 'do', 'does', 'why', 'where', 'when', 'it', 'and', 'map', 'coffee', 'yo', 'my', 'me', 'im', 'its', 'whats', 'there', 'cool', 'nice', 'night', 'of', 'in', 'on', 'to', 'up', 'with', 'about']);
// letters only Portuguese uses among the three
const PT_MARKS = /[ãõçâêôàáéíóú]/gi;
const CYRILLIC = /[а-яё]/gi;
const LATIN = /[a-z]/gi;

// the language a message is written in, when it is clear; else `fallback`
// (the site's language). Cyrillic answers in Russian.
export function detectLanguage(text, fallback = 'en') {
  const s = String(text || '').toLowerCase();
  const cyr = (s.match(CYRILLIC) || []).length;
  const lat = (s.match(LATIN) || []).length;
  if (cyr > 0 && cyr >= lat) return 'ru';
  if (!lat) return fallback;
  let pt = 2 * (s.match(PT_MARKS) || []).length;
  let en = 0;
  for (const w of words(s)) {
    if (PT_WORDS.has(w)) pt++;
    if (EN_WORDS.has(w)) en++;
  }
  if (pt > en) return 'pt';
  if (en > pt) return 'en';
  return fallback;
}

// ---- intent
// keyword: a word ('bug'), a prefix ('bug*') or a phrase with a space
// ('bom jesus'). The first intent in this order with a hit wins, so a topic
// beats "thanks", and "thanks" beats "hi".
const KEYWORDS = {
  who: ['who', 'whoami', 'your name', 'quem', 'teu nome', 'seu nome', 'кто', 'как тебя', 'тебя зовут', 'звать'],
  bike: ['bike*', 'bicycle*', 'cycl*', 'scooter*', 'trotinet*', 'bicicleta*', 'велосип*', 'байк*', 'самокат*'],
  bugs: ['bug*', 'lag*', 'slow', 'stutter*', 'glitch*', 'broken', 'crash*', 'fps', 'freez*', 'jank*', 'lento', 'lenta', 'trava*', 'erro*', 'falha*', 'avaria*', 'баг*', 'лаг*', 'тормоз*', 'медлен*', 'глюк*', 'слома*', 'ошибк*', 'фриз*', 'дерга*', 'вылета*'],
  missions: ['mission*', 'quest*', 'errand*', 'game*', 'task*', 'missao', 'missoes', 'jogo*', 'tarefa*', 'мисси*', 'квест*', 'игр*', 'задани*'],
  layers: ['layer*', 'textur*', 'roof*', 'shadow*', 'flicker*', 'z fighting', 'camada*', 'textura*', 'telhad*', 'sombra*', 'слои', 'слой', 'слоя', 'слоев', 'слоями', 'текстур*', 'крыш*', 'тен', 'тени', 'тень', 'мерца*'],
  walk: ['walk*', 'play', 'wasd', 'andar', 'caminh*', 'passe*', 'a pe', 'пешком', 'гуля*', 'ходить', 'прогулк*'],
  chat: ['chat*', 'ai', 'gpt', 'claude', 'bot', 'bots', 'robot*', 'voice', 'human', 'real', 'conversa*', 'voz', 'robo', 'ia', 'humano', 'чат*', 'бот*', 'ии', 'голос*', 'живои', 'настоящ*', 'нейросет*', 'робот*'],
  doing: ['doing', 'working on', 'up to', 'code*', 'coding', 'program*', 'fazes', 'a fazer', 'fazendo', 'trabalh*', 'programa*', 'codigo', 'делаешь', 'занят', 'работаешь', 'пишешь', 'кодишь', 'код', 'кодер*', 'программ*'],
  porto: ['porto', 'oporto', 'gaia', 'douro', 'порту', 'опорто', 'дору'],
  braga: ['braga*', 'bom jesus', 'minho', 'брага', 'браге', 'браги', 'брагу', 'брагои', 'бом жезус', 'минью'],
  map: ['map*', '3d', 'three*', 'city', 'cities', 'building*', 'cidade*', 'mapa*', 'predio*', 'edificio*', 'карт*', 'город*', 'здани*'],
  coffee: ['coffee*', 'cafe*', 'food', 'eat*', 'lunch*', 'dinner*', 'hungry', 'beer*', 'nata*', 'galao', 'comida', 'comer', 'almoco', 'jantar', 'fome', 'cerveja*', 'кофе', 'еда', 'еду', 'поесть', 'обед*', 'ужин*', 'голод*', 'пив*', 'чаи', 'чай'],
  time: ['time', 'night', 'late', 'sleep*', 'tired', 'que horas', 'dormir', 'cansad*', 'sono', 'ночь*', 'ночью', 'поздно', 'спать', 'спишь', 'устал*', 'время', 'который час'],
  thanks: ['thanks', 'thank', 'thx', 'ty', 'cheers', 'obrigad*', 'valeu', 'спасибо', 'спс', 'благодар*', 'пасиб*'],
  bye: ['bye', 'goodbye', 'cya', 'see you', 'later', 'adeus', 'tchau', 'ate logo', 'ate ja', 'xau', 'пока', 'до свидания', 'бываи', 'удачи'],
  greeting: ['hi', 'hello', 'hey', 'yo', 'hiya', 'howdy', 'sup', 'ola', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'привет*', 'здравств*', 'здрасте', 'хаи', 'салют', 'добрыи', 'доброе', 'добрыи вечер', 'хеи'],
};
export const INTENTS = [...Object.keys(KEYWORDS), 'fallback'];

const COMPILED = Object.entries(KEYWORDS).map(([intent, list]) => {
  const exact = new Set(), prefix = [], phrase = [];
  for (const k of list) {
    const n = norm(k);
    if (n.includes(' ')) phrase.push(n);
    else if (n.endsWith('*')) prefix.push(n.slice(0, -1));
    else exact.add(n);
  }
  return { intent, exact, prefix, phrase };
});

export function intentOf(text) {
  const ws = words(text);
  if (!ws.length) return 'fallback';
  const joined = ` ${ws.join(' ')} `;
  for (const { intent, exact, prefix, phrase } of COMPILED) {
    if (ws.some((w) => exact.has(w) || prefix.some((p) => w.startsWith(p)))) return intent;
    if (phrase.some((p) => joined.includes(` ${p} `))) return intent;
  }
  return 'fallback';
}

// ---- replies: intent -> language -> variants. `open` greets the visitor
// when the panel opens.
export const REPLIES = {
  open: {
    en: ['oh, a visitor. say something', 'hey. pull up a chair. well, there is only one chair', 'hi. one sec, finishing a commit. go on'],
    pt: ['olha, uma visita. diz qualquer coisa', 'olá. puxa uma cadeira. bem, só há uma cadeira', 'oi. um segundo, estou a acabar um commit. diz'],
    ru: ['о, гости. пиши', 'привет. садись. а, стул один. ну стой тогда', 'секунду, коммит дописываю. давай, пиши'],
  },
  greeting: {
    en: ['hey!', 'hi. go on', 'oh hi. you found the balcony', 'hey. ask me anything. I will pretend to know'],
    pt: ['olá!', 'oi. diz lá', 'olá. encontraste a varanda', 'boas. pergunta o que quiseres, eu finjo que sei'],
    ru: ['привет!', 'хай. давай', 'о, нашёл балкон', 'привет. спрашивай, сделаю вид что знаю'],
  },
  who: {
    en: ['the one who builds this map. well, a scripted copy. the real one is fixing shadows somewhere', 'I build these city maps with Claude Code. you found the easter egg', 'a builder on a balcony. that is the whole bio'],
    pt: ['quem constrói este mapa. bem, uma cópia com falas escritas. o verdadeiro está algures a corrigir sombras', 'faço estes mapas de cidades com o Claude Code. encontraste o easter egg', 'um construtor numa varanda. é a biografia toda'],
    ru: ['тот, кто строит эту карту. ну, его заскриптованная копия. настоящий где-то тени чинит', 'делаю эти карты городов вместе с Claude Code. ты нашёл пасхалку', 'строитель на балконе. вся биография'],
  },
  doing: {
    en: ['fixing layers. there were layers sticking out everywhere', 'one more fix and I am done (not really)', 'telling Claude Code "давай делай не спрашивай". it works', 'porting a fix from Porto back to Braga'],
    pt: ['a corrigir camadas. havia camadas a sair por todo o lado', 'só mais uma correção e acabo (não acabo)', 'a dizer ao Claude Code "давай делай не спрашивай". funciona', 'a trazer uma correção do Porto de volta para Braga'],
    ru: ['чиню слои. торчали отовсюду', 'ещё один фикс и всё (нет)', 'говорю Claude Code: давай делай не спрашивай. работает', 'переношу фикс из Порту обратно в Брагу'],
  },
  braga: {
    en: ['Braga is the engine the other cities fork from. so it has to be right', '2000 years of city and I still cannot get one roof right', 'go see Bom Jesus. funicular up, stairs down'],
    pt: ['Braga é o motor de onde saem as outras cidades. por isso tem de estar certo', '2000 anos de cidade e ainda não acerto num telhado', 'vai ao Bom Jesus. sobe de funicular, desce a pé'],
    ru: ['Брага — движок, от которого форкаются остальные города. так что тут всё должно быть правильно', '2000 лет городу, а у меня одна крыша всё никак', 'сходи на Бом Жезус. наверх на фуникулёре, вниз пешком'],
  },
  porto: {
    en: ['Porto is the bigger fork. the bridges took a week', 'Porto has the hills, Braga has the churches. both have my bugs', 'а это также действует и на движок Порту? yes. everything goes both ways'],
    pt: ['o Porto é o fork maior. as pontes levaram uma semana', 'o Porto tem as colinas, Braga tem as igrejas. os dois têm os meus bugs', 'а это также действует и на движок Порту? sim. tudo vai nos dois sentidos'],
    ru: ['Порту — форк побольше. мосты заняли неделю', 'в Порту холмы, в Браге церкви. баги мои везде', 'а это также действует и на движок Порту? да. всё в обе стороны'],
  },
  bugs: {
    en: ['send me the steps. or wait — deploy tonight', 'a stutter every few seconds? yeah, someone is on it right now', 'not a bug, a texture with personality. ok, it is a bug', 'давай все поправим! where exactly?'],
    pt: ['manda-me os passos. ou espera — deploy hoje à noite', 'um soluço de poucos em poucos segundos? sim, alguém está a tratar disso agora', 'não é um bug, é uma textura com personalidade. pronto, é um bug', 'давай все поправим! onde exatamente?'],
    ru: ['пришли шаги. или подожди — вечером деплой', 'дёргается раз в пару секунд? да, уже чиним', 'это не баг, это текстура с характером. ладно, баг', 'давай все поправим! где именно?'],
  },
  bike: {
    en: ['there was lag on the bike but now it is smooth', 'e-scooters are on /play. press F next to one', 'bike lanes next. maybe. after the roofs'],
    pt: ['havia lag na bicicleta mas agora está suave', 'há trotinetes no /play. carrega F ao pé de uma', 'ciclovias a seguir. talvez. depois dos telhados'],
    ru: ['на велике был лаг, теперь плавно', 'самокаты на /play. жми F рядом', 'велодорожки следующие. может быть. после крыш'],
  },
  walk: {
    en: ['walk mode: WASD, shift to run, V for the view', 'go down and walk the street. I will be here', 'the walker used to fall through bridges. not anymore. mostly'],
    pt: ['modo a pé: WASD, shift para correr, V muda a vista', 'desce e anda pela rua. eu fico aqui', 'o caminhante caía das pontes. já não. quase nunca'],
    ru: ['пешком: WASD, shift — бегом, V — вид', 'спускайся, погуляй по улице. я тут посижу', 'раньше человечек проваливался сквозь мосты. теперь нет. почти'],
  },
  map: {
    en: ['one world unit is 4 metres. every building is a real footprint', 'plain three.js and vite. no framework', 'seventeen thousand buildings and each one has an opinion'],
    pt: ['uma unidade do mundo são 4 metros. cada prédio é uma planta real', 'three.js e vite, simples. sem framework', 'dezassete mil prédios e cada um tem a sua opinião'],
    ru: ['одна единица мира — 4 метра. каждый дом — реальный контур', 'чистый three.js и vite. без фреймворка', 'семнадцать тысяч зданий, и у каждого своё мнение'],
  },
  layers: {
    en: ['layers sticking out everywhere — fixing it', 'if a roof flickers, tell me where', 'z-fighting. my old friend'],
    pt: ['camadas a sair por todo o lado — a corrigir', 'se um telhado piscar, diz-me onde', 'z-fighting. velho amigo'],
    ru: ['слои торчат отовсюду — чиню', 'если крыша мерцает, скажи где', 'z-fighting. старый друг'],
  },
  missions: {
    en: ['people by Porta Nova have errands for you. go help them', 'missions are on /play. look for the beam over a head', 'finish one, then come back and brag'],
    pt: ['há pessoas junto à Porta Nova com recados para ti. vai ajudar', 'as missões estão no /play. procura o feixe por cima de uma cabeça', 'acaba uma e volta cá para te gabares'],
    ru: ['у людей у Порта-Нова есть поручения. сходи помоги', 'миссии на /play. ищи луч над головой', 'пройди одну и возвращайся хвастаться'],
  },
  chat: {
    en: ['no AI here. just lines I wrote ahead of time', 'voice? maybe later. for now type and I will pretend', 'this chat has no server. it all runs in your browser'],
    pt: ['aqui não há IA. só falas que escrevi antes', 'voz? talvez mais tarde. por agora escreve e eu finjo', 'este chat não tem servidor. corre tudo no teu browser'],
    ru: ['тут нет ИИ. только заранее написанные реплики', 'голос? может потом. пока пиши, а я буду делать вид', 'у этого чата нет сервера. всё крутится у тебя в браузере'],
  },
  coffee: {
    en: ['third coffee. do not tell anyone', 'a galão and a pastel de nata. that is the fuel', 'lunch after this commit. (I said that two hours ago)'],
    pt: ['terceiro café. não contes a ninguém', 'um galão e um pastel de nata. é o combustível', 'almoço depois deste commit. (disse isso há duas horas)'],
    ru: ['третий кофе. никому не говори', 'галан и паштел-де-ната. вот и всё топливо', 'пообедаю после этого коммита. (говорил это два часа назад)'],
  },
  time: {
    en: ['it is always deploy o clock here', 'night is best. fewer pings, more commits', 'I sit here day and night. easter egg duty'],
    pt: ['aqui é sempre hora de deploy', 'a noite é melhor. menos mensagens, mais commits', 'fico aqui dia e noite. dever de easter egg'],
    ru: ['тут всегда время деплоя', 'ночью лучше всего. меньше пингов, больше коммитов', 'сижу тут днём и ночью. служба пасхалки'],
  },
  thanks: {
    en: ['anytime!', 'thanks for walking around the city', 'glad you like it. tell a friend'],
    pt: ['sempre!', 'obrigado por passeares pela cidade', 'ainda bem que gostas. conta a um amigo'],
    ru: ['всегда пожалуйста!', 'спасибо, что гуляешь по городу', 'рад, что нравится. расскажи другу'],
  },
  bye: {
    en: ['bye! watch the cars', 'see you. I will be on this balcony', 'go on, explore. I will keep fixing'],
    pt: ['adeus! cuidado com os carros', 'até já. estou nesta varanda', 'vai, explora. eu continuo a corrigir'],
    ru: ['пока! осторожно, машины', 'до встречи. я на этом балконе', 'давай, гуляй. я дальше чинить'],
  },
  fallback: {
    en: ['hm. did not get that. ask me about the map, bugs or coffee', 'go on', 'not sure. try: what are you doing?', 'а это также действует и на движок города? ...sorry, that was for Claude. what did you say?'],
    pt: ['hm. não percebi. pergunta-me pelo mapa, bugs ou café', 'continua', 'não sei bem. tenta: o que estás a fazer?', 'а это также действует и на движок города? ...desculpa, era para o Claude. o que disseste?'],
    ru: ['хм. не понял. спроси про карту, баги или кофе', 'давай дальше', 'не уверен. попробуй: что делаешь?', 'а это также действует и на движок города? ...а, это я Claude спрашивал. что ты сказал?'],
  },
};

// A replier for one panel: reply(text) -> { lang, intent, text }. siteLang:
// the language when the message does not show one; random: () => [0, 1).
export function createReplier({ siteLang = 'en', random = Math.random } = {}) {
  const base = LANGS.includes(siteLang) ? siteLang : 'en';
  const last = new Map(); // `${intent}:${lang}` -> last variant index
  let lastText = '';
  function pick(intent, lang) {
    const list = REPLIES[intent][lang];
    const key = `${intent}:${lang}`;
    let i = Math.floor(random() * list.length) % list.length;
    if (list.length > 1 && (i === last.get(key) || list[i] === lastText)) i = (i + 1 + Math.floor(random() * (list.length - 1))) % list.length;
    if (list.length > 1 && list[i] === lastText) i = (i + 1) % list.length;
    last.set(key, i);
    lastText = list[i];
    return list[i];
  }
  let lang = base;
  return {
    get lang() {
      return lang;
    },
    open() {
      return { lang, intent: 'open', text: pick('open', lang) };
    },
    reply(text) {
      lang = detectLanguage(text, lang);
      const intent = intentOf(text);
      return { lang, intent, text: pick(intent, lang) };
    },
  };
}
