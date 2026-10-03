# PokePixel — loja rápida

Um painel com um botão de compra para cada pokébola, poção e revive da loja do Mark. **Alt+C**
mostra e esconde.

Cada item tem a sua própria quantidade, que fica salva. Quem fica em **0** não entra na compra.
O painel mostra quanto você tem na mochila, quanto vai gastar e o seu saldo, e arrasta pelo
cabeçalho para onde você quiser.

## Como ela compra

Exatamente como você compraria. Ela abre a loja do Mark pelo menu do próprio jogo, acha o item
pelo nome no catálogo, escreve a quantidade no campo e clica em **Comprar**. Se o jogo pedir
confirmação, ela confirma — mas só uma caixa cujo texto corresponde ao item e à quantidade que
aquele clique pediu. Dá para desligar essa confirmação automática no rodapé.

**Nenhuma requisição é montada por fora do jogo.** O que sai do seu navegador é o mesmo que sairia
se você tivesse clicado. Ela também ignora de propósito a loja de diamantes: as duas telas usam as
mesmas classes, e sem esse cuidado um clique errado gastaria moeda paga.

## O botão "Comprar tudo"

Compra, em sequência, todos os itens com quantidade acima de zero, abrindo a loja uma única vez.
O valor total aparece no próprio botão. Durante a compra ele vira **Parar**: termina o item em
andamento e para, dizendo onde parou. Um item que falhar não interrompe os outros.

## A mochila

O número que aparece em cada linha vem do inventário do jogo, lido quando ele está aberto, e é
guardado com a hora da leitura — por isso pode estar desatualizado. O botão **Atualizar mochila**
abre o inventário, lê e fecha. Há também uma atualização automática, **desligada por padrão**, com
intervalo sorteado dentro de uma faixa que você define.

## O que ela guarda

Tudo no armazenamento da própria página, no seu computador:

- a quantidade escolhida para cada item;
- a posição do painel;
- o catálogo e os preços vistos na loja;
- o último saldo e o último estoque vistos, com a hora;
- as suas preferências de confirmação e de atualização automática.

Não lê a sua senha, não faz chamada de rede nenhuma e não envia nada para lugar nenhum. O código
é um arquivo só, sem dependências, e está aqui inteiro para ser lido.

## Onde funciona

`pokepixel.nietore.com` e `poke.idleworld.online`. Em qualquer outro site ela não é carregada.

## Antes de usar

Isto automatiza uma ação do jogo. **Se o PokePixel proibir automação, usar esta extensão é por sua
conta e risco**, e nenhum detalhe de implementação muda isso.

Vale saber também que ela é detectável, caso o jogo resolva procurar: o painel é um elemento
acrescentado à página, com um id próprio, e os cliques que ela dá chegam marcados como não
confiáveis (`isTrusted: false`), ao contrário dos seus. Não há como esconder nenhuma das duas
coisas de dentro de uma extensão que desenha na tela.
