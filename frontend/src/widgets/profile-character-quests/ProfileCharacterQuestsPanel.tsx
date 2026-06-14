import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { api, formatApiError } from '@shared/api';
import { cosmeticAssetUrl } from '@entities/character/lib/cosmetics';
import { ChestIcon } from '@widgets/chest/icon/ChestIcon';
import { ChestLootOddsButton } from '@widgets/chest/loot-odds/ChestLootOddsButton';
import { ChestTapOpenView } from '@widgets/chest/tap-open/ChestTapOpenModal';
import { DustIcon } from '@widgets/dust/icon/DustIcon';
import {
  achievementIconUrl,
  achievementIconLockedClassName,
  ACHIEVEMENT_ICON_CARD_SIZE,
} from '@entities/achievement/lib/achievementAssets';
import {
  DUST_ICON_SIZE_SHOP,
  DUST_ICON_SIZE_SM,
} from '@entities/dust/lib/dustAssets';
import {
  chestHasTapOpen,
  chestLastTapFrameIndex,
} from '@entities/chest/lib/chestAssets';
import {
  CHEST_TIER_LABEL_RU,
  COSMETIC_TYPE_LABEL_RU,
  cosmeticTypeCanEquip,
  isTitleBadgeCosmetic,
  type AchievementProgressItem,
  type CharacterAchievementsView,
  type CharacterQuestsView,
  type DustShopView,
  type InventoryItemDto,
  type OpenChestResult,
  type QuestPeriodGroup,
  type QuestProgressItem,
  type ChestTier,
  type UserChestDto,
} from '@entities/quest';
import { GamificationGuide } from '@widgets/gamification-guide/GamificationGuide';

type ChestModalState =
  | { phase: 'tapping'; tier: ChestTier; chestId: number; frameIndex: number }
  | { phase: 'reveal'; tier: ChestTier; result: OpenChestResult };

function chestItemNameRu(tier: ChestTier): string {
  if (tier === 'RARE') return 'Редкий сундук';
  if (tier === 'EPIC') return 'Эпический сундук';
  return 'Обычный сундук';
}

function chestRewardPreviewUrl(result: OpenChestResult): string | null {
  return cosmeticAssetUrl(result.cosmeticKey);
}

const STORAGE_GRID_COLS = 6;
const STORAGE_GRID_ROWS = 3;
const STORAGE_SLOTS_PER_PAGE = STORAGE_GRID_COLS * STORAGE_GRID_ROWS;

const storageGridStyle = {
  '--storage-grid-cols': STORAGE_GRID_COLS,
  '--storage-grid-rows': STORAGE_GRID_ROWS,
} as CSSProperties;

function getStorageTotalPages(
  itemCount: number,
  slotsPerPage: number = STORAGE_SLOTS_PER_PAGE,
): number {
  return Math.max(1, Math.ceil(itemCount / slotsPerPage));
}

function sliceStoragePage<T>(
  items: T[],
  page: number,
  slotsPerPage: number = STORAGE_SLOTS_PER_PAGE,
): T[] {
  const totalPages = getStorageTotalPages(items.length, slotsPerPage);
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * slotsPerPage;
  return items.slice(start, start + slotsPerPage);
}

function StoragePagedGrid(props: {
  page: number;
  itemCount: number;
  onPageChange: (page: number) => void;
  ariaLabel: string;
  slotsPerPage?: number;
  gridClassName?: string;
  gridStyle?: CSSProperties;
  children: ReactNode;
}) {
  const slotsPerPage = props.slotsPerPage ?? STORAGE_SLOTS_PER_PAGE;
  const totalPages = getStorageTotalPages(props.itemCount, slotsPerPage);
  const safePage = Math.min(Math.max(0, props.page), totalPages - 1);
  const gridClassName = props.gridClassName ?? 'trello-character-inventory-grid--storage';

  return (
    <div className="trello-character-storage-page">
      <ul
        className={`trello-character-inventory-grid ${gridClassName}`}
        style={{ ...storageGridStyle, ...props.gridStyle }}
        role="list"
        aria-label={props.ariaLabel}
      >
        {props.children}
      </ul>
      <nav className="trello-character-storage-pager" aria-label="Навигация по страницам">
          <button
            type="button"
            className="trello-character-storage-pager-btn"
            disabled={safePage <= 0}
            onClick={() => props.onPageChange(safePage - 1)}
            aria-label="Предыдущая страница"
          >
            ←
          </button>
          <span className="trello-character-storage-pager-label">
            {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="trello-character-storage-pager-btn"
            disabled={safePage >= totalPages - 1}
            onClick={() => props.onPageChange(safePage + 1)}
            aria-label="Следующая страница"
          >
            →
          </button>
      </nav>
    </div>
  );
}

function resolveItemEquipped(
  item: InventoryItemDto,
  portrait?: CharacterPortraitPreview,
): boolean {
  if (item.equipped) return true;
  if (!portrait) return false;
  if (
    item.cosmeticItem.type === 'PORTRAIT_FRAME' &&
    item.cosmeticItem.key === portrait.frameKey
  ) {
    return true;
  }
  if (
    item.cosmeticItem.type === 'PROFILE_BACKGROUND' &&
    item.cosmeticItem.key === portrait.profileBackgroundKey
  ) {
    return true;
  }
  return false;
}

/** Stable slot order: by obtain time, then id — equip state does not reorder. */
function sortStorageInventoryItems(items: InventoryItemDto[]): InventoryItemDto[] {
  return [...items].sort((a, b) => {
    const timeDiff = new Date(a.obtainedAt).getTime() - new Date(b.obtainedAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id - b.id;
  });
}

function sortChestsByCreatedAtAsc(chests: UserChestDto[]): UserChestDto[] {
  return [...chests].sort((a, b) => {
    const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id - b.id;
  });
}

function renderEmptyStorageSlots(count: number, keyPrefix: string) {
  return Array.from({ length: count }).map((_, index) => (
    <li key={`${keyPrefix}-empty-${index}`} className="trello-character-inventory-grid-item">
      <div className="trello-character-inventory-slot trello-character-inventory-slot--empty" />
    </li>
  ));
}

type CharacterPortraitPreview = {
  avatarPreset: string;
  frameKey?: string | null;
  profileBackgroundKey?: string | null;
};

type Props = {
  accessToken: string;
  characterPortrait?: CharacterPortraitPreview;
  activeTab: ProfileCharacterTabKey;
  tabOpenSignal?: number;
  onCharacterRefresh?: () => Promise<void>;
};

export type ProfileCharacterTabKey =
  | 'inventory'
  | 'quests'
  | 'shop'
  | 'achievements'
  | 'rules';

type StorageInnerTabKey = 'chests' | 'cosmetics' | 'items';

const GAMIFICATION_CONTENT_TABS: ProfileCharacterTabKey[] = [
  'inventory',
  'quests',
  'shop',
  'achievements',
  'rules',
];

function isGamificationContentTab(tab: ProfileCharacterTabKey): tab is ProfileCharacterTabKey {
  return (GAMIFICATION_CONTENT_TABS as readonly string[]).includes(tab);
}

function gamificationTabPanelClass(layoutMod: string): string {
  return ['trello-character-rpg-tab-stage-panel', layoutMod].filter(Boolean).join(' ');
}

function QuestRow(props: {
  quest: QuestProgressItem;
  onOpenChest: (chestId: number, tier: ChestTier) => void;
  openingChestId: number | null;
}) {
  const { quest } = props;
  const pct = quest.target > 0 ? Math.min(100, Math.round((quest.current / quest.target) * 100)) : 0;
  const chest = quest.chest;
  const rewardTier = chest?.tier ?? quest.rewardChestTier;
  const canOpen = chest && !chest.openedAt;

  const questText = quest.descriptionRu?.trim() || quest.titleRu;

  return (
    <li className="trello-character-quest-row">
      <div className="trello-character-quest-row-head">
        <p className="trello-character-quest-desc trello-character-quest-desc--lead">{questText}</p>
        {quest.completed && (
          <span className="trello-character-quest-done-badge" aria-label="Выполнено">
            ✓
          </span>
        )}
      </div>
      <div className="trello-character-quest-progress">
        <div
          className="trello-character-quest-progress-fill"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
        <span className="trello-character-quest-progress-label">
          {Math.min(quest.current, quest.target)} / {quest.target}
        </span>
      </div>
      <div
        className={[
          'trello-character-quest-reward',
          chest?.openedAt ? 'trello-character-quest-reward--claimed' : '',
          !chest ? 'trello-character-quest-reward--pending' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-chest-tier={rewardTier.toLowerCase()}
      >
        <div className="trello-character-quest-reward-visual" aria-hidden>
          <div className="trello-character-chest-slot-visual">
            <ChestIcon tier={rewardTier} />
          </div>
        </div>
        <div className="trello-character-quest-reward-meta">
          {chest?.openedAt ? (
            <span className="trello-character-quest-reward-claimed" role="status">
              <span className="trello-character-quest-done-badge" aria-hidden>
                ✓
              </span>
              Награда получена
            </span>
          ) : chest ? (
            <>
              <span className="trello-character-quest-chest-label">
                {CHEST_TIER_LABEL_RU[chest.tier]} сундук · ждёт открытия
              </span>
              {canOpen && (
                <button
                  type="button"
                  className="trello-btn trello-btn-primary trello-btn-sm"
                  disabled={props.openingChestId === chest.id}
                  onClick={() => props.onOpenChest(chest.id, chest.tier)}
                >
                  {props.openingChestId === chest.id ? 'Открываем…' : 'Открыть'}
                </button>
              )}
            </>
          ) : (
            <span className="trello-character-quest-chest-label">
              Награда: {CHEST_TIER_LABEL_RU[quest.rewardChestTier]} сундук
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function QuestGroup(props: {
  title: string;
  group: QuestPeriodGroup;
  onOpenChest: (chestId: number, tier: ChestTier) => void;
  openingChestId: number | null;
}) {
  return (
    <div className="trello-character-quest-group trello-character-quest-column">
      <h3 className="trello-character-quest-group-title">{props.title}</h3>
      <ul className="trello-character-quest-list">
        {props.group.quests.map((q) => (
          <QuestRow
            key={q.templateId}
            quest={q}
            onOpenChest={props.onOpenChest}
            openingChestId={props.openingChestId}
          />
        ))}
      </ul>
    </div>
  );
}

function AchievementRow({ item }: { item: AchievementProgressItem }) {
  const pct =
    item.target > 0 ? Math.min(100, Math.round((item.current / item.target) * 100)) : 0;
  const progressPct = item.unlocked ? 100 : pct;
  return (
    <li
      className={
        item.unlocked
          ? 'trello-character-achievement-row trello-character-achievement-row--unlocked'
          : 'trello-character-achievement-row'
      }
    >
      <div className="trello-character-achievement-head">
        <span className="trello-character-achievement-title">{item.titleRu}</span>
        {item.unlocked ? <span className="trello-character-quest-done-badge">✓</span> : null}
      </div>
      <div className="trello-character-achievement-visual">
        <img
          src={achievementIconUrl(item.key)}
          alt=""
          width={ACHIEVEMENT_ICON_CARD_SIZE}
          height={ACHIEVEMENT_ICON_CARD_SIZE}
          className={achievementIconLockedClassName(item.unlocked)}
          loading="lazy"
          draggable={false}
        />
      </div>
      <div className="trello-character-achievement-body">
        {item.descriptionRu ? (
          <p className="trello-character-achievement-desc">{item.descriptionRu}</p>
        ) : null}
        <div className="trello-character-quest-progress trello-character-quest-progress--sm">
          <div
            className="trello-character-quest-progress-fill"
            style={{ width: `${progressPct}%` }}
            aria-hidden
          />
          <span className="trello-character-quest-progress-label">
            {Math.min(item.current, item.target)} / {item.target}
          </span>
        </div>
        {item.rewardDust > 0 ? (
          <div className="trello-character-achievement-reward">
            <span className="trello-character-achievement-reward-label">Награда</span>
            <span className="trello-character-achievement-reward-value">{item.rewardDust}</span>
            <DustIcon size={DUST_ICON_SIZE_SM} className="trello-character-achievement-reward-icon" />
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function ProfileCharacterQuestsPanel(props: Props) {
  const [quests, setQuests] = useState<CharacterQuestsView | null>(null);
  const [userChests, setUserChests] = useState<UserChestDto[]>([]);
  const [inventory, setInventory] = useState<InventoryItemDto[]>([]);
  const [dustShop, setDustShop] = useState<DustShopView | null>(null);
  const [achievements, setAchievements] = useState<CharacterAchievementsView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openingChestId, setOpeningChestId] = useState<number | null>(null);
  const [chestModal, setChestModal] = useState<ChestModalState | null>(null);
  const [pendingChestOpen, setPendingChestOpen] = useState<{
    result: OpenChestResult | null;
    error: string | null;
  }>({ result: null, error: null });
  const [storageInnerTab, setStorageInnerTab] = useState<StorageInnerTabKey>('chests');
  const [storageChestPage, setStorageChestPage] = useState(0);
  const [storageCosmeticsPage, setStorageCosmeticsPage] = useState(0);
  const [storageItemsPage, setStorageItemsPage] = useState(0);
  const onCharacterRefreshRef = useRef(props.onCharacterRefresh);
  onCharacterRefreshRef.current = props.onCharacterRefresh;
  const reloadInflightRef = useRef<Promise<void> | null>(null);
  const dataLoadedForKeyRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (reloadInflightRef.current) {
      return reloadInflightRef.current;
    }

    const task = (async () => {
      setLoadError(null);
      const [q, chests, inv, shop, ach] = await Promise.all([
        api<CharacterQuestsView>('/character/quests', {
          method: 'GET',
          accessToken: props.accessToken,
        }),
        api<UserChestDto[]>('/character/chests', {
          method: 'GET',
          accessToken: props.accessToken,
        }),
        api<InventoryItemDto[]>('/character/inventory', {
          method: 'GET',
          accessToken: props.accessToken,
        }),
        api<DustShopView>('/character/dust/shop', {
          method: 'GET',
          accessToken: props.accessToken,
        }),
        api<CharacterAchievementsView>('/character/achievements', {
          method: 'GET',
          accessToken: props.accessToken,
        }),
      ]);
      setQuests(q);
      setUserChests(chests);
      setInventory(inv);
      setDustShop(shop);
      setAchievements(ach);
    })();

    reloadInflightRef.current = task;
    try {
      await task;
    } finally {
      if (reloadInflightRef.current === task) {
        reloadInflightRef.current = null;
      }
    }
  }, [props.accessToken]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (props.activeTab === 'inventory') {
      setStorageInnerTab('chests');
    }
  }, [props.activeTab, props.tabOpenSignal]);

  useEffect(() => {
    const loadKey = String(props.tabOpenSignal ?? 0);
    if (dataLoadedForKeyRef.current === loadKey) return;
    dataLoadedForKeyRef.current = loadKey;

    let cancelled = false;
    void (async () => {
      try {
        await reloadRef.current();
      } catch (e) {
        if (!cancelled) setLoadError(formatApiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.tabOpenSignal]);

  const unopenedChests = useMemo(
    () => sortChestsByCreatedAtAsc(userChests.filter((chest) => !chest.openedAt)),
    [userChests],
  );
  const activeContentTab = isGamificationContentTab(props.activeTab) ? props.activeTab : 'quests';

  const inventoryWithoutBadges = useMemo(
    () => inventory.filter((i) => !isTitleBadgeCosmetic(i.cosmeticItem.type)),
    [inventory],
  );

  const equippableInventory = useMemo(
    () =>
      sortStorageInventoryItems(
        inventoryWithoutBadges.filter((i) => cosmeticTypeCanEquip(i.cosmeticItem.type)),
      ),
    [inventoryWithoutBadges],
  );
  const otherInventoryItems = useMemo(
    () =>
      sortStorageInventoryItems(
        inventoryWithoutBadges.filter((i) => !cosmeticTypeCanEquip(i.cosmeticItem.type)),
      ),
    [inventoryWithoutBadges],
  );

  const questRowCount = useMemo(() => {
    if (!quests) return 0;
    return Math.max(
      quests.daily.quests.length,
      quests.weekly.quests.length,
      quests.monthly.quests.length,
    );
  }, [quests]);

  useEffect(() => {
    setStorageCosmeticsPage(0);
    setStorageItemsPage(0);
  }, [storageInnerTab]);

  useEffect(() => {
    setStorageChestPage((page) => Math.min(page, getStorageTotalPages(unopenedChests.length) - 1));
  }, [unopenedChests.length]);

  useEffect(() => {
    setStorageCosmeticsPage((page) =>
      Math.min(page, getStorageTotalPages(equippableInventory.length) - 1),
    );
  }, [equippableInventory.length]);

  useEffect(() => {
    setStorageItemsPage((page) => Math.min(page, getStorageTotalPages(otherInventoryItems.length) - 1));
  }, [otherInventoryItems.length]);
  const finishTapChestReveal = useCallback(
    async (tier: ChestTier, result: OpenChestResult) => {
      setChestModal({ phase: 'reveal', tier, result });
      try {
        await reload();
      } catch (e) {
        setLoadError(formatApiError(e));
      } finally {
        setOpeningChestId(null);
        setBusy(false);
      }
    },
    [reload],
  );

  useEffect(() => {
    if (chestModal?.phase !== 'tapping') return;
    if (!pendingChestOpen.error) return;
    setChestModal(null);
    setLoadError(pendingChestOpen.error);
    setOpeningChestId(null);
    setBusy(false);
  }, [chestModal, pendingChestOpen.error]);

  async function handleOpenChest(chestId: number, tier: ChestTier) {
    setOpeningChestId(chestId);
    setBusy(true);
    setLoadError(null);
    setPendingChestOpen({ result: null, error: null });

    const useTap =
      chestHasTapOpen(tier) &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (useTap) {
      setChestModal({ phase: 'tapping', tier, chestId, frameIndex: 0 });
      try {
        const result = await api<OpenChestResult>(`/character/chests/${chestId}/open`, {
          method: 'POST',
          accessToken: props.accessToken,
        });
        setPendingChestOpen({ result, error: null });
      } catch (e) {
        setPendingChestOpen({ result: null, error: formatApiError(e) });
      }
      return;
    }

    try {
      const result = await api<OpenChestResult>(`/character/chests/${chestId}/open`, {
        method: 'POST',
        accessToken: props.accessToken,
      });
      setChestModal({ phase: 'reveal', tier, result });
      await reload();
    } catch (e) {
      setLoadError(formatApiError(e));
    } finally {
      setOpeningChestId(null);
      setBusy(false);
    }
  }

  function handleChestTap() {
    if (chestModal?.phase !== 'tapping') return;
    const lastFrame = chestLastTapFrameIndex(chestModal.tier);
    if (chestModal.frameIndex < lastFrame) {
      setChestModal({ ...chestModal, frameIndex: chestModal.frameIndex + 1 });
      return;
    }
    if (pendingChestOpen.result) {
      void finishTapChestReveal(chestModal.tier, pendingChestOpen.result);
    }
  }

  async function handlePurchaseChest(tier: ChestTier) {
    setBusy(true);
    setLoadError(null);
    try {
      await api('/character/dust/purchase', {
        method: 'POST',
        accessToken: props.accessToken,
        json: { tier },
      });
      await reload();
    } catch (e) {
      setLoadError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleEquip(inventoryItemId: number) {
    setBusy(true);
    setLoadError(null);
    try {
      await api('/character/cosmetics/equip', {
        method: 'PATCH',
        accessToken: props.accessToken,
        json: { inventoryItemId },
      });
      await reload();
      await onCharacterRefreshRef.current?.();
    } catch (e) {
      setLoadError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCosmeticSlotActivate(item: InventoryItemDto) {
    const equipped = resolveItemEquipped(item, props.characterPortrait);
    if (equipped) {
      await handleUnequip(item.id);
      return;
    }
    await handleEquip(item.id);
  }

  function storageItemPreviewUrl(item: InventoryItemDto): string | null {
    return cosmeticAssetUrl(item.cosmeticItem.key);
  }

  async function handleUnequip(inventoryItemId: number) {
    setBusy(true);
    setLoadError(null);
    try {
      await api('/character/cosmetics/unequip', {
        method: 'PATCH',
        accessToken: props.accessToken,
        json: { inventoryItemId },
      });
      await reload();
      await onCharacterRefreshRef.current?.();
    } catch (e) {
      setLoadError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="trello-character-quests-section trello-character-quests-section--tabbed">
      <div className="trello-character-quests-body trello-character-rpg-tab-panel">
        {loadError && <div className="trello-banner trello-banner-error">{loadError}</div>}

        <div className="trello-character-rpg-tab-stage trello-character-rpg-tab-stage--inner">
          {activeContentTab === 'quests' ? (
          <div
            className={gamificationTabPanelClass('trello-character-quests-body--columns')}
            role="tabpanel"
            id="character-tabpanel-quests"
            aria-labelledby="character-tab-quests"
          >
            {!quests && !loadError && (
              <p className="trello-muted">Загрузка данных персонажа…</p>
            )}
            {quests && questRowCount > 0 && (
              <div className="trello-character-quests-columns">
                <QuestGroup
                  title="Ежедневные"
                  group={quests.daily}
                  onOpenChest={(id, tier) => void handleOpenChest(id, tier)}
                  openingChestId={openingChestId}
                />
                <QuestGroup
                  title="Еженедельные"
                  group={quests.weekly}
                  onOpenChest={(id, tier) => void handleOpenChest(id, tier)}
                  openingChestId={openingChestId}
                />
                <QuestGroup
                  title="Ежемесячные"
                  group={quests.monthly}
                  onOpenChest={(id, tier) => void handleOpenChest(id, tier)}
                  openingChestId={openingChestId}
                />
              </div>
            )}
          </div>
          ) : null}

          {activeContentTab === 'inventory' ? (
          <div
            className={gamificationTabPanelClass('trello-character-quests-body--storage')}
            role="tabpanel"
            id="character-tabpanel-inventory"
            aria-labelledby="character-tab-inventory"
          >
            {!quests && !loadError && (
              <p className="trello-muted">Загрузка хранилища…</p>
            )}
            {quests && (
              <div className="trello-character-storage-panel">
<div
                      className="trello-character-storage-inner-tabs"
                      role="tablist"
                      aria-label="Разделы хранилища"
                    >
                      {(
                        [
                          { key: 'chests', label: 'Сундуки' },
                          { key: 'cosmetics', label: 'Косметика' },
                          { key: 'items', label: 'Предметы' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          role="tab"
                          aria-selected={storageInnerTab === tab.key}
                          className={
                            storageInnerTab === tab.key
                              ? 'trello-character-storage-inner-tab trello-character-storage-inner-tab--active'
                              : 'trello-character-storage-inner-tab'
                          }
                          onClick={() => setStorageInnerTab(tab.key)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="trello-character-storage-tab-stage">
                      <div
                        className={[
                          'trello-character-storage-tab-panel',
                          storageInnerTab !== 'chests'
                            ? 'trello-character-storage-tab-panel--inactive'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        aria-hidden={storageInnerTab !== 'chests'}
                      >
                        {(() => {
                      const pageChests = sliceStoragePage(unopenedChests, storageChestPage);
                      const emptyCount = STORAGE_SLOTS_PER_PAGE - pageChests.length;
                      return (
                        <StoragePagedGrid
                          page={storageChestPage}
                          itemCount={unopenedChests.length}
                          onPageChange={setStorageChestPage}
                          ariaLabel="Сундуки в хранилище"
                          gridClassName="trello-character-inventory-grid--storage trello-character-inventory-grid--storage-chests"
                        >
                          {pageChests.map((chest) => (
                            <li key={`popup-inventory-${chest.id}`} className="trello-character-inventory-grid-item">
                              <button
                                type="button"
                                className="trello-character-inventory-slot trello-character-inventory-slot--clickable trello-character-chest-storage-slot"
                                data-chest-tier={chest.tier.toLowerCase()}
                                disabled={busy || openingChestId === chest.id}
                                onClick={() => void handleOpenChest(chest.id, chest.tier)}
                              >
                                <div className="trello-character-chest-slot-wrap">
                                  <div className="trello-character-chest-slot-visual" aria-hidden>
                                    <ChestIcon tier={chest.tier} />
                                  </div>
                                  <ChestLootOddsButton tier={chest.tier} />
                                </div>
                                <strong className="trello-character-inventory-slot-title">
                                  {CHEST_TIER_LABEL_RU[chest.tier]} сундук
                                </strong>
                              </button>
                            </li>
                          ))}
                          {renderEmptyStorageSlots(emptyCount, `chest-${storageChestPage}`)}
                        </StoragePagedGrid>
                      );
                    })()}
                      </div>
                      <div
                        className={[
                          'trello-character-storage-tab-panel',
                          storageInnerTab !== 'cosmetics'
                            ? 'trello-character-storage-tab-panel--inactive'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        aria-hidden={storageInnerTab !== 'cosmetics'}
                      >
                        {(() => {
                      const pageItems = sliceStoragePage(
                        equippableInventory,
                        storageCosmeticsPage,
                      );
                      const emptyCount = STORAGE_SLOTS_PER_PAGE - pageItems.length;
                      return (
                        <StoragePagedGrid
                          page={storageCosmeticsPage}
                          itemCount={equippableInventory.length}
                          onPageChange={setStorageCosmeticsPage}
                          gridClassName="trello-character-inventory-grid--storage trello-character-inventory-grid--storage-cosmetics"
                          ariaLabel="Косметика в хранилище"
                        >
                          {pageItems.map((item) => {
                                const previewUrl = storageItemPreviewUrl(item);
                                const equipped = resolveItemEquipped(item, props.characterPortrait);
                                return (
                                  <li
                                    key={`storage-cosmetic-${item.id}`}
                                    className="trello-character-inventory-grid-item"
                                  >
                                    <button
                                      type="button"
                                      className={
                                        equipped
                                          ? 'trello-character-inventory-slot trello-character-inventory-slot--clickable trello-character-cosmetic-storage-slot trello-character-cosmetic-storage-slot--equipped'
                                          : 'trello-character-inventory-slot trello-character-inventory-slot--clickable trello-character-cosmetic-storage-slot'
                                      }
                                      disabled={busy}
                                      aria-pressed={equipped}
                                      aria-label={`${item.cosmeticItem.nameRu}. ${equipped ? 'Надето' : 'Не надето'}`}
                                      onClick={() => void handleCosmeticSlotActivate(item)}
                                    >
                                      {previewUrl ? (
                                        <img
                                          src={previewUrl}
                                          alt=""
                                          className="trello-character-storage-slot-visual"
                                        />
                                      ) : (
                                        <span
                                          className="trello-character-storage-slot-fallback"
                                          aria-hidden
                                        >
                                          {COSMETIC_TYPE_LABEL_RU[item.cosmeticItem.type]}
                                        </span>
                                      )}
                                      <span className="trello-character-inventory-slot-title">
                                        {item.cosmeticItem.nameRu}
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                          {renderEmptyStorageSlots(emptyCount, `cosmetic-${storageCosmeticsPage}`)}
                        </StoragePagedGrid>
                      );
                    })()}
                      </div>
                      <div
                        className={[
                          'trello-character-storage-tab-panel',
                          storageInnerTab !== 'items'
                            ? 'trello-character-storage-tab-panel--inactive'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        aria-hidden={storageInnerTab !== 'items'}
                      >
                        {(() => {
                      const pageItems = sliceStoragePage(otherInventoryItems, storageItemsPage);
                      const emptyCount = STORAGE_SLOTS_PER_PAGE - pageItems.length;
                      return (
                        <StoragePagedGrid
                          page={storageItemsPage}
                          itemCount={otherInventoryItems.length}
                          onPageChange={setStorageItemsPage}
                          ariaLabel="Предметы в хранилище"
                        >
                          {pageItems.map((item) => {
                            const previewUrl = storageItemPreviewUrl(item);
                            return (
                              <li key={`storage-item-${item.id}`} className="trello-character-inventory-grid-item">
                                <div className="trello-character-inventory-slot trello-character-inventory-slot--clickable trello-character-cosmetic-storage-slot">
                                  {previewUrl ? (
                                    <img
                                      src={previewUrl}
                                      alt=""
                                      className="trello-character-storage-slot-visual"
                                    />
                                  ) : (
                                    <span className="trello-character-storage-slot-fallback" aria-hidden>
                                      {item.cosmeticItem.nameRu.slice(0, 1)}
                                    </span>
                                  )}
                                  <span className="trello-character-inventory-slot-title">
                                    {item.cosmeticItem.nameRu}
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                          {renderEmptyStorageSlots(emptyCount, `item-${storageItemsPage}`)}
                        </StoragePagedGrid>
                      );
                    })()}
                      </div>
                    </div>
              </div>
            )}
          </div>
          ) : null}

          {activeContentTab === 'shop' ? (
          <div
            className={gamificationTabPanelClass('trello-character-quests-body--shop')}
            role="tabpanel"
            id="character-tabpanel-shop"
            aria-labelledby="character-tab-shop"
          >
            {!dustShop && !loadError && <p className="trello-muted">Загрузка магазина…</p>}
            {dustShop && (
              <div className="trello-character-dust-shop">
                <p className="trello-character-dust-shop-balance" aria-live="polite">
                  <span className="trello-character-dust-shop-balance-content">
                    <span>Баланс:</span>
                    <strong className="trello-character-dust-shop-balance-value">{dustShop.balance}</strong>
                    <DustIcon size={DUST_ICON_SIZE_SHOP} />
                  </span>
                </p>
                <div className="trello-character-dust-shop-grid">
                  {dustShop.options.map((option) => (
                    <div key={option.tier} className="trello-character-dust-shop-card">
                      <div
                        className="trello-character-shop-chest-visual trello-character-chest-slot-wrap"
                        data-chest-tier={option.tier.toLowerCase()}
                      >
                        <div className="trello-character-chest-slot-visual" aria-hidden>
                          <ChestIcon tier={option.tier} />
                        </div>
                        <ChestLootOddsButton tier={option.tier} />
                      </div>
                      <span className="trello-character-dust-shop-title">{chestItemNameRu(option.tier)}</span>
                      <button
                        type="button"
                        className="trello-btn trello-btn-primary trello-btn-sm trello-character-shop-buy-btn"
                        disabled={busy || !option.canAfford}
                        onClick={() => void handlePurchaseChest(option.tier)}
                      >
                        <span className="trello-character-shop-buy-content">
                          <span>Купить</span>
                          <span className="trello-character-shop-buy-price">{option.cost}</span>
                          <DustIcon size={DUST_ICON_SIZE_SHOP} />
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          ) : null}

          {activeContentTab === 'achievements' ? (
          <div
            className={gamificationTabPanelClass('trello-character-quests-body--achievements')}
            role="tabpanel"
            id="character-tabpanel-achievements"
            aria-labelledby="character-tab-achievements"
          >
            <div className="trello-character-achievements-panel">
              {!achievements && !loadError && (
                <p className="trello-muted">Загрузка достижений…</p>
              )}
              {achievements && (
                <ul className="trello-character-achievement-list trello-character-achievement-list--columns">
                  {achievements.achievements.map((a) => (
                    <AchievementRow key={a.key} item={a} />
                  ))}
                </ul>
              )}
            </div>
          </div>
          ) : null}

          {activeContentTab === 'rules' ? (
          <div
            className={gamificationTabPanelClass('trello-character-quests-body--rules')}
            role="tabpanel"
            id="character-tabpanel-rules"
            aria-labelledby="character-tab-rules"
          >
            <div className="trello-character-rules-panel">
              <GamificationGuide />
            </div>
          </div>
          ) : null}
        </div>
      </div>



      {chestModal &&
        createPortal(
          <div
            className={[
              'trello-modal-backdrop',
              chestModal.phase === 'tapping' ? 'trello-chest-tap-modal-backdrop' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="presentation"
            onClick={() => chestModal.phase === 'reveal' && !busy && setChestModal(null)}
          >
            <div
              className={[
                'trello-modal',
                'trello-character-loot-popup',
                chestModal.phase === 'tapping'
                  ? 'trello-chest-tap-open-modal'
                  : 'trello-character-chest-open-modal',
              ].join(' ')}
              role="dialog"
              aria-modal
              aria-labelledby="chest-open-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="trello-modal-head trello-character-loot-popup-head--centered">
                <h2
                  id="chest-open-title"
                  className="trello-modal-title trello-character-loot-popup-title--hero"
                >
                  {chestModal.phase === 'reveal'
                    ? chestModal.result.cosmeticNameRu
                    : chestItemNameRu(chestModal.tier)}
                </h2>
              </div>
              <div className="trello-modal-body">
                {chestModal.phase === 'tapping' ? (
                  <ChestTapOpenView
                    tier={chestModal.tier}
                    frameIndex={chestModal.frameIndex}
                    waitingForApi={
                      chestModal.frameIndex >= chestLastTapFrameIndex(chestModal.tier) &&
                      !pendingChestOpen.result &&
                      !pendingChestOpen.error
                    }
                    onTap={handleChestTap}
                  />
                ) : (
                  <>
                    {(() => {
                      const result = chestModal.result;
                      const isDuplicateDust =
                        result.alreadyOwned && result.dustGranted > 0;
                      const previewUrl = chestRewardPreviewUrl(result);
                      return (
                        <>
                          <div
                            className="trello-character-chest-reveal-reward-wrap"
                            data-cosmetic-type={result.cosmeticType}
                          >
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt=""
                                className="trello-character-chest-reveal-reward"
                              />
                            ) : (
                              <span
                                className="trello-character-chest-reveal-reward-fallback"
                                aria-hidden
                              >
                                {COSMETIC_TYPE_LABEL_RU[result.cosmeticType]}
                              </span>
                            )}
                          </div>
                          {isDuplicateDust ? (
                            <div className="trello-character-chest-dust-notice" role="status">
                              <p className="trello-character-chest-dust-notice-line">
                                У вас уже есть «{result.cosmeticNameRu}».
                              </p>
                              <p className="trello-character-chest-dust-notice-line">
                                Предмет был заменён на {result.dustGranted} пыли.
                              </p>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
              {chestModal.phase === 'reveal' && (
                <div className="trello-modal-foot trello-character-chest-open-modal-foot">
                  {(() => {
                    const result = chestModal.result;
                    const canWear =
                      Boolean(
                        result.inventoryItemId &&
                          cosmeticTypeCanEquip(result.cosmeticType),
                      );
                    return (
                      <>
                        {canWear && (
                          <button
                            type="button"
                            className="trello-btn trello-btn-primary"
                            disabled={busy}
                            onClick={() => {
                              if (result.inventoryItemId) {
                                void handleEquip(result.inventoryItemId).then(() =>
                                  setChestModal(null),
                                );
                              }
                            }}
                          >
                            Надеть
                          </button>
                        )}
                        <button
                          type="button"
                          className="trello-btn trello-btn-ghost"
                          disabled={busy}
                          onClick={() => setChestModal(null)}
                        >
                          {result.alreadyOwned ? 'Закрыть' : 'Позже'}
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
