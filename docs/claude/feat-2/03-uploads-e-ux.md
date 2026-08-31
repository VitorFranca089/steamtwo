# Upload de arquivo e feedback ao usuário

## Armazenamento de upload

- `server/uploads/storage.js` — configura duas instâncias de `multer`
  (`avatarUpload`, `coverUpload`), cada uma salvando em disco
  (`uploads/avatars/`, `uploads/covers/`, criadas no boot se não existirem,
  gitignored).
- Nome do arquivo: `${userId}.${extensão}` — determinístico, então um reupload
  no mesmo formato simplesmente sobrescreve o arquivo anterior. Se o usuário
  troca de formato (ex.: tinha `.png`, envia um `.jpg`), `removeStaleFiles`
  apaga o arquivo antigo com extensão diferente logo após o novo upload ser
  salvo — evita acumular lixo em disco.
- `fileFilter` do multer rejeita qualquer mimetype fora de
  `image/jpeg`/`image/png`/`image/webp` com erro `400`; limite de tamanho
  5MB (`multer` retorna `MulterError`, mapeado para `400` no handler de erro
  central em `server/app.js`).
- `requireAuth` roda **antes** do multer na cadeia de middlewares da rota
  (`server/routes/profile.js`) porque o nome do arquivo depende de
  `request.user.id`.
- Os arquivos são servidos como estáticos em `/uploads/*`
  (`app.use("/uploads", express.static(uploadsDir))`, registrado antes do
  catch-all do SPA em `server/app.js`).
- **Gotcha de dev environment**: o Vite dev server só fazia proxy de `/api`
  para a API (porta separada da 5173/5174). As imagens em `/uploads/...`
  não carregavam em modo `npm run dev` até adicionar `/uploads` ao proxy em
  [`vite.config.mjs`](../../../vite.config.mjs). Sem isso, funcionaria em
  produção (tudo atrás do mesmo processo Express) mas quebraria em dev.

## Bug corrigido: foto de perfil não atualizava após o upload

**Sintoma reportado pelo usuário**: depois de enviar uma nova foto de perfil,
a imagem exibida na tela não mudava — só atualizava dando refresh na página.

**Causa raiz**: o componente `SafeImage` (`src/App.jsx`), usado para toda
imagem com fallback em caso de erro, guardava a URL num `useState(src)`
inicializado **uma única vez**, sem nenhum `useEffect` para resincronizar
quando a prop `src` mudava em renders seguintes:

```js
// antes
function SafeImage({ src, alt, ... }) {
  const [url, setUrl] = useState(src); // só lida com o valor inicial
  return <img src={url} onError={() => setUrl(fallback)} ... />;
}
```

Como o avatar no perfil é um componente que permanece montado (mesma
posição/`key`) durante toda a sessão, ele nunca remonta quando o upload
termina e a prop `avatarUrl` muda — `useState` ignora esse novo valor.
(A capa não sofria disso porque é aplicada via CSS `background-image` num
`style` inline, sempre recalculado a cada render, sem estado próprio.)

**Correção**: adicionar a resincronização que faltava —

```js
useEffect(() => setUrl(src), [src]);
```

Verificado manualmente (Chromium headless): upload do avatar atualiza a
imagem na hora, inclusive fazendo um segundo upload em seguida (sem dar
refresh na página) para garantir que não era só o preview otimista via
`URL.createObjectURL` mascarando o problema.

## Sistema de toast

**Sintoma reportado**: nenhuma ação na página de perfil (upload de foto/capa,
favoritar, adicionar à wishlist, criar/apagar conquista) dava qualquer
indicação visual de sucesso ou erro ao usuário.

- `src/Toast.jsx` (novo, reutilizável) — hook `useToasts()` (fila de toasts
  em memória, auto-dismiss em 4s, dispensável manualmente) + componente
  `ToastStack` (pilha fixa no canto inferior direito, ícone de sucesso/erro
  do `@phosphor-icons/react`).
- `MyProfilePage` (`src/ProfilePages.jsx`) instancia `useToasts()` e passa
  `notify(mensagem, "success" | "error")` para baixo: `AvatarCoverEditor`
  (upload de foto/capa), `AchievementsSection` (criar conquista, incluindo a
  validação "escolha um jogo"), e usa diretamente nos handlers de
  favoritar/desfavoritar/wishlist/apagar conquista.
- As mensagens de erro exibidas no toast são as mesmas retornadas pela API
  (`{ error }`), já em português e específicas por caso (`error.js`
  de validação Zod, conflitos, jogo/conquista não encontrado etc.).
- O botão de trocar avatar/capa fica desabilitado durante o upload em curso
  e mostra um spinner sobreposto no avatar (`.profile-avatar-loading`) e o
  texto do botão de capa muda para "Enviando…" — feedback de que a ação está
  em andamento, não só do resultado final.
- Os banners de erro inline antigos (`ErrorNotice`/`auth-error`) usados na
  página de perfil foram removidos em favor do toast, que é o pedido
  explícito do usuário ("é interessante que deixe esse sistema bem
  interativo"). O padrão `ErrorNotice` de `AuthPages.jsx` (Feature 1)
  continua como estava — fora do escopo deste ajuste.
