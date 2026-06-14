import { useCallback, useEffect, useRef, useState } from 'react';
import type { HabitPolarity, PersonalDailyDto, PersonalHabitDto, PersonalTodoDto } from '@entities/personal/model/types';
import { fetchCompletedPersonalTodos } from '@entities/personal/api/personalApi';
import {
  buildRewardToastSteps,
  delayMs,
  hasRewardToast,
  REWARD_TOAST_GAP_MS,
  REWARD_TOAST_VISIBLE_MS,
  type XpGrantRewards,
} from '@entities/reward';
import { useGamificationSettings } from '@entities/user-settings';
import { CheckinRewardToast, TaskRewardToast } from '@widgets/reward-grant-toast/RewardGrantToast';
import { usePersonalBoard } from './usePersonalBoard';
import { PersonalCardMenu } from './PersonalItemActions';
type Props = {
  accessToken: string | null;
};

function HabitCard({
  habit,
  busy,
  onLog,
  onSave,
  onDelete,
}: {
  habit: PersonalHabitDto;
  busy: boolean;
  onLog: (id: number, direction: 'positive' | 'negative') => void;
  onSave: (id: number, payload: { title: string; polarity?: HabitPolarity }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const showPlus = habit.polarity !== 'NEGATIVE';
  const showMinus = habit.polarity !== 'POSITIVE';
  const disabled = busy;
  return (
    <div className="personal-card personal-card--habit personal-card--has-menu">
      {showPlus ? (
        <button
          type="button"
          className={`personal-habit-btn personal-habit-btn--plus${habit.polarity === 'BOTH' && habit.negativeCount > habit.positiveCount ? '' : ''}`}
          disabled={disabled}
          aria-label="Плюс"
          onClick={() => onLog(habit.id, 'positive')}
        >
          +
        </button>
      ) : (
        <span className="personal-habit-btn personal-habit-btn--spacer" aria-hidden />
      )}
      <div className="personal-card-body">
        <div className="personal-card-title-row">
          <span className="personal-card-title">{habit.title}</span>
          <div className="personal-card-actions">
            {habit.streakCurrent > 0 ? (
              <span className="personal-card-meta">🔥 {habit.streakCurrent}</span>
            ) : null}
            <PersonalCardMenu
              kind="habit"
              title={habit.title}
              polarity={habit.polarity}
              busy={busy}
              onSave={(payload) => onSave(habit.id, payload)}
              onDelete={() => onDelete(habit.id)}
            />
          </div>
        </div>
      </div>
      {showMinus ? (
        <button
          type="button"
          className="personal-habit-btn personal-habit-btn--minus"
          disabled={disabled}
          aria-label="Минус"
          onClick={() => onLog(habit.id, 'negative')}
        >
          −
        </button>
      ) : (
        <span className="personal-habit-btn personal-habit-btn--spacer" aria-hidden />
      )}
    </div>
  );
}

function PersonalCompleteBtn({
  done,
  busy,
  label,
  onClick,
}: {
  done: boolean;
  busy: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="personal-complete-slot">
      <button
        type="button"
        className={
          done
            ? 'trello-card-complete-btn trello-card-complete-btn--done'
            : 'trello-card-complete-btn'
        }
        disabled={done || busy}
        aria-label={label}
        aria-pressed={done}
        onClick={onClick}
      >
        {done ? (
          <span className="trello-card-complete-check" aria-hidden>
            ✓
          </span>
        ) : null}
      </button>
    </div>
  );
}

function DailyCard({
  daily,
  busy,
  onComplete,
  onSave,
  onDelete,
}: {
  daily: PersonalDailyDto;
  busy: boolean;
  onComplete: (id: number) => void;
  onSave: (id: number, title: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  return (
    <div className="personal-card personal-card--daily personal-card--has-menu">
      <div className="personal-card-row">
        <PersonalCompleteBtn
          done={Boolean(daily.completedToday)}
          busy={busy}
          label={daily.completedToday ? 'Выполнено' : 'Отметить выполненным'}
          onClick={() => onComplete(daily.id)}
        />
        <div className="personal-card-body">
          <div className="personal-card-title-row">
            <span className="personal-card-title">{daily.title}</span>
            <div className="personal-card-actions">
              {daily.streakCurrent > 0 ? (
                <span className="personal-card-meta">🔥 {daily.streakCurrent}</span>
              ) : null}
              <PersonalCardMenu
                kind="daily"
                title={daily.title}
                busy={busy}
                onSave={({ title }) => onSave(daily.id, title)}
                onDelete={() => onDelete(daily.id)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TodoCard({
  todo,
  busy,
  onComplete,
  onSave,
  onDelete,
}: {
  todo: PersonalTodoDto;
  busy: boolean;
  onComplete: (id: number) => void;
  onSave: (id: number, title: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  return (
    <div className="personal-card personal-card--todo personal-card--has-menu">
      <div className="personal-card-row">
        <PersonalCompleteBtn
          done={false}
          busy={busy}
          label="Выполнить задачу"
          onClick={() => onComplete(todo.id)}
        />
        <div className="personal-card-body">
          <div className="personal-card-title-row">
            <span className="personal-card-title">{todo.title}</span>
            <PersonalCardMenu
              kind="todo"
              title={todo.title}
              busy={busy}
              onSave={({ title }) => onSave(todo.id, title)}
              onDelete={() => onDelete(todo.id)}
            />
          </div>
          {todo.dueAt ? (
            <span className="personal-card-meta">
              до {new Date(todo.dueAt).toLocaleDateString('ru-RU')}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const HABIT_POLARITY_OPTIONS: { value: HabitPolarity; label: string }[] = [
  { value: 'POSITIVE', label: 'Положительная (+)' },
  { value: 'NEGATIVE', label: 'Отрицательная (−)' },
  { value: 'BOTH', label: 'Обе (+/−)' },
];

function PersonalAddHabitRow({
  busy,
  onAdd,
}: {
  busy: boolean;
  onAdd: (title: string, polarity: HabitPolarity) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [polarity, setPolarity] = useState<HabitPolarity>('POSITIVE');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function close() {
    setOpen(false);
    setValue('');
    setPolarity('POSITIVE');
  }

  if (!open) {
    return (
      <button
        type="button"
        className="personal-add-trigger"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        + Добавить привычку
      </button>
    );
  }

  return (
    <form
      className="personal-add-form"
      onSubmit={(e) => {
        e.preventDefault();
        const title = value.trim();
        if (!title || busy) return;
        void Promise.resolve(onAdd(title, polarity)).then(() => close());
      }}
    >
      <input
        ref={inputRef}
        className="personal-add-input trello-inline-add-card-input"
        type="text"
        placeholder="Название привычки"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        maxLength={200}
        aria-label="Название привычки"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
      />
      <fieldset className="personal-habit-polarity">
        <legend className="personal-habit-polarity-legend">Тип привычки</legend>
        <div className="personal-habit-polarity-options">
          {HABIT_POLARITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                polarity === option.value
                  ? 'personal-habit-polarity-btn personal-habit-polarity-btn--active'
                  : 'personal-habit-polarity-btn'
              }
              disabled={busy}
              aria-pressed={polarity === option.value}
              onClick={() => setPolarity(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="trello-inline-add-card-actions">
        <button
          type="submit"
          className="trello-inline-add-card-submit"
          disabled={busy || !value.trim()}
        >
          {busy ? 'Добавление…' : 'Добавить'}
        </button>
        <button
          type="button"
          className="trello-inline-add-card-cancel"
          disabled={busy}
          aria-label="Отмена"
          onClick={close}
        >
          ×
        </button>
      </div>
    </form>
  );
}

function PersonalAddRow({
  placeholder,
  busy,
  onAdd,
}: {
  placeholder: string;
  busy: boolean;
  onAdd: (title: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function close() {
    setOpen(false);
    setValue('');
  }

  if (!open) {
    return (
      <button
        type="button"
        className="personal-add-trigger"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        + {placeholder}
      </button>
    );
  }

  return (
    <form
      className="personal-add-form"
      onSubmit={(e) => {
        e.preventDefault();
        const title = value.trim();
        if (!title || busy) return;
        void Promise.resolve(onAdd(title)).then(() => close());
      }}
    >
      <input
        ref={inputRef}
        className="personal-add-input trello-inline-add-card-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        maxLength={200}
        aria-label={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
      />
      <div className="trello-inline-add-card-actions">
        <button
          type="submit"
          className="trello-inline-add-card-submit"
          disabled={busy || !value.trim()}
        >
          {busy ? 'Добавление…' : 'Добавить'}
        </button>
        <button
          type="button"
          className="trello-inline-add-card-cancel"
          disabled={busy}
          aria-label="Отмена"
          onClick={close}
        >
          ×
        </button>
      </div>
    </form>
  );
}

function PersonalColumn({
  title,
  count,
  headerExtra,
  children,
  footer,
}: {
  title: string;
  count?: number;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="personal-column">
      <header className="personal-column-head">
        <h2 className="personal-column-title">
          {title}
          {count != null && count > 0 ? (
            <span className="personal-column-badge">{count}</span>
          ) : null}
        </h2>
        {headerExtra ?? null}
      </header>
      <div className="personal-column-list">{children}</div>
      {footer ? <div className="personal-column-footer">{footer}</div> : null}
    </section>
  );
}

const COMPLETED_TODOS_PAGE_SIZE = 10;

function PersonalHistoryIcon() {
  return (
    <svg
      className="personal-history-trigger-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function formatCompletedAt(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PersonalTodoArchiveModal({
  open,
  accessToken,
  busy,
  onClose,
  onRestore,
}: {
  open: boolean;
  accessToken: string | null;
  busy: boolean;
  onClose: () => void;
  onRestore: (todoId: number) => Promise<void>;
}) {
  const [items, setItems] = useState<PersonalTodoDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(total / COMPLETED_TODOS_PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * COMPLETED_TODOS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * COMPLETED_TODOS_PAGE_SIZE);

  const loadPage = useCallback(
    async (pageIndex: number) => {
      if (!accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCompletedPersonalTodos(accessToken, {
          limit: COMPLETED_TODOS_PAGE_SIZE,
          offset: pageIndex * COMPLETED_TODOS_PAGE_SIZE,
        });
        setItems(data.items);
        setTotal(data.total);
        setPage(pageIndex);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить историю');
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (!open || !accessToken) return;
    void loadPage(0);
  }, [open, accessToken, loadPage]);

  if (!open) return null;

  async function handleRestore(todoId: number) {
    await onRestore(todoId);
    if (!accessToken) return;
    const data = await fetchCompletedPersonalTodos(accessToken, {
      limit: COMPLETED_TODOS_PAGE_SIZE,
      offset: page * COMPLETED_TODOS_PAGE_SIZE,
    });
    if (data.items.length === 0 && page > 0) {
      await loadPage(page - 1);
      return;
    }
    setItems(data.items);
    setTotal(data.total);
  }

  return (
    <div
      className="trello-modal-backdrop"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        className="trello-modal personal-todo-archive-modal"
        role="dialog"
        aria-modal
        aria-labelledby="personal-todo-archive-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="trello-modal-head">
          <h2 id="personal-todo-archive-title" className="trello-modal-title">
            История задач
          </h2>
          <button
            type="button"
            className="trello-modal-close"
            onClick={() => !busy && onClose()}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="trello-modal-body personal-todo-archive-body">
          {loading ? <p className="personal-page-hint">Загрузка…</p> : null}
          {error ? <p className="personal-page-error">{error}</p> : null}
          {!loading && !error && items.length === 0 ? (
            <p className="personal-page-hint">Выполненных задач пока нет.</p>
          ) : null}
          {!loading && items.length > 0 ? (
            <ul className="personal-todo-archive-list">
              {items.map((todo) => (
                <li key={todo.id} className="personal-todo-archive-item">
                  <div className="personal-todo-archive-item-main">
                    <span className="personal-todo-archive-title">{todo.title}</span>
                    {todo.completedAt ? (
                      <span className="personal-todo-archive-date">
                        {formatCompletedAt(todo.completedAt)}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="trello-btn trello-btn-secondary personal-todo-archive-restore"
                    disabled={busy}
                    onClick={() => void handleRestore(todo.id)}
                  >
                    Вернуть
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {total > COMPLETED_TODOS_PAGE_SIZE ? (
          <div className="trello-modal-foot personal-todo-archive-foot">
            <span className="personal-todo-archive-range">
              {rangeStart}–{rangeEnd} из {total}
            </span>
            <div className="personal-todo-archive-pager">
              <button
                type="button"
                className="trello-btn trello-btn-ghost trello-btn-sm"
                disabled={busy || loading || page <= 0}
                onClick={() => void loadPage(page - 1)}
              >
                Назад
              </button>
              <span className="personal-todo-archive-page">
                {page + 1} / {pageCount}
              </span>
              <button
                type="button"
                className="trello-btn trello-btn-ghost trello-btn-sm"
                disabled={busy || loading || page >= pageCount - 1}
                onClick={() => void loadPage(page + 1)}
              >
                Далее
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PersonalPage({ accessToken }: Props) {
  const {
    board,
    loading,
    error,
    busy,
    addHabit,
    addDaily,
    addTodo,
    logHabit,
    completeDaily,
    completeTodo,
    uncompleteTodo,
    updateHabit,
    archiveHabit,
    updateDaily,
    archiveDaily,
    updateTodo,
    archiveTodo,
  } = usePersonalBoard({ accessToken });
  const [gamificationSettings] = useGamificationSettings(accessToken);
  const [todoArchiveOpen, setTodoArchiveOpen] = useState(false);
  const [rewardToast, setRewardToast] = useState<{
    step: ReturnType<typeof buildRewardToastSteps>[number];
    id: number;
  } | null>(null);
  const rewardToastRunIdRef = useRef(0);

  async function playRewardToastSequence(rewards: XpGrantRewards) {
    const steps = buildRewardToastSteps(rewards, gamificationSettings);
    if (steps.length === 0) return;
    const runId = ++rewardToastRunIdRef.current;
    for (let i = 0; i < steps.length; i++) {
      if (rewardToastRunIdRef.current !== runId) return;
      setRewardToast({ step: steps[i], id: Date.now() + i });
      await delayMs(REWARD_TOAST_VISIBLE_MS);
      if (rewardToastRunIdRef.current !== runId) return;
      setRewardToast(null);
      if (i < steps.length - 1) {
        await delayMs(REWARD_TOAST_GAP_MS);
      }
    }
  }

  function showRewardsToast(rewards?: XpGrantRewards) {
    if (rewards && hasRewardToast(rewards, gamificationSettings)) {
      void playRewardToastSequence(rewards);
    }
  }

  function handlePersonalRewards(rewards?: XpGrantRewards) {
    showRewardsToast(rewards);
  }


  return (
    <div className="px-page personal-page">
      <header className="px-topbar">
        <div className="px-topbar-left">
          <h1 className="px-topbar-title">Привычки</h1>
        </div>
      </header>
      <div className="px-content personal-page-content">

        {loading && !board ? <p className="personal-page-hint">Загрузка…</p> : null}
        {error ? <p className="personal-page-error">{error}</p> : null}

        {board ? (
          <div className="personal-columns">
            <PersonalColumn
              title="Привычки"
              count={board.habits.length}
              footer={
                <p className="personal-column-hint">
                  Привычки не привязаны к расписанию — отмечайте +/− в любое время.
                </p>
              }
            >
              <PersonalAddHabitRow busy={busy} onAdd={addHabit} />
              {board.habits.map((h) => (
                <HabitCard
                  key={h.id}
                  habit={h}
                  busy={busy}
                  onLog={(id, direction) => logHabit(id, direction, handlePersonalRewards)}
                  onSave={(id, payload) => updateHabit(id, payload)}
                  onDelete={(id) => archiveHabit(id)}
                />
              ))}
            </PersonalColumn>

            <PersonalColumn
              title="Ежедневные"
              count={board.dailies.length}
              footer={
                <p className="personal-column-hint">
                  Сбрасываются каждый игровой день. Пропуск — потеря здоровья.
                </p>
              }
            >
              <PersonalAddRow placeholder="Добавить ежедневную задачу" busy={busy} onAdd={addDaily} />
              {board.dailies.map((d) => (
                <DailyCard
                  key={d.id}
                  daily={d}
                  busy={busy}
                  onComplete={(id) => completeDaily(id, handlePersonalRewards)}
                  onSave={(id, title) => updateDaily(id, title)}
                  onDelete={(id) => archiveDaily(id)}
                />
              ))}
            </PersonalColumn>

            <PersonalColumn
              title="Задачи"
              count={board.todos.length}
              headerExtra={
                <button
                  type="button"
                  className="personal-history-trigger"
                  disabled={busy}
                  title="История выполненных задач"
                  onClick={() => setTodoArchiveOpen(true)}
                >
                  <PersonalHistoryIcon />
                  История
                </button>
              }
              footer={
                board.todos.length === 0 ? (
                  <p className="personal-column-hint">
                    ☐ Разовые дела без сброса — добавьте первую задачу.
                  </p>
                ) : (
                  <p className="personal-column-hint">Разовые дела — выполняются один раз.</p>
                )
              }
            >
              <PersonalAddRow placeholder="Добавить задачу" busy={busy} onAdd={addTodo} />
              {board.todos.map((t) => (
                <TodoCard
                  key={t.id}
                  todo={t}
                  busy={busy}
                  onComplete={(id) => completeTodo(id, handlePersonalRewards)}
                  onSave={(id, title) => updateTodo(id, title)}
                  onDelete={(id) => archiveTodo(id)}
                />
              ))}
            </PersonalColumn>
          </div>
        ) : null}
      </div>

      {rewardToast?.step.kind === 'task' ? (
        <TaskRewardToast
          rewards={rewardToast.step.rewards}
          toastId={rewardToast.id}
        />
      ) : null}
      {rewardToast?.step.kind === 'checkin' ? (
        <CheckinRewardToast
          rewards={rewardToast.step.rewards}
          toastId={rewardToast.id}
        />
      ) : null}

      <PersonalTodoArchiveModal
        open={todoArchiveOpen}
        accessToken={accessToken}
        busy={busy}
        onClose={() => setTodoArchiveOpen(false)}
        onRestore={async (todoId) => {
          await uncompleteTodo(todoId);
        }}
      />
    </div>
  );
}
