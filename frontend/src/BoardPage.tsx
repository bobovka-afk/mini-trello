import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { AlertModal } from './AlertModal';
import { api, API_URL, type ApiError } from './lib/api';
import type { BoardRow } from './WorkspaceBoardsPage';
import { canManageWorkspace } from './lib/roles';
import { LIST_COLOR_PRESET_KEYS, listHeaderColor } from './lib/trelloColors';

type ListRow = {
  id: number;
  boardId: number;
  name: string;
  position: number;
  colorPreset: string;
  createdAt: string;
  updatedAt: string;
};

export type CardRow = {
  id: number;
  listId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  position: number;
  assigneeId: number | null;
  isCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  accessToken: string | null;
  workspaceId: number;
  boardId: number;
  currentUserId: number | null;
};

export type CommentRow = {
  id: number;
  cardId: number;
  userId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  user: { id: number; name: string; avatarPath?: string | null };
};

type WorkspaceMemberApiRow = {
  userId: number;
  user: { id: number; name: string; avatarPath?: string | null };
};

function navigate(to: string) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function formatError(e: unknown) {
  const err = e as Partial<ApiError>;
  if (typeof err?.message === 'string') return err.message;
  return 'Ошибка запроса';
}

function nextListPosition(rows: ListRow[]): number {
  if (rows.length === 0) return 0;
  return rows.reduce((max, row) => (row.position > max ? row.position : max), rows[0].position) + 1;
}

function nextCardPosition(cards: CardRow[]): number {
  if (cards.length === 0) return 0;
  return cards.reduce((max, c) => (c.position > max ? c.position : max), cards[0].position) + 1;
}

function dueDateToInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inputValueToIsoOrNull(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Как на странице участников: «28 марта 2026 12:41» без «г.» и сокращений месяца */
function formatCardLogWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const months = [
      'января',
      'февраля',
      'марта',
      'апреля',
      'мая',
      'июня',
      'июля',
      'августа',
      'сентября',
      'октября',
      'ноября',
      'декабря',
    ];
    const day = d.getDate();
    const mon = months[d.getMonth()] ?? '';
    const y = d.getFullYear();
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${mon} ${y} ${h}:${min}`;
  } catch {
    return '—';
  }
}

function avatarSrcFromPath(p: string | null | undefined): string {
  if (!p) return '';
  const normalized = p.replace(/\\/g, '/');
  if (normalized.startsWith('data:')) return normalized;
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;
  if (normalized.startsWith('//')) {
    const proto = API_URL.startsWith('https://') ? 'https:' : 'http:';
    return `${proto}${normalized}`;
  }
  if (normalized.startsWith('/')) return `${API_URL}${normalized}`;
  return `${API_URL}/${normalized}`;
}

/** Относительное время для комментариев (Intl, ru). */
function formatCommentRelativeAgo(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffSec = Math.floor((nowMs - then) / 1000);
  if (diffSec < 45) return 'только что';
  const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'always' });
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hours = Math.floor(mins / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');
  const weeks = Math.floor(days / 7);
  if (days < 30) return rtf.format(-weeks, 'week');
  const months = Math.floor(days / 30);
  if (days < 365) return rtf.format(-months, 'month');
  const years = Math.floor(days / 365);
  return rtf.format(-years, 'year');
}

function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  const n = name.trim();
  return n.slice(0, 2).toUpperCase() || '?';
}

function CommentAvatarBubble({
  name,
  avatarPath,
}: {
  name: string;
  avatarPath?: string | null;
}) {
  const [broken, setBroken] = useState(false);
  const src = avatarSrcFromPath(avatarPath);
  return (
    <div className="trello-card-comment-avatar">
      {src && !broken ? (
        <img
          src={src}
          alt=""
          className="trello-card-comment-avatar-img"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="trello-card-comment-avatar-fallback" aria-hidden>
          {avatarInitials(name)}
        </span>
      )}
    </div>
  );
}

export function BoardPage({
  accessToken,
  workspaceId,
  boardId,
  currentUserId,
}: Props) {
  const [board, setBoard] = useState<BoardRow | null>(null);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [cardsByListId, setCardsByListId] = useState<Record<number, CardRow[]>>({});
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertText, setAlertText] = useState('');

  const [addListOpen, setAddListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  const [editList, setEditList] = useState<ListRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<string>('GRAY');
  const [editBusy, setEditBusy] = useState(false);
  const [activeListMenuId, setActiveListMenuId] = useState<number | null>(null);
  const [deleteListId, setDeleteListId] = useState<number | null>(null);
  const [listPendingDelete, setListPendingDelete] = useState<ListRow | null>(null);

  const [moveBusy, setMoveBusy] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<
    { userId: number; user: { id: number; name: string } }[]
  >([]);

  const [createCardListId, setCreateCardListId] = useState<number | null>(null);
  const [createCardTitle, setCreateCardTitle] = useState('');
  const [createCardDesc, setCreateCardDesc] = useState('');
  const [createCardBusy, setCreateCardBusy] = useState(false);

  const [editCard, setEditCard] = useState<CardRow | null>(null);
  const [editCardTitle, setEditCardTitle] = useState('');
  const [editCardDesc, setEditCardDesc] = useState('');
  const [editCardDue, setEditCardDue] = useState('');
  const [editCardAssigneeId, setEditCardAssigneeId] = useState<number | null>(null);
  const [editCardBusy, setEditCardBusy] = useState(false);

  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitBusy, setCommentSubmitBusy] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentDraft, setEditCommentDraft] = useState('');
  const [commentEditBusy, setCommentEditBusy] = useState(false);
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<CommentRow | null>(null);
  const [deleteCommentBusy, setDeleteCommentBusy] = useState(false);

  const [deleteCardRow, setDeleteCardRow] = useState<CardRow | null>(null);
  const [deleteCardBusy, setDeleteCardBusy] = useState(false);
  const [completionBusyId, setCompletionBusyId] = useState<number | null>(null);

  const [cardTitleEditing, setCardTitleEditing] = useState(false);
  const cardTitleInputRef = useRef<HTMLInputElement>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const listNameForCard = useMemo(() => {
    if (!editCard) return '';
    return lists.find((l) => l.id === editCard.listId)?.name ?? 'Колонка';
  }, [editCard, lists]);

  const load = useCallback(async () => {
    if (!accessToken) {
      setBoard(null);
      setLists([]);
      setMyRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const [b, ls, summary] = await Promise.all([
        api<BoardRow>(`/board/workspace/${workspaceId}/boards/${boardId}`, {
          method: 'GET',
          accessToken,
        }),
        api<ListRow[]>(
          `/list/workspace/${workspaceId}/board/${boardId}/lists`,
          { method: 'GET', accessToken },
        ),
        api<{ myRole: string | null }>(
          `/workspace/${workspaceId}/summary`,
          { method: 'GET', accessToken },
        ),
      ]);
      setBoard(b);
      setLists(Array.isArray(ls) ? ls : []);
      setMyRole(summary.myRole ?? null);
    } catch (e) {
      setMsg(formatError(e));
      setBoard(null);
      setLists([]);
      setMyRole(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, workspaceId, boardId]);

  const loadCards = useCallback(async () => {
    if (!accessToken || lists.length === 0) {
      setCardsByListId({});
      return;
    }
    try {
      const entries = await Promise.all(
        lists.map(async (list) => {
          const raw = await api<CardRow[]>(
            `/card/workspace/${workspaceId}/lists/${list.id}/cards`,
            { method: 'GET', accessToken },
          );
          return [list.id, Array.isArray(raw) ? raw : []] as const;
        }),
      );
      setCardsByListId(Object.fromEntries(entries));
    } catch {
      setCardsByListId({});
    }
  }, [accessToken, workspaceId, lists]);

  const loadComments = useCallback(
    async (cardId: number) => {
      if (!accessToken) {
        setComments([]);
        return;
      }
      setCommentsLoading(true);
      try {
        const raw = await api<CommentRow[]>(
          `/comment/workspace/${workspaceId}/cards/${cardId}/comments`,
          { method: 'GET', accessToken },
        );
        setComments(Array.isArray(raw) ? raw : []);
      } catch {
        setComments([]);
      } finally {
        setCommentsLoading(false);
      }
    },
    [accessToken, workspaceId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  useEffect(() => {
    setEditingCommentId(null);
    setEditCommentDraft('');
    setCommentDraft('');
    setDeleteCommentTarget(null);
    setCardTitleEditing(false);
    if (!editCard) {
      setComments([]);
      return;
    }
    void loadComments(editCard.id);
  }, [editCard, loadComments]);

  useEffect(() => {
    if (!editCard) return;
    setNowTick(Date.now());
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [editCard?.id]);

  useEffect(() => {
    if (!cardTitleEditing) return;
    cardTitleInputRef.current?.focus();
  }, [cardTitleEditing]);

  useEffect(() => {
    if (!accessToken) {
      setWorkspaceMembers([]);
      return;
    }
    void (async () => {
      try {
        const raw = await api<WorkspaceMemberApiRow[]>(
          `/workspace/${workspaceId}/members?limit=100&offset=0`,
          { method: 'GET', accessToken },
        );
        const rows = Array.isArray(raw) ? raw : [];
        setWorkspaceMembers(
          rows.map((r) => ({
            userId: r.userId,
            user: { id: r.user.id, name: r.user.name },
          })),
        );
      } catch {
        setWorkspaceMembers([]);
      }
    })();
  }, [accessToken, workspaceId]);

  async function handleDragEnd(result: DropResult) {
    if (!accessToken || moveBusy) return;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const cardId = Number(draggableId);
    const sourceListId = Number(source.droppableId);
    const destListId = Number(destination.droppableId);
    const toIndex = destination.index;

    setMoveBusy(true);
    setCardsByListId((prev) => {
      const next: Record<number, CardRow[]> = { ...prev };
      const src = [...(next[sourceListId] ?? [])];
      const fromIdx = src.findIndex((c) => c.id === cardId);
      if (fromIdx < 0) return prev;
      const [removed] = src.splice(fromIdx, 1);
      if (!removed) return prev;

      if (sourceListId === destListId) {
        src.splice(toIndex, 0, removed);
        next[sourceListId] = src;
      } else {
        next[sourceListId] = src;
        const dest = [...(next[destListId] ?? [])];
        dest.splice(toIndex, 0, { ...removed, listId: destListId });
        next[destListId] = dest;
      }
      return next;
    });

    try {
      await api(`/card/workspace/${workspaceId}/cards/${cardId}/move`, {
        method: 'PATCH',
        accessToken,
        json: { toListId: destListId, position: toIndex },
      });
      await loadCards();
    } catch (e) {
      setAlertText(formatError(e));
      setAlertOpen(true);
      await loadCards();
    } finally {
      setMoveBusy(false);
    }
  }

  async function submitAddList() {
    if (!accessToken) return;
    const name = newListName.trim();
    if (name.length < 3) return;
    const position = nextListPosition(lists);
    setAddBusy(true);
    setMsg(null);
    try {
      await api(`/list/workspace/${workspaceId}/board/${boardId}/lists`, {
        method: 'POST',
        accessToken,
        json: { name, position },
      });
      setNewListName('');
      setAddListOpen(false);
      await load();
    } catch (e) {
      setAlertText(formatError(e));
      setAlertOpen(true);
    } finally {
      setAddBusy(false);
    }
  }

  function openEditList(list: ListRow) {
    setEditList(list);
    setEditName(list.name);
    setEditColor(list.colorPreset || 'GRAY');
    setMsg(null);
  }

  async function confirmDeleteList() {
    if (!accessToken || !listPendingDelete) return;
    const list = listPendingDelete;
    setDeleteListId(list.id);
    setMsg(null);
    try {
      await api(`/list/workspace/${workspaceId}/lists/${list.id}`, {
        method: 'DELETE',
        accessToken,
      });
      if (editList?.id === list.id) {
        setEditList(null);
      }
      setActiveListMenuId(null);
      setListPendingDelete(null);
      await load();
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setDeleteListId(null);
    }
  }

  async function submitEditList() {
    if (!accessToken || !editList) return;
    const name = editName.trim();
    if (name.length < 3) return;
    setEditBusy(true);
    setMsg(null);
    try {
      await api(`/list/workspace/${workspaceId}/lists/${editList.id}`, {
        method: 'PATCH',
        accessToken,
        json: {
          name,
          colorPreset: editColor,
        },
      });
      setEditList(null);
      await load();
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setEditBusy(false);
    }
  }

  function openCreateCard(listId: number) {
    setCreateCardListId(listId);
    setCreateCardTitle('');
    setCreateCardDesc('');
  }

  async function submitCreateCard() {
    if (!accessToken || createCardListId == null) return;
    const title = createCardTitle.trim();
    if (title.length < 3) return;
    const listCards = cardsByListId[createCardListId] ?? [];
    const position = nextCardPosition(listCards);
    setCreateCardBusy(true);
    try {
      const body: { title: string; position: number; description?: string } = {
        title,
        position,
      };
      const d = createCardDesc.trim();
      if (d.length > 0) body.description = d;
      await api(`/card/workspace/${workspaceId}/lists/${createCardListId}/cards`, {
        method: 'POST',
        accessToken,
        json: body,
      });
      setCreateCardListId(null);
      await loadCards();
    } catch (e) {
      setAlertText(formatError(e));
      setAlertOpen(true);
    } finally {
      setCreateCardBusy(false);
    }
  }

  function openCardDetail(card: CardRow) {
    setEditCard(card);
    setEditCardTitle(card.title);
    setEditCardDesc(card.description ?? '');
    setEditCardDue(dueDateToInputValue(card.dueDate));
    setEditCardAssigneeId(card.assigneeId);
    setCardTitleEditing(false);
  }

  async function saveCardTitleInline() {
    if (!accessToken || !editCard) return;
    const title = editCardTitle.trim();
    if (title.length < 3) {
      setAlertText('Название: не менее 3 символов.');
      setAlertOpen(true);
      return;
    }
    if (title === editCard.title) {
      setCardTitleEditing(false);
      return;
    }
    setEditCardBusy(true);
    try {
      await api(`/card/workspace/${workspaceId}/cards/${editCard.id}`, {
        method: 'PATCH',
        accessToken,
        json: { title },
      });
      const next = { ...editCard, title };
      setEditCard(next);
      setCardTitleEditing(false);
      await loadCards();
    } catch (e) {
      setAlertText(formatError(e));
      setAlertOpen(true);
    } finally {
      setEditCardBusy(false);
    }
  }

  function cancelCardTitleEdit() {
    if (!editCard) return;
    setEditCardTitle(editCard.title);
    setCardTitleEditing(false);
  }

  const toggleCardCompletion = useCallback(
    async (card: CardRow, e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!accessToken || completionBusyId === card.id) return;
      const next = !Boolean(card.isCompleted);
      setCompletionBusyId(card.id);
      setCardsByListId((prev) => {
        const listCards = prev[card.listId] ?? [];
        return {
          ...prev,
          [card.listId]: listCards.map((c) =>
            c.id === card.id ? { ...c, isCompleted: next } : c,
          ),
        };
      });
      try {
        await api(`/card/workspace/${workspaceId}/cards/${card.id}/completion`, {
          method: 'PATCH',
          accessToken,
          json: { isCompleted: next },
        });
      } catch (err) {
        setCardsByListId((prev) => {
          const listCards = prev[card.listId] ?? [];
          return {
            ...prev,
            [card.listId]: listCards.map((c) =>
              c.id === card.id ? { ...c, isCompleted: !next } : c,
            ),
          };
        });
        setAlertText(formatError(err));
        setAlertOpen(true);
      } finally {
        setCompletionBusyId(null);
      }
    },
    [accessToken, completionBusyId, workspaceId],
  );

  async function submitEditCard() {
    if (!accessToken || !editCard) return;
    const title = editCardTitle.trim();
    if (title.length < 3) return;
    setEditCardBusy(true);
    try {
      const dueIso = inputValueToIsoOrNull(editCardDue);
      await api(`/card/workspace/${workspaceId}/cards/${editCard.id}`, {
        method: 'PATCH',
        accessToken,
        json: {
          title,
          description: editCardDesc.trim() || null,
          dueDate: dueIso,
          assigneeId: editCardAssigneeId,
        },
      });
      setEditCard(null);
      await loadCards();
    } catch (e) {
      setAlertText(formatError(e));
      setAlertOpen(true);
    } finally {
      setEditCardBusy(false);
    }
  }

  async function confirmDeleteCard() {
    if (!accessToken || !deleteCardRow) return;
    setDeleteCardBusy(true);
    try {
      await api(`/card/workspace/${workspaceId}/cards/${deleteCardRow.id}`, {
        method: 'DELETE',
        accessToken,
      });
      setDeleteCardRow(null);
      await loadCards();
    } catch (e) {
      setAlertText(formatError(e));
      setAlertOpen(true);
    } finally {
      setDeleteCardBusy(false);
    }
  }

  async function submitComment() {
    if (!accessToken || !editCard) return;
    const body = commentDraft.trim();
    if (!body.length || commentSubmitBusy) return;
    setCommentSubmitBusy(true);
    try {
      const created = await api<CommentRow>(
        `/comment/workspace/${workspaceId}/cards/${editCard.id}/comments`,
        { method: 'POST', accessToken, json: { body } },
      );
      setCommentDraft('');
      setComments((prev) => [...prev, created]);
    } catch (e) {
      setAlertText(formatError(e));
      setAlertOpen(true);
    } finally {
      setCommentSubmitBusy(false);
    }
  }

  async function saveCommentEdit(commentId: number) {
    if (!accessToken) return;
    const body = editCommentDraft.trim();
    if (!body.length || commentEditBusy) return;
    setCommentEditBusy(true);
    try {
      const updated = await api<CommentRow>(
        `/comment/workspace/${workspaceId}/comments/${commentId}`,
        { method: 'PATCH', accessToken, json: { body } },
      );
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setEditingCommentId(null);
      setEditCommentDraft('');
    } catch (e) {
      setAlertText(formatError(e));
      setAlertOpen(true);
    } finally {
      setCommentEditBusy(false);
    }
  }

  async function confirmDeleteComment() {
    if (!accessToken || !deleteCommentTarget) return;
    const id = deleteCommentTarget.id;
    setDeleteCommentBusy(true);
    try {
      await api(`/comment/workspace/${workspaceId}/comments/${id}`, {
        method: 'DELETE',
        accessToken,
      });
      setComments((prev) => prev.filter((c) => c.id !== id));
      setDeleteCommentTarget(null);
    } catch (e) {
      setAlertText(formatError(e));
      setAlertOpen(true);
    } finally {
      setDeleteCommentBusy(false);
    }
  }

  const listContent = lists.map((list) => {
    const cards = cardsByListId[list.id] ?? [];
    const cardArea = accessToken ? (
      <Droppable droppableId={String(list.id)}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="trello-cards-droppable"
          >
            {cards.map((card, index) => (
              <Draggable
                key={card.id}
                draggableId={String(card.id)}
                index={index}
                isDragDisabled={moveBusy}
              >
                {(dragProvided, snapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    className={[
                      'trello-card trello-card--clickable',
                      snapshot.isDragging ? 'trello-card--dragging' : '',
                      card.isCompleted ? 'trello-card--completed' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="trello-card-inner">
                      <div className="trello-card-complete-slot">
                        <button
                          type="button"
                          className={
                            card.isCompleted
                              ? 'trello-card-complete-btn trello-card-complete-btn--done'
                              : 'trello-card-complete-btn'
                          }
                          aria-label={
                            card.isCompleted
                              ? 'Отметить как невыполненную'
                              : 'Отметить как выполненную'
                          }
                          aria-pressed={Boolean(card.isCompleted)}
                          disabled={completionBusyId === card.id}
                          onClick={(e) => void toggleCardCompletion(card, e)}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {card.isCompleted ? (
                            <span className="trello-card-complete-check" aria-hidden>
                              ✓
                            </span>
                          ) : null}
                        </button>
                      </div>
                      <div
                        className={
                          card.isCompleted
                            ? 'trello-card-title trello-card-title--in-list trello-card-title--done'
                            : 'trello-card-title trello-card-title--in-list'
                        }
                        role="button"
                        tabIndex={0}
                        aria-label={`Карточка: ${card.title}`}
                        onClick={() => openCardDetail(card)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openCardDetail(card);
                          }
                        }}
                      >
                        {card.title}
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    ) : null;

    return (
      <div
        key={list.id}
        className="trello-list-wrap"
        style={{ backgroundColor: listHeaderColor(list.colorPreset) }}
      >
        <div className="trello-list-header">
          <div className="trello-list-header-row">
            <span className="trello-list-header-title">{list.name}</span>
            {accessToken && canManageWorkspace(myRole) ? (
              <div
                className="trello-list-menu-wrap"
                onMouseEnter={() => setActiveListMenuId(list.id)}
                onMouseLeave={() => setActiveListMenuId(null)}
              >
                <button
                  type="button"
                  className="trello-list-column-menu-btn"
                  title="Действия с колонкой"
                  aria-label="Действия с колонкой"
                >
                  ✎
                </button>
                {activeListMenuId === list.id && (
                  <div className="trello-list-menu">
                    <button
                      type="button"
                      className="trello-list-menu-item"
                      onClick={() => {
                        setActiveListMenuId(null);
                        openEditList(list);
                      }}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="trello-list-menu-item trello-list-menu-item-danger"
                      disabled={deleteListId === list.id}
                      onClick={() => {
                        setActiveListMenuId(null);
                        setListPendingDelete(list);
                      }}
                    >
                      Удалить…
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <div className="trello-list-body">
          {cardArea}
          {!accessToken ? (
            <div className="trello-list-placeholder">Войдите, чтобы видеть карточки.</div>
          ) : null}
          {accessToken ? (
            <button
              type="button"
              className="trello-add-card-btn"
              onClick={() => openCreateCard(list.id)}
            >
              <span className="trello-add-card-btn-plus" aria-hidden>
                +
              </span>
              <span>Добавить карточку</span>
            </button>
          ) : null}
        </div>
      </div>
    );
  });

  return (
    <div className="trello-board-viewport">
      <header className="trello-board-topbar trello-topbar-stripe-3col">
        <div className="trello-topbar-stripe-left trello-topbar-stripe-left--boards-nav">
          <button type="button" className="trello-top-left-brand trello-top-left-brand--stripe" onClick={() => navigate('/workspaces')}>
            <span className="trello-logo" aria-hidden />
            <span className="trello-top-left-brand-text">mini trello</span>
          </button>
          <button
            type="button"
            className="trello-btn trello-btn-topbar-nav trello-topbar-back-btn"
            onClick={() => navigate(`/workspaces/${workspaceId}/boards`)}
          >
            ← Доски
          </button>
        </div>
        <h1 className="trello-topbar-stripe-center">
          {loading ? '…' : board?.name ?? 'Доска'}
        </h1>
        <div className="trello-topbar-stripe-spacer" aria-hidden />
      </header>

      {!accessToken && (
        <div className="trello-board-banner">
          Нужен вход.{' '}
          <button type="button" className="trello-board-banner-link" onClick={() => navigate('/')}>
            На главную
          </button>
        </div>
      )}

      {msg && <div className="trello-board-banner trello-board-banner-error">{msg}</div>}

      <div className="trello-board-lists-scroll">
        {loading ? (
          <div className="trello-board-loading">Загрузка…</div>
        ) : lists.length === 0 ? (
          <div className="trello-board-loading">Колонок пока нет.</div>
        ) : accessToken ? (
          <DragDropContext onDragEnd={handleDragEnd}>{listContent}</DragDropContext>
        ) : (
          listContent
        )}

        {accessToken && !loading ? (
          <div className="trello-list-wrap trello-add-list-wrap">
            <button
              type="button"
              className="trello-add-list-btn"
              onClick={() => {
                setAddListOpen(true);
                setNewListName('');
              }}
            >
              + Добавить колонку
            </button>
          </div>
        ) : null}
      </div>

      {addListOpen && (
        <div
          className="trello-modal-backdrop"
          role="presentation"
          onClick={() => !addBusy && setAddListOpen(false)}
        >
          <div
            className="trello-modal"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Новая колонка</h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !addBusy && setAddListOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="trello-modal-body">
              <label className="trello-field">
                <span className="trello-label">Название</span>
                <input
                  className="trello-input"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  maxLength={50}
                  autoFocus
                />
              </label>
            </div>
            <div className="trello-modal-foot">
              <button
                type="button"
                className="trello-btn trello-btn-ghost"
                onClick={() => !addBusy && setAddListOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="trello-btn trello-btn-primary"
                disabled={newListName.trim().length < 3 || addBusy}
                onClick={() => void submitAddList()}
              >
                {addBusy ? 'Добавление…' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {createCardListId != null && (
        <div
          className="trello-modal-backdrop"
          role="presentation"
          onClick={() => !createCardBusy && setCreateCardListId(null)}
        >
          <div
            className="trello-modal"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Новая карточка</h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !createCardBusy && setCreateCardListId(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="trello-modal-body">
              <label className="trello-field">
                <span className="trello-label">Заголовок *</span>
                <input
                  className="trello-input"
                  value={createCardTitle}
                  onChange={(e) => setCreateCardTitle(e.target.value)}
                  maxLength={50}
                  autoFocus
                />
              </label>
              <label className="trello-field">
                <span className="trello-label">Описание</span>
                <textarea
                  className="trello-textarea"
                  value={createCardDesc}
                  onChange={(e) => setCreateCardDesc(e.target.value)}
                  rows={3}
                  maxLength={2000}
                />
              </label>
            </div>
            <div className="trello-modal-foot">
              <button
                type="button"
                className="trello-btn trello-btn-ghost"
                onClick={() => !createCardBusy && setCreateCardListId(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="trello-btn trello-btn-primary"
                disabled={createCardTitle.trim().length < 3 || createCardBusy}
                onClick={() => void submitCreateCard()}
              >
                {createCardBusy ? 'Создание…' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editCard && (
        <div
          className="trello-modal-backdrop"
          role="presentation"
          onClick={() => !editCardBusy && setEditCard(null)}
        >
          <div
            className="trello-modal trello-modal-card-detail trello-modal-card-detail--wide"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2
                className="trello-modal-title trello-modal-title--card-detail"
                title={listNameForCard}
              >
                {listNameForCard}
              </h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !editCardBusy && setEditCard(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="trello-modal-body trello-card-detail-body trello-card-detail-body--with-comments">
              <div className="trello-card-detail-main">
                <div className="trello-card-detail-title-block">
                  {cardTitleEditing ? (
                    <div className="trello-profile-name-edit trello-card-detail-title-edit">
                      <input
                        ref={cardTitleInputRef}
                        className="trello-input trello-profile-name-input trello-card-detail-title-input"
                        value={editCardTitle}
                        onChange={(e) => setEditCardTitle(e.target.value)}
                        maxLength={50}
                        disabled={editCardBusy}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void saveCardTitleInline();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelCardTitleEdit();
                          }
                        }}
                        aria-label="Название карточки"
                      />
                      <div className="trello-profile-name-edit-actions">
                        <button
                          type="button"
                          className="trello-btn trello-btn-primary trello-btn-sm"
                          disabled={editCardBusy}
                          onClick={() => void saveCardTitleInline()}
                        >
                          {editCardBusy ? '…' : 'Сохранить'}
                        </button>
                        <button
                          type="button"
                          className="trello-btn trello-btn-ghost trello-btn-sm"
                          disabled={editCardBusy}
                          onClick={() => cancelCardTitleEdit()}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="trello-profile-display-name trello-card-detail-card-title-btn"
                      onClick={() => {
                        if (editCardBusy) return;
                        setCardTitleEditing(true);
                      }}
                      disabled={editCardBusy}
                      title="Нажмите, чтобы изменить название"
                    >
                      {editCardTitle.trim() || editCard.title}
                    </button>
                  )}
                </div>
                <label className="trello-field">
                  <span className="trello-label">Описание</span>
                  <textarea
                    className="trello-textarea"
                    value={editCardDesc}
                    onChange={(e) => setEditCardDesc(e.target.value)}
                    rows={6}
                    maxLength={2000}
                  />
                </label>
                <label className="trello-field">
                  <span className="trello-label">Срок</span>
                  <input
                    className="trello-input"
                    type="datetime-local"
                    value={editCardDue}
                    onChange={(e) => setEditCardDue(e.target.value)}
                  />
                </label>
                <div className="trello-card-detail-aside-block trello-card-detail-meta-in-main">
                  <h3 className="trello-card-detail-aside-heading-plain">Исполнитель</h3>
                  <select
                    className="trello-input trello-card-assignee-select"
                    value={editCardAssigneeId == null ? '' : String(editCardAssigneeId)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditCardAssigneeId(v === '' ? null : Number(v));
                    }}
                    disabled={editCardBusy}
                  >
                    <option value="">Не назначен</option>
                    {workspaceMembers.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="trello-card-detail-aside-block trello-card-detail-meta-in-main">
                  <h3 className="trello-card-detail-aside-title">История</h3>
                  <ul className="trello-card-detail-log">
                    <li className="trello-card-detail-log-item">
                      <span className="trello-card-detail-log-label">Создано</span>
                      <span className="trello-card-detail-log-value">
                        {formatCardLogWhen(editCard.createdAt)}
                      </span>
                    </li>
                    <li className="trello-card-detail-log-item">
                      <span className="trello-card-detail-log-label">Обновлено</span>
                      <span className="trello-card-detail-log-value">
                        {formatCardLogWhen(editCard.updatedAt)}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
              <aside
                className="trello-card-comments-panel"
                aria-label="Комментарии и события"
              >
                <div className="trello-card-comments-panel-header">
                  <span className="trello-card-comments-panel-header-inner">
                    <svg
                      className="trello-card-comments-panel-msg-icon"
                      viewBox="0 0 24 24"
                      width={18}
                      height={18}
                      aria-hidden
                    >
                      <path
                        fill="currentColor"
                        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"
                      />
                    </svg>
                    <span>Комментарии и события</span>
                  </span>
                </div>
                {accessToken ? (
                  <>
                    <div className="trello-card-comments-compose">
                      <textarea
                        className="trello-textarea trello-card-comments-textarea"
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        rows={3}
                        maxLength={2000}
                        disabled={commentSubmitBusy}
                        spellCheck
                        autoComplete="off"
                      />
                    </div>
                    <div className="trello-card-comments-compose-actions">
                      <button
                        type="button"
                        className="trello-btn trello-btn-primary trello-btn-sm"
                        disabled={
                          commentDraft.trim().length === 0 || commentSubmitBusy
                        }
                        onClick={() => void submitComment()}
                      >
                        {commentSubmitBusy ? 'Отправка…' : 'Отправить'}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="trello-card-comments-guest-hint">Войдите, чтобы комментировать.</p>
                )}
                <div className="trello-card-comments-list-wrap">
                  {commentsLoading ? (
                    <p className="trello-card-comments-loading">Загрузка комментариев…</p>
                  ) : comments.length === 0 ? (
                    <p className="trello-card-comments-empty">Пока нет комментариев.</p>
                  ) : (
                    <ul className="trello-card-comments-list">
                      {comments.map((c) => {
                        const isAuthor =
                          currentUserId != null && c.userId === currentUserId;
                        const canDelete =
                          isAuthor || canManageWorkspace(myRole);
                        const showEdit = isAuthor;
                        return (
                          <li key={c.id} className="trello-card-comment-item">
                            <div className="trello-card-comment-row">
                              <CommentAvatarBubble
                                name={c.user.name}
                                avatarPath={c.user.avatarPath}
                              />
                              <div className="trello-card-comment-main">
                                <div className="trello-card-comment-head">
                                  <span className="trello-card-comment-author">
                                    {c.user.name}
                                  </span>
                                  <time
                                    className="trello-card-comment-when"
                                    dateTime={c.createdAt}
                                  >
                                    {formatCommentRelativeAgo(c.createdAt, nowTick)}
                                  </time>
                                </div>
                                {editingCommentId === c.id ? (
                                  <div className="trello-card-comment-edit">
                                    <textarea
                                      className="trello-textarea trello-card-comments-textarea"
                                      value={editCommentDraft}
                                      onChange={(e) =>
                                        setEditCommentDraft(e.target.value)
                                      }
                                      rows={4}
                                      maxLength={2000}
                                      disabled={commentEditBusy}
                                    />
                                    <div className="trello-card-comment-edit-actions">
                                      <button
                                        type="button"
                                        className="trello-btn trello-btn-primary trello-btn-sm"
                                        disabled={
                                          editCommentDraft.trim().length === 0 ||
                                          commentEditBusy
                                        }
                                        onClick={() => void saveCommentEdit(c.id)}
                                      >
                                        {commentEditBusy ? 'Сохранение…' : 'Сохранить'}
                                      </button>
                                      <button
                                        type="button"
                                        className="trello-btn trello-btn-ghost trello-btn-sm"
                                        disabled={commentEditBusy}
                                        onClick={() => {
                                          setEditingCommentId(null);
                                          setEditCommentDraft('');
                                        }}
                                      >
                                        Отмена
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className="trello-card-comment-text">{c.body}</p>
                                    {(showEdit || canDelete) && (
                                      <div className="trello-card-comment-actions">
                                        {showEdit ? (
                                          <button
                                            type="button"
                                            className="trello-card-comment-link"
                                            onClick={() => {
                                              setEditingCommentId(c.id);
                                              setEditCommentDraft(c.body);
                                            }}
                                          >
                                            Редактировать
                                          </button>
                                        ) : null}
                                        {canDelete ? (
                                          <button
                                            type="button"
                                            className="trello-card-comment-link trello-card-comment-link-danger"
                                            onClick={() => setDeleteCommentTarget(c)}
                                          >
                                            Удалить
                                          </button>
                                        ) : null}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </aside>
            </div>
            <div className="trello-modal-foot trello-modal-foot-split">
              <button
                type="button"
                className="trello-btn trello-btn-danger"
                disabled={editCardBusy}
                onClick={() => {
                  const row = editCard;
                  if (!row) return;
                  setEditCard(null);
                  setDeleteCardRow(row);
                }}
              >
                Удалить
              </button>
              <div className="trello-modal-foot-actions">
                <button
                  type="button"
                  className="trello-btn trello-btn-ghost"
                  onClick={() => !editCardBusy && setEditCard(null)}
                >
                  Закрыть
                </button>
                <button
                  type="button"
                  className="trello-btn trello-btn-primary"
                  disabled={editCardTitle.trim().length < 3 || editCardBusy}
                  onClick={() => void submitEditCard()}
                >
                  {editCardBusy ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteCardRow && (
        <div
          className="trello-modal-backdrop"
          role="presentation"
          onClick={() => !deleteCardBusy && setDeleteCardRow(null)}
        >
          <div
            className="trello-modal trello-modal-narrow"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Удалить карточку?</h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !deleteCardBusy && setDeleteCardRow(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="trello-modal-body">
              <p className="trello-confirm-text">
                Карточка «<strong>{deleteCardRow.title}</strong>» будет удалена.
              </p>
            </div>
            <div className="trello-modal-foot">
              <button
                type="button"
                className="trello-btn trello-btn-ghost"
                onClick={() => !deleteCardBusy && setDeleteCardRow(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="trello-btn trello-btn-danger"
                disabled={deleteCardBusy}
                onClick={() => void confirmDeleteCard()}
              >
                {deleteCardBusy ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCommentTarget && (
        <div
          className="trello-modal-backdrop"
          role="presentation"
          style={{ zIndex: 1100 }}
          onClick={() => !deleteCommentBusy && setDeleteCommentTarget(null)}
        >
          <div
            className="trello-modal trello-modal-narrow"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Удалить комментарий?</h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !deleteCommentBusy && setDeleteCommentTarget(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="trello-modal-body">
              <p className="trello-confirm-text">Комментарий будет удалён без возможности восстановления.</p>
            </div>
            <div className="trello-modal-foot">
              <button
                type="button"
                className="trello-btn trello-btn-ghost"
                onClick={() => !deleteCommentBusy && setDeleteCommentTarget(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="trello-btn trello-btn-danger"
                disabled={deleteCommentBusy}
                onClick={() => void confirmDeleteComment()}
              >
                {deleteCommentBusy ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        open={alertOpen}
        message={alertText}
        onClose={() => setAlertOpen(false)}
      />

      {listPendingDelete && (
        <div
          className="trello-modal-backdrop"
          role="presentation"
          onClick={() => !deleteListId && setListPendingDelete(null)}
        >
          <div
            className="trello-modal trello-modal-narrow"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Удалить колонку?</h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !deleteListId && setListPendingDelete(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="trello-modal-body">
              <p className="trello-confirm-text">
                Колонка «<strong>{listPendingDelete.name}</strong>» будет удалена без возможности восстановления.
              </p>
            </div>
            <div className="trello-modal-foot">
              <button
                type="button"
                className="trello-btn trello-btn-ghost"
                onClick={() => !deleteListId && setListPendingDelete(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="trello-btn trello-btn-danger"
                disabled={deleteListId === listPendingDelete.id}
                onClick={() => void confirmDeleteList()}
              >
                {deleteListId === listPendingDelete.id ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editList && (
        <div
          className="trello-modal-backdrop"
          role="presentation"
          onClick={() => !editBusy && setEditList(null)}
        >
          <div
            className="trello-modal"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Колонка</h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !editBusy && setEditList(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="trello-modal-body">
              <label className="trello-field">
                <span className="trello-label">Название</span>
                <input
                  className="trello-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={50}
                />
              </label>
              <label className="trello-field">
                <span className="trello-label">Цвет</span>
                <div className="trello-color-grid" role="listbox" aria-label="Цвет колонки">
                  {LIST_COLOR_PRESET_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={
                        key === editColor
                          ? 'trello-color-swatch trello-color-swatch-active'
                          : 'trello-color-swatch'
                      }
                      style={{ backgroundColor: listHeaderColor(key) }}
                      aria-label={key}
                      aria-selected={key === editColor}
                      onClick={() => setEditColor(key)}
                    />
                  ))}
                </div>
              </label>
            </div>
            <div className="trello-modal-foot">
              <button
                type="button"
                className="trello-btn trello-btn-ghost"
                onClick={() => !editBusy && setEditList(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="trello-btn trello-btn-primary"
                disabled={editName.trim().length < 3 || editBusy}
                onClick={() => void submitEditList()}
              >
                {editBusy ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
