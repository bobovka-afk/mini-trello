import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type MouseEvent,
	type ReactNode
} from 'react'
import {
	DragDropContext,
	Draggable,
	Droppable,
	type DragStart,
	type DragUpdate,
	type DropResult
} from '@hello-pangea/dnd'
import { AlertModal } from '@shared/ui/alert-modal/AlertModal'
import { ModalForm } from '@shared/ui/modal-form'
import {
	api,
	formatApiError,
	isRateLimitMessage,
	isXpGrantErrorCode,
	type ApiError
} from '@shared/api'
import { BoardSwitcherBar } from '@widgets/board-switcher/BoardSwitcherBar'
import { BoardTopbarMenu } from '@widgets/board-topbar-menu/BoardTopbarMenu'
import { CheckinRewardToast, TaskRewardToast } from '@widgets/reward-grant-toast/RewardGrantToast'
import { writeCharacterStreakSnapshot } from '@entities/character/lib/characterStreakSnapshot'
import type { ActivityUserBrief } from '@entities/user'
import {
	buildRewardToastSteps,
	delayMs,
	hasRewardToast,
	REWARD_TOAST_GAP_MS,
	REWARD_TOAST_VISIBLE_MS,
	type CardCompletionResponse,
	type RewardToastStep,
	type XpGrantRewards
} from '@entities/reward'
import { useGamificationSettings } from '@entities/user-settings'
import { SpaLink } from '@shared/lib/navigation'
import { AppLogo } from '@shared/ui/app-logo/AppLogo'
import type { BoardRow } from '@pages/workspace-boards/WorkspaceBoardsPage'
import {
	canArchiveBoards,
	canManageBoards,
	canManageLabels,
	canManageWorkspace,
	type WorkspacePermissions,
} from '@entities/workspace'
import {
	filterBoardCards,
	type BoardCardFilter,
	type WorkspaceLabelRow,
} from '@features/board/lib/boardCardFilters'
import {
	cloneCardsByListId,
	getCardListLocation,
	reorderCardsByListId
} from '@features/board/lib/boardCardDnD'
import { CardLabelStrip } from '@features/board/ui/CardLabelStrip'
import { CardListBadges } from '@features/board/ui/CardListBadges'
import { CardDetailModalTrello } from '@widgets/card-detail/CardDetailModalTrello'
import { WorkspaceSearchModal } from '@widgets/workspace-search/WorkspaceSearchModal'
import { WorkspaceLabelsModal } from '@widgets/workspace-labels/WorkspaceLabelsModal'
import { useWorkspaceSearchHotkey } from '@shared/lib/useWorkspaceSearchHotkey'
import { useIsDarkTheme } from '@app/theme/useAppTheme'
import { MoreHorizontalIcon } from '@shared/ui/icons/MoreHorizontalIcon'
import { LIST_COLOR_PRESET_KEYS, listColumnChromeColor, listHeaderColor, listUsesLightChrome } from '@entities/board'
import { LIST_NAME_MIN_LENGTH } from '@entities/board/lib/listLimits'
import { CARD_TITLE_MAX_LENGTH, CARD_TITLE_MIN_LENGTH } from '@entities/card/lib/cardLimits'
import { archiveCard } from '@features/board/api/cardCoverApi'
import type { CardCoverDisplayMode } from '@features/board/api/cardCoverApi'

type ListRow = {
	id: number
	boardId: number
	name: string
	position: number
	colorPreset: string
	createdAt: string
	updatedAt: string
}

export type CardRow = {
	id: number
	listId: number
	title: string
	description: string | null
	dueDate: string | null
	reminderMinutesBefore?: number | null
	position: number
	assigneeId: number | null
	isCompleted?: boolean
	labels?: WorkspaceLabelRow[]
	coverImageUrl?: string | null
	coverColorPreset?: string | null
	coverDisplayMode?: CardCoverDisplayMode
	attachmentCount?: number
	commentCount?: number
	createdAt: string
	updatedAt: string
}

type Props = {
	accessToken: string | null
	workspaceId: number
	boardId: number
	currentUserId: number | null
}

export type CommentRow = {
	id: number
	cardId: number
	userId: number
	body: string
	createdAt: string
	updatedAt: string
	user: ActivityUserBrief
}

type WorkspaceMemberApiRow = {
	userId: number
	user: ActivityUserBrief
}

function formatError(e: unknown) {
	return formatApiError(e)
}

function nextListPosition(rows: ListRow[]): number {
	if (rows.length === 0) return 0
	return (
		rows.reduce(
			(max, row) => (row.position > max ? row.position : max),
			rows[0].position
		) + 1
	)
}

function nextCardPosition(cards: CardRow[]): number {
	if (cards.length === 0) return 0
	return (
		cards.reduce(
			(max, c) => (c.position > max ? c.position : max),
			cards[0].position
		) + 1
	)
}

/** Horizontal droppable for reordering columns; must not clash with numeric list ids. */
const BOARD_LISTS_DROPPABLE_ID = 'board-lists'
const LIST_DRAG_PREFIX = 'list-'

/** Не начинать панораму доски с этих элементов (колонки, карточки и т.д.). */
const BOARD_PAN_BLOCK_SELECTOR =
	'.trello-list-wrap,.trello-card,button,a,input,textarea,select,[role="dialog"]'

function adjustTextareaHeight(el: HTMLTextAreaElement | null) {
	if (!el) return
	el.style.height = 'auto'
	el.style.height = `${el.scrollHeight}px`
}

function InlineAddCardForm({
	title,
	busy,
	textareaRef,
	onTitleChange,
	onSubmit,
	onCancel
}: {
	title: string
	busy: boolean
	textareaRef: React.RefObject<HTMLTextAreaElement | null>
	onTitleChange: (value: string) => void
	onSubmit: () => void
	onCancel: () => void
}) {
	const rootRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handlePointerDown(e: PointerEvent) {
			const root = rootRef.current
			if (!root || root.contains(e.target as Node)) return
			if (busy) return
			if (title.trim().length >= CARD_TITLE_MIN_LENGTH) {
				onSubmit()
			} else {
				onCancel()
			}
		}
		document.addEventListener('pointerdown', handlePointerDown, true)
		return () =>
			document.removeEventListener('pointerdown', handlePointerDown, true)
	}, [title, busy, onSubmit, onCancel])

	return (
		<div ref={rootRef} className='trello-inline-add-card'>
			<textarea
				ref={textareaRef}
				className='trello-inline-add-card-input'
				value={title}
				onChange={e => {
					onTitleChange(e.target.value)
					adjustTextareaHeight(e.target)
				}}
				onKeyDown={e => {
					if (e.key === 'Escape') {
						e.preventDefault()
						onCancel()
						return
					}
					if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
						e.preventDefault()
						if (!busy && title.trim().length >= CARD_TITLE_MIN_LENGTH) {
							onSubmit()
						}
					}
				}}
				maxLength={CARD_TITLE_MAX_LENGTH}
				rows={1}
				disabled={busy}
				aria-label='Название карточки'
			/>
			<div className='trello-inline-add-card-actions'>
				<button
					type='button'
					className='trello-inline-add-card-submit'
					disabled={busy || title.trim().length < CARD_TITLE_MIN_LENGTH}
					onClick={() => onSubmit()}
				>
					{busy ? 'Добавление…' : 'Добавить карточку'}
				</button>
				<button
					type='button'
					className='trello-inline-add-card-cancel'
					onClick={onCancel}
					disabled={busy}
					aria-label='Отмена'
				>
					×
				</button>
			</div>
		</div>
	)
}

function ListHeaderName({
	list,
	canEdit,
	editing,
	editName,
	busy,
	inputRef,
	onStartEdit,
	onNameChange,
	onSave,
	onCancel
}: {
	list: ListRow
	canEdit: boolean
	editing: boolean
	editName: string
	busy: boolean
	inputRef: React.RefObject<HTMLInputElement | null>
	onStartEdit: () => void
	onNameChange: (value: string) => void
	onSave: () => void
	onCancel: () => void
}) {
	if (editing) {
		return (
			<div
				className='trello-list-header-title-edit'
				data-list-name-edit={list.id}
			>
				<input
					ref={inputRef}
					className='trello-list-header-title-input'
					value={editName}
					onChange={e => onNameChange(e.target.value)}
					onKeyDown={e => {
						if (e.key === 'Enter') {
							e.preventDefault()
							onSave()
						}
						if (e.key === 'Escape') {
							e.preventDefault()
							onCancel()
						}
					}}
					onBlur={e => {
						const next = e.relatedTarget as HTMLElement | null
						if (next?.closest('.trello-list-menu-wrap')) return
						onSave()
					}}
					maxLength={50}
					disabled={busy}
					aria-label='Название колонки'
					onMouseDown={e => e.stopPropagation()}
				/>
			</div>
		)
	}

	return (
		<button
			type='button'
			className='trello-list-header-title-hit'
			disabled={!canEdit}
			title={canEdit ? 'Изменить название' : undefined}
			onMouseDown={e => e.stopPropagation()}
			onClick={e => {
				e.stopPropagation()
				if (!canEdit) return
				onStartEdit()
			}}
		>
			<span className='trello-list-header-title'>{list.name}</span>
		</button>
	)
}

function TrelloListCardsPane({
	listId,
	cardCount,
	chromeColor,
	addCardFooter,
	children
}: {
	listId: number
	cardCount: number
	chromeColor: string
	addCardFooter: ReactNode
	children: ReactNode
}) {
	const scrollRef = useRef<HTMLDivElement>(null)
	const [fadeTop, setFadeTop] = useState(false)
	const [fadeBottom, setFadeBottom] = useState(false)
	const [hasOverflow, setHasOverflow] = useState(false)

	const syncFades = useCallback(() => {
		const el = scrollRef.current
		if (!el) return
		const { scrollTop, scrollHeight, clientHeight } = el
		const slop = 2
		setFadeTop(scrollTop > slop)
		setFadeBottom(scrollTop + clientHeight < scrollHeight - slop)
		setHasOverflow(scrollHeight > clientHeight + slop)
	}, [])

	useLayoutEffect(() => {
		const el = scrollRef.current
		if (!el) return
		syncFades()
		const ro = new ResizeObserver(syncFades)
		ro.observe(el)
		for (const child of el.children) {
			ro.observe(child)
		}
		return () => ro.disconnect()
	}, [syncFades, listId, cardCount])

	const paneStyle: CSSProperties = {
		['--trello-list-chrome' as string]: chromeColor
	}

	const scrollClass =
		'trello-list-cards-scroll' +
		(hasOverflow ? ' trello-list-cards-scroll--overflow' : '')
	const paneClass =
		'trello-list-cards-pane' +
		(hasOverflow ? ' trello-list-cards-pane--overflow' : '')

	return (
		<div className={paneClass} style={paneStyle}>
			<div className='trello-list-cards-scroll-outer'>
				<div
					ref={scrollRef}
					className={scrollClass}
					onScroll={syncFades}
				>
					{children}
				</div>
				{fadeTop ? (
					<div
						className='trello-list-cards-fade trello-list-cards-fade--top'
						aria-hidden
					/>
				) : null}
				{fadeBottom ? (
					<div
						className='trello-list-cards-fade trello-list-cards-fade--bottom'
						aria-hidden
					/>
				) : null}
			</div>
			<div className='trello-list-add-card-footer'>{addCardFooter}</div>
		</div>
	)
}

import {
	dueDateToInputValue,
	inputValueToIso,
} from '@features/board/lib/cardDatesUtils'

/** Относительное время для комментариев (Intl, ru). */
function formatCommentRelativeAgo(iso: string, nowMs: number): string {
	const then = new Date(iso).getTime()
	if (Number.isNaN(then)) return '—'
	const diffSec = Math.floor((nowMs - then) / 1000)
	if (diffSec < 45) return 'только что'
	const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'always' })
	const mins = Math.floor(diffSec / 60)
	if (mins < 60) return rtf.format(-mins, 'minute')
	const hours = Math.floor(mins / 60)
	if (hours < 24) return rtf.format(-hours, 'hour')
	const days = Math.floor(hours / 24)
	if (days < 7) return rtf.format(-days, 'day')
	const weeks = Math.floor(days / 7)
	if (days < 30) return rtf.format(-weeks, 'week')
	const months = Math.floor(days / 30)
	if (days < 365) return rtf.format(-months, 'month')
	const years = Math.floor(days / 365)
	return rtf.format(-years, 'year')
}

export function BoardPage({
	accessToken,
	workspaceId,
	boardId,
	currentUserId
}: Props) {
	const isDark = useIsDarkTheme()
	const [board, setBoard] = useState<BoardRow | null>(null)
	const [lists, setLists] = useState<ListRow[]>([])
	const [cardsByListId, setCardsByListId] = useState<
		Record<number, CardRow[]>
	>({})
	const [myRole, setMyRole] = useState<string | null>(null)
	const [myPermissions, setMyPermissions] =
		useState<WorkspacePermissions | null>(null)
	const [loading, setLoading] = useState(true)
	const [msg, setMsg] = useState<string | null>(null)
	const [alertOpen, setAlertOpen] = useState(false)
	const [alertText, setAlertText] = useState('')

	const [addListOpen, setAddListOpen] = useState(false)
	const [newListName, setNewListName] = useState('')
	const [addBusy, setAddBusy] = useState(false)

	const [editList, setEditList] = useState<ListRow | null>(null)
	const [editName, setEditName] = useState('')
	const [editColor, setEditColor] = useState<string>('GRAY')
	const [editBusy, setEditBusy] = useState(false)
	const [editingListNameId, setEditingListNameId] = useState<number | null>(
		null
	)
	const [editingListName, setEditingListName] = useState('')
	const listNameInputRef = useRef<HTMLInputElement>(null)
	const inlineListNameSaveLock = useRef(false)
	const [activeListMenuId, setActiveListMenuId] = useState<number | null>(
		null
	)
	const [deleteListId, setDeleteListId] = useState<number | null>(null)
	const [listPendingDelete, setListPendingDelete] = useState<ListRow | null>(
		null
	)

	const [moveBusy, setMoveBusy] = useState(false)
	const cardsDragSnapshotRef = useRef<Record<number, CardRow[]> | null>(null)
	const cardDragLocationRef = useRef<string | null>(null)
	const [workspaceMembers, setWorkspaceMembers] = useState<
		{ userId: number; user: ActivityUserBrief }[]
	>([])

	const [createCardListId, setCreateCardListId] = useState<number | null>(
		null
	)
	const [createCardTitle, setCreateCardTitle] = useState('')
	const [createCardBusy, setCreateCardBusy] = useState(false)
	const createCardTextareaRef = useRef<HTMLTextAreaElement>(null)

	const [editCard, setEditCard] = useState<CardRow | null>(null)
	const [editCardTitle, setEditCardTitle] = useState('')
	const [editCardDesc, setEditCardDesc] = useState('')
	const [editCardDue, setEditCardDue] = useState('')
	const [editCardAssigneeId, setEditCardAssigneeId] = useState<number | null>(
		null
	)
	const [editCardReminder, setEditCardReminder] = useState('')
	const [editCardLabelIds, setEditCardLabelIds] = useState<number[]>([])
	const [editCardBusy, setEditCardBusy] = useState(false)
	const [wsLabels, setWsLabels] = useState<WorkspaceLabelRow[]>([])
	const [boardFilter, setBoardFilter] = useState<BoardCardFilter>('all')
	const [labelFilterId, setLabelFilterId] = useState<number | null>(null)
	const [searchOpen, setSearchOpen] = useState(false)
	const [labelsModalOpen, setLabelsModalOpen] = useState(false)
	const [archivedLists, setArchivedLists] = useState<ListRow[]>([])
	const [archivedListsOpen, setArchivedListsOpen] = useState(false)
	const [archiveListBusyId, setArchiveListBusyId] = useState<number | null>(
		null
	)

	const canManageLists =
		canManageBoards(myPermissions) || canManageWorkspace(myRole)
	const canArchiveLists =
		canArchiveBoards(myPermissions) || canManageWorkspace(myRole)
	const canManageLabelsPerm =
		canManageLabels(myPermissions) || canManageWorkspace(myRole)

	useWorkspaceSearchHotkey(() => setSearchOpen(true), Boolean(accessToken))

	useEffect(() => {
		if (activeListMenuId == null) return
		function handlePointerDown(e: PointerEvent) {
			const wrap = document.querySelector(
				`[data-list-menu-id="${activeListMenuId}"]`,
			)
			if (wrap && wrap.contains(e.target as Node)) return
			setActiveListMenuId(null)
		}
		document.addEventListener('pointerdown', handlePointerDown, true)
		return () =>
			document.removeEventListener('pointerdown', handlePointerDown, true)
	}, [activeListMenuId])

	const [comments, setComments] = useState<CommentRow[]>([])
	const [commentsLoading, setCommentsLoading] = useState(false)
	const [commentDraft, setCommentDraft] = useState('')
	const [commentSubmitBusy, setCommentSubmitBusy] = useState(false)
	const [editingCommentId, setEditingCommentId] = useState<number | null>(
		null
	)
	const [editCommentDraft, setEditCommentDraft] = useState('')
	const [commentEditBusy, setCommentEditBusy] = useState(false)
	const [deleteCommentTarget, setDeleteCommentTarget] =
		useState<CommentRow | null>(null)
	const [deleteCommentBusy, setDeleteCommentBusy] = useState(false)

	const [deleteCardRow, setDeleteCardRow] = useState<CardRow | null>(null)
	const [deleteCardBusy, setDeleteCardBusy] = useState(false)
	const [completionBusyId, setCompletionBusyId] = useState<number | null>(
		null
	)
	const [rewardToast, setRewardToast] = useState<{
		step: RewardToastStep
		id: number
	} | null>(null)
	const rewardToastRunIdRef = useRef(0)
	const [gamificationSettings] = useGamificationSettings(accessToken)
	useEffect(() => {
		return () => {
			rewardToastRunIdRef.current += 1
		}
	}, [])

	const playRewardToastSequence = useCallback(
		async (rewards: XpGrantRewards) => {
			const steps = buildRewardToastSteps(rewards, gamificationSettings)
			if (steps.length === 0) return

			const runId = ++rewardToastRunIdRef.current
			for (let i = 0; i < steps.length; i++) {
				if (rewardToastRunIdRef.current !== runId) return
				setRewardToast({ step: steps[i], id: Date.now() + i })
				await delayMs(REWARD_TOAST_VISIBLE_MS)
				if (rewardToastRunIdRef.current !== runId) return
				setRewardToast(null)
				if (i < steps.length - 1) {
					await delayMs(REWARD_TOAST_GAP_MS)
				}
			}
		},
		[gamificationSettings]
	)

	const [cardTitleEditing, setCardTitleEditing] = useState(false)
	const cardTitleInputRef = useRef<HTMLTextAreaElement>(null)
	const boardListsScrollRef = useRef<HTMLDivElement>(null)
	const boardPanRef = useRef<{ id: number | null; lastX: number }>({
		id: null,
		lastX: 0
	})
	const [nowTick, setNowTick] = useState(() => Date.now())

	const handleBoardListsPanDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (e.button !== 0) return
			if (!(e.target instanceof Element)) return
			if (e.target.closest(BOARD_PAN_BLOCK_SELECTOR)) return
			const scrollEl = boardListsScrollRef.current
			if (!scrollEl) return
			e.preventDefault()
			boardPanRef.current = { id: e.pointerId, lastX: e.clientX }
			scrollEl.setPointerCapture(e.pointerId)
		},
		[]
	)

	const handleBoardListsPanMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const st = boardPanRef.current
			if (st.id == null || st.id !== e.pointerId) return
			const scrollEl = boardListsScrollRef.current
			if (!scrollEl) return
			const dx = e.clientX - st.lastX
			st.lastX = e.clientX
			scrollEl.scrollLeft -= dx
		},
		[]
	)

	const handleBoardListsPanEnd = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const st = boardPanRef.current
			if (st.id !== e.pointerId) return
			st.id = null
			try {
				boardListsScrollRef.current?.releasePointerCapture(e.pointerId)
			} catch {
				/* noop */
			}
		},
		[]
	)

	const listNameForCard = useMemo(() => {
		if (!editCard) return ''
		return lists.find(l => l.id === editCard.listId)?.name ?? 'Колонка'
	}, [editCard, lists])

	const currentUserName = useMemo(() => {
		if (currentUserId == null) return 'Участник'
		const m = workspaceMembers.find(w => w.user.id === currentUserId)
		return m?.user.name ?? 'Участник'
	}, [currentUserId, workspaceMembers])

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!accessToken) {
      setBoard(null)
      setLists([])
      setMyRole(null)
      setLoading(false)
      return
    }
    const silent = options?.silent ?? false
    if (!silent) {
      setLoading(true)
      setMsg(null)
    }
    try {
      const [b, ls, summary] = await Promise.all([
        api<BoardRow>(`/workspace/${workspaceId}/boards/${boardId}`, {
          method: 'GET',
          accessToken
        }),
        api<ListRow[]>(
          `/workspace/${workspaceId}/board/${boardId}/lists`,
          { method: 'GET', accessToken }
        ),
        api<{
          myRole: string | null
          myPermissions: WorkspacePermissions | null
        }>(`/workspace/${workspaceId}/summary`, {
          method: 'GET',
          accessToken,
        }),
      ])
      setBoard(b)
      setLists(Array.isArray(ls) ? ls : [])
      setMyRole(summary.myRole ?? null)
      setMyPermissions(summary.myPermissions ?? null)
    } catch (e) {
      if (!silent) {
        setMsg(formatError(e))
      }
      setBoard(null)
      setLists([])
      setMyRole(null)
      setMyPermissions(null)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [accessToken, workspaceId, boardId])

	const reloadWsLabels = useCallback(async () => {
		if (!accessToken) {
			setWsLabels([])
			return
		}
		try {
			const raw = await api<WorkspaceLabelRow[]>(
				`/workspace/${workspaceId}/labels`,
				{ method: 'GET', accessToken }
			)
			setWsLabels(Array.isArray(raw) ? raw : [])
		} catch {
			setWsLabels([])
		}
	}, [accessToken, workspaceId])

	const loadArchivedLists = useCallback(async () => {
		if (!accessToken || !canArchiveLists) {
			setArchivedLists([])
			return
		}
		try {
			const raw = await api<ListRow[]>(
				`/workspace/${workspaceId}/board/${boardId}/lists/archived`,
				{ method: 'GET', accessToken }
			)
			setArchivedLists(Array.isArray(raw) ? raw : [])
		} catch {
			setArchivedLists([])
		}
	}, [accessToken, workspaceId, boardId, canArchiveLists])

	const listIdsKey = useMemo(
		() =>
			lists
				.map(list => list.id)
				.sort((a, b) => a - b)
				.join(','),
		[lists]
	)

	const loadCards = useCallback(async () => {
		if (!accessToken) {
			setCardsByListId({})
			return
		}
		const listIds = listIdsKey
			? listIdsKey.split(',').map(id => Number(id))
			: []
		if (listIds.length === 0) {
			setCardsByListId({})
			return
		}
		try {
			const entries = await Promise.all(
				listIds.map(async listId => {
					const raw = await api<CardRow[]>(
						`/workspace/${workspaceId}/lists/${listId}/cards`,
						{ method: 'GET', accessToken }
					)
					return [listId, Array.isArray(raw) ? raw : []] as const
				})
			)
			setCardsByListId(Object.fromEntries(entries))
		} catch {
			setCardsByListId({})
		}
	}, [accessToken, workspaceId, listIdsKey])

	const loadComments = useCallback(
		async (cardId: number) => {
			if (!accessToken) {
				setComments([])
				return
			}
			setCommentsLoading(true)
			try {
				const raw = await api<CommentRow[]>(
					`/workspace/${workspaceId}/cards/${cardId}/comments`,
					{ method: 'GET', accessToken }
				)
				setComments(Array.isArray(raw) ? raw : [])
			} catch {
				setComments([])
			} finally {
				setCommentsLoading(false)
			}
		},
		[accessToken, workspaceId]
	)

	useEffect(() => {
		void load()
	}, [load])

	useEffect(() => {
		void loadCards()
	}, [loadCards])

	useEffect(() => {
		void reloadWsLabels()
	}, [reloadWsLabels])

	useEffect(() => {
		if (archivedListsOpen) void loadArchivedLists()
	}, [archivedListsOpen, loadArchivedLists])

	useEffect(() => {
		setEditingCommentId(null)
		setEditCommentDraft('')
		setCommentDraft('')
		setDeleteCommentTarget(null)
		setCardTitleEditing(false)
		if (!editCard) {
			setComments([])
			return
		}
		void loadComments(editCard.id)
	}, [editCard, loadComments])

	useEffect(() => {
		if (!editCard) return
		setNowTick(Date.now())
		const id = window.setInterval(() => setNowTick(Date.now()), 60_000)
		return () => window.clearInterval(id)
	}, [editCard])

	useEffect(() => {
		if (!cardTitleEditing) return
		cardTitleInputRef.current?.focus()
	}, [cardTitleEditing])

	useEffect(() => {
		if (createCardListId == null) return
		requestAnimationFrame(() => {
			const el = createCardTextareaRef.current
			if (!el) return
			el.focus()
			adjustTextareaHeight(el)
		})
	}, [createCardListId])

	useEffect(() => {
		if (editingListNameId == null) return
		requestAnimationFrame(() => {
			const el = listNameInputRef.current
			if (!el) return
			el.focus()
			el.select()
		})
	}, [editingListNameId])

	useEffect(() => {
		if (!accessToken) {
			setWorkspaceMembers([])
			return
		}
		void (async () => {
			try {
				const raw = await api<WorkspaceMemberApiRow[]>(
					`/workspace/${workspaceId}/members?limit=100&offset=0`,
					{ method: 'GET', accessToken }
				)
				const rows = Array.isArray(raw) ? raw : []
				setWorkspaceMembers(
					rows.map(r => ({
						userId: r.userId,
						user: {
							id: r.user.id,
							name: r.user.name,
							avatarPath: r.user.avatarPath ?? null,
							characterName: r.user.characterName ?? null,
							characterAvatarPreset: r.user.characterAvatarPreset ?? null,
						},
					}))
				)
			} catch {
				setWorkspaceMembers([])
			}
		})()
	}, [accessToken, workspaceId])

	function handleDragStart(start: DragStart) {
		if (start.type === 'LIST') return
		cardsDragSnapshotRef.current = cloneCardsByListId(cardsByListId)
		cardDragLocationRef.current = null
	}

	function handleDragUpdate(update: DragUpdate) {
		if (update.type === 'LIST') return
		const { destination, draggableId } = update
		if (!destination) return

		const cardId = Number(draggableId)
		if (!Number.isFinite(cardId)) return

		setCardsByListId(prev => {
			const current = getCardListLocation(prev, cardId)
			if (!current) return prev

			const destListId = Number(destination.droppableId)
			if (
				current.listId === destListId &&
				current.index === destination.index
			) {
				return prev
			}

			const locKey = `${current.listId}:${current.index}->${destination.droppableId}:${destination.index}`
			if (cardDragLocationRef.current === locKey) return prev
			cardDragLocationRef.current = locKey

			const next = reorderCardsByListId(
				prev,
				{
					droppableId: String(current.listId),
					index: current.index,
				},
				destination,
				draggableId,
			)
			return next ?? prev
		})
	}

	async function handleDragEnd(result: DropResult) {
		if (!accessToken) return
		const { destination, source, draggableId, type } = result

		if (type === 'LIST') {
			if (moveBusy) return
			if (!destination) return
			if (
				destination.droppableId === source.droppableId &&
				destination.index === source.index
			) {
				return
			}
			if (
				source.droppableId !== BOARD_LISTS_DROPPABLE_ID ||
				destination.droppableId !== BOARD_LISTS_DROPPABLE_ID
			) {
				return
			}
			const listId = Number(draggableId.slice(LIST_DRAG_PREFIX.length))
			if (!Number.isInteger(listId)) return

			setMoveBusy(true)
			setLists(prev => {
				const next = [...prev]
				const [removed] = next.splice(source.index, 1)
				if (!removed) return prev
				next.splice(destination.index, 0, removed)
				return next
			})

			try {
				await api(`/workspace/${workspaceId}/lists/${listId}/move`, {
					method: 'PATCH',
					accessToken,
					json: { position: destination.index }
				})
			} catch (e) {
				setAlertText(formatError(e))
				setAlertOpen(true)
				await load({ silent: true })
			} finally {
				setMoveBusy(false)
			}
			return
		}

		const snapshot = cardsDragSnapshotRef.current
		cardsDragSnapshotRef.current = null
		cardDragLocationRef.current = null

		if (!destination) {
			if (snapshot) setCardsByListId(snapshot)
			return
		}
		if (
			destination.droppableId === source.droppableId &&
			destination.index === source.index
		) {
			if (snapshot) setCardsByListId(snapshot)
			return
		}

		const cardId = Number(draggableId)
		const destListId = Number(destination.droppableId)
		const toIndex = destination.index

		setCardsByListId(prev => {
			const next = reorderCardsByListId(prev, source, destination, draggableId)
			return next ?? prev
		})

		try {
			await api(`/workspace/${workspaceId}/cards/${cardId}/move`, {
				method: 'PATCH',
				accessToken,
				json: { toListId: destListId, position: toIndex }
			})
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
			if (snapshot) {
				setCardsByListId(snapshot)
			} else {
				await loadCards()
			}
		}
	}

	async function submitAddList() {
		if (!accessToken) return
		const name = newListName.trim()
		if (name.length < LIST_NAME_MIN_LENGTH) return
		const position = nextListPosition(lists)
		setAddBusy(true)
		setMsg(null)
		try {
			const created = await api<ListRow>(
				`/workspace/${workspaceId}/board/${boardId}/lists`,
				{
					method: 'POST',
					accessToken,
					json: { name, position },
				},
			)
			setLists(prev =>
				[...prev, created].sort(
					(a, b) => a.position - b.position || a.id - b.id,
				),
			)
			setCardsByListId(prev => ({ ...prev, [created.id]: prev[created.id] ?? [] }))
			setNewListName('')
			setAddListOpen(false)
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
		} finally {
			setAddBusy(false)
		}
	}

	function cancelInlineListNameEdit() {
		setEditingListNameId(null)
		setEditingListName('')
	}

	function startInlineListNameEdit(list: ListRow) {
		setActiveListMenuId(null)
		setEditList(null)
		setEditingListNameId(list.id)
		setEditingListName(list.name)
	}

	const saveInlineListName = useCallback(
		async (listId: number) => {
			if (!accessToken || inlineListNameSaveLock.current) return
			const list = lists.find(row => row.id === listId)
			if (!list) {
				cancelInlineListNameEdit()
				return
			}
			const name = editingListName.trim()
			if (name.length < LIST_NAME_MIN_LENGTH) {
				setAlertText('Название не может быть пустым.')
				setAlertOpen(true)
				listNameInputRef.current?.focus()
				return
			}
			if (name === list.name) {
				cancelInlineListNameEdit()
				return
			}

			const previousName = list.name
			inlineListNameSaveLock.current = true
			setLists(prev =>
				prev.map(row => (row.id === listId ? { ...row, name } : row))
			)
			cancelInlineListNameEdit()

			try {
				await api(`/workspace/${workspaceId}/lists/${listId}`, {
					method: 'PATCH',
					accessToken,
					json: { name }
				})
			} catch (e) {
				setLists(prev =>
					prev.map(row =>
						row.id === listId ? { ...row, name: previousName } : row
					)
				)
				setAlertText(formatError(e))
				setAlertOpen(true)
			} finally {
				inlineListNameSaveLock.current = false
			}
		},
		[accessToken, editingListName, lists, workspaceId]
	)

	useEffect(() => {
		if (editingListNameId == null) return

		const onPointerDown = (e: PointerEvent) => {
			if (!(e.target instanceof Element)) return
			if (
				e.target.closest(`[data-list-name-edit="${editingListNameId}"]`)
			) {
				return
			}
			if (e.target.closest('.trello-list-menu-wrap')) return
			void saveInlineListName(editingListNameId)
			e.stopPropagation()
		}

		document.addEventListener('pointerdown', onPointerDown, true)
		return () =>
			document.removeEventListener('pointerdown', onPointerDown, true)
	}, [editingListNameId, saveInlineListName])

	function openEditList(list: ListRow) {
		cancelInlineListNameEdit()
		setEditList(list)
		setEditName(list.name)
		setEditColor(list.colorPreset || 'GRAY')
		setMsg(null)
	}

	function removeListFromBoard(listId: number) {
		setLists(prev => prev.filter(row => row.id !== listId))
		setCardsByListId(prev => {
			const next = { ...prev }
			delete next[listId]
			return next
		})
	}

	async function confirmDeleteList() {
		if (!accessToken || !listPendingDelete) return
		const list = listPendingDelete
		setDeleteListId(list.id)
		setMsg(null)
		try {
			await api(`/workspace/${workspaceId}/lists/${list.id}`, {
				method: 'DELETE',
				accessToken
			})
			if (editList?.id === list.id) {
				setEditList(null)
			}
			setActiveListMenuId(null)
			setListPendingDelete(null)
			removeListFromBoard(list.id)
		} catch (e) {
			setMsg(formatError(e))
		} finally {
			setDeleteListId(null)
		}
	}

	async function archiveListById(list: ListRow) {
		if (!accessToken) return
		setArchiveListBusyId(list.id)
		setActiveListMenuId(null)
		try {
			await api(`/workspace/${workspaceId}/lists/${list.id}/archive`, {
				method: 'PATCH',
				accessToken,
			})
			if (editList?.id === list.id) setEditList(null)
			removeListFromBoard(list.id)
			if (archivedListsOpen) {
				setArchivedLists(prev => [...prev, list])
			}
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
		} finally {
			setArchiveListBusyId(null)
		}
	}

	async function restoreArchivedList(list: ListRow) {
		if (!accessToken) return
		setArchiveListBusyId(list.id)
		try {
			await api(`/workspace/${workspaceId}/lists/${list.id}/unarchive`, {
				method: 'PATCH',
				accessToken,
			})
			setArchivedLists(prev => prev.filter(row => row.id !== list.id))
			setLists(prev =>
				[...prev, list].sort(
					(a, b) => a.position - b.position || a.id - b.id,
				),
			)
			setCardsByListId(prev => ({ ...prev, [list.id]: prev[list.id] ?? [] }))
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
		} finally {
			setArchiveListBusyId(null)
		}
	}

	async function submitEditList() {
		if (!accessToken || !editList) return
		const name = editName.trim()
		if (name.length < LIST_NAME_MIN_LENGTH) return
		const listId = editList.id
		const previousName = editList.name
		const previousColor = editList.colorPreset || 'GRAY'
		setEditBusy(true)
		setMsg(null)
		setLists(prev =>
			prev.map(row =>
				row.id === listId
					? { ...row, name, colorPreset: editColor }
					: row
			)
		)
		setEditList(null)
		try {
			await api(`/workspace/${workspaceId}/lists/${listId}`, {
				method: 'PATCH',
				accessToken,
				json: {
					name,
					colorPreset: editColor
				}
			})
		} catch (e) {
			setLists(prev =>
				prev.map(row =>
					row.id === listId
						? {
								...row,
								name: previousName,
								colorPreset: previousColor
							}
						: row
				)
			)
			setMsg(formatError(e))
		} finally {
			setEditBusy(false)
		}
	}

	function openCreateCard(listId: number) {
		setCreateCardListId(listId)
		setCreateCardTitle('')
	}

	function cancelCreateCard() {
		if (createCardBusy) return
		setCreateCardListId(null)
		setCreateCardTitle('')
	}

	async function submitCreateCard() {
		if (!accessToken || createCardListId == null) return
		const title = createCardTitle.trim()
		if (title.length < CARD_TITLE_MIN_LENGTH) return
		const listCards = cardsByListId[createCardListId] ?? []
		const position = nextCardPosition(listCards)
		setCreateCardBusy(true)
		try {
			const created = await api<CardRow>(
				`/workspace/${workspaceId}/lists/${createCardListId}/cards`,
				{
					method: 'POST',
					accessToken,
					json: { title, position }
				}
			)
			setCardsByListId(prev => {
				const listCards = prev[createCardListId] ?? []
				return {
					...prev,
					[createCardListId]: [...listCards, created].sort(
						(a, b) => a.position - b.position || a.id - b.id,
					),
				}
			})
			setCreateCardTitle('')
			requestAnimationFrame(() => {
				const el = createCardTextareaRef.current
				if (!el) return
				el.focus()
				adjustTextareaHeight(el)
			})
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
		} finally {
			setCreateCardBusy(false)
		}
	}

	async function archiveEditCard() {
		if (!accessToken || !editCard) return
		setEditCardBusy(true)
		try {
			await archiveCard(accessToken, workspaceId, editCard.id)
			setCardsByListId(prev => ({
				...prev,
				[editCard.listId]: (prev[editCard.listId] ?? []).filter(
					c => c.id !== editCard.id,
				),
			}))
			setEditCard(null)
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
		} finally {
			setEditCardBusy(false)
		}
	}

	function patchCardCoverOnBoard(
		cardId: number,
		listId: number,
		patch: {
			coverColorPreset?: string | null
			coverDisplayMode?: CardCoverDisplayMode
			coverImageUrl?: string | null
		},
	) {
		const merge = (c: CardRow): CardRow =>
			c.id === cardId ? { ...c, ...patch } : c
		setCardsByListId(prev => ({
			...prev,
			[listId]: (prev[listId] ?? []).map(merge),
		}))
		setEditCard(prev => (prev && prev.id === cardId ? { ...prev, ...patch } : prev))
	}

	function patchCardMetaOnBoard(
		cardId: number,
		listId: number,
		patch: Partial<Pick<CardRow, 'attachmentCount' | 'commentCount'>>,
	) {
		setCardsByListId(prev => ({
			...prev,
			[listId]: (prev[listId] ?? []).map(c =>
				c.id === cardId ? { ...c, ...patch } : c,
			),
		}))
		setEditCard(prev => (prev && prev.id === cardId ? { ...prev, ...patch } : prev))
	}

	async function refreshEditCardFromBoard() {
		if (!accessToken || !editCard) return
		try {
			const raw = await api<CardRow[]>(
				`/workspace/${workspaceId}/lists/${editCard.listId}/cards`,
				{ method: 'GET', accessToken },
			)
			const cards = Array.isArray(raw) ? raw : []
			setCardsByListId(prev => ({ ...prev, [editCard.listId]: cards }))
			const fresh = cards.find(c => c.id === editCard.id)
			if (fresh) setEditCard(fresh)
		} catch {
			await loadCards()
		}
	}

	function handleCardCoverChange(patch?: {
		coverColorPreset?: string | null
		coverDisplayMode?: CardCoverDisplayMode
		coverImageUrl?: string | null
	}) {
		if (patch && editCard) {
			patchCardCoverOnBoard(editCard.id, editCard.listId, patch)
			return
		}
		void refreshEditCardFromBoard()
	}

	function openCardDetail(card: CardRow) {
		setEditCard(card)
		setEditCardTitle(card.title)
		setEditCardDesc(card.description ?? '')
		setEditCardDue(dueDateToInputValue(card.dueDate))
		setEditCardAssigneeId(card.assigneeId)
		setEditCardReminder(
			card.reminderMinutesBefore != null
				? String(card.reminderMinutesBefore)
				: ''
		)
		setEditCardLabelIds((card.labels ?? []).map(l => l.id))
		setCardTitleEditing(false)
	}

	async function saveCardTitleInline() {
		if (!accessToken || !editCard) return
		const title = editCardTitle.trim()
		if (title.length < CARD_TITLE_MIN_LENGTH) {
			setAlertText('Название не может быть пустым.')
			setAlertOpen(true)
			return
		}
		if (title === editCard.title) {
			setCardTitleEditing(false)
			return
		}
		setEditCardBusy(true)
		try {
			await api(`/workspace/${workspaceId}/cards/${editCard.id}`, {
				method: 'PATCH',
				accessToken,
				json: { title }
			})
			const next = { ...editCard, title }
			setEditCard(next)
			setCardTitleEditing(false)
			await loadCards()
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
		} finally {
			setEditCardBusy(false)
		}
	}

	function cancelCardTitleEdit() {
		if (!editCard) return
		setEditCardTitle(editCard.title)
		setCardTitleEditing(false)
	}

	async function saveCardDescriptionInline() {
		if (!accessToken || !editCard) return
		const description = editCardDesc.trim() || null
		const prev = editCard.description?.trim() || null
		if (description === prev) return
		setEditCardBusy(true)
		try {
			await api(`/workspace/${workspaceId}/cards/${editCard.id}`, {
				method: 'PATCH',
				accessToken,
				json: { description },
			})
			const next = { ...editCard, description }
			setEditCard(next)
			await loadCards()
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
		} finally {
			setEditCardBusy(false)
		}
	}

	async function saveCardDates(due: string, reminder: string) {
		if (!accessToken || !editCard) return
		const dueDate = inputValueToIso(due)
		const reminderMinutesBefore =
			dueDate && reminder.trim() ? Number(reminder) : null
		const prevDue = editCard.dueDate ?? null
		const prevReminder = editCard.reminderMinutesBefore ?? null
		const nextReminder =
			reminderMinutesBefore != null && !Number.isNaN(reminderMinutesBefore)
				? reminderMinutesBefore
				: null
		const prevDueMs = prevDue ? new Date(prevDue).getTime() : null
		const nextDueMs = dueDate ? new Date(dueDate).getTime() : null
		if (prevDueMs === nextDueMs && prevReminder === nextReminder) {
			setEditCardDue(due)
			setEditCardReminder(reminder)
			return
		}
		setEditCardBusy(true)
		try {
			await api(`/workspace/${workspaceId}/cards/${editCard.id}`, {
				method: 'PATCH',
				accessToken,
				json: {
					dueDate,
					reminderMinutesBefore: nextReminder,
				},
			})
			const patch = {
				dueDate,
				reminderMinutesBefore: nextReminder,
			}
			setEditCard(prev => (prev ? { ...prev, ...patch } : prev))
			setEditCardDue(due)
			setEditCardReminder(reminder)
			setCardsByListId(prev => ({
				...prev,
				[editCard.listId]: (prev[editCard.listId] ?? []).map(c =>
					c.id === editCard.id ? { ...c, ...patch } : c,
				),
			}))
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
		} finally {
			setEditCardBusy(false)
		}
	}

	async function removeCardDates() {
		await saveCardDates('', '')
	}

	async function saveCardAssignee(assigneeId: number | null) {
		if (!accessToken || !editCard) return
		if (editCard.assigneeId === assigneeId) return
		setEditCardBusy(true)
		try {
			await api(`/workspace/${workspaceId}/cards/${editCard.id}`, {
				method: 'PATCH',
				accessToken,
				json: { assigneeId },
			})
			setEditCard(prev => (prev ? { ...prev, assigneeId } : prev))
			setCardsByListId(prev => ({
				...prev,
				[editCard.listId]: (prev[editCard.listId] ?? []).map(c =>
					c.id === editCard.id ? { ...c, assigneeId } : c,
				),
			}))
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
		} finally {
			setEditCardBusy(false)
		}
	}

	const toggleCardCompletion = useCallback(
		async (card: CardRow, e: MouseEvent<HTMLButtonElement>) => {
			e.preventDefault()
			e.stopPropagation()
			if (!accessToken || completionBusyId === card.id) return
			const next = !card.isCompleted
			setCompletionBusyId(card.id)
			setCardsByListId(prev => {
				const listCards = prev[card.listId] ?? []
				return {
					...prev,
					[card.listId]: listCards.map(c =>
						c.id === card.id ? { ...c, isCompleted: next } : c
					)
				}
			})
			try {
				const completionRes = await api<CardCompletionResponse>(
					`/workspace/${workspaceId}/cards/${card.id}/completion`,
					{
						method: 'PATCH',
						accessToken,
						json: { isCompleted: next }
					}
				)
				const xpRecipientId =
					card.assigneeId ?? currentUserId
				if (
					next &&
					xpRecipientId != null &&
					xpRecipientId === currentUserId &&
					completionRes.rewards &&
					hasRewardToast(completionRes.rewards, gamificationSettings)
				) {
					const rewards = completionRes.rewards
					if (
						currentUserId != null &&
						rewards.streakIncreased &&
						rewards.previousCheckinStreak !== rewards.checkinStreak
					) {
						writeCharacterStreakSnapshot(currentUserId, {
							checkinStreak: rewards.previousCheckinStreak,
							lastCheckinDayKey: null,
						})
					}
					void playRewardToastSequence(rewards)
				}
			} catch (err) {
				const code = (err as ApiError).code
				const completionSavedButXpFailed =
					next && isXpGrantErrorCode(code)
				if (!completionSavedButXpFailed) {
					setCardsByListId(prev => {
						const listCards = prev[card.listId] ?? []
						return {
							...prev,
							[card.listId]: listCards.map(c =>
								c.id === card.id
									? { ...c, isCompleted: !next }
									: c
							)
						}
					})
				}
				if (
					completionSavedButXpFailed &&
					code === 'CHARACTER_NOT_FOUND'
				) {
					// Без персонажа карточка всё равно закрыта на сервере; не блокируем продуктовый флоу.
					return
				}
				if (
					completionSavedButXpFailed &&
					(code === 'XP_EVENT_ALREADY_RECORDED' ||
						code === 'DAILY_ACTIVITY_XP_LIMIT' ||
						code === 'DAILY_TASK_XP_LIMIT' ||
						code === 'DAILY_HABIT_XP_LIMIT')
				) {
					return
				}
				setAlertText(formatError(err))
				setAlertOpen(true)
			} finally {
				setCompletionBusyId(null)
			}
		},
		[
			accessToken,
			completionBusyId,
			currentUserId,
			gamificationSettings,
			playRewardToastSequence,
			workspaceId
		]
	)

	async function confirmDeleteCard() {
		if (!accessToken || !deleteCardRow) return
		setDeleteCardBusy(true)
		try {
			await api(`/workspace/${workspaceId}/cards/${deleteCardRow.id}`, {
				method: 'DELETE',
				accessToken
			})
			setDeleteCardRow(null)
			await loadCards()
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
		} finally {
			setDeleteCardBusy(false)
		}
	}

	async function submitComment(bodyOverride?: string) {
		if (!accessToken || !editCard) return
		const body = (bodyOverride ?? commentDraft).trim()
		if (!body.length || commentSubmitBusy) return
		setCommentSubmitBusy(true)
		try {
			const created = await api<CommentRow>(
				`/workspace/${workspaceId}/cards/${editCard.id}/comments`,
				{ method: 'POST', accessToken, json: { body } }
			)
			setCommentDraft('')
			setComments(prev => [...prev, created])
			patchCardMetaOnBoard(editCard.id, editCard.listId, {
				commentCount: (editCard.commentCount ?? 0) + 1,
			})
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
		} finally {
			setCommentSubmitBusy(false)
		}
	}

	async function saveCommentEdit(commentId: number) {
		if (!accessToken) return
		const body = editCommentDraft.trim()
		if (!body.length || commentEditBusy) return
		setCommentEditBusy(true)
		try {
			const updated = await api<CommentRow>(
				`/workspace/${workspaceId}/comments/${commentId}`,
				{ method: 'PATCH', accessToken, json: { body } }
			)
			setComments(prev =>
				prev.map(c => (c.id === commentId ? updated : c))
			)
			setEditingCommentId(null)
			setEditCommentDraft('')
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
		} finally {
			setCommentEditBusy(false)
		}
	}

	async function confirmDeleteComment() {
		if (!accessToken || !deleteCommentTarget) return
		const target = deleteCommentTarget
		const id = target.id
		const card = editCard
		setDeleteCommentBusy(true)
		try {
			await api(`/workspace/${workspaceId}/comments/${id}`, {
				method: 'DELETE',
				accessToken
			})
			setComments(prev => prev.filter(c => c.id !== id))
			setDeleteCommentTarget(null)
			if (card && card.id === target.cardId) {
				patchCardMetaOnBoard(card.id, card.listId, {
					commentCount: Math.max(0, (card.commentCount ?? 1) - 1),
				})
			}
		} catch (e) {
			setAlertText(formatError(e))
			setAlertOpen(true)
		} finally {
			setDeleteCommentBusy(false)
		}
	}

	const guestListColumns = lists.map(list => (
		<div
			key={list.id}
			className={[
				'trello-list-wrap',
				listUsesLightChrome(list.colorPreset, isDark)
					? 'trello-list-wrap--light-chrome'
					: '',
			]
				.filter(Boolean)
				.join(' ')}
			style={{ backgroundColor: listColumnChromeColor(list.colorPreset, isDark) }}
		>
			<div className='trello-list-header'>
				<div className='trello-list-header-row'>
					<span className='trello-list-header-title'>
						{list.name}
					</span>
				</div>
			</div>
			<div className='trello-list-body'>
				<div className='trello-list-placeholder'>
					Войдите, чтобы видеть карточки.
				</div>
			</div>
		</div>
	))

	const memberBoardDnd = (
		<DragDropContext
			onDragStart={handleDragStart}
			onDragUpdate={handleDragUpdate}
			onDragEnd={handleDragEnd}
		>
			<div className='trello-board-scroll-surface'>
				<div className='trello-board-dnd-row'>
					<Droppable
						droppableId={BOARD_LISTS_DROPPABLE_ID}
						direction='horizontal'
						type='LIST'
					>
					{listDropProvided => (
						<div
							ref={listDropProvided.innerRef}
							{...listDropProvided.droppableProps}
							className='trello-board-lists-droppable'
						>
							{lists.map((list, listIndex) => {
								const cards = filterBoardCards(
									cardsByListId[list.id] ?? [],
									boardFilter,
									labelFilterId,
									currentUserId
								)
								return (
									<Draggable
										key={list.id}
										draggableId={`${LIST_DRAG_PREFIX}${list.id}`}
										index={listIndex}
										isDragDisabled={
											moveBusy ||
											editingListNameId === list.id
										}
									>
										{(listDragProvided, listSnapshot) => (
											<div
												ref={listDragProvided.innerRef}
												{...listDragProvided.draggableProps}
												className={[
													'trello-list-wrap',
													listSnapshot.isDragging
														? 'trello-list-wrap--dragging'
														: '',
													listUsesLightChrome(list.colorPreset, isDark)
														? 'trello-list-wrap--light-chrome'
														: '',
												]
													.filter(Boolean)
													.join(' ')}
												style={{
													backgroundColor:
														listColumnChromeColor(
															list.colorPreset,
															isDark
														),
													...listDragProvided
														.draggableProps.style
												}}
											>
												<div className='trello-list-header'>
													<div className='trello-list-header-row'>
														<div
															className={[
																'trello-list-header-drag-zone',
																editingListNameId ===
																list.id
																	? ''
																	: 'trello-list-header-row--drag-handle'
															]
																.filter(Boolean)
																.join(' ')}
															{...(editingListNameId ===
															list.id
																? {}
																: listDragProvided.dragHandleProps)}
															title={
																editingListNameId ===
																list.id
																	? undefined
																	: 'Перетащить колонку'
															}
														>
															<ListHeaderName
																list={list}
																canEdit={
																	canManageLists
																}
																editing={
																	editingListNameId ===
																	list.id
																}
																editName={
																	editingListName
																}
																busy={false}
																inputRef={
																	listNameInputRef
																}
																onStartEdit={() =>
																	startInlineListNameEdit(
																		list
																	)
																}
																onNameChange={
																	setEditingListName
																}
																onSave={() =>
																	void saveInlineListName(
																		list.id
																	)
																}
																onCancel={
																	cancelInlineListNameEdit
																}
															/>
														</div>
														<div className='trello-list-header-actions'>
															{cards.length > 0 ? (
																<span
																	className='trello-list-card-count'
																	title={`Карточек: ${cards.length}`}
																	aria-label={`Карточек в колонке: ${cards.length}`}
																>
																	{cards.length}
																</span>
															) : null}
														{canManageLists ? (
															<div
																className='trello-list-menu-wrap'
																data-list-menu-id={list.id}
															>
																<button
																	type='button'
																	className='trello-list-column-menu-btn'
																	title='Действия с колонкой'
																	aria-label='Действия с колонкой'
																	aria-haspopup='menu'
																	aria-expanded={
																		activeListMenuId === list.id
																	}
																	onMouseDown={e =>
																		e.stopPropagation()
																	}
																	onClick={e => {
																		e.stopPropagation()
																		setActiveListMenuId(prev =>
																			prev === list.id ? null : list.id,
																		)
																	}}
																>
																	<MoreHorizontalIcon className='trello-list-column-menu-icon' />
																</button>
																{activeListMenuId ===
																	list.id && (
																	<div className='trello-list-menu'>
																		<button
																			type='button'
																			className='trello-list-menu-item'
																			onClick={() => {
																				setActiveListMenuId(
																					null
																				)
																				openEditList(
																					list
																				)
																			}}
																		>
																			Редактировать
																		</button>
																		{canArchiveLists ? (
																			<button
																				type='button'
																				className='trello-list-menu-item'
																				disabled={
																					archiveListBusyId ===
																					list.id
																				}
																				onClick={() =>
																					void archiveListById(
																						list
																					)
																				}
																			>
																				В архив
																			</button>
																		) : null}
																		<button
																			type='button'
																			className='trello-list-menu-item trello-list-menu-item-danger'
																			disabled={
																				deleteListId ===
																				list.id
																			}
																			onClick={() => {
																				setActiveListMenuId(
																					null
																				)
																				setListPendingDelete(
																					list
																				)
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
												</div>
												<div className='trello-list-body'>
													<TrelloListCardsPane
														listId={list.id}
														cardCount={cards.length}
														chromeColor={listColumnChromeColor(
															list.colorPreset,
															isDark
														)}
														addCardFooter={
															createCardListId ===
															list.id ? (
																<InlineAddCardForm
																	title={
																		createCardTitle
																	}
																	busy={
																		createCardBusy
																	}
																	textareaRef={
																		createCardTextareaRef
																	}
																	onTitleChange={
																		setCreateCardTitle
																	}
																	onSubmit={() =>
																		void submitCreateCard()
																	}
																	onCancel={
																		cancelCreateCard
																	}
																/>
															) : (
																<button
																	type='button'
																	className='trello-add-card-btn'
																	onClick={() =>
																		openCreateCard(
																			list.id
																		)
																	}
																>
																	<span className='trello-add-card-btn-plus' aria-hidden>+</span><span className='trello-add-card-btn-label'>Добавить карточку</span>
																</button>
															)
														}
													>
														<Droppable
															droppableId={String(
																list.id
															)}
														>
														{provided => (
															<div
																ref={
																	provided.innerRef
																}
																{...provided.droppableProps}
																className='trello-cards-droppable'
															>
																{cards.map(
																	(
																		card,
																		index
																	) => (
																		<Draggable
																			key={
																				card.id
																			}
																			draggableId={String(
																				card.id
																			)}
																			index={
																				index
																			}
																		>
																			{(
																				dragProvided,
																				snapshot
																			) => {
																				const {
																					style: dragStyle,
																					...dragRest
																				} = dragProvided.draggableProps
																				const bannerCoverColor =
																					card.coverColorPreset &&
																					card.coverDisplayMode ===
																						'BANNER' &&
																					!card.coverImageUrl
																						? listHeaderColor(
																								card.coverColorPreset,
																							)
																						: null
																				const fullCoverColor =
																					card.coverColorPreset &&
																					card.coverDisplayMode ===
																						'FULL' &&
																					!card.coverImageUrl
																						? listHeaderColor(
																								card.coverColorPreset,
																							)
																						: null
																				const hasCoverStrip =
																					Boolean(
																						card.coverImageUrl ||
																							bannerCoverColor,
																					)
																				return (
																				<div
																					ref={
																						dragProvided.innerRef
																					}
																					{...dragRest}
																					{...dragProvided.dragHandleProps}
																					className={[
																						'trello-card trello-card--clickable',
																						snapshot.isDragging
																							? 'trello-card--dragging'
																							: '',
																						card.isCompleted
																							? 'trello-card--completed'
																							: '',
																						hasCoverStrip
																							? 'trello-card--has-cover'
																							: '',
																						fullCoverColor
																							? 'trello-card--full-color-cover'
																							: '',
																					]
																						.filter(
																							Boolean
																						)
																						.join(
																							' '
																						)}
																					style={{
																						...dragStyle,
																						...(snapshot.isDragging
																							? { zIndex: 11_000 }
																							: {}),
																						...(fullCoverColor
																							? {
																									backgroundColor:
																										fullCoverColor,
																								}
																							: {}),
																					}}
																				>
																					<div className='trello-card-inner'>
																						{hasCoverStrip ? (
																							<div
																								className={
																									bannerCoverColor &&
																									!card.coverImageUrl
																										? 'trello-card-cover-wrap trello-card-cover-wrap--color'
																										: 'trello-card-cover-wrap'
																								}
																								style={
																									bannerCoverColor &&
																									!card.coverImageUrl
																										? {
																												backgroundColor:
																													bannerCoverColor,
																											}
																										: undefined
																								}
																								role='button'
																								tabIndex={0}
																								onClick={() =>
																									openCardDetail(
																										card,
																									)
																								}
																								onKeyDown={e => {
																									if (
																										e.key ===
																											'Enter' ||
																										e.key ===
																											' '
																									) {
																										e.preventDefault()
																										openCardDetail(
																											card,
																										)
																									}
																								}}
																							>
																								{card.coverImageUrl ? (
																									<img
																										className='trello-card-cover-img'
																										src={
																											card.coverImageUrl
																										}
																										alt=''
																									/>
																								) : null}
																							</div>
																						) : null}
																						<CardLabelStrip
																							labels={
																								card.labels
																							}
																						/>
																						<div
																							className={
																								card.isCompleted
																									? 'trello-card-title trello-card-title--in-list trello-card-title--done'
																									: 'trello-card-title trello-card-title--in-list'
																							}
																							role='button'
																							tabIndex={0}
																							aria-label={`Карточка: ${card.title}`}
																							onClick={() =>
																								openCardDetail(card)
																							}
																							onKeyDown={e => {
																								if (
																									e.key === 'Enter' ||
																									e.key === ' '
																								) {
																									e.preventDefault()
																									openCardDetail(card)
																								}
																							}}
																						>
																							<div className='trello-card-title-head'>
																								<div className='trello-card-complete-slot'>
																									<button
																										type='button'
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
																										aria-pressed={Boolean(
																											card.isCompleted
																										)}
																										disabled={
																											completionBusyId ===
																											card.id
																										}
																										onClick={e =>
																											void toggleCardCompletion(
																												card,
																												e
																											)
																										}
																										onMouseDown={e =>
																											e.stopPropagation()
																										}
																									>
																										{card.isCompleted ? (
																											<span
																												className='trello-card-complete-check'
																												aria-hidden
																											>
																												✓
																											</span>
																										) : null}
																									</button>
																								</div>
																								<div className='trello-card-title-main'>
																									<span className='trello-card-title-text'>
																										{card.title}
																									</span>
																								</div>
																							</div>
																							<CardListBadges
																								attachmentCount={
																									card.attachmentCount
																								}
																								commentCount={
																									card.commentCount
																								}
																							/>
																						</div>
																					</div>
																				</div>
																				)
																			}}
																		</Draggable>
																	)
																)}
																{
																	provided.placeholder
																}
															</div>
														)}
														</Droppable>
													</TrelloListCardsPane>
												</div>
											</div>
										)}
									</Draggable>
								)
							})}
							{listDropProvided.placeholder}
						</div>
					)}
				</Droppable>
				<div className='trello-list-wrap trello-add-list-wrap trello-add-list-wrap--inline'>
					<button
						type='button'
						className='trello-add-list-btn'
						onClick={() => {
							setAddListOpen(true)
							setNewListName('')
						}}
					>
						+ Добавить колонку
					</button>
				</div>
			</div>
		</div>
		</DragDropContext>
	)

	return (
		<div className='trello-board-viewport'>
			<header className='trello-board-topbar trello-topbar-stripe-3col trello-boards-topbar--sticky'>
				<div className='trello-topbar-stripe-left'>
					<SpaLink className='trello-top-left-brand trello-top-left-brand--stripe' to='/workspaces'>
						<AppLogo />
						<span className='trello-top-left-brand-text'>
							Questflow
						</span>
					</SpaLink>
					<SpaLink
						className='trello-btn trello-btn-topbar-nav trello-topbar-back-btn'
						to={`/workspaces/${workspaceId}/boards`}
					>
						← Доски
					</SpaLink>
				</div>
				<h1 className='trello-topbar-stripe-center'>
					{loading ? '…' : (board?.name ?? 'Доска')}
				</h1>
				<div className='trello-topbar-actions'>
					{accessToken ? (
						<BoardTopbarMenu
							boardFilter={boardFilter}
							onBoardFilterChange={setBoardFilter}
							wsLabels={wsLabels}
							labelFilterId={labelFilterId}
							onLabelFilterChange={setLabelFilterId}
							onSearch={() => setSearchOpen(true)}
							onLabels={() => setLabelsModalOpen(true)}
							onArchivedLists={() => setArchivedListsOpen(true)}
							canArchiveLists={canArchiveLists}
						/>
					) : null}
				</div>
			</header>

			{!accessToken && (
				<div className='trello-board-banner'>
					Нужен вход.{' '}
					<SpaLink className='trello-board-banner-link' to='/'>
						На главную
					</SpaLink>
				</div>
			)}

			{msg && (
				<div className='trello-board-banner trello-board-banner-error'>
					{msg}
				</div>
			)}

			<div
				className='trello-board-lists-scroll'
				ref={boardListsScrollRef}
				onPointerDownCapture={handleBoardListsPanDown}
				onPointerMove={handleBoardListsPanMove}
				onPointerUp={handleBoardListsPanEnd}
				onPointerCancel={handleBoardListsPanEnd}
			>
				{loading ? (
					<div className='trello-board-loading'>Загрузка…</div>
				) : !accessToken ? (
					lists.length === 0 ? (
						<div className='trello-board-loading'>
							Колонок пока нет.
						</div>
					) : (
						<div className='trello-board-scroll-surface'>
							<div className='trello-board-dnd-row'>
								{guestListColumns}
							</div>
						</div>
					)
				) : lists.length === 0 ? (
					<div className='trello-board-empty-auth'>
						<div className='trello-board-loading'>
							Колонок пока нет.
						</div>
						<div className='trello-list-wrap trello-add-list-wrap trello-add-list-wrap--inline'>
							<button
								type='button'
								className='trello-add-list-btn'
								onClick={() => {
									setAddListOpen(true)
									setNewListName('')
								}}
							>
								+ Добавить колонку
							</button>
						</div>
					</div>
				) : (
					memberBoardDnd
				)}
			</div>

			{addListOpen && (
				<div
					className='trello-modal-backdrop'
					role='presentation'
					onClick={() => !addBusy && setAddListOpen(false)}
				>
					<div
						className='trello-modal trello-modal--board-form'
						role='dialog'
						aria-modal
						onClick={e => e.stopPropagation()}
					>
						<div className='trello-modal-head'>
							<h2 className='trello-modal-title'>
								Новая колонка
							</h2>
							<button
								type='button'
								className='trello-modal-close'
								onClick={() =>
									!addBusy && setAddListOpen(false)
								}
								aria-label='Закрыть'
							>
								×
							</button>
						</div>
						<ModalForm
							onSubmit={submitAddList}
							disabled={
								newListName.trim().length < LIST_NAME_MIN_LENGTH || addBusy
							}
						>
							<div className='trello-modal-body'>
								<label className='trello-field'>
									<span className='trello-label'>Название</span>
									<input
										className='trello-input'
										value={newListName}
										onChange={e =>
											setNewListName(e.target.value)
										}
										maxLength={50}
										autoFocus
									/>
								</label>
							</div>
							<div className='trello-modal-foot'>
								<button
									type='button'
									className='trello-btn trello-btn-ghost'
									onClick={() =>
										!addBusy && setAddListOpen(false)
									}
								>
									Отмена
								</button>
								<button
									type='submit'
									className='trello-btn trello-btn-primary'
									disabled={
										newListName.trim().length < LIST_NAME_MIN_LENGTH || addBusy
									}
								>
									{addBusy ? 'Добавление…' : 'Добавить'}
								</button>
							</div>
						</ModalForm>
					</div>
				</div>
			)}

			{editCard && (
				<CardDetailModalTrello
					card={{
						id: editCard.id,
						title: editCard.title,
						isCompleted: editCard.isCompleted,
						coverImageUrl: editCard.coverImageUrl,
						coverColorPreset: editCard.coverColorPreset,
						coverDisplayMode: editCard.coverDisplayMode,
						attachmentCount: editCard.attachmentCount,
						labels: editCard.labels,
						createdAt: editCard.createdAt,
					}}
					listName={listNameForCard}
					workspaceId={workspaceId}
					accessToken={accessToken}
					currentUserId={currentUserId}
					currentUserName={currentUserName}
					busy={editCardBusy}
					onClose={() => !editCardBusy && setEditCard(null)}
					onDelete={() => {
						const row = editCard
						setEditCard(null)
						setDeleteCardRow(row)
					}}
					onArchive={() => void archiveEditCard()}
					onCoverChange={handleCardCoverChange}
					onToggleComplete={(e) => {
						if (!editCard) return
						void toggleCardCompletion(editCard, e)
						setEditCard((prev) =>
							prev ? { ...prev, isCompleted: !prev.isCompleted } : prev,
						)
					}}
					completionBusy={completionBusyId === editCard.id}
					title={editCardTitle}
					onTitleChange={setEditCardTitle}
					titleEditing={cardTitleEditing}
					onTitleEditStart={() => {
						if (editCardBusy) return
						setCardTitleEditing(true)
					}}
					onTitleSave={() => void saveCardTitleInline()}
					onTitleCancel={cancelCardTitleEdit}
					titleInputRef={cardTitleInputRef}
					description={editCardDesc}
					onDescriptionChange={setEditCardDesc}
					onDescriptionSave={() => void saveCardDescriptionInline()}
					onDescriptionCancel={() => {
						if (!editCard) return
						setEditCardDesc(editCard.description ?? '')
					}}
					due={editCardDue}
					reminder={editCardReminder}
					onDatesSave={saveCardDates}
					onDatesRemove={removeCardDates}
					assigneeId={editCardAssigneeId}
					onAssigneeChange={id => {
						setEditCardAssigneeId(id)
						void saveCardAssignee(id)
					}}
					labelIds={editCardLabelIds}
					onLabelIdsChange={setEditCardLabelIds}
					wsLabels={wsLabels}
					members={workspaceMembers}
					canManageWorkspace={canManageWorkspace(myRole)}
					comments={comments}
					commentsLoading={commentsLoading}
					commentDraft={commentDraft}
					onCommentDraftChange={setCommentDraft}
					commentSubmitBusy={commentSubmitBusy}
					onSubmitComment={body => void submitComment(body)}
					formatCommentRelativeAgo={formatCommentRelativeAgo}
					nowTick={nowTick}
					editingCommentId={editingCommentId}
					editCommentDraft={editCommentDraft}
					onEditCommentDraftChange={setEditCommentDraft}
					commentEditBusy={commentEditBusy}
					onStartEditComment={c => {
						setEditingCommentId(c.id)
						setEditCommentDraft(c.body)
					}}
					onCancelEditComment={() => {
						setEditingCommentId(null)
						setEditCommentDraft('')
					}}
					onSaveCommentEdit={id => void saveCommentEdit(id)}
					onDeleteComment={c => {
						setEditingCommentId(null)
						setEditCommentDraft('')
						const row = comments.find(x => x.id === c.id)
						if (row) setDeleteCommentTarget(row)
					}}
				/>
			)}

			{deleteCardRow && (
				<div
					className='trello-modal-backdrop'
					role='presentation'
					onClick={() => !deleteCardBusy && setDeleteCardRow(null)}
				>
					<div
						className='trello-modal trello-modal-narrow'
						role='dialog'
						aria-modal
						onClick={e => e.stopPropagation()}
					>
						<div className='trello-modal-head'>
							<h2 className='trello-modal-title'>
								Удалить карточку?
							</h2>
							<button
								type='button'
								className='trello-modal-close'
								onClick={() =>
									!deleteCardBusy && setDeleteCardRow(null)
								}
								aria-label='Закрыть'
							>
								×
							</button>
						</div>
						<div className='trello-modal-body'>
							<p className='trello-confirm-text'>
								Карточка «<strong>{deleteCardRow.title}</strong>
								» будет удалена.
							</p>
						</div>
						<div className='trello-modal-foot'>
							<button
								type='button'
								className='trello-btn trello-btn-ghost'
								onClick={() =>
									!deleteCardBusy && setDeleteCardRow(null)
								}
							>
								Отмена
							</button>
							<button
								type='button'
								className='trello-btn trello-btn-danger'
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
					className='trello-modal-backdrop trello-alert-modal-backdrop'
					role='presentation'
					onClick={() =>
						!deleteCommentBusy && setDeleteCommentTarget(null)
					}
				>
					<div
						className='trello-modal trello-modal-narrow'
						role='dialog'
						aria-modal
						onClick={e => e.stopPropagation()}
					>
						<div className='trello-modal-head'>
							<h2 className='trello-modal-title'>
								Удалить комментарий?
							</h2>
							<button
								type='button'
								className='trello-modal-close'
								onClick={() =>
									!deleteCommentBusy &&
									setDeleteCommentTarget(null)
								}
								aria-label='Закрыть'
							>
								×
							</button>
						</div>
						<div className='trello-modal-body'>
							<p className='trello-confirm-text'>
								Комментарий будет удалён без возможности
								восстановления.
							</p>
						</div>
						<div className='trello-modal-foot'>
							<button
								type='button'
								className='trello-btn trello-btn-ghost'
								onClick={() =>
									!deleteCommentBusy &&
									setDeleteCommentTarget(null)
								}
							>
								Отмена
							</button>
							<button
								type='button'
								className='trello-btn trello-btn-danger'
								disabled={deleteCommentBusy}
								onClick={() => void confirmDeleteComment()}
							>
								{deleteCommentBusy ? 'Удаление…' : 'Удалить'}
							</button>
						</div>
					</div>
				</div>
			)}

			{rewardToast?.step.kind === 'checkin' ? (
				<CheckinRewardToast
					rewards={rewardToast.step.rewards}
					toastId={rewardToast.id}
					showXp={rewardToast.step.showXp}
					disableStreakAnimation={rewardToast.step.disableStreakAnimation}
				/>
			) : null}
			{rewardToast?.step.kind === 'task' ? (
				<TaskRewardToast
					rewards={rewardToast.step.rewards}
					toastId={rewardToast.id}
				/>
			) : null}

			<AlertModal
				open={alertOpen}
				message={alertText}
				title={isRateLimitMessage(alertText) ? 'Лимит запросов' : undefined}
				onClose={() => setAlertOpen(false)}
			/>

			{archivedListsOpen && canArchiveLists ? (
				<div
					className='trello-modal-backdrop'
					role='presentation'
					onClick={() => !archiveListBusyId && setArchivedListsOpen(false)}
				>
					<div
						className='trello-modal trello-modal-archived-lists'
						role='dialog'
						aria-modal
						aria-labelledby='archived-lists-modal-title'
						onClick={e => e.stopPropagation()}
					>
						<div className='trello-modal-head'>
							<h2 className='trello-modal-title' id='archived-lists-modal-title'>
								Архив колонок
							</h2>
							<button
								type='button'
								className='trello-modal-close'
								onClick={() => !archiveListBusyId && setArchivedListsOpen(false)}
								aria-label='Закрыть'
							>
								×
							</button>
						</div>
						<div className='trello-modal-body trello-archived-lists-modal-body'>
							{archivedLists.length === 0 ? (
								<p className='trello-settings-card-hint'>
									Нет архивных колонок.
								</p>
							) : (
								<ul className='trello-archived-lists'>
									{archivedLists.map(list => (
										<li key={list.id}>
											<span className='trello-archived-lists-name'>
												{list.name}
											</span>
											<div className='trello-archived-lists-actions'>
												<button
													type='button'
													className='trello-btn trello-btn-sm trello-btn-ghost'
													disabled={archiveListBusyId === list.id}
													onClick={() =>
														void restoreArchivedList(list)
													}
												>
													{archiveListBusyId === list.id
														? '…'
														: 'Восстановить'}
												</button>
												{canManageLists ? (
													<button
														type='button'
														className='trello-btn trello-btn-sm trello-btn-danger-ghost'
														disabled={
															deleteListId === list.id ||
															archiveListBusyId === list.id
														}
														onClick={() =>
															setListPendingDelete(list)
														}
													>
														Удалить
													</button>
												) : null}
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
						<div className='trello-modal-foot'>
							<button
								type='button'
								className='trello-btn trello-btn-ghost'
								onClick={() => !archiveListBusyId && setArchivedListsOpen(false)}
							>
								Закрыть
							</button>
						</div>
					</div>
				</div>
			) : null}

			{listPendingDelete && (
				<div
					className='trello-modal-backdrop'
					role='presentation'
					onClick={() => !deleteListId && setListPendingDelete(null)}
				>
					<div
						className='trello-modal trello-modal-narrow'
						role='dialog'
						aria-modal
						onClick={e => e.stopPropagation()}
					>
						<div className='trello-modal-head'>
							<h2 className='trello-modal-title'>
								Удалить колонку?
							</h2>
							<button
								type='button'
								className='trello-modal-close'
								onClick={() =>
									!deleteListId && setListPendingDelete(null)
								}
								aria-label='Закрыть'
							>
								×
							</button>
						</div>
						<div className='trello-modal-body'>
							<p className='trello-confirm-text'>
								Колонка «
								<strong>{listPendingDelete.name}</strong>» будет
								удалена без возможности восстановления.
							</p>
						</div>
						<div className='trello-modal-foot'>
							<button
								type='button'
								className='trello-btn trello-btn-ghost'
								onClick={() =>
									!deleteListId && setListPendingDelete(null)
								}
							>
								Отмена
							</button>
							<button
								type='button'
								className='trello-btn trello-btn-danger'
								disabled={deleteListId === listPendingDelete.id}
								onClick={() => void confirmDeleteList()}
							>
								{deleteListId === listPendingDelete.id
									? 'Удаление…'
									: 'Удалить'}
							</button>
						</div>
					</div>
				</div>
			)}

			{editList && (
				<div
					className='trello-modal-backdrop'
					role='presentation'
					onClick={() => !editBusy && setEditList(null)}
				>
					<div
						className='trello-modal trello-modal--board-form'
						role='dialog'
						aria-modal
						onClick={e => e.stopPropagation()}
					>
						<div className='trello-modal-head'>
							<h2 className='trello-modal-title'>Колонка</h2>
							<button
								type='button'
								className='trello-modal-close'
								onClick={() => !editBusy && setEditList(null)}
								aria-label='Закрыть'
							>
								×
							</button>
						</div>
						<ModalForm
							onSubmit={submitEditList}
							disabled={
								editName.trim().length < LIST_NAME_MIN_LENGTH || editBusy
							}
						>
							<div className='trello-modal-body'>
								<label className='trello-field'>
									<span className='trello-label'>Название</span>
									<input
										className='trello-input'
										value={editName}
										onChange={e => setEditName(e.target.value)}
										maxLength={50}
									/>
								</label>
								<label className='trello-field'>
									<span className='trello-label'>Цвет</span>
									<div
										className='trello-color-grid'
										role='listbox'
										aria-label='Цвет колонки'
									>
										{LIST_COLOR_PRESET_KEYS.map(key => (
											<button
												key={key}
												type='button'
												className={
													key === editColor
														? 'trello-color-swatch trello-color-swatch-active'
														: 'trello-color-swatch'
												}
												style={{
													backgroundColor:
														listHeaderColor(key)
												}}
												aria-label={key}
												aria-selected={key === editColor}
												onClick={() => setEditColor(key)}
											/>
										))}
									</div>
								</label>
							</div>
							<div className='trello-modal-foot'>
								<button
									type='button'
									className='trello-btn trello-btn-ghost'
									onClick={() => !editBusy && setEditList(null)}
								>
									Отмена
								</button>
								<button
									type='submit'
									className='trello-btn trello-btn-primary'
									disabled={
										editName.trim().length < LIST_NAME_MIN_LENGTH || editBusy
									}
								>
									{editBusy ? 'Сохранение…' : 'Сохранить'}
								</button>
							</div>
						</ModalForm>
					</div>
				</div>
			)}

			{accessToken && (
				<WorkspaceSearchModal
					accessToken={accessToken}
					workspaceId={workspaceId}
					open={searchOpen}
					onClose={() => setSearchOpen(false)}
				/>
			)}
			{accessToken && (
				<WorkspaceLabelsModal
					open={labelsModalOpen}
					accessToken={accessToken}
					workspaceId={workspaceId}
					labels={wsLabels}
					canManage={canManageLabelsPerm}
					onClose={() => setLabelsModalOpen(false)}
					onLabelsChange={() => {
						void reloadWsLabels()
						void loadCards()
					}}
				/>
			)}

			{accessToken && (
				<BoardSwitcherBar
					accessToken={accessToken}
					workspaceId={workspaceId}
					currentBoardId={boardId}
				/>
			)}
		</div>
	)
}
