# Correções: avatar, acesso às configurações, CPF e mensagens de erro

Leva de correções pedidas depois de usar a feature de perfil/conta em produção.

## Pedido original

- Ícone de engrenagem no perfil do usuário levando para as configurações.
- Usuário não pode acessar as configurações antes de completar o perfil
  (nome, CPF, data de nascimento).
- O ícone azul de trocar foto deve ficar "pra fora" do círculo do avatar,
  deixando claro que é clicável — estava malposicionado/bugado.
- CPF não pode ser alterado na tela de dados pessoais das configurações.
- Erro de "CPF inválido" estava aparecendo como um JSON bruto em vez da
  mensagem literal.

## O que foi corrigido

| Correção | Onde | Detalhe |
|---|---|---|
| Ícone de engrenagem | `src/ProfilePages.jsx` (`ProfileBody`), `src/App.jsx` | Botão redondo ao lado do username em "Meu perfil" (só no próprio perfil, não no público), navega para `/conta`. |
| Bloqueio de `/conta` sem KYC | `src/App.jsx` | O `view === "conta"` agora checa `user.isVerified` (admins são isentos, mesmo critério já usado no resto do app): se não verificado, renderiza o próprio formulário de KYC (`ProfilePage`, o mesmo de `/perfil/verificar`) em vez das configurações. Depois de completar, cai direto em `/conta` já liberado. |
| Avatar quebrado quando o usuário não tem foto | `src/ProfilePages.jsx` (`AvatarImage`) | Antes: `<img src={null}>` sem foto enviada renderizava quebrado (texto do `alt` vazando). Agora: sem `avatarUrl`, mostra um ícone de usuário genérico (`UserCircle`) no lugar da imagem — nem tenta carregar uma URL vazia. |
| Badge da foto "pra fora" do círculo | `src/styles.css` | `.profile-avatar-wrap` tinha `overflow: hidden`, o que cortava qualquer coisa posicionada fora do círculo — por isso o badge preso em `right: 2px; bottom: 2px` parecia "espremido" para dentro. Solução: o recorte circular passou a ser feito pela própria imagem/placeholder (`.profile-avatar { border-radius: 50%; overflow: hidden; }`), liberando o wrap para não cortar mais nada; o badge foi reposicionado para `right: -6px; bottom: -6px`, protuberante de propósito (padrão comum de "editar avatar"). |
| CPF travado nas configurações | `src/AccountPages.jsx` (frontend) + `server/services/auth-service.js` (`completeProfile`, backend) | Frontend: campo vira `disabled`, com rótulo "CPF (não pode ser alterado)". Backend, em defesa de profundidade: `completeProfile` agora busca o CPF já salvo do usuário (`repository.findById`) e rejeita com `409` se o valor enviado for diferente — mesmo que alguém tente forçar a chamada da API diretamente, sem passar pela UI. |
| Mensagem de erro de validação em JSON | `server/app.js` (handler de erro central) | Bug que afetava **qualquer** erro de validação (Zod) da aplicação inteira, não só CPF: o handler usava `error.message` de um `ZodError`, que por padrão é uma string JSON com a lista bruta de issues, não uma frase legível. Corrigido para usar `error.issues?.[0]?.message` (a mensagem da primeira regra que falhou) — é assim que "CPF inválido", "Informe o nome completo" etc. chegam legíveis no toast/notice do frontend. |

## Bug lateral encontrado e corrigido no caminho

Ao implementar o bloqueio de `/conta`, foi descoberto que **o estado do usuário no
frontend nunca era atualizado depois de completar o KYC** — `onCompleted()` só
navegava, sem buscar os dados atualizados. Isso já era um problema sutil antes
desta correção (o aviso "Completar perfil" no cabeçalho ficava aparecendo até
a página ser recarregada manualmente), mas agora causava um loop real: a tela
de configurações continuava achando o usuário não verificado mesmo depois do
KYC ser concluído com sucesso, mostrando o formulário de novo.

Corrigido com um helper `refreshUserThenNavigate` em `src/App.jsx` que busca o
usuário atual (`fetchCurrentUser()`) antes de navegar, usado tanto no fluxo de
`/perfil/verificar` quanto no bloqueio de `/conta`.

## Testes novos

- `tests/domain/auth-service.test.js` — "permite atualizar nome/data mantendo
  o mesmo CPF, mas rejeita trocar o CPF depois de verificado".
- `tests/api/auth-routes.test.js` — "retorna uma mensagem legível (não JSON
  bruto) para CPF inválido", verificando literalmente `response.body.error === "CPF inválido"`.

## Verificação manual

Rodado em Chromium headless (Playwright) nesta sessão: cadastro → perfil sem
avatar mostra o placeholder (sem texto quebrado) → clicar na engrenagem ou
acessar `/conta` direto sem ter feito o KYC mostra o formulário de
regularização, não as configurações → CPF inválido mostra "CPF inválido" em
texto puro → completar com CPF válido libera `/conta` automaticamente, sem
precisar recarregar a página → campo de CPF aparece desabilitado nas
configurações → badge azul da foto visivelmente para fora do círculo do avatar.
