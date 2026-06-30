import {
  SERVEOS_SUPPORT_FAQS,
  SERVEOS_SUPPORT_FALLBACK,
  SERVEOS_SUPPORT_TOPICS,
  type ServeosSupportEntry
} from "./knowledge.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "so",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "to",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "need",
  "want",
  "like",
  "get",
  "got",
  "me",
  "my",
  "i",
  "we",
  "you",
  "your",
  "it",
  "its",
  "this",
  "that",
  "what",
  "how",
  "when",
  "where",
  "why",
  "who",
  "which",
  "please",
  "thanks",
  "thank",
  "hey",
  "hi",
  "hello",
  "just",
  "also",
  "about",
  "any",
  "all",
  "some",
  "very",
  "really",
  "much",
  "many",
  "more",
  "most",
  "other",
  "than",
  "too",
  "up",
  "out",
  "over",
  "under",
  "again",
  "still",
  "already",
  "know",
  "tell",
  "say",
  "ask",
  "help",
  "using",
  "use",
  "work",
  "works",
  "working"
]);

function normalize(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^\w\s'?-]/g, " ")
    .replace(/\s+/g, " ");
}

function tokenize(text: string) {
  return normalize(text)
    .split(" ")
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function scoreEntry(text: string, tokens: string[], entry: ServeosSupportEntry) {
  let score = 0;

  for (const phrase of entry.phrases ?? []) {
    const normalizedPhrase = normalize(phrase);
    if (text.includes(normalizedPhrase)) {
      score += normalizedPhrase.split(" ").length * 4;
    }
  }

  for (const keyword of entry.keywords) {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) continue;

    if (text.includes(normalizedKeyword)) {
      score += normalizedKeyword.split(" ").length * 2;
      continue;
    }

    const keywordTokens = tokenize(normalizedKeyword);
    if (keywordTokens.length > 1) {
      const allPresent = keywordTokens.every((part) => tokens.includes(part));
      if (allPresent) score += keywordTokens.length * 1.5;
    }
  }

  const entryTokens = new Set(tokenize(entry.keywords.join(" ") + " " + (entry.phrases?.join(" ") ?? "")));
  for (const token of tokens) {
    if (entryTokens.has(token)) score += 1;
  }

  return score;
}

function rankEntries(text: string, tokens: string[], entries: ServeosSupportEntry[]) {
  return entries
    .map((entry) => ({ entry, score: scoreEntry(text, tokens, entry) }))
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score);
}

function pickBestReply(text: string, tokens: string[], entries: ServeosSupportEntry[]) {
  const ranked = rankEntries(text, tokens, entries);
  if (ranked.length === 0) return null;

  const [top, second] = ranked;
  if (second && second.score >= top.score * 0.75 && top.entry.id !== second.entry.id) {
    return `${top.entry.reply}\n\nAlso relevant: ${second.entry.reply}`;
  }

  return top.entry.reply;
}

/** Local rule-based reply for the support modal — no network calls. */
export function getServeosSupportReply(input: string): string {
  const text = normalize(input);
  if (!text) return SERVEOS_SUPPORT_FALLBACK;

  const tokens = tokenize(text);

  if (matchesAny(text, [/^(hi|hey|hello|howdy|yo)\b/, /\bgood (morning|afternoon|evening)\b/])) {
    return "Hi — ask me anything about ServeOS: setup, menus, orders, reservations, payments, staff, or trials.";
  }

  if (matchesAny(text, [/\b(thanks|thank you|thx|appreciate it|cheers)\b/])) {
    return "You're welcome. Anything else about the platform I can help with?";
  }

  if (matchesAny(text, [/\b(bye|goodbye|see you|talk later|catch you later)\b/])) {
    return "Happy to help anytime. The team can also jump in from this chat if you need a person.";
  }

  if (
    matchesAny(text, [
      /^what (is|are) serveos/,
      /^tell me about serveos/,
      /^explain serveos/,
      /\bwhat does serveos (do|offer)\b/,
      /\boverview of serveos\b/
    ])
  ) {
    const overview = pickBestReply(text, tokens, SERVEOS_SUPPORT_TOPICS.filter((e) => e.id === "overview"));
    if (overview) return overview;
  }

  const allEntries = [...SERVEOS_SUPPORT_FAQS, ...SERVEOS_SUPPORT_TOPICS];
  const rankedAll = rankEntries(text, tokens, allEntries);
  const rankedFaqs = rankEntries(text, tokens, SERVEOS_SUPPORT_FAQS);
  const rankedTopics = rankEntries(text, tokens, SERVEOS_SUPPORT_TOPICS);

  const faqScore = rankedFaqs[0]?.score ?? 0;
  const topicScore = rankedTopics[0]?.score ?? 0;

  if (faqScore >= topicScore && rankedFaqs[0]) {
    return pickBestReply(text, tokens, SERVEOS_SUPPORT_FAQS) ?? rankedFaqs[0].entry.reply;
  }
  if (rankedTopics[0]) {
    return pickBestReply(text, tokens, SERVEOS_SUPPORT_TOPICS) ?? rankedTopics[0].entry.reply;
  }

  if (rankedAll[0]) {
    return pickBestReply(text, tokens, allEntries) ?? rankedAll[0].entry.reply;
  }

  if (matchesAny(text, [/\b(help|support|stuck|issue|problem|broken|bug|error)\b/])) {
    return "Describe what you're trying to do in ServeOS — which app (admin, mobile, or customer QR) and what step failed. I'll walk you through it.";
  }

  return SERVEOS_SUPPORT_FALLBACK;
}
