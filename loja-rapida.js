// PokePixel - loja rapida
//
// Um botao por item da loja do Mark: pokebolas, pocoes e revives. Cada item guarda a sua propria
// quantidade, entao comprar vira um clique so'.
//
// Nada daqui fala com o servidor por fora: o que o botao faz e' exatamente o que voce faria a mao,
// na propria tela da loja. Abrir, achar o item, escrever a quantidade, clicar em Comprar.

(() => {
  'use strict';

  const CHAVE_QTD = 'lioncode:loja-rapida:quantidades';
  const CHAVE_POS = 'lioncode:loja-rapida:posicao';
  const CHAVE_CATALOGO = 'lioncode:loja-rapida:catalogo';
  const CHAVE_CONFIRMA = 'lioncode:loja-rapida:confirmar';
  const CHAVE_SALDO = 'lioncode:loja-rapida:saldo';
  const CHAVE_ESTOQUE = 'lioncode:loja-rapida:estoque';
  const CHAVE_AUTO = 'lioncode:loja-rapida:auto-mochila';
  const CATEGORIAS = ['Pokébolas', 'Poções', 'Revives'];

  // A loja premium usa as mesmas classes npc-shop. Sem excluir ela, o script compraria diamante.
  const LOJA = '.npc-shop-window:not(.premium-shop-window)';

  const ler = (chave, padrao) => {
    try {
      return JSON.parse(localStorage.getItem(chave)) ?? padrao;
    } catch {
      return padrao;
    }
  };
  const gravar = (chave, valor) => {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      /* modo anonimo, ou armazenamento cheio: a extensao continua, so' nao lembra. */
    }
  };

  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

  /** Separador de milhar: "1300" nao se le' tao rapido quanto "1.300" na hora de gastar. */
  const moeda = (valor) => Number(valor || 0).toLocaleString('pt-BR');

  /** Espera um elemento aparecer, porque a loja demora a montar depois do clique no menu. */
  async function aguardar(seletor, limite = 4000) {
    const fim = Date.now() + limite;
    while (Date.now() < fim) {
      const achado = document.querySelector(seletor);
      if (achado && achado.getBoundingClientRect().width > 0) return achado;
      await espera(100);
    }
    return null;
  }

  const lojaAberta = () => {
    const janela = document.querySelector(LOJA);
    return janela && janela.getBoundingClientRect().width > 0 ? janela : null;
  };

  /**
   * Abre a loja pelo menu do proprio jogo. O botao "Cidade" e' um grupo que so' mostra a lista ao
   * passar o mouse, mas os itens existem no DOM o tempo todo, entao da' para clicar direto.
   */
  async function abrirLoja() {
    if (lojaAberta()) return { janela: lojaAberta(), abriEu: false };
    const item = [...document.querySelectorAll('.pokeidle-top-toolbar__dropdown-btn')].find(
      (b) => (b.textContent || '').trim() === 'Loja do Mark',
    );
    if (!item) return { janela: null, abriEu: false };
    item.click();
    return { janela: await aguardar(LOJA), abriEu: true };
  }

  /**
   * Fecha so' pelo botao "Fechar" do rodape da loja.
   *
   * A primeira versao procurava qualquer botao de fechar dentro da janela e acabava clicando no X
   * da caixa de confirmacao, cancelando a compra que ela mesma tinha pedido.
   */
  function fecharLoja(janela) {
    if (confirmacaoNaTela()) return;
    const fechar = [...janela.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim() === 'Fechar',
    );
    if (fechar) fechar.click();
  }

  const CAIXAS = '[class*="modal"],[class*="dialog"],[class*="confirm"],[class*="panel"]';

  /**
   * A caixa de confirmacao do jogo.
   *
   * Procurada pelo que ela *e'* — texto "Confirmar compra" com os botoes Comprar e Cancelar —, e
   * nao por classe nem por posicao no DOM. A primeira versao exigia que o titulo fosse um elemento
   * sem filhos e nao achava nada, por isso a confirmacao automatica nunca disparava. Entre os
   * candidatos vence o menor: o maior seria a tela inteira, que tambem contem o texto.
   */
  function confirmacaoNaTela() {
    const candidatos = [...document.querySelectorAll('div,section,article,dialog,aside')].filter(
      (e) => {
        if (e.getBoundingClientRect().width === 0) return false;
        if (!(e.textContent || '').includes('Confirmar compra')) return false;
        const textos = [...e.querySelectorAll('button')].map((b) => (b.textContent || '').trim());
        return textos.includes('Comprar') && textos.includes('Cancelar');
      },
    );
    candidatos.sort((a, b) => a.textContent.length - b.textContent.length);
    return candidatos[0] ?? null;
  }

  async function aguardarConfirmacao(limite = 2500) {
    const fim = Date.now() + limite;
    while (Date.now() < fim) {
      const caixa = confirmacaoNaTela();
      if (caixa) return caixa;
      await espera(80);
    }
    return null;
  }

  const cartoes = (janela) => [...janela.querySelectorAll('.npc-shop__buy-card')];

  /**
   * O saldo que a loja mostra no rodape.
   *
   * So' existe no DOM enquanto a loja esta' aberta, que e' justamente quando o painel nao precisa
   * dele. Por isso e' guardado com a hora: melhor um numero velho e datado do que nenhum.
   */
  function saldoNaLoja(janela) {
    const valor = [...janela.querySelectorAll('.pokeidle-currency__amount')].find((e) => {
      let pai = e.parentElement;
      for (let nivel = 0; pai && nivel < 4; nivel += 1, pai = pai.parentElement)
        if (/SEU SALDO/i.test(pai.textContent || '')) return true;
      return false;
    });
    const numero = Number((valor?.textContent || '').replace(/\D/g, ''));
    return Number.isFinite(numero) && numero > 0 ? numero : null;
  }

  function anotarSaldo() {
    const janela = lojaAberta();
    if (!janela) return false;
    const valor = saldoNaLoja(janela);
    if (valor === null) return false;
    const antes = ler(CHAVE_SALDO, null);
    gravar(CHAVE_SALDO, { valor, quando: Date.now() });
    return antes?.valor !== valor;
  }

  // ---------- inventario ----------

  const INVENTARIO = '.inventory-window';

  /**
   * Quanto de cada item existe na mochila.
   *
   * Cada slot traz o nome e a quantidade no proprio `aria-label` ("Poke Ball, 77149 unidades"),
   * que e' mais confiavel que o texto do icone: ali o numero vem abreviado com separador.
   */
  function estoqueNaTela() {
    const janela = inventarioAberto();
    if (!janela) return null;
    const achados = {};
    for (const slot of janela.querySelectorAll('.inventory-slot')) {
      const texto = slot.getAttribute('aria-label') || '';
      const partes = /^(.+),\s*(\d+)\s+unidades?$/.exec(texto);
      if (partes) achados[partes[1].trim()] = Number(partes[2]);
    }
    return Object.keys(achados).length ? achados : null;
  }

  function anotarEstoque() {
    const achados = estoqueNaTela();
    if (!achados) return false;
    gravar(CHAVE_ESTOQUE, { itens: achados, quando: Date.now() });
    return true;
  }

  /**
   * Abre o inventario, le, e fecha se foi este botao que abriu.
   *
   * O script nao abre esta tela sozinho de tempos em tempos: so' quando voce pede. Uma janela que
   * pisca na sua frente no meio do jogo e' pior do que um numero velho.
   */
  /**
   * Aberto mesmo, nao so' presente.
   *
   * O jogo deixa a janela do inventario no DOM depois de fechada, igual a' loja premium. Testar a
   * existencia dava "ja' esta' aberto" com ela fechada: o script nao abria, nao lia nada e ainda
   * reclamava. O que vale e' ter tamanho na tela.
   */
  const inventarioAberto = () => {
    const janela = document.querySelector(INVENTARIO);
    return janela && janela.getBoundingClientRect().width > 0 ? janela : null;
  };

  /** O X do cabecalho. Procurado pelo texto, pelo rotulo e pela classe, porque varia. */
  function fecharInventario() {
    const janela = inventarioAberto();
    if (!janela) return;
    const botao = [...janela.querySelectorAll('button')].find((b) => {
      if (b.classList.contains('inventory-slot') || b.classList.contains('inventory-category-tab'))
        return false;
      const texto = (b.textContent || '').trim();
      const rotulo = `${b.getAttribute('aria-label') || ''} ${b.getAttribute('title') || ''} ${b.className}`;
      return /^[✕×✖xX]$/.test(texto) || /close|fechar/i.test(rotulo);
    });
    if (botao) {
      botao.click();
      return;
    }
    // Sem botao reconhecido, Escape e' o que o jogo tambem aceita para fechar uma janela.
    for (const tipo of ['keydown', 'keyup'])
      document.dispatchEvent(
        new KeyboardEvent(tipo, { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }),
      );
  }

  async function atualizarEstoque(avisar) {
    const jaAberto = Boolean(inventarioAberto());
    if (!jaAberto) {
      const botao = document.querySelector('.pokeidle-top-toolbar__btn[data-menu-id="inventory"]');
      if (!botao) {
        avisar('nao achei o inventario');
        return;
      }
      botao.click();
      if (!(await aguardar(INVENTARIO, 8000))) {
        avisar('o inventario nao abriu');
        return;
      }
      await espera(400);
    }
    const certo = anotarEstoque();
    if (!jaAberto) {
      // A mochila fica aberta de 1 a 5 segundos antes de fechar, nunca o mesmo tempo duas vezes.
      await espera(1000 + Math.random() * 4000);
      fecharInventario();
      await espera(500);
      // Se nao fechou, dizer isso e' melhor do que deixar a janela aberta sem explicacao.
      if (inventarioAberto()) {
        avisar(certo ? 'li a mochila, mas nao consegui fechar' : 'nao li nem fechei a mochila');
        desenhar();
        return;
      }
    }
    avisar(certo ? 'mochila atualizada' : 'nao li a mochila');
    desenhar();
  }

  /** "agora", "ha 7 min", "ha 2 h": a idade importa mais que o horario exato. */
  function idade(quando) {
    const minutos = Math.floor((Date.now() - quando) / 60000);
    if (minutos < 1) return 'agora';
    if (minutos < 60) return `ha ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    return horas < 24 ? `ha ${horas} h` : `ha ${Math.floor(horas / 24)} d`;
  }

  const dadosDoCartao = (cartao) => ({
    nome: cartao.querySelector('b')?.textContent?.trim() ?? '',
    categoria: cartao.querySelector('.npc-shop__item-category')?.textContent?.trim() ?? '',
    preco: Number(
      cartao.querySelector('.npc-shop__purchase-button .pokeidle-currency__amount')?.textContent
        ?.replace(/\D/g, '') ?? 0,
    ),
  });

  /**
   * O campo e' controlado pelo jogo: mudar `.value` direto nao avisa ninguem e o clique seguinte
   * compraria a quantidade antiga. O setter nativo mais os eventos e' o que o jogo escuta.
   */
  function escrever(input, valor) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(valor));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * O cartao do item, esperando ele aparecer.
   *
   * A janela da loja fica visivel antes de a lista de produtos existir. Procurar o cartao no
   * instante seguinte ao clique nao achava nada, e era por isso que a compra precisava de dois
   * cliques: o primeiro so' abria a loja, o segundo encontrava o que o primeiro deveria ter achado.
   */
  async function aguardarCartao(janela, nome, limite = 6000) {
    const fim = Date.now() + limite;
    while (Date.now() < fim) {
      const cartao = cartoes(janela).find((c) => dadosDoCartao(c).nome === nome);
      if (cartao && cartao.querySelector('.npc-shop__custom-button')) return cartao;
      await espera(100);
    }
    return null;
  }

  /**
   * Reparte o resto da compra ao longo de 5 a 20 segundos, contados de agora.
   *
   * O relogio comeca quando a loja ja' esta' aberta, e os marcos sao absolutos: o tempo que o jogo
   * levar para montar a lista e' descontado da fatia seguinte em vez de somar no fim. Assim a
   * duracao total e' a sorteada, e nao a sorteada mais o carregamento.
   */
  function ritmo() {
    const inicio = Date.now();
    const total = 5000 + Math.random() * 15000;
    const marcos = [0.3, 0.6, 0.85, 1].map((parte) => Math.round(total * parte));
    let passo = 0;
    return () => {
      const alvo = marcos[Math.min(passo++, marcos.length - 1)];
      return espera(Math.max(0, inicio + alvo - Date.now()));
    };
  }

  /**
   * Compra um item com a loja ja' aberta.
   *
   * Separado de `comprar` porque o botao "Comprar tudo" abre a loja uma vez e passa por varios
   * itens: abrir e fechar a cada item seria lento e piscaria a tela sem motivo.
   */
  async function comprarNaLoja(janela, nome, quantidade, avisar) {
    const pausa = ritmo();
    await pausa();
    const cartao = await aguardarCartao(janela, nome, 20000);
    if (!cartao) {
      avisar(`${nome} nao apareceu no catalogo`);
      return false;
    }
    const campo = cartao.querySelector('.npc-shop__custom-purchase input[type="number"]');
    const botao = cartao.querySelector('.npc-shop__custom-button');
    if (!campo || !botao) {
      avisar('a loja mudou de formato');
      return false;
    }
    avisar(`${nome}: escrevendo ${quantidade}...`);
    await pausa();
    escrever(campo, quantidade);
    // A loja ainda redesenha depois de abrir; se o redesenho apagar o valor, escreve de novo.
    await espera(250);
    if (Number(campo.value) !== quantidade) {
      escrever(campo, quantidade);
      await espera(250);
    }
    avisar(`comprando ${quantidade}x ${nome}...`);
    await pausa();
    botao.click();

    const caixa = await aguardarConfirmacao(5000);
    if (caixa) {
      if (!ler(CHAVE_CONFIRMA, true)) {
        avisar(`confirme: ${quantidade}x ${nome}`);
        return false;
      }
      // So' confirma a caixa que corresponde ao que este clique pediu. Se o texto falar de outro
      // item ou de outra quantidade, e' outra compra e nao e' deste script confirmar.
      const texto = (caixa.textContent || '').replace(/\s+/g, ' ');
      const confere = texto.includes(nome) && texto.replace(/\s/g, '').includes(`${quantidade}×`);
      const sim = [...caixa.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim() === 'Comprar',
      );
      if (!confere || !sim) {
        avisar('confirmacao diferente do pedido');
        return false;
      }
      avisar('confirmando...');
      await pausa();
      sim.click();
      await espera(400);
    }
    avisar(`${quantidade}x ${nome}`);
    return true;
  }

  async function comprar(nome, quantidade, avisar) {
    avisar('abrindo a loja...');
    const { janela, abriEu } = await abrirLoja();
    if (!janela) {
      avisar('nao achei a loja do Mark');
      return;
    }
    // So' agora o relogio comeca: abrir a loja nao entra na conta dos 5 a 20 segundos.
    await comprarNaLoja(janela, nome, quantidade, avisar);
    if (abriEu) fecharLoja(janela);
  }

  let parar = false;

  /** Percorre a lista comprando so' o que tem quantidade maior que zero. */
  async function comprarTudo(avisar) {
    const quantidades = ler(CHAVE_QTD, {});
    const pedido = ler(CHAVE_CATALOGO, [])
      .filter((item) => CATEGORIAS.includes(item.categoria))
      .map((item) => ({ ...item, quantidade: Number(quantidades[item.nome]) || 0 }))
      .filter((item) => item.quantidade > 0);
    if (!pedido.length) {
      avisar('nada configurado acima de zero');
      return;
    }
    parar = false;
    avisar('abrindo a loja...');
    const { janela, abriEu } = await abrirLoja();
    if (!janela) {
      avisar('nao achei a loja do Mark');
      return;
    }
    let feitos = 0;
    for (const item of pedido) {
      if (parar) break;
      feitos += 1;
      const prefixo = `${feitos}/${pedido.length} `;
      const ok = await comprarNaLoja(janela, item.nome, item.quantidade, (texto) =>
        avisar(prefixo + texto),
      );
      // Um item que falhou nao interrompe o resto: os outros nao tem culpa.
      if (!ok) await espera(400);
    }
    if (abriEu) fecharLoja(janela);
    avisar(parar ? `parado em ${feitos}/${pedido.length}` : `pronto: ${pedido.length} itens`);
  }

  /** Guarda o catalogo para os botoes existirem mesmo com a loja fechada. */
  function lembrarCatalogo() {
    const janela = lojaAberta();
    if (!janela) return;
    const itens = cartoes(janela)
      .map(dadosDoCartao)
      .filter((item) => CATEGORIAS.includes(item.categoria));
    if (itens.length) gravar(CHAVE_CATALOGO, itens);
  }

  // ---------- interface ----------

  const painel = document.createElement('div');
  painel.id = 'lioncode-loja-rapida';
  painel.innerHTML = `
    <header>
      <strong>Loja rapida</strong>
      <span data-saldo></span>
      <button type="button" data-fechar>&times;</button>
    </header>
    <div data-lista></div>
    <footer>
      <label><input type="checkbox" data-confirma> Confirmar sozinho</label>
      <button type="button" class="tudo" data-tudo></button>
      <div class="rodape">
        <button type="button" data-mochila>Atualizar mochila</button>
        <span data-aviso>Alt+C esconde</span>
      </div>
      <div class="linhas">
        <label class="auto">
          <input type="checkbox" data-auto> atualizar sozinho a cada
          <input type="number" data-min min="1" max="1440"> a
          <input type="number" data-max min="1" max="1440"> min
        </label>
      </div>
    </footer>`;

  const estilo = document.createElement('style');
  estilo.textContent = `
    /* Sem isto a largura declarada nao inclui padding e borda, e o campo de quantidade ficava 14px
       mais largo que a coluna do cabecalho — os rotulos nao batiam com as colunas. */
    #lioncode-loja-rapida, #lioncode-loja-rapida * { box-sizing: border-box; }
    #lioncode-loja-rapida {
      position: fixed; z-index: 2147483000; width: 524px; max-height: 88vh; overflow: auto;
      background: #10151e; color: #e6e9ef; border: 1px solid #2a3240; border-radius: 12px;
      font: 12px/1.45 system-ui, sans-serif; box-shadow: 0 14px 34px rgba(0,0,0,.55);
      scrollbar-width: thin; scrollbar-color: #2a3240 transparent;
    }
    #lioncode-loja-rapida header {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 9px 12px; background: linear-gradient(#1b2430, #161d27); cursor: move;
      user-select: none; border-bottom: 1px solid #2a3240; position: sticky; top: 0; z-index: 2;
    }
    #lioncode-loja-rapida header strong { font-size: 12px; letter-spacing: .3px; }
    #lioncode-loja-rapida header button {
      background: none; border: 0; color: #8b93a5; font-size: 17px; cursor: pointer; line-height: 1;
      padding: 0 2px;
    }
    #lioncode-loja-rapida header button:hover { color: #e6e9ef; }
    #lioncode-loja-rapida h4 {
      margin: 9px 12px 4px; font-size: 10px; text-transform: uppercase; color: #7d8697;
      letter-spacing: 1px; font-weight: 600;
    }
    /* As colunas do cabecalho repetem as larguras das linhas, senao os rotulos sairiam do lugar. */
    #lioncode-loja-rapida .cabecalho {
      display: flex; align-items: center; gap: 8px; margin: 2px 8px 4px;
      padding: 0 10px; border: 1px solid transparent; font-size: 10px; letter-spacing: 1px;
      text-transform: uppercase; color: #6d7586;
    }
    #lioncode-loja-rapida .cabecalho span { text-align: right; }
    #lioncode-loja-rapida .col-qtd { flex: none; width: 72px; }
    #lioncode-loja-rapida .col-vazio { flex: none; width: 76px; }
    /* Uma linha por item: nome, estoque, quantidade, gasto e botao lado a lado, sem rolagem. */
    #lioncode-loja-rapida .item {
      display: flex; align-items: center; gap: 8px;
      margin: 0 8px 4px; padding: 5px 9px; border: 1px solid #222a37; border-radius: 8px;
      background: #141b26;
    }
    #lioncode-loja-rapida .item__nome {
      flex: 1; min-width: 120px; font-weight: 600; color: #f2f4f8; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    #lioncode-loja-rapida .item__unidade {
      flex: none; width: 86px; text-align: right; color: #7d8697; font-size: 11px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      font-variant-numeric: tabular-nums;
    }
    #lioncode-loja-rapida .item__total {
      flex: none; width: 76px; text-align: right; color: #e9c877;
      font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis;
    }
    #lioncode-loja-rapida input[type="number"] {
      flex: none; width: 72px; background: #0b0f16; color: #e6e9ef; border: 1px solid #2a3240;
      border-radius: 7px; padding: 4px 6px; font: inherit; text-align: right;
      font-variant-numeric: tabular-nums;
    }
    #lioncode-loja-rapida input[type="number"]:focus {
      outline: none; border-color: #3d4b63; background: #0d131c;
    }
    #lioncode-loja-rapida .item button {
      flex: none; width: 76px; background: #22304a; color: #dfe6f3; border: 1px solid #31425f;
      border-radius: 7px; padding: 4px 8px; font: inherit; font-weight: 600; cursor: pointer;
    }
    #lioncode-loja-rapida .item button:hover:not(:disabled) { background: #2c3d5c; }
    #lioncode-loja-rapida .item button:disabled { opacity: .45; cursor: default; }
    #lioncode-loja-rapida footer {
      padding: 8px 12px; border-top: 1px solid #2a3240; color: #7d8697;
      position: sticky; bottom: 0; background: #10151e; z-index: 2;
    }
    #lioncode-loja-rapida footer label {
      display: flex; align-items: center; gap: 7px; cursor: pointer; margin-bottom: 5px;
      color: #c3c9d6;
    }
    #lioncode-loja-rapida [data-aviso] { display: block; min-height: 15px; }
    #lioncode-loja-rapida [data-saldo] {
      flex: 1; text-align: right; font-size: 11px; color: #9aa3b4; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums;
    }
    #lioncode-loja-rapida [data-saldo] b { color: #cfd6e4; font-weight: 600; }
    #lioncode-loja-rapida [data-saldo] i { font-style: normal; color: #6d7586; }
    /* Nao bloqueia a compra: o saldo pode estar velho, entao o aviso e' visual, nao uma trava. */
    #lioncode-loja-rapida .item__total--caro { color: #e38080; }
    #lioncode-loja-rapida .rodape { display: flex; align-items: center; gap: 8px; }
    #lioncode-loja-rapida footer .linhas {
      display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    }
    #lioncode-loja-rapida footer .linhas label { margin: 0; }
    #lioncode-loja-rapida .rodape button {
      flex: none; background: #1a2230; color: #c3c9d6; border: 1px solid #2a3240;
      border-radius: 7px; padding: 3px 9px; font: inherit; cursor: pointer;
    }
    #lioncode-loja-rapida .rodape button:hover:not(:disabled) { background: #222c3d; }
    #lioncode-loja-rapida .rodape button:disabled { opacity: .45; cursor: default; }
    #lioncode-loja-rapida .rodape [data-aviso] { flex: 1; min-width: 0; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; }
    #lioncode-loja-rapida .tudo {
      display: block; width: 100%; margin-bottom: 7px; padding: 7px; font: inherit;
      font-weight: 600; cursor: pointer; border-radius: 8px; border: 1px solid #3a5a3f;
      background: #1e3326; color: #d6efdc;
    }
    #lioncode-loja-rapida .tudo:hover:not(:disabled) { background: #26412f; }
    #lioncode-loja-rapida .tudo:disabled { opacity: .45; cursor: default; }
    #lioncode-loja-rapida .tudo.parando { border-color: #5e3a3a; background: #33201f; color: #f0cfcf; }
    #lioncode-loja-rapida .item--fora { opacity: .55; }
    #lioncode-loja-rapida .item__total--fora { color: #6d7586; }
    #lioncode-loja-rapida footer label.auto { margin: 6px 0 0; gap: 5px; color: #9aa3b4; }
    #lioncode-loja-rapida footer label.auto input[type="number"] {
      width: 44px; padding: 2px 4px;
    }`;

  let comprandoTudo = false;
  let emCompra = false;

  const aviso = () => painel.querySelector('[data-aviso]');
  let apagarAviso = 0;
  const mostrar = (texto) => {
    aviso().textContent = texto;
    clearTimeout(apagarAviso);
    apagarAviso = setTimeout(() => (aviso().textContent = 'Alt+C esconde'), 3000);
  };

  function desenharSaldo() {
    const campo = painel.querySelector('[data-saldo]');
    const guardado = ler(CHAVE_SALDO, null);
    campo.textContent = '';
    if (!guardado) return;
    const valor = document.createElement('b');
    valor.textContent = moeda(guardado.valor);
    const quando = document.createElement('i');
    quando.textContent = ` ${idade(guardado.quando)}`;
    campo.append(valor, quando);
    campo.title = `Saldo visto na loja ${idade(guardado.quando)}. Pode estar desatualizado.`;
  }

  function desenhar() {
    const quantidades = ler(CHAVE_QTD, {});
    const catalogo = ler(CHAVE_CATALOGO, []);
    const estoque = ler(CHAVE_ESTOQUE, { itens: {}, quando: 0 });
    const lista = painel.querySelector('[data-lista]');
    lista.textContent = '';
    if (!catalogo.length) {
      const vazio = document.createElement('p');
      vazio.style.cssText = 'margin:10px;color:#8b93a5';
      vazio.textContent = 'Abra a loja do Mark uma vez para eu aprender o catalogo.';
      lista.append(vazio);
      return;
    }
    const cabecalho = document.createElement('div');
    cabecalho.className = 'cabecalho';
    for (const [classe, texto] of [
      ['item__nome', ''],
      ['item__unidade', 'mochila'],
      ['col-qtd', 'quantidade'],
      ['item__total', 'valor'],
      ['col-vazio', ''],
    ]) {
      const celula = document.createElement('span');
      celula.className = classe;
      celula.textContent = texto;
      cabecalho.append(celula);
    }
    lista.append(cabecalho);

    for (const categoria of CATEGORIAS) {
      const doGrupo = catalogo.filter((item) => item.categoria === categoria);
      if (!doGrupo.length) continue;
      const titulo = document.createElement('h4');
      titulo.textContent = categoria;
      lista.append(titulo);
      for (const item of doGrupo) {
        const bloco = document.createElement('div');
        bloco.className = 'item';
        bloco.dataset.preco = String(item.preco);

        const nome = document.createElement('span');
        nome.className = 'item__nome';
        nome.textContent = item.nome;
        nome.title = item.nome;
        const unidade = document.createElement('span');
        unidade.className = 'item__unidade';
        const tenho = estoque.itens?.[item.nome];
        // O rotulo saiu daqui para o cabecalho das colunas: repetir "tenho" em cada linha so'
        // roubava espaco do nome e atrapalhava comparar os numeros de cima a baixo.
        unidade.textContent = tenho === undefined ? '—' : moeda(tenho);
        unidade.title =
          tenho === undefined
            ? `${moeda(item.preco)} cada`
            : `${moeda(tenho)} na mochila (${idade(estoque.quando)}) · ${moeda(item.preco)} cada`;
        const campo = document.createElement('input');
        campo.type = 'number';
        // Zero e' uma resposta valida: significa "este nao entra na compra de tudo".
        campo.min = '0';
        campo.value = quantidades[item.nome] ?? 0;
        const botao = document.createElement('button');
        botao.type = 'button';
        const total = document.createElement('span');
        total.className = 'item__total';
        // O gasto aparece antes do clique: o preco unitario sozinho nao responde "quanto vai sair".
        const pedido = () => Math.max(0, Math.floor(Number(campo.value) || 0));
        const atualizarTotal = () => {
          const gasto = pedido() * item.preco;
          total.textContent = gasto ? `= ${moeda(gasto)}` : 'fora';
          const saldo = ler(CHAVE_SALDO, null)?.valor;
          total.classList.toggle('item__total--caro', Boolean(saldo) && gasto > saldo);
          total.classList.toggle('item__total--fora', gasto === 0);
          bloco.classList.toggle('item--fora', gasto === 0);
          botao.disabled = gasto === 0;
          total.title = saldo ? `Ultimo saldo conhecido: ${moeda(saldo)}` : '';
          somarPedido();
        };
        atualizarTotal();
        campo.addEventListener('input', atualizarTotal);
        campo.addEventListener('change', () => {
          campo.value = pedido();
          atualizarTotal();
          gravar(CHAVE_QTD, { ...ler(CHAVE_QTD, {}), [item.nome]: pedido() });
        });
        botao.textContent = 'Comprar';
        botao.addEventListener('click', () => {
          if (!pedido()) return;
          ocupado(true);
          void comprar(item.nome, pedido(), mostrar).finally(() => ocupado(false));
        });
        bloco.append(nome, unidade, campo, total, botao);
        lista.append(bloco);
      }
    }
  }

  // Arrastar pelo cabecalho, com a posicao lembrada: o painel fica onde voce deixou.
  function arrastavel() {
    const cabecalho = painel.querySelector('header');
    let partida = null;
    cabecalho.addEventListener('pointerdown', (evento) => {
      if (evento.target.closest('button')) return;
      // `...getBoundingClientRect()` devolve objeto vazio: as medidas vivem no prototipo, nao no
      // objeto. `partida.left` saia undefined, a conta dava NaN e o painel so' nao andava.
      const caixa = painel.getBoundingClientRect();
      partida = { x: evento.clientX, y: evento.clientY, left: caixa.left, top: caixa.top };
      cabecalho.setPointerCapture(evento.pointerId);
    });
    cabecalho.addEventListener('pointermove', (evento) => {
      if (!partida) return;
      const x = Math.max(0, Math.min(innerWidth - 60, partida.left + evento.clientX - partida.x));
      const y = Math.max(0, Math.min(innerHeight - 30, partida.top + evento.clientY - partida.y));
      painel.style.left = `${x}px`;
      painel.style.top = `${y}px`;
      painel.style.right = 'auto';
    });
    const soltar = () => {
      if (!partida) return;
      partida = null;
      gravar(CHAVE_POS, { left: painel.style.left, top: painel.style.top });
    };
    cabecalho.addEventListener('pointerup', soltar);
    cabecalho.addEventListener('pointercancel', soltar);
  }

  const posicao = ler(CHAVE_POS, null);
  if (posicao?.left) {
    painel.style.left = posicao.left;
    painel.style.top = posicao.top;
  } else {
    painel.style.right = '16px';
    painel.style.top = '110px';
  }

  document.documentElement.append(estilo, painel);
  arrastavel();
  // A idade do saldo envelhece sozinha; sem isto ficaria "agora" para sempre.
  setInterval(desenharSaldo, 30000);

  const tudo = painel.querySelector('[data-tudo]');
  const mochila = painel.querySelector('[data-mochila]');

  /** Enquanto uma compra corre, nada mais pode comecar outra; so' o "Parar" continua vivo. */
  function ocupado(estado) {
    emCompra = estado;
    for (const b of painel.querySelectorAll('.item button, [data-mochila]'))
      b.disabled = estado || b.closest('.item')?.classList.contains('item--fora') === true;
    tudo.disabled = estado && !comprandoTudo;
    tudo.classList.toggle('parando', comprandoTudo);
    tudo.textContent = comprandoTudo ? 'Parar' : rotuloTudo();
  }

  /**
   * O rotulo do botao ja' diz o que vai sair da conta.
   *
   * A soma vem dos campos na tela, nao do que esta' gravado: gravar so' acontece ao sair do campo,
   * e ate' la' o rodape mostraria um total que nao corresponde ao que se esta' vendo.
   */
  function rotuloTudo() {
    const soma = [...painel.querySelectorAll('.item')].reduce((total, bloco) => {
      const quanto = Math.max(0, Math.floor(Number(bloco.querySelector('input')?.value) || 0));
      return total + quanto * Number(bloco.dataset.preco || 0);
    }, 0);
    return soma ? `Comprar tudo · ${moeda(soma)}` : 'Comprar tudo';
  }

  function somarPedido() {
    if (!comprandoTudo) tudo.textContent = rotuloTudo();
  }

  tudo.addEventListener('click', () => {
    if (comprandoTudo) {
      parar = true;
      tudo.disabled = true;
      return;
    }
    comprandoTudo = true;
    ocupado(true);
    void comprarTudo(mostrar).finally(() => {
      comprandoTudo = false;
      parar = false;
      ocupado(false);
      somarPedido();
    });
  });

  mochila.addEventListener('click', () => {
    mochila.disabled = true;
    void atualizarEstoque(mostrar).finally(() => {
      mochila.disabled = false;
    });
  });

  // Atualizacao sozinha: desligada por padrao, porque abre uma janela do jogo na sua frente.
  const auto = painel.querySelector('[data-auto]');
  const campoMin = painel.querySelector('[data-min]');
  const campoMax = painel.querySelector('[data-max]');
  let relogio = 0;

  /** Le a configuracao aceitando tambem o formato antigo, de um valor so'. */
  function configAuto() {
    const salvo = ler(CHAVE_AUTO, null) ?? {};
    const minimo = Number(salvo.min ?? salvo.minutos) || 60;
    const maximo = Number(salvo.max ?? salvo.minutos) || minimo;
    return { ligado: Boolean(salvo.ligado), min: minimo, max: Math.max(minimo, maximo) };
  }

  /**
   * Agenda a proxima leitura, sorteando o intervalo dentro da faixa.
   *
   * Encadeado com `setTimeout` em vez de `setInterval`: cada ciclo sorteia o seu proprio tempo, e
   * um intervalo fixo e' o padrao mais obvio que existe.
   */
  function agendarMochila() {
    clearTimeout(relogio);
    const config = configAuto();
    auto.checked = config.ligado;
    campoMin.value = config.min;
    campoMax.value = config.max;
    campoMin.disabled = !config.ligado;
    campoMax.disabled = !config.ligado;
    if (!config.ligado) return;
    const minutos = config.min + Math.random() * (config.max - config.min);
    relogio = setTimeout(
      () => {
        // Nunca no meio de uma compra: abrir o inventario ali atrapalharia a propria loja.
        if (!lojaAberta() && !confirmacaoNaTela()) void atualizarEstoque(mostrar);
        agendarMochila();
      },
      Math.max(1, minutos) * 60000,
    );
  }

  const salvarAuto = () => {
    const limite = (campo, padrao) => Math.min(1440, Math.max(1, Number(campo.value) || padrao));
    const minimo = limite(campoMin, 60);
    gravar(CHAVE_AUTO, {
      ligado: auto.checked,
      min: minimo,
      // O maximo nunca fica abaixo do minimo, senao a faixa nao existe.
      max: Math.max(minimo, limite(campoMax, minimo)),
    });
    agendarMochila();
  };
  auto.addEventListener('change', salvarAuto);
  campoMin.addEventListener('change', salvarAuto);
  campoMax.addEventListener('change', salvarAuto);
  // Aqui, e nao junto do resto da partida: `agendarMochila` le' os campos, que so' existem acima.
  agendarMochila();

  const confirma = painel.querySelector('[data-confirma]');
  confirma.checked = ler(CHAVE_CONFIRMA, true);
  confirma.addEventListener('change', () => gravar(CHAVE_CONFIRMA, confirma.checked));

  // Desenhar por ultimo: a lista le' `tudo` e `ocupado`, que so' existem depois da fiacao acima.
  desenhar();
  desenharSaldo();
  ocupado(false);

  painel.querySelector('[data-fechar]').addEventListener('click', () => {
    painel.style.display = 'none';
  });

  addEventListener('keydown', (evento) => {
    if (evento.altKey && !evento.ctrlKey && evento.code === 'KeyC') {
      evento.preventDefault();
      painel.style.display = painel.style.display === 'none' ? '' : 'none';
    }
  });

  // A loja pode abrir por fora daqui: observar o DOM mantem o catalogo em dia sozinho.
  new MutationObserver(() => {
    if (!lojaAberta()) return;
    const antes = JSON.stringify(ler(CHAVE_CATALOGO, []));
    lembrarCatalogo();
    if (JSON.stringify(ler(CHAVE_CATALOGO, [])) !== antes) desenhar();
    if (anotarSaldo()) {
      desenharSaldo();
      desenhar();
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Inventario aberto por voce tambem conta: o painel aproveita e anota, sem abrir nada sozinho.
  new MutationObserver(() => {
    const antes = JSON.stringify(ler(CHAVE_ESTOQUE, {}).itens ?? {});
    if (anotarEstoque() && JSON.stringify(ler(CHAVE_ESTOQUE, {}).itens) !== antes) desenhar();
  }).observe(document.body, { childList: true, subtree: true });
})();
