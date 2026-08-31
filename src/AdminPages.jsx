import { useEffect, useRef, useState } from "react";
import { GameController, Image, Sparkle, Trash, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { SafeImage } from "./App.jsx";
import { ToastStack, useToasts } from "./Toast.jsx";
import { createAdminGame, deleteAdminGame, fetchAdminGames } from "./admin-api.js";

function GameSubmissionForm({ onCreated, notify }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [genres, setGenres] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [heroFile, setHeroFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const coverInput = useRef(null);
  const heroInput = useRef(null);

  const reset = () => {
    setTitle("");
    setSummary("");
    setReleaseDate("");
    setGenres("");
    setCoverFile(null);
    setHeroFile(null);
    if (coverInput.current) coverInput.current.value = "";
    if (heroInput.current) heroInput.current.value = "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const game = await createAdminGame({ title, summary, releaseDate, genres, coverFile, heroFile });
      onCreated(game);
      notify(`"${game.title}" enviado para o catálogo como jogo independente.`);
      reset();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="admin-game-form" onSubmit={handleSubmit}>
      <label className="settings-field">
        <span>Nome do jogo</span>
        <div className="auth-field">
          <GameController size={18} />
          <input required minLength={2} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Jornada de Aço" />
        </div>
      </label>
      <label className="settings-field">
        <span>Resumo</span>
        <textarea className="admin-game-textarea" maxLength={2000} rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Uma frase ou parágrafo sobre o jogo" />
      </label>
      <div className="admin-game-form-row">
        <label className="settings-field">
          <span>Lançamento</span>
          <div className="auth-field"><input type="date" value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} /></div>
        </label>
        <label className="settings-field">
          <span>Gêneros</span>
          <div className="auth-field"><input maxLength={300} value={genres} onChange={(event) => setGenres(event.target.value)} placeholder="RPG, Indie, Roguelike" /></div>
        </label>
      </div>
      <div className="admin-game-form-row">
        <div className="admin-game-upload">
          <span>Capa</span>
          <button type="button" className="admin-game-upload-button" onClick={() => coverInput.current?.click()}>
            <Image size={16} /> {coverFile ? coverFile.name : "Escolher imagem"}
          </button>
          <input ref={coverInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} />
        </div>
        <div className="admin-game-upload">
          <span>Imagem de destaque (opcional)</span>
          <button type="button" className="admin-game-upload-button" onClick={() => heroInput.current?.click()}>
            <Image size={16} /> {heroFile ? heroFile.name : "Escolher imagem"}
          </button>
          <input ref={heroInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(event) => setHeroFile(event.target.files?.[0] ?? null)} />
        </div>
      </div>
      <button className="primary-button" type="submit" disabled={submitting}>
        <UploadSimple size={18} /> {submitting ? "Enviando…" : "Enviar jogo"}
      </button>
    </form>
  );
}

function AdminGameRow({ game, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(game.id);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <li className="admin-game-row">
      <SafeImage src={game.coverUrl} alt="" />
      <span className="admin-game-info">
        <b>{game.title}</b>
        <small>{(game.genres || []).join(" · ") || "Sem gêneros"}</small>
      </span>
      <span className="badge-independent"><Sparkle size={12} weight="fill" /> Independente</span>
      <button type="button" onClick={handleDelete} disabled={deleting} aria-label={`Remover ${game.title}`}><Trash size={16} /></button>
    </li>
  );
}

export function AdminGamesPage() {
  const [games, setGames] = useState(null);
  const [loadError, setLoadError] = useState("");
  const { toasts, notify, dismiss } = useToasts();

  useEffect(() => {
    fetchAdminGames().then(setGames).catch((error) => setLoadError(error.message));
  }, []);

  const handleDelete = async (id) => {
    const previous = games;
    setGames((current) => current.filter((game) => game.id !== id));
    try {
      await deleteAdminGame(id);
      notify("Jogo removido do catálogo.");
    } catch (error) {
      setGames(previous);
      notify(error.message, "error");
    }
  };

  if (loadError) {
    return <section className="profile-page"><div className="empty-state"><WarningCircle size={34} /><h2>Não foi possível carregar os jogos enviados</h2><p>{loadError}</p></div></section>;
  }

  return (
    <section className="profile-page settings-page">
      <h1 className="profile-username">Enviar jogo independente</h1>
      <section className="profile-section">
        <div className="profile-section-head"><h2>Novo jogo</h2></div>
        <GameSubmissionForm notify={notify} onCreated={(game) => setGames((current) => [game, ...(current ?? [])])} />
      </section>
      <section className="profile-section">
        <div className="profile-section-head"><h2>Jogos enviados</h2></div>
        {games === null ? (
          <p className="profile-empty">Carregando…</p>
        ) : games.length ? (
          <ul className="admin-game-list">
            {games.map((game) => <AdminGameRow key={game.id} game={game} onDelete={handleDelete} />)}
          </ul>
        ) : (
          <p className="profile-empty">Nenhum jogo independente enviado ainda.</p>
        )}
      </section>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}
