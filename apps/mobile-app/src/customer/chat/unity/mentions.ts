export type MentionableUser = {
  id: string;
  name: string;
  unit: string;
  handle: string;
  source: string;
};

export type ActiveMentionQuery = {
  query: string;
  start: number;
  end: number;
};

const MENTION_RE = /@([a-zA-Z0-9_]+)/g;

function handleFromName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

/** Venue chat mentionables — venue + common staff handles (UI only). */
export function getMentionableUsers(venueName: string): MentionableUser[] {
  const venue = venueName.trim() || "Venue";
  const extras = [
    { name: venue, unit: "Venue", source: "Chat" },
    { name: "Staff", unit: "Venue", source: "Chat" },
    { name: "Kitchen", unit: "Venue", source: "Chat" },
    { name: "Host", unit: "Venue", source: "Chat" }
  ];
  const map = new Map<string, MentionableUser>();
  for (const u of extras) {
    const handle = handleFromName(u.name);
    if (!handle || map.has(handle)) continue;
    map.set(handle, {
      id: `${handle}-${u.unit}`,
      name: u.name,
      unit: u.unit,
      handle,
      source: u.source
    });
  }
  return Array.from(map.values());
}

export function filterMentionableUsers(venueName: string, query: string): MentionableUser[] {
  const q = query.trim().toLowerCase();
  const all = getMentionableUsers(venueName);
  if (!q) return all.slice(0, 8);
  return all
    .filter(
      (u) =>
        u.handle.startsWith(q) ||
        u.name.toLowerCase().includes(q) ||
        u.unit.toLowerCase().includes(q)
    )
    .slice(0, 8);
}

export function findMentionableByHandle(venueName: string, handle: string): MentionableUser | undefined {
  return getMentionableUsers(venueName).find((u) => u.handle === handleFromName(handle));
}

export function getActiveMentionQuery(text: string, cursor: number = text.length): ActiveMentionQuery | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  const afterAt = before.slice(at + 1);
  if (/\s/.test(afterAt)) return null;
  return { query: afterAt, start: at, end: cursor };
}

export function insertMention(text: string, start: number, end: number, name: string): string {
  const mention = `@${name.replace(/\s+/g, "")} `;
  return text.slice(0, start) + mention + text.slice(end);
}

export function splitMentionText(
  text: string,
  venueName: string
): { text: string; mention: boolean }[] {
  const parts: { text: string; mention: boolean }[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ text: text.slice(last, match.index), mention: false });
    }
    const user = findMentionableByHandle(venueName, match[1]);
    parts.push({ text: match[0], mention: Boolean(user) });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mention: false });
  return parts.length ? parts : [{ text, mention: false }];
}
