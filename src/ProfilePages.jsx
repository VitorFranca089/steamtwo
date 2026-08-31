import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, Eye, Gear, GameController, MagnifyingGlass, Plus, Trash, Trophy, UserCircle, UsersThree, WarningCircle, X } from "@phosphor-icons/react";
import { SafeImage } from "./App.jsx";
import { ToastStack, useToasts } from "./Toast.jsx";
import {
  addFavorite,
  addToWishlist,
  createAchievement,
  deleteAchievement,
  fetchMyProfile,
  fetchProfileByUsername,
  removeFavorite,
  removeFromWishlist,
  searchGames,
  searchUsers,
  uploadAvatar,
  uploadCover,
} from "./profile-api.js";

function useDebouncedSearch(query, fetcher, delayMs = 300) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      fetcher(query)
        .then((items) => { if (!controller.signal.aborted) setResults(items); })
        .catch(() => { if (!controller.signal.aborted) setResults([]); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, delayMs);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, fetcher, delayMs]);

  return { results, loading };
}

function GamePicker({ onSelect, placeholder = "Buscar jogo…" }) {
  const [query, setQuery] = useState("");
  const { results, loading } = useDebouncedSearch(query, searchGames);

  return (
    <div className="game-picker">
      <label className="game-picker-input">
        <MagnifyingGlass size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} />
      </label>
      {query.trim() && (
        <div className="game-picker-results">
          {loading ? (
            <p className="game-picker-empty">Buscando…</p>
          ) : results.length ? (
            results.map((game) => (
              <button
                type="button"
                key={game.id || game.slug}
                className="game-picker-item"
                onClick={() => { onSelect(game); setQuery(""); }}
              >
                <SafeImage src={game.coverUrl || game.cover_url} alt="" />
                <span>{game.title}</span>
              </button>
            ))
          ) : (
            <p className="game-picker-empty">Nenhum jogo encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}

function AvatarImage({ src }) {
  if (!src) return <div className="profile-avatar profile-avatar-placeholder"><UserCircle size={64} weight="thin" /></div>;
  return <SafeImage className="profile-avatar" src={src} alt="Foto de perfil" />;
}

function AvatarCoverEditor({ avatarUrl, coverUrl, onAvatarSaved, onCoverSaved, notify }) {
  const [preview, setPreview] = useState({ avatar: avatarUrl, cover: coverUrl });
  const [uploading, setUploading] = useState({ avatar: false, cover: false });
  const avatarInput = useRef(null);
  const coverInput = useRef(null);

  useEffect(() => setPreview({ avatar: avatarUrl, cover: coverUrl }), [avatarUrl, coverUrl]);

  const handleUpload = async (event, kind) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPreview((current) => ({ ...current, [kind]: objectUrl }));
    setUploading((current) => ({ ...current, [kind]: true }));
    try {
      if (kind === "avatar") onAvatarSaved(await uploadAvatar(file));
      else onCoverSaved(await uploadCover(file));
      notify(kind === "avatar" ? "Foto de perfil atualizada." : "Capa atualizada.");
    } catch (uploadError) {
      setPreview((current) => ({ ...current, [kind]: kind === "avatar" ? avatarUrl : coverUrl }));
      notify(uploadError.message, "error");
    } finally {
      setUploading((current) => ({ ...current, [kind]: false }));
    }
  };

  return (
    <div className="profile-header" style={preview.cover ? { "--profile-cover": `url(${preview.cover})` } : undefined}>
      <button type="button" className="profile-cover-input" onClick={() => coverInput.current?.click()} disabled={uploading.cover}>
        <Camera size={20} /> {uploading.cover ? "Enviando…" : preview.cover ? "Trocar capa" : "Adicionar capa"}
      </button>
      <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => handleUpload(event, "cover")} />
      <div className="profile-avatar-wrap">
        <AvatarImage src={preview.avatar} />
        {uploading.avatar && <span className="profile-avatar-loading" aria-hidden="true" />}
        <button type="button" className="profile-avatar-input" onClick={() => avatarInput.current?.click()} disabled={uploading.avatar} aria-label="Trocar foto de perfil">
          <Camera size={16} />
        </button>
        <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => handleUpload(event, "avatar")} />
      </div>
    </div>
  );
}

function GameListSection({ title, items, editable, onAdd, onRemove, emptyText }) {
  const [picking, setPicking] = useState(false);
  return (
    <section className="profile-section">
      <div className="profile-section-head">
        <h2>{title}</h2>
        {editable && (
          <button type="button" className="list-button" onClick={() => setPicking((value) => !value)}>
            <Plus size={16} /> Adicionar jogo
          </button>
        )}
      </div>
      {editable && picking && (
        <GamePicker onSelect={(game) => { onAdd(game); setPicking(false); }} />
      )}
      {items.length ? (
        <div className="profile-grid">
          {items.map((game) => (
            <div className="poster profile-poster" key={game.id}>
              <SafeImage src={game.coverUrl} alt={`Capa de ${game.title}`} />
              <span className="poster-title">{game.title}</span>
              {editable && (
                <button type="button" className="poster-remove" onClick={() => onRemove(game.id)} aria-label={`Remover ${game.title}`}>
                  <Trash size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="profile-empty">{emptyText}</p>
      )}
    </section>
  );
}

function AchievementsSection({ items, editable, onCreate, onDelete, notify }) {
  const [selectedGame, setSelectedGame] = useState(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedGame) {
      notify("Escolha um jogo para a conquista.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({ gameId: selectedGame.id, name });
      notify(`Conquista "${name}" criada.`);
      setSelectedGame(null);
      setName("");
    } catch (submitError) {
      notify(submitError.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="profile-section">
      <div className="profile-section-head">
        <h2>Conquistas</h2>
      </div>
      {editable && (
        <form className="achievement-form" onSubmit={handleSubmit}>
          {selectedGame ? (
            <div className="achievement-form-game">
              <SafeImage src={selectedGame.coverUrl || selectedGame.cover_url} alt="" />
              <span>{selectedGame.title}</span>
              <button type="button" onClick={() => setSelectedGame(null)} aria-label="Remover jogo selecionado"><X size={14} /></button>
            </div>
          ) : (
            <GamePicker onSelect={setSelectedGame} placeholder="Escolher jogo…" />
          )}
          <input
            className="achievement-name-input"
            required
            maxLength={120}
            placeholder="Nome da conquista"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button className="primary-button" type="submit" disabled={submitting}>
            <Plus size={16} /> {submitting ? "Salvando…" : "Nova conquista"}
          </button>
        </form>
      )}
      {items.length ? (
        <ul className="achievement-list">
          {items.map((achievement) => (
            <li className="achievement-row" key={achievement.id}>
              <Trophy size={20} weight="fill" />
              <SafeImage src={achievement.gameCoverUrl} alt="" />
              <span className="achievement-info">
                <b>{achievement.name}</b>
                <small>{achievement.gameTitle}</small>
              </span>
              {editable && (
                <button type="button" onClick={() => onDelete(achievement.id)} aria-label={`Apagar conquista ${achievement.name}`}>
                  <Trash size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="profile-empty">Nenhuma conquista criada ainda.</p>
      )}
    </section>
  );
}

function ProfileBody({ profile, editable, notify, onAvatarSaved, onCoverSaved, onAddFavorite, onRemoveFavorite, onAddWishlist, onRemoveWishlist, onCreateAchievement, onDeleteAchievement, onSettings }) {
  return (
    <>
      {editable ? (
        <AvatarCoverEditor avatarUrl={profile.avatarUrl} coverUrl={profile.coverUrl} onAvatarSaved={onAvatarSaved} onCoverSaved={onCoverSaved} notify={notify} />
      ) : (
        <div className="profile-header profile-header-static" style={profile.coverUrl ? { "--profile-cover": `url(${profile.coverUrl})` } : undefined}>
          <div className="profile-avatar-wrap">
            <AvatarImage src={profile.avatarUrl} />
          </div>
        </div>
      )}
      <div className="profile-title-row">
        <h1 className="profile-username">
          {profile.user.username}
          {!editable && <span className="badge-readonly"><Eye size={13} weight="bold" /> Somente leitura</span>}
        </h1>
        {editable && onSettings && (
          <button type="button" className="profile-settings-button" onClick={onSettings} aria-label="Configurações da conta">
            <Gear size={20} />
          </button>
        )}
      </div>
      <GameListSection
        title="Favoritos"
        items={profile.favorites}
        editable={editable}
        onAdd={(game) => onAddFavorite(game)}
        onRemove={onRemoveFavorite}
        emptyText="Nenhum jogo favoritado ainda."
      />
      <GameListSection
        title="Wishlist"
        items={profile.wishlist}
        editable={editable}
        onAdd={(game) => onAddWishlist(game)}
        onRemove={onRemoveWishlist}
        emptyText="Nenhum jogo na wishlist ainda."
      />
      <AchievementsSection
        items={profile.achievements}
        editable={editable}
        onCreate={onCreateAchievement}
        onDelete={onDeleteAchievement}
        notify={notify}
      />
    </>
  );
}

const LIST_LABELS = { favorites: { added: "adicionado aos favoritos", removed: "Jogo removido dos favoritos." }, wishlist: { added: "adicionado à wishlist", removed: "Jogo removido da wishlist." } };

export function MyProfilePage({ user, onVerify, onSettings }) {
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState("");
  const { toasts, notify, dismiss } = useToasts();

  useEffect(() => {
    fetchMyProfile().then(setProfile).catch((error) => setLoadError(error.message));
  }, []);

  if (loadError) {
    return <section className="profile-page"><div className="empty-state"><WarningCircle size={34} /><h2>Não foi possível carregar seu perfil</h2><p>{loadError}</p></div></section>;
  }
  if (!profile) {
    return <section className="profile-page"><div className="empty-state"><GameController size={34} /><h2>Carregando perfil…</h2></div></section>;
  }

  const addGame = (setListKey) => async (game) => {
    const gameId = game.id;
    setProfile((current) => ({ ...current, [setListKey]: [{ id: gameId, slug: game.slug, title: game.title, coverUrl: game.coverUrl || game.cover_url }, ...current[setListKey]] }));
    try {
      if (setListKey === "favorites") await addFavorite(gameId);
      else await addToWishlist(gameId);
      notify(`${game.title} ${LIST_LABELS[setListKey].added}.`);
    } catch (addError) {
      setProfile((current) => ({ ...current, [setListKey]: current[setListKey].filter((item) => item.id !== gameId) }));
      notify(addError.message, "error");
    }
  };

  const removeGame = (setListKey) => async (gameId) => {
    const previous = profile[setListKey];
    setProfile((current) => ({ ...current, [setListKey]: current[setListKey].filter((item) => item.id !== gameId) }));
    try {
      if (setListKey === "favorites") await removeFavorite(gameId);
      else await removeFromWishlist(gameId);
      notify(LIST_LABELS[setListKey].removed);
    } catch (removeError) {
      setProfile((current) => ({ ...current, [setListKey]: previous }));
      notify(removeError.message, "error");
    }
  };

  return (
    <section className="profile-page">
      {!user.isVerified && (
        <div className="profile-banner">
          <span>Complete sua verificação de identidade para regularizar sua conta.</span>
          <button type="button" onClick={onVerify}>Verificar agora</button>
        </div>
      )}
      <ProfileBody
        profile={profile}
        editable
        notify={notify}
        onSettings={onSettings}
        onAvatarSaved={(media) => setProfile((current) => ({ ...current, avatarUrl: media.avatarUrl }))}
        onCoverSaved={(media) => setProfile((current) => ({ ...current, coverUrl: media.coverUrl }))}
        onAddFavorite={addGame("favorites")}
        onRemoveFavorite={removeGame("favorites")}
        onAddWishlist={addGame("wishlist")}
        onRemoveWishlist={removeGame("wishlist")}
        onCreateAchievement={async ({ gameId, name }) => {
          const achievement = await createAchievement({ gameId, name });
          const game = [...profile.favorites, ...profile.wishlist].find((item) => item.id === gameId);
          setProfile((current) => ({
            ...current,
            achievements: [{ ...achievement, gameId, gameTitle: game?.title, gameCoverUrl: game?.coverUrl }, ...current.achievements],
          }));
        }}
        onDeleteAchievement={async (id) => {
          const previous = profile.achievements;
          setProfile((current) => ({ ...current, achievements: current.achievements.filter((item) => item.id !== id) }));
          try {
            await deleteAchievement(id);
            notify("Conquista removida.");
          } catch (deleteError) {
            setProfile((current) => ({ ...current, achievements: previous }));
            notify(deleteError.message, "error");
          }
        }}
      />
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}

export function PublicProfilePage({ username, onBack }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setProfile(null);
    setError("");
    fetchProfileByUsername(username).then(setProfile).catch((loadError) => setError(loadError.message));
  }, [username]);

  if (error) {
    return (
      <section className="profile-page">
        <div className="empty-state">
          <WarningCircle size={34} />
          <h2>Perfil não encontrado</h2>
          <p>{error}</p>
          <button className="primary-button" onClick={onBack}>Voltar ao início</button>
        </div>
      </section>
    );
  }
  if (!profile) {
    return <section className="profile-page"><div className="empty-state"><GameController size={34} /><h2>Carregando perfil…</h2></div></section>;
  }

  return (
    <section className="profile-page">
      <button type="button" className="back-link" onClick={onBack}><ArrowRight size={17} /> Voltar</button>
      <ProfileBody profile={profile} editable={false} />
    </section>
  );
}

export function PlayersPage({ onOpenProfile }) {
  const [query, setQuery] = useState("");
  const { results, loading } = useDebouncedSearch(query, searchUsers);

  return (
    <section className="players-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">COMUNIDADE STEAMTWO</span>
          <h1>Jogadores</h1>
          <p>Busque por outro jogador para ver o perfil público dele — favoritos, wishlist e conquistas, sem poder editar nada.</p>
        </div>
        <UsersThree size={58} weight="thin" />
      </div>
      <label className="players-search">
        <MagnifyingGlass size={20} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome de usuário" aria-label="Buscar jogadores" />
      </label>
      {!query.trim() ? (
        <div className="empty-state"><UsersThree size={34} /><h2>Encontre outros jogadores</h2><p>Digite pelo menos 2 letras do nome de usuário.</p></div>
      ) : loading ? (
        <div className="empty-state"><UsersThree size={34} /><h2>Buscando…</h2></div>
      ) : results.length ? (
        <div className="players-grid">
          {results.map((user) => (
            <button type="button" className="player-card" key={user.id} onClick={() => onOpenProfile(user.username)}>
              <span className="player-avatar"><AvatarImage src={user.avatarUrl} /></span>
              <span className="player-name">{user.username}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state"><UsersThree size={34} /><h2>Nenhum jogador encontrado</h2><p>Tente outro nome de usuário.</p></div>
      )}
    </section>
  );
}
