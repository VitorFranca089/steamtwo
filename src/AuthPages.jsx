import { useState } from "react";
import { CalendarBlank, Check, Circle, EnvelopeSimple, IdentificationCard, Lock, User, WarningCircle } from "@phosphor-icons/react";
import { completeProfile, login, passwordChecklist, signup } from "./auth-api.js";

function ErrorNotice({ message }) {
  if (!message) return null;
  return <p className="auth-error"><WarningCircle size={16} /> {message}</p>;
}

export function SignupPage({ onSignedUp, onNavigate }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const checklist = passwordChecklist(password);
  const passwordValid = checklist.every((rule) => rule.met);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!passwordValid) {
      setError("A senha não atende aos requisitos mínimos.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await signup({ username, email, password });
      onSignedUp();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="eyebrow">CRIAR CONTA</span>
        <h1>Cadastre-se na SteamTwo</h1>
        <p className="auth-subtitle">Leva menos de um minuto. Você poderá completar seu perfil depois.</p>
        <label className="auth-field">
          <User size={18} />
          <input required minLength={3} maxLength={24} placeholder="Nome de usuário" value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="auth-field">
          <EnvelopeSimple size={18} />
          <input required type="email" placeholder="E-mail" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="auth-field">
          <Lock size={18} />
          <input required type="password" placeholder="Senha" value={password} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} />
        </label>
        <ul className="password-checklist">
          {checklist.map((rule) => (
            <li key={rule.label} className={rule.met ? "met" : ""}>
              {rule.met ? <Check size={13} weight="bold" /> : <Circle size={13} />} {rule.label}
            </li>
          ))}
        </ul>
        <ErrorNotice message={error} />
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Criando conta…" : "Criar conta"}</button>
        <p className="auth-switch">Já tem uma conta? <button type="button" onClick={() => onNavigate("login")}>Entrar</button></p>
      </form>
    </section>
  );
}

export function LoginPage({ onLoggedIn, onNavigate }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await login({ identifier, password });
      onLoggedIn(user);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="eyebrow">ENTRAR</span>
        <h1>Bem-vindo de volta</h1>
        <p className="auth-subtitle">Acesse sua conta com seu usuário ou e-mail.</p>
        <label className="auth-field">
          <User size={18} />
          <input required placeholder="Usuário ou e-mail" value={identifier} autoComplete="username" onChange={(event) => setIdentifier(event.target.value)} />
        </label>
        <label className="auth-field">
          <Lock size={18} />
          <input required type="password" placeholder="Senha" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} />
        </label>
        <ErrorNotice message={error} />
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Entrando…" : "Entrar"}</button>
        <p className="auth-switch">Não tem uma conta? <button type="button" onClick={() => onNavigate("signup")}>Cadastre-se</button></p>
      </form>
    </section>
  );
}

export function ProfilePage({ onCompleted }) {
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cpf, setCpf] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await completeProfile({ fullName, birthDate, cpf });
      onCompleted();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="eyebrow">REGULARIZAR CONTA</span>
        <h1>Complete seu perfil</h1>
        <p className="auth-subtitle">Precisamos confirmar sua identidade e idade para liberar todos os recursos da plataforma.</p>
        <label className="auth-field">
          <IdentificationCard size={18} />
          <input required minLength={3} placeholder="Nome completo" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </label>
        <label className="auth-field">
          <CalendarBlank size={18} />
          <input required type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
        </label>
        <label className="auth-field">
          <IdentificationCard size={18} />
          <input required placeholder="CPF" value={cpf} onChange={(event) => setCpf(event.target.value)} />
        </label>
        <ErrorNotice message={error} />
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Confirmar dados"}</button>
      </form>
    </section>
  );
}
