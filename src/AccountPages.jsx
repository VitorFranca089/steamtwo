import { useEffect, useState } from "react";
import {
  CalendarBlank,
  Check,
  CheckCircle,
  Circle,
  EnvelopeSimple,
  IdentificationCard,
  Lock,
  ShieldCheck,
  User,
  WarningCircle,
} from "@phosphor-icons/react";
import { ToastStack, useToasts } from "./Toast.jsx";
import {
  changePassword,
  completeProfile,
  confirmEmailVerification,
  fetchAccount,
  passwordChecklist,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  updateEmail,
  updateUsername,
} from "./auth-api.js";

function ErrorNotice({ message }) {
  if (!message) return null;
  return <p className="auth-error"><WarningCircle size={16} /> {message}</p>;
}

function SuccessNotice({ message }) {
  if (!message) return null;
  return <p className="auth-success"><CheckCircle size={16} weight="fill" /> {message}</p>;
}

function UsernameForm({ account, notify, onUpdated }) {
  const [username, setUsername] = useState(account.username);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (username === account.username) return;
    setSubmitting(true);
    try {
      await updateUsername({ username });
      onUpdated({ username });
      notify("Nome de usuário atualizado.");
    } catch (error) {
      setUsername(account.username);
      notify(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="settings-row" onSubmit={handleSubmit}>
      <label className="settings-field">
        <span>Usuário</span>
        <div className="auth-field"><User size={18} /><input required minLength={3} maxLength={24} value={username} onChange={(event) => setUsername(event.target.value)} /></div>
      </label>
      <button className="list-button" type="submit" disabled={submitting || username === account.username}>{submitting ? "Salvando…" : "Salvar"}</button>
    </form>
  );
}

function EmailForm({ account, notify, onUpdated }) {
  const [email, setEmail] = useState(account.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await updateEmail({ email, currentPassword });
      onUpdated({ email, emailVerified: false });
      setCurrentPassword("");
      notify("E-mail atualizado. Enviamos um novo link de verificação.");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="settings-row" onSubmit={handleSubmit}>
      <label className="settings-field">
        <span>E-mail</span>
        <div className="auth-field"><EnvelopeSimple size={18} /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      </label>
      <label className="settings-field">
        <span>Senha atual</span>
        <div className="auth-field"><Lock size={18} /><input required type="password" placeholder="Confirme com sua senha" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
      </label>
      <button className="list-button" type="submit" disabled={submitting}>{submitting ? "Salvando…" : "Salvar e-mail"}</button>
    </form>
  );
}

function PersonalDataForm({ account, notify, onUpdated }) {
  const [fullName, setFullName] = useState(account.fullName ?? "");
  const [birthDate, setBirthDate] = useState(account.birthDate ? account.birthDate.slice(0, 10) : "");
  const [cpf, setCpf] = useState(account.cpf ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const profile = await completeProfile({ fullName, birthDate, cpf });
      onUpdated({ fullName: profile.fullName, birthDate: profile.birthDate, cpf: profile.cpf, isVerified: true });
      notify("Dados pessoais atualizados.");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="settings-row" onSubmit={handleSubmit}>
      <label className="settings-field">
        <span>Nome completo</span>
        <div className="auth-field"><IdentificationCard size={18} /><input required minLength={3} value={fullName} onChange={(event) => setFullName(event.target.value)} /></div>
      </label>
      <label className="settings-field">
        <span>Data de nascimento</span>
        <div className="auth-field"><CalendarBlank size={18} /><input required type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></div>
      </label>
      <label className="settings-field">
        <span>CPF</span>
        <div className="auth-field"><IdentificationCard size={18} /><input required value={cpf} onChange={(event) => setCpf(event.target.value)} /></div>
      </label>
      <button className="list-button" type="submit" disabled={submitting}>{submitting ? "Salvando…" : "Salvar dados pessoais"}</button>
    </form>
  );
}

function PasswordForm({ notify, onChanged }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const checklist = passwordChecklist(newPassword);
  const passwordValid = checklist.every((rule) => rule.met);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!passwordValid) {
      notify("A nova senha não atende aos requisitos mínimos.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      notify("Senha alterada. Faça login novamente.");
      onChanged();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="settings-row" onSubmit={handleSubmit}>
      <label className="settings-field">
        <span>Senha atual</span>
        <div className="auth-field"><Lock size={18} /><input required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
      </label>
      <label className="settings-field">
        <span>Nova senha</span>
        <div className="auth-field"><Lock size={18} /><input required type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div>
      </label>
      <ul className="password-checklist">
        {checklist.map((rule) => (
          <li key={rule.label} className={rule.met ? "met" : ""}>
            {rule.met ? <Check size={13} weight="bold" /> : <Circle size={13} />} {rule.label}
          </li>
        ))}
      </ul>
      <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Alterando…" : "Alterar senha"}</button>
    </form>
  );
}

export function AccountSettingsPage({ onLoggedOut }) {
  const [account, setAccount] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [resending, setResending] = useState(false);
  const { toasts, notify, dismiss } = useToasts();

  useEffect(() => {
    fetchAccount().then(setAccount).catch((error) => setLoadError(error.message));
  }, []);

  const handleResend = async () => {
    setResending(true);
    try {
      await requestEmailVerification();
      notify("Enviamos um novo e-mail de verificação.");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setResending(false);
    }
  };

  if (loadError) {
    return <section className="profile-page"><div className="empty-state"><WarningCircle size={34} /><h2>Não foi possível carregar sua conta</h2><p>{loadError}</p></div></section>;
  }
  if (!account) {
    return <section className="profile-page"><div className="empty-state"><User size={34} /><h2>Carregando conta…</h2></div></section>;
  }

  return (
    <section className="profile-page settings-page">
      <h1 className="profile-username">Configurações da conta</h1>

      <section className="profile-section">
        <div className="profile-section-head"><h2>Verificação de e-mail</h2></div>
        {account.emailVerified ? (
          <p className="settings-status settings-status-ok"><ShieldCheck size={18} weight="fill" /> E-mail verificado</p>
        ) : (
          <div className="settings-status settings-status-pending">
            <span><WarningCircle size={18} /> E-mail ainda não verificado</span>
            <button className="list-button" type="button" onClick={handleResend} disabled={resending}>{resending ? "Enviando…" : "Reenviar e-mail"}</button>
          </div>
        )}
      </section>

      <section className="profile-section">
        <div className="profile-section-head"><h2>Usuário e e-mail</h2></div>
        <UsernameForm account={account} notify={notify} onUpdated={(patch) => setAccount((current) => ({ ...current, ...patch }))} />
        <EmailForm account={account} notify={notify} onUpdated={(patch) => setAccount((current) => ({ ...current, ...patch }))} />
      </section>

      <section className="profile-section">
        <div className="profile-section-head"><h2>Dados pessoais</h2></div>
        <PersonalDataForm account={account} notify={notify} onUpdated={(patch) => setAccount((current) => ({ ...current, ...patch }))} />
      </section>

      <section className="profile-section">
        <div className="profile-section-head"><h2>Senha</h2></div>
        <PasswordForm notify={notify} onChanged={onLoggedOut} />
      </section>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}

export function ForgotPasswordPage({ onNavigate }) {
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const responseMessage = await requestPasswordReset({ identifier });
      setMessage(responseMessage || "Se existir uma conta com esses dados, enviamos um e-mail com instruções.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="eyebrow">RECUPERAR ACESSO</span>
        <h1>Esqueci minha senha</h1>
        <p className="auth-subtitle">Informe seu usuário ou e-mail. Enviaremos um link para redefinir sua senha.</p>
        <label className="auth-field">
          <User size={18} />
          <input required placeholder="Usuário ou e-mail" value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
        </label>
        <ErrorNotice message={error} />
        <SuccessNotice message={message} />
        <button className="primary-button" type="submit" disabled={submitting || Boolean(message)}>{submitting ? "Enviando…" : "Enviar link"}</button>
        <p className="auth-switch">Lembrou a senha? <button type="button" onClick={() => onNavigate("login")}>Entrar</button></p>
      </form>
    </section>
  );
}

export function ResetPasswordPage({ token, onNavigate }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const checklist = passwordChecklist(password);
  const passwordValid = checklist.every((rule) => rule.met);

  if (!token) {
    return (
      <section className="auth-page">
        <div className="auth-card">
          <ErrorNotice message="Link inválido. Solicite uma nova redefinição de senha." />
          <button className="primary-button" type="button" onClick={() => onNavigate("esqueci-senha")}>Solicitar novo link</button>
        </div>
      </section>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!passwordValid) {
      setError("A senha não atende aos requisitos mínimos.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await resetPassword({ token, password });
      setMessage("Senha redefinida com sucesso.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (message) {
    return (
      <section className="auth-page">
        <div className="auth-card">
          <SuccessNotice message={message} />
          <button className="primary-button" type="button" onClick={() => onNavigate("login")}>Ir para o login</button>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="eyebrow">REDEFINIR SENHA</span>
        <h1>Crie uma nova senha</h1>
        <label className="auth-field">
          <Lock size={18} />
          <input required type="password" placeholder="Nova senha" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <ul className="password-checklist">
          {checklist.map((rule) => (
            <li key={rule.label} className={rule.met ? "met" : ""}>
              {rule.met ? <Check size={13} weight="bold" /> : <Circle size={13} />} {rule.label}
            </li>
          ))}
        </ul>
        <ErrorNotice message={error} />
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Salvando…" : "Redefinir senha"}</button>
      </form>
    </section>
  );
}

export function VerifyEmailPage({ token, onNavigate }) {
  const [status, setStatus] = useState(token ? "loading" : "missing");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    confirmEmailVerification({ token })
      .then(() => setStatus("success"))
      .catch((confirmError) => { setError(confirmError.message); setStatus("error"); });
  }, [token]);

  return (
    <section className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">VERIFICAÇÃO DE E-MAIL</span>
        {status === "loading" && <h1>Confirmando seu e-mail…</h1>}
        {status === "success" && (
          <>
            <h1>E-mail confirmado!</h1>
            <SuccessNotice message="Sua conta agora tem o e-mail verificado." />
          </>
        )}
        {(status === "error" || status === "missing") && (
          <>
            <h1>Não foi possível confirmar</h1>
            <ErrorNotice message={status === "missing" ? "Link de verificação inválido." : error} />
          </>
        )}
        <button className="primary-button" type="button" onClick={() => onNavigate("conta")}>Ir para minha conta</button>
      </div>
    </section>
  );
}
