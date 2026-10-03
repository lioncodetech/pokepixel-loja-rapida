# PokePixel — loja rápida

Um painel com um botão de compra para cada pokébola, poção e revive da loja do Mark. **Alt+C**
esconde o painel e **Alt+V** o traz de volta.

Cada item tem o seu próprio **alvo**, que fica salvo: o número da coluna é quanto você quer *ter*,
não quanto comprar. Com 77.149 Poké Balls e alvo 78.000, ela compra 851. Se você já tem mais do que
o alvo, ela não compra nada — e quem fica em **0** não entra na compra.

Para a mochila não terminar sempre no mesmo número redondo, o alvo é sorteado dentro de uma margem
que você define no rodapé (± 3% por padrão): um alvo de 78.000 vira algo entre 75.660 e 80.340 a
cada compra. Com 0% ela compra exatamente até o alvo.

Antes de comprar — tanto num item quanto no **Comprar tudo** — ela lê a mochila, porque "até ter X"
só se calcula contra o que você tem agora. O valor que aparece na tela é a estimativa feita sobre a
última leitura; por isso o total do botão vem com `~`.
O painel mostra quanto você tem na mochila, quanto vai gastar e o seu saldo, e arrasta pelo
cabeçalho para onde você quiser.

Dá para redimensioná-lo pelo canto, e o tamanho fica guardado como proporção da janela, não em
pixels: ao rearranjar as janelas do LionMultInstance, o painel encolhe e cresce junto com a janela
em que está, sem nunca sobrar para fora dela.

## Como ela compra

Exatamente como você compraria. Ela abre a loja do Mark pelo menu do próprio jogo, acha o item
pelo nome no catálogo, escreve a quantidade no campo e clica em **Comprar**.

A loja guarda a última aba aberta, então ela própria volta para **Comprar itens** se você tiver
deixado em Vender ou Recomprar, e tira o filtro de categoria (**Todos**) quando o item que procura
não está entre os que a aba atual mostra.

Antes de cada ação, manual ou automática, ela fecha os avisos que o jogo põe por cima de tudo — o
resumo da expedição, o "a caçada continuou sem você" e o banner do Discord —, porque com eles na
frente o clique não chega à loja. A loja, a mochila e a caixa de confirmação nunca são fechadas. Se o jogo pedir
confirmação, ela confirma — mas só uma caixa cujo texto corresponde ao item e à quantidade que
aquele clique pediu. Dá para desligar essa confirmação automática no rodapé.

**Nenhuma requisição é montada por fora do jogo.** O que sai do seu navegador é o mesmo que sairia
se você tivesse clicado. Ela também ignora de propósito a loja de diamantes: as duas telas usam as
mesmas classes, e sem esse cuidado um clique errado gastaria moeda paga.

## O botão "Comprar tudo"

Lê a mochila uma vez, descobre o que falta em cada item com alvo acima de zero e compra isso em
sequência, abrindo a loja uma única vez. Quem já está no alvo é pulado sem abrir nada. O valor
estimado aparece no próprio botão. Durante a compra ele vira **Parar**: termina o item em
andamento e para, dizendo onde parou. Um item que falhar não interrompe os outros.

### Os dois modos do ciclo

A lista ao lado do botão escolhe como o ciclo marca a próxima rodada:

- **a cada** `10` a `15` **min** — o que já existia: um intervalo sorteado dentro da faixa, a
  qualquer hora do dia.
- **uma vez entre** `08:00-09:00, 19:00-20:00` — **uma única rodada dentro de cada janela**, num
  instante sorteado lá dentro. Com essas duas janelas são duas rodadas por dia: uma entre 8 e 9,
  outra entre 19 e 20, nunca no mesmo minuto dois dias seguidos.

Só os campos do modo escolhido aparecem. Vale uma janela, duas ou quantas quiser, separadas por
vírgula; `8-9` também serve, e uma janela que termina antes de começar atravessa a meia-noite
(`22:00-02:00`). Um texto que não vira janela nenhuma fica marcado em vermelho.

No modo por horário, apertar **Iniciar** não dispara nada na hora: ele marca a rodada da janela
atual (se ainda der tempo) ou da próxima — a graça do modo é a rodada cair dentro da janela.
Enquanto o ciclo está ligado, ao lado do relógio aparece **a hora da próxima rodada**, por exemplo
`próxima às 17:29`.

## A mochila

O número que aparece em cada linha vem do inventário do jogo, lido quando ele está aberto, e é
guardado com a hora da leitura — por isso pode estar desatualizado. O botão **Atualizar mochila**
abre o inventário, lê e fecha; antes de cada compra isso acontece sozinho.

## Comprar sozinho

O botão **Iniciar**, no rodapé, liga o ciclo: ele compra na hora e marca a próxima compra para
daqui a um tempo sorteado dentro da faixa de minutos ao lado. O próprio botão vira **Parar** e
mostra o relógio da próxima — `Parar · 06:30`. Clicar em Parar encerra o ciclo e também a compra
em andamento, que ainda termina o item que estava no meio.

A próxima só é marcada quando a anterior acaba, então duas compras nunca se cruzam. Mudar a faixa
com o relógio correndo vale na hora. Uma compra que você pedir à mão tem a vez: se o relógio bater
durante ela, aquele ciclo é pulado e volta no intervalo seguinte.

Recarregar a página não é pedir uma compra: se o ciclo estava ligado, ele volta a contar o tempo,
mas a primeira rodada espera o intervalo em vez de comprar no ato de abrir o jogo.

## O que ela guarda

Tudo no armazenamento da própria página, no seu computador:

- a quantidade escolhida para cada item;
- a posição do painel;
- o catálogo e os preços vistos na loja;
- o último saldo e o último estoque vistos, com a hora;
- as suas preferências de confirmação e de atualização automática.

Não lê a sua senha, não faz chamada de rede nenhuma e não envia nada para lugar nenhum. O código
é um arquivo só, sem dependências, e está aqui inteiro para ser lido.

## Transparência

O painel fica um pouco transparente em repouso, para não tapar o jogo atrás dele, e volta ao normal
assim que o mouse ou o cursor de texto chega perto.

## Onde funciona

`pokepixel.nietore.com` e `poke.idleworld.online`. Em qualquer outro site ela não é carregada.

## Antes de usar

Isto automatiza uma ação do jogo. **Se o PokePixel proibir automação, usar esta extensão é por sua
conta e risco**, e nenhum detalhe de implementação muda isso.

Vale saber também que ela é detectável, caso o jogo resolva procurar: o painel é um elemento
acrescentado à página, com um id próprio, e os cliques que ela dá chegam marcados como não
confiáveis (`isTrusted: false`), ao contrário dos seus. Não há como esconder nenhuma das duas
coisas de dentro de uma extensão que desenha na tela.
