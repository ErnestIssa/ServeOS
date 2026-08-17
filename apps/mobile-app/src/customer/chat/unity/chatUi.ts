export type MessageDeliveryStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type ChatReplyPreview = {
  author: string;
  text: string;
};

export type ChatUiMessage = {
  id: string;
  authorKey: string;
  author: string;
  unit: string;
  text: string;
  sentAt: string;
  timeLabel: string;
  isOwn: boolean;
  status?: MessageDeliveryStatus;
  isAdmin?: boolean;
  replyPreview?: ChatReplyPreview;
  reaction?: string;
};

export type MessageRenderGroup = {
  id: string;
  messages: ChatUiMessage[];
  authorKey: string;
  author: string;
  unit: string;
  isOwn: boolean;
  showAvatar: boolean;
  showSenderName: boolean;
  dateLabel?: string;
};

const AVATAR_COLORS = ["#175F61", "#3B82C4", "#22A06B", "#8B5CF6", "#E5A100", "#D64545", "#0F766E"];

export function authorKey(author: string, unit: string): string {
  return `${author}-${unit}`;
}

export function avatarColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function avatarInitial(author: string): string {
  return (author.trim()[0] ?? "?").toUpperCase();
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return "Yesterday";
  }
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

const GROUP_WINDOW_MS = 3 * 60 * 1000;

export function groupMessages(messages: ChatUiMessage[], isGroupChat: boolean): MessageRenderGroup[] {
  const groups: MessageRenderGroup[] = [];
  let current: MessageRenderGroup | null = null;

  messages.forEach((msg, index) => {
    const prev = messages[index - 1];
    const dateLabel =
      !prev || !sameDay(prev.sentAt, msg.sentAt) ? formatDateLabel(msg.sentAt) : undefined;

    const withinWindow =
      prev &&
      authorKey(prev.author, prev.unit) === authorKey(msg.author, msg.unit) &&
      new Date(msg.sentAt).getTime() - new Date(prev.sentAt).getTime() < GROUP_WINDOW_MS;

    if (current && withinWindow && !dateLabel) {
      current.messages.push(msg);
    } else {
      current = {
        id: `g-${msg.id}`,
        messages: [msg],
        authorKey: authorKey(msg.author, msg.unit),
        author: msg.author,
        unit: msg.unit,
        isOwn: msg.isOwn,
        showAvatar: false,
        showSenderName: false,
        dateLabel
      };
      groups.push(current);
    }
  });

  groups.forEach((group, gi) => {
    const next = groups[gi + 1];
    const isLastInRun = !next || next.authorKey !== group.authorKey;
    group.showAvatar = isLastInRun;
    group.showSenderName =
      isGroupChat && !group.isOwn && (gi === 0 || groups[gi - 1].authorKey !== group.authorKey);
  });

  return groups;
}

export function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
