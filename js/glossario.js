// glossario.js — dicionário de termos-chave que alimenta os balões de hover.
//
// Formato: GLOSSARIO é um objeto plano { "token": "definição" }.
// - Chave = o token EXATO como aparece nos spans de código dos enunciados
//   (case-sensitive; ex.: "yield", "json.loads", ".lower()", "try:").
// - Valor = string única, 1-2 frases em PT-BR: o que é + pra que serve,
//   sempre com uma imagem mental memorável (esteira, gaveta, porteiro...).
//   Sem aspas duplas dentro do texto, sem markdown, sem emoji.
// - Aliases (ex.: "re" e "regex", "gather" e "asyncio.gather") repetem o
//   MESMO texto — sem referências cruzadas, para o ui.js fazer lookup
//   direto: GLOSSARIO[token].
//
// Consumo esperado (ui.js): ao renderizar um enunciado, para cada span de
// código cujo texto exista aqui como chave, anexar o balão com a definição.

export const GLOSSARIO = {

  // ---------------------------------------------------------------
  // Fundamentos: fluxo, condições e palavras-chave
  // ---------------------------------------------------------------
  "def": "Define uma função: dá nome a uma receita de passos que você executa quantas vezes quiser, só chamando pelo nome. Os ingredientes entram como parâmetros; o prato sai pelo return.",
  "return": "Encerra a função e devolve um valor a quem chamou, como o caixa que entrega o troco e fecha o atendimento. Sem return, a função devolve None.",
  "print": "Mostra um valor na tela: o alto-falante do programa. Serve para conferir o que está acontecendo, mas não devolve nada — quem devolve é o return.",
  "input": "No Python, pausa e espera o usuário digitar, devolvendo SEMPRE texto (str). Na web, é o campo de formulário onde se digita — e o evento que dispara a cada tecla.",
  "if": "Cria uma bifurcação: o bloco só roda se a condição for verdadeira, como um porteiro que só abre a porta para quem cumpre a regra.",
  "elif": "Um segundo porteiro na fila: só é consultado se o if anterior recusou. Encadeia várias condições sem aninhar bloco dentro de bloco.",
  "else": "O plano B da bifurcação: roda quando nenhuma condição anterior passou — a porta que recebe todo mundo que sobrou.",
  "for": "Laço que percorre uma coleção item por item, como um carteiro que visita cada casa da rua uma vez e repete a mesma tarefa em cada parada.",
  "while": "Repete enquanto a condição for verdadeira, como uma torneira aberta até o balde encher. Se a condição nunca virar falsa, vira loop infinito.",
  "break": "Botão de emergência do laço: interrompe a repetição na hora e salta para depois dela, mesmo que ainda houvesse itens pela frente.",
  "continue": "Pula só a rodada atual do laço e vai direto para a próxima — o inspetor descarta a peça com defeito e segue para a seguinte da esteira.",
  "pass": "Não faz nada de propósito: preenche um bloco que a sintaxe exige, como um assento vazio com a placa de reservado.",
  "import": "Traz um módulo pronto para o seu código, como buscar uma caixa de ferramentas no depósito: você não fabrica o martelo, só pega e usa.",
  "from": "Importa apenas a peça que interessa de um módulo: em vez de carregar a caixa inteira, tira só a ferramenta que vai usar.",
  "as": "Dá um apelido ao que foi importado, como chamar numpy de np: nome curto, combinado que todo mundo reconhece.",
  "in": "Detector de presença: pergunta se algo está dentro de uma coleção (3 in lista) — e, no for, é quem entrega um item por vez.",
  "and": "Só é verdadeiro se OS DOIS lados forem verdadeiros: uma porta com duas fechaduras, que exige as duas chaves.",
  "or": "Verdadeiro se PELO MENOS UM lado for: duas campainhas na mesma porta — qualquer uma que toque já chama alguém.",
  "not": "Inverte o valor lógico: verdadeiro vira falso e vice-versa, como um interruptor que sempre troca o estado da lâmpada.",
  "is": "Pergunta se dois nomes apontam para o MESMO objeto na memória, não só valores iguais. Uso clássico: x is None.",
  "None": "O valor da ausência: a gaveta existe, mas está vazia. Funções sem return devolvem None, e o teste certo é x is None.",
  "True": "O sim lógico do Python, com T maiúsculo: o valor que faz if e while seguirem em frente.",
  "False": "O não lógico do Python, com F maiúsculo. Atenção: 0, texto vazio e lista vazia também contam como falsos numa condição.",

  // ---------------------------------------------------------------
  // Funções, classes e escopo
  // ---------------------------------------------------------------
  "yield": "Pausa a função e ENTREGA um valor sem encerrá-la; na próxima chamada ela continua dali. Transforma a função numa esteira que produz um item por vez, sem carregar tudo na memória.",
  "lambda": "Função anônima de uma linha: uma receita descartável escrita no lugar do uso. Perfeita como critério: sorted(itens, key=lambda x: x[1]).",
  "class": "Molde para fabricar objetos: define os dados e as ações de cada exemplar, como a planta de uma casa que vira muitas casas.",
  "self": "Dentro da classe, é o próprio objeto falando de si: self.nome é o crachá que ESTE objeto carrega, diferente do crachá dos outros.",
  "__init__": "O construtor: roda sozinho na criação do objeto e preenche os dados iniciais, como a ficha de cadastro na entrada do clube.",
  "dataclass": "Decorator que escreve __init__, __repr__ e __eq__ por você em classes que guardam dados: você declara os campos, o Python faz o resto.",
  "@dataclass": "Decorator que escreve __init__, __repr__ e __eq__ por você em classes que guardam dados: você declara os campos, o Python faz o resto.",
  "decorator": "Função que embrulha outra para adicionar comportamento (medir tempo, repetir, validar) sem mexer no código original — uma capa por cima da roupa.",
  "nonlocal": "Numa função aninhada, avisa que a variável pertence à função de fora: sem isso, atribuir criaria uma variável nova em vez de atualizar a de cima.",

  // ---------------------------------------------------------------
  // Tipos e coleções
  // ---------------------------------------------------------------
  "int": "Número inteiro, sem vírgula: conta o que não se divide — tokens, tentativas, páginas. int(texto) converte, ou lança ValueError se o texto não for número.",
  "int()": "Número inteiro, sem vírgula: conta o que não se divide — tokens, tentativas, páginas. int(texto) converte, ou lança ValueError se o texto não for número.",
  "float": "Número com casas decimais: preço, temperatura, latência. float(texto) converte — mas lembre que 0.1 + 0.2 não dá exatamente 0.3.",
  "str": "Texto: sequência imutável de caracteres. Tudo que o usuário digita chega como str; str(x) transforma qualquer valor em texto.",
  "bool": "Tipo lógico de dois valores: True e False. É a resposta de toda comparação e o combustível de if e while.",
  "list": "Coleção ordenada e mutável, como um trem de vagões: cada item tem posição, e dá para engatar, tirar e reordenar. Escreve-se com colchetes: [1, 2, 3].",
  "dict": "Coleção de pares chave -> valor, como um armário de gavetas etiquetadas: você pede pela etiqueta (chave) e recebe o conteúdo (valor) na hora, sem procurar gaveta por gaveta.",
  "set": "Coleção sem ordem e sem repetição, como lista de convidados: cada nome entra uma vez. Ideal para deduplicar e testar presença rapidinho.",
  "tuple": "Coleção ordenada e IMUTÁVEL, como um pacote lacrado: depois de criada, ninguém troca os itens. Ótima para pares fixos como (texto, score).",
  "len": "A fita métrica universal: mede quantos caracteres tem um texto, quantos itens tem uma lista ou um dict.",
  "range": "Fabrica números sob demanda: range(5) rende 0, 1, 2, 3, 4, um por vez, sem criar a lista inteira. O parceiro clássico do for.",
  "enumerate": "Percorre a coleção entregando (índice, item) a cada volta: um crachá numerado para cada elemento, sem você contar por fora.",
  "zip": "Fecha o zíper entre duas listas: primeiro com primeiro, segundo com segundo, formando pares. Para dados que andam em colunas paralelas.",
  "sorted": "Devolve uma lista NOVA já ordenada, sem mexer na original. Com key= você escolhe o critério da fila: por preço, por tamanho, pelo que quiser.",
  "sum": "Soma todos os números de uma coleção numa tacada: sum([1, 2, 3]) dá 6. O fechamento de caixa do Python.",
  "any": "Pergunta se PELO MENOS UM item é verdadeiro — e para no primeiro sim, como o fiscal que encerra a vistoria ao achar a primeira irregularidade.",
  "all": "Pergunta se TODOS os itens são verdadeiros — e para no primeiro não, como o checklist de decolagem: um item reprovado cancela o voo.",
  "append": "Engata um item no FIM da lista: lista.append(item) altera a própria lista e não devolve nada — não guarde o resultado.",
  "pop": "Remove e DEVOLVE um item: tira o vagão e fica com ele na mão. Em listas, o último por padrão; em dicts, d.pop(chave) leva a gaveta inteira.",
  "get": "O jeito educado de ler um dict: d.get(chave, padrao) devolve o valor se a chave existe, ou o padrão se não existe — sem explodir em KeyError.",
  ".get": "O jeito educado de ler um dict: d.get(chave, padrao) devolve o valor se a chave existe, ou o padrão se não existe — sem explodir em KeyError.",
  "items": "Abre o armário mostrando etiqueta e conteúdo juntos: for chave, valor in d.items() percorre o dict aos pares.",
  "keys": "Lista só as etiquetas do dict (as chaves): útil para saber o que existe no armário antes de abrir gavetas.",
  "values": "Lista só o conteúdo do dict (os valores): útil para somar ou conferir tudo que está guardado, como sum(d.values()).",

  // ---------------------------------------------------------------
  // Métodos de texto
  // ---------------------------------------------------------------
  "split": "Corta o texto numa lista de pedaços: sem argumento, separa por espaços e a frase vira um trem de palavras; com argumento, corta onde você mandar.",
  ".split()": "Corta o texto numa lista de pedaços: sem argumento, separa por espaços e a frase vira um trem de palavras; com argumento, corta onde você mandar.",
  "join": "Cola uma lista de textos num só, usando como cola o texto que vem ANTES do ponto: separador.join(lista). O caminho de volta do split.",
  ".join": "Cola uma lista de textos num só, usando como cola o texto que vem ANTES do ponto: separador.join(lista). O caminho de volta do split.",
  "strip": "Apara espaços e quebras de linha das pontas, sem tocar no miolo — tira a casca e deixa o recheio. Essencial antes de comparar o que o usuário digitou.",
  ".strip()": "Apara espaços e quebras de linha das pontas, sem tocar no miolo — tira a casca e deixa o recheio. Essencial antes de comparar o que o usuário digitou.",
  "replace": "Troca todas as ocorrências de um trecho por outro e devolve um texto NOVO: o original fica intacto, porque strings são imutáveis.",
  ".lower()": "Devolve o texto todo em minúsculas, nivelando o campo para comparar sem pegadinha: Gato e gato ficam iguais.",
  "lower()": "Devolve o texto todo em minúsculas, nivelando o campo para comparar sem pegadinha: Gato e gato ficam iguais.",
  "casefold": "O lower turbinado para comparações: normaliza até caracteres especiais de outros idiomas. O padrão certo para igualar texto digitado por humanos.",
  "casefold()": "O lower turbinado para comparações: normaliza até caracteres especiais de outros idiomas. O padrão certo para igualar texto digitado por humanos.",
  ".casefold()": "O lower turbinado para comparações: normaliza até caracteres especiais de outros idiomas. O padrão certo para igualar texto digitado por humanos.",
  "f-string": "Texto com lacunas preenchidas na hora: f'Olá, {nome}' injeta o valor da variável direto na frase. Adeus, concatenação com +.",

  // ---------------------------------------------------------------
  // Erros e exceções
  // ---------------------------------------------------------------
  "try": "Abre um trecho vigiado: se algo explodir aqui dentro, o Python não derruba o programa — ele pula direto para o except tratar o problema.",
  "try:": "Abre um trecho vigiado: se algo explodir aqui dentro, o Python não derruba o programa — ele pula direto para o except tratar o problema.",
  "except": "A rede de proteção do try: captura o erro anunciado e decide o destino — registrar, tentar de novo, devolver um padrão. Capture erros específicos, não tudo.",
  "finally": "Roda SEMPRE, com ou sem erro: a equipe de limpeza que fecha arquivos e desliga as luzes mesmo quando a festa termina em incêndio.",
  "raise": "Aciona o alarme de propósito: lança um erro quando você detecta algo inválido, interrompendo o fluxo até um except assumir o caso.",
  "Exception": "A mãe de quase todos os erros. Herdar dela cria erros seus (class MeuErro(Exception)); capturá-la pega quase tudo — cômodo, mas esconde surpresas.",
  "ValueError": "O tipo até serve, mas o conteúdo não faz sentido: float('abc') explode assim. O aviso clássico de entrada malformada.",
  "KeyError": "Você pediu uma gaveta que o armário não tem: chave inexistente no dict. Antídotos: d.get(chave, padrao) ou checar antes com in.",
  "TypeError": "A operação não combina com o ingrediente: somar texto com número, por exemplo. O Python recusa a receita antes de estragar o prato.",
  "RuntimeError": "Erro genérico de execução: algo deu errado rodando e nenhuma categoria específica descreve melhor. Bom para sinalizar estados que não deveriam acontecer.",
  "FileNotFoundError": "O arquivo pedido não está no caminho indicado: nome errado, pasta errada ou arquivo ainda não criado. Trate com except e dê uma mensagem amigável.",
  "JSONDecodeError": "O texto não é JSON válido: vírgula sobrando, aspas erradas, bloco cortado no meio. O erro que separa texto qualquer de JSON de verdade.",
  "json.JSONDecodeError": "O texto não é JSON válido: vírgula sobrando, aspas erradas, bloco cortado no meio. O erro que separa texto qualquer de JSON de verdade.",
  "RateLimitError": "O provedor pediu calma: chamadas demais em pouco tempo (HTTP 429). O tratamento certo é esperar e tentar de novo — de preferência com backoff.",

  // ---------------------------------------------------------------
  // Arquivos
  // ---------------------------------------------------------------
  "with": "Abre um recurso com fechamento garantido: saiu do bloco, o Python fecha o arquivo sozinho, mesmo com erro no meio. Uma porta com mola: nunca fica aberta.",
  "open": "Abre um arquivo para ler ou escrever. Use com with (fecha sozinho) e encoding='utf-8' (lê acentos direito): with open(caminho) as f.",

  // ---------------------------------------------------------------
  // JSON
  // ---------------------------------------------------------------
  "json": "Módulo que traduz entre texto JSON e objetos Python: loads/dumps para strings, load/dump para arquivos. O tradutor juramentado entre APIs e seu código.",
  "JSON": "Formato de texto para trocar dados estruturados: objetos, listas, números e textos que qualquer linguagem entende. O idioma universal das APIs.",
  "json.loads": "Converte uma STRING JSON em objetos Python (dict, list...) — o s é de string. Texto malformado? Lança JSONDecodeError.",
  "loads": "Converte uma STRING JSON em objetos Python (dict, list...) — o s é de string. Texto malformado? Lança JSONDecodeError.",
  "json.load": "Lê JSON direto de um ARQUIVO aberto e devolve objetos Python. Sem o s no final: esta versão é para arquivos, loads é para strings.",
  "json.dumps": "O caminho de volta: converte objetos Python numa STRING JSON. Com ensure_ascii=False, os acentos saem legíveis em vez de virarem códigos.",
  "json.dump": "Escreve objetos Python como JSON direto num ARQUIVO aberto. Com indent=2, sai formatado bonito para olhos humanos.",
  "ensure_ascii=False": "Opção do json.dumps que mantém acentos e caracteres especiais legíveis no resultado, em vez de trocá-los por códigos numéricos.",

  // ---------------------------------------------------------------
  // Texto avançado: regex
  // ---------------------------------------------------------------
  "re": "Módulo de expressões regulares: padrões de busca que encontram, validam e extraem trechos de texto — um imã de formatos que atrai só o que combina.",
  "regex": "Módulo de expressões regulares: padrões de busca que encontram, validam e extraem trechos de texto — um imã de formatos que atrai só o que combina.",
  "re.search": "Procura o padrão em qualquer ponto do texto e devolve um Match com a PRIMEIRA ocorrência — ou None se nada casar. Sempre confira o None antes de usar.",
  "re.findall": "Varre o texto inteiro e devolve uma lista com TODAS as ocorrências do padrão: o rastelo que recolhe tudo que combina.",
  "re.DOTALL": "Flag do módulo re que faz o ponto do padrão casar TAMBÉM com quebras de linha, deixando o .* atravessar um bloco de várias linhas. Sem ela, o ponto para na primeira quebra e um JSON multilinha nunca casa.",
  "DOTALL": "Flag do módulo re que faz o ponto do padrão casar TAMBÉM com quebras de linha, deixando o .* atravessar um bloco de várias linhas. Sem ela, o ponto para na primeira quebra e um JSON multilinha nunca casa.",
  "Match": "O comprovante de que o padrão casou: guarda o que e onde encontrou. Use .group() para o achado inteiro e .group(1) para o primeiro grupo entre parênteses.",
  ".group(1)": "Extrai só o que casou com o PRIMEIRO grupo entre parênteses do padrão: você recorta a fatia que interessa, não o achado inteiro.",

  // ---------------------------------------------------------------
  // Assíncrono
  // ---------------------------------------------------------------
  "async": "Marca a função como assíncrona: ela pode pausar nos pontos de espera (await) e liberar o programa para adiantar outras tarefas enquanto aguarda.",
  "await": "Ponto de espera de uma função async: pausa AQUI até a resposta chegar, sem congelar o resto — o garçom deixa o pedido na cozinha e atende outras mesas.",
  "asyncio": "Biblioteca padrão de concorrência: agenda e executa funções async, deixando dezenas de esperas de rede andarem em paralelo numa thread só.",
  "asyncio.gather": "Dispara várias tarefas async DE UMA VEZ e espera todas: o tempo total vira o da mais lenta, não a soma. O acelerador clássico de chamadas de API.",
  "gather": "Dispara várias tarefas async DE UMA VEZ e espera todas: o tempo total vira o da mais lenta, não a soma. O acelerador clássico de chamadas de API.",

  // ---------------------------------------------------------------
  // Dados: numpy e pandas
  // ---------------------------------------------------------------
  "numpy": "Biblioteca de vetores e matrizes: opera milhares de números de uma vez, com C por baixo do capô. A base matemática dos embeddings e da ciência de dados.",
  "array": "Vetor do NumPy: um bloco compacto de números do mesmo tipo que aceita operações em massa. A lista musculosa da matemática.",
  "np.array": "Transforma uma lista em vetor NumPy: um bloco compacto de números que aceita operações em massa — somar, multiplicar, comparar tudo de uma vez, sem for.",
  "np.dot": "Produto escalar: multiplica dois vetores posição a posição e soma tudo. O medidor de alinhamento entre vetores — o coração da similaridade de embeddings.",
  "np.argsort": "Devolve os ÍNDICES que ordenariam o vetor em ordem CRESCENTE (do menor valor ao maior), não os valores. Para achar os campeões (scores maiores), ordene os valores negados: np.argsort(-scores) e pegue os primeiros.",
  "argsort": "Devolve os ÍNDICES que ordenariam o vetor em ordem CRESCENTE (do menor valor ao maior), não os valores. Para achar os campeões (scores maiores), ordene os valores negados: np.argsort(-scores) e pegue os primeiros.",
  "np.linalg.norm": "Mede o comprimento (norma) de um vetor: a régua dos vetores. Dividir o vetor pela própria norma o normaliza para comprimento 1.",
  "shape": "A etiqueta de dimensões do array: (3, 5) significa 3 linhas e 5 colunas. Conferir o shape é o primeiro socorro de qualquer bug com matrizes.",
  "pandas": "Biblioteca de tabelas: carrega, filtra, agrupa e cruza dados como uma planilha programável. O canivete suíço dos relatórios de custo e uso.",
  "pd.DataFrame": "Constrói a tabela do pandas: pd.DataFrame(registros) transforma uma lista de dicts numa planilha com linhas e colunas nomeadas, pronta para análise.",
  "DataFrame": "A tabela do pandas: linhas e colunas nomeadas, como uma planilha programável. Cada coluna aceita operações em massa (média, soma, filtro).",
  "merge": "Cruza duas tabelas por uma coluna em comum, como juntar cadastro e compras pelo id do cliente. O how= decide o destino de quem só existe num lado.",
  "groupby": "Agrupa linhas pelo valor de uma coluna e resume cada grupo (soma, média...): a tabela dinâmica do pandas em uma linha de código.",
  "fillna": "Tapa os buracos (NaN) da tabela com um valor padrão: fillna(0.0) troca ausência por zero antes de somar, evitando contas contaminadas.",
  "isna": "O detector de buracos: marca True onde falta valor (NaN). Com .sum(), conta quantos dados faltam antes de você confiar numa média.",
  "NaN": "Not a Number: o buraco oficial das tabelas, marcando valor ausente. Contamina contas (soma com NaN dá NaN) e nem é igual a si mesmo.",
  "nan": "Not a Number: o buraco oficial das tabelas, marcando valor ausente. Contamina contas (soma com NaN dá NaN) e nem é igual a si mesmo.",
  "cosseno": "Similaridade do cosseno: mede o ângulo entre dois vetores, ignorando tamanho. Perto de 1, apontam na mesma direção — textos falando da mesma coisa.",

  // ---------------------------------------------------------------
  // HTTP e APIs
  // ---------------------------------------------------------------
  "API": "Balcão de atendimento de um sistema: você faz um pedido num formato combinado e recebe a resposta, sem precisar conhecer a cozinha por dentro.",
  "HTTP": "O protocolo de pedido e resposta da web: o cliente pede (GET, POST...), o servidor responde com um status e um corpo. Toda API REST fala esse idioma.",
  "endpoint": "O endereço de um serviço específico dentro da API, como /produtos ou /modelos: cada balcão atende um tipo de pedido.",
  "requests": "Biblioteca Python para falar HTTP: requests.get busca, requests.post envia. Chamadas de API em uma linha legível.",
  "requests.get": "Pedido HTTP GET: busca dados de uma URL, como consultar uma vitrine. Devolve um Response com status_code e .json() para ler o corpo.",
  "requests.post": "Pedido HTTP POST: ENVIA dados ao servidor (json=dados), como entregar um formulário preenchido no balcão.",
  "Response": "O pacote de resposta do requests: carrega status_code, headers e o corpo (via .text ou .json()). Tudo que o servidor mandou, embrulhado num objeto.",
  "resp.json()": "Converte o corpo da resposta de texto JSON para objetos Python numa chamada. Se o servidor mandou outra coisa, explode — confira o status antes.",
  ".json()": "Converte o corpo da resposta de texto JSON para objetos Python numa chamada. Se o servidor mandou outra coisa, explode — confira o status antes.",
  "status_code": "O código numérico da resposta HTTP: 200 deu certo, 404 não existe, 429 calma, 500 quebrou lá. O semáforo que você DEVE olhar antes de usar o corpo.",
  // ("200" de propósito NÃO tem entrada: no ato 1 aparece como soma numérica
  // — o balão de HTTP seria um falso positivo. 404/429/500 são sempre HTTP.)
  "404": "Status HTTP de não encontrado: o servidor existe, mas o recurso pedido não. Confira o id ou o caminho da URL.",
  "429": "Status HTTP de excesso de pedidos (rate limit): o servidor pede pausa. Respeite o Retry-After e tente depois — insistir na hora só piora.",
  "500": "Status HTTP de erro interno do servidor: a culpa não é sua. Costuma ser passageiro — vale tentar de novo com backoff.",
  "Retry-After": "Cabeçalho que acompanha o 429 dizendo QUANTOS SEGUNDOS esperar antes de tentar de novo. O timer oficial do servidor: use-o em vez de chutar a pausa.",
  "timeout": "Tempo máximo de espera pela resposta: estourou, desiste e lança erro. Sem timeout, o programa pode ficar pendurado para sempre num servidor mudo.",
  "retry": "Tentar de novo após falha temporária (429, 500, rede): a segunda chance educada. Sempre com limite de tentativas, para não virar teimosia infinita.",
  "backoff": "Pausa crescente entre tentativas: 1s, 2s, 4s, 8s (base * 2 ** tentativa). Dá fôlego ao servidor em vez de bombardeá-lo de novo no segundo seguinte.",
  "params": "Dicionário de parâmetros de consulta que o requests cola na URL (?pagina=2&limite=10): os filtros do pedido, sem montar string na mão.",
  "raise_for_status()": "Converte status de erro (4xx/5xx) em exceção Python na hora: em vez de seguir com resposta quebrada, o programa avisa cedo e alto.",
  "cursor": "O marca-páginas da paginação: cada resposta traz o cursor da próxima página, e você o reenvia para continuar exatamente de onde parou.",

  // ---------------------------------------------------------------
  // IA: modelos, prompts e RAG
  // ---------------------------------------------------------------
  "token": "A unidade que o modelo lê e cobra: pedaços de palavra (uns 4 caracteres em média). Contar tokens é contar custo e limite de contexto.",
  "prompt": "A instrução entregue ao modelo: contexto, pergunta e formato desejado. Pedido claro, resposta obediente; pedido vago, resposta criativa demais.",
  "LLM": "Large Language Model: modelo treinado em montanhas de texto para prever a próxima palavra — e, com isso, conversar, resumir, extrair e gerar código.",
  "embedding": "A tradução de um texto para um vetor de números que captura o significado: frases parecidas viram vetores vizinhos. O GPS semântico da busca.",
  "embed": "A função que gera o embedding: entra texto, sai o vetor numérico do significado, pronto para comparar com outros vetores.",
  "chunk": "Fatia de documento em tamanho controlado: textos longos são picados em chunks para caber no contexto e afinar a busca. O overlap evita cortar ideias ao meio.",
  "RAG": "Retrieval-Augmented Generation: antes de responder, o sistema BUSCA trechos dos seus documentos e os entrega ao modelo como contexto. A cola autorizada da prova.",
  "temperatura": "O botão de ousadia do modelo: perto de 0, respostas previsíveis e repetíveis; alto, respostas criativas e arriscadas. Para extrair dados, use baixa.",
  "temperature": "O botão de ousadia do modelo: perto de 0, respostas previsíveis e repetíveis; alto, respostas criativas e arriscadas. Para extrair dados, use baixa.",
  "max_tokens": "Teto de tokens da RESPOSTA: o modelo para ao bater nele, mesmo no meio da frase (finish_reason vira length). Controla custo e evita respostas sem fim.",
  "messages": "A lista de mensagens da conversa enviada ao modelo, cada uma com role e content. O modelo não tem memória: você reenvia o histórico inteiro toda vez.",
  "role": "Quem fala em cada mensagem: system (regras da casa), user (quem pede) ou assistant (o modelo). É como o modelo sabe a quem obedecer.",
  "content": "O texto da mensagem em si — o que foi dito. O par inseparável do role no formato de conversa das APIs de LLM.",
  "system": "A mensagem de bastidor com as regras do modelo: tom, papel, limites. O usuário não a vê, mas ela manda mais que o pedido dele.",
  "user": "O papel de quem pergunta: a mensagem do humano. É o pedido que o modelo tenta atender, dentro das regras do system.",
  "assistant": "O papel do modelo: as respostas que ele já deu. Reenviá-las no histórico é o que dá memória à conversa.",
  "tool_calls": "Em vez de texto, o modelo pede que VOCÊ rode uma função com certos argumentos. Seu código executa e devolve o resultado para ele continuar.",
  "finish_reason": "Por que o modelo parou: stop (concluiu), length (bateu no max_tokens — resposta truncada!) ou tool_calls (quer chamar função). Sempre confira.",
  "stopwords": "Palavras tão comuns que não carregam significado (de, a, o, que): ruído de fundo. Filtrá-las destaca as palavras que realmente descrevem o texto.",

  // ---------------------------------------------------------------
  // Laboratório web: HTML, CSS e JavaScript
  // ---------------------------------------------------------------
  "HTML": "A linguagem de estrutura da página: define O QUE existe (títulos, listas, botões) com tags aninhadas. O esqueleto que o CSS veste e o JS movimenta.",
  "html": "A linguagem de estrutura da página: define O QUE existe (títulos, listas, botões) com tags aninhadas. O esqueleto que o CSS veste e o JS movimenta.",
  "CSS": "A linguagem de aparência: seletores escolhem elementos, regras definem cor, tamanho e posição. A roupa do esqueleto HTML.",
  "css": "A linguagem de aparência: seletores escolhem elementos, regras definem cor, tamanho e posição. A roupa do esqueleto HTML.",
  "JavaScript": "A linguagem de comportamento da página: reage a cliques, altera o HTML em tempo real e conversa com APIs. O sistema nervoso da página.",
  "js": "A linguagem de comportamento da página: reage a cliques, altera o HTML em tempo real e conversa com APIs. O sistema nervoso da página.",
  "DOM": "A página viva na memória do navegador: uma árvore de elementos que o JS lê e altera. Mexeu no DOM, a tela muda na hora.",
  "tag": "O bloco de construção do HTML: um rótulo entre sinais de menor e maior que marca um pedaço de conteúdo, como <p> para parágrafo e <li> para item de lista.",
  "id": "Identificador único: na página, cada elemento tem no máximo um id (buscado com # no CSS e getElementById no JS); numa API, é o número que localiza o recurso.",
  "function": "Declara uma função em JavaScript: bloco nomeado e reutilizável de passos, como o def do Python. Recebe parâmetros, devolve com return.",
  "addEventListener": "Instala uma campainha no elemento: quando o evento tocar (click, input, submit), sua função é chamada. A ponte entre a ação do usuário e o seu código.",
  "querySelector": "Busca o PRIMEIRO elemento que casa com um seletor CSS: aceita #id, .classe ou tag. O localizador universal do DOM.",
  "textContent": "O texto puro dentro do elemento: ler mostra o que está escrito; atribuir troca o conteúdo sem interpretar HTML — à prova de injeção.",
  "createElement": "Fabrica um elemento novo em memória: document.createElement(tag) cria a peça, você a preenche e a encaixa na página com appendChild.",
  "dataset": "Acessa os atributos data- do elemento: data-alvo vira elemento.dataset.alvo. Um bolso para guardar dados seus direto no HTML.",
  "forEach": "Percorre um array executando uma função para cada item: o for automático do JavaScript, sem contador na mão.",
  "classList": "O painel de interruptores de classes CSS do elemento: add coloca, remove tira, toggle alterna, contains verifica.",
  "toggle": "Alterna uma classe: se o elemento tem, tira; se não tem, coloca. Um interruptor de luz — perfeito para abrir menu, fechar modal e trocar tema.",
  "innerHTML": "Lê ou substitui o HTML interno do elemento como texto: rápido para montar listas, mas NUNCA injete texto vindo do usuário — é a porta do XSS.",
  "value": "O conteúdo atual de um campo de formulário: o que está digitado agora. campo.value lê; campo.value = '' limpa.",
  ".value": "O conteúdo atual de um campo de formulário: o que está digitado agora. campo.value lê; campo.value = '' limpa.",
  ".checked": "Diz se a caixinha está marcada: true ou false. A pergunta direta ao checkbox: o usuário aceitou ou não?",
  "hidden": "Escondido: com visibility:hidden o elemento fica invisível mas o espaço continua reservado; com display:none ou o atributo hidden, some tudo.",
  "visibility": "Propriedade CSS de visibilidade: hidden esconde o elemento MANTENDO o espaço dele (um fantasma na cadeira); visible o mostra de novo.",
  "display:none": "Remove o elemento do layout: some da tela E o espaço é liberado, como tirar o móvel da sala. Compare com visibility:hidden, que deixa a cadeira vazia no lugar.",
  "style": "A porta do JS para o CSS do elemento: elemento.style.width = pct + '%' muda a aparência na hora, gravando direto no atributo style.",
  "margin": "Espaço EXTERNO do elemento: o respiro entre ele e os vizinhos, como o quintal ao redor da casa. Fica fora da borda.",
  "padding": "Espaço INTERNO do elemento: o estofado entre a borda e o conteúdo, como a almofada dentro da caixa. Fica dentro da borda.",
  "border": "A moldura do elemento: a linha entre o padding (dentro) e a margin (fora). Espessura, estilo e cor: border: 1px solid #ccc.",
  "submit": "O evento de envio do formulário: dispara no clique do botão ou no Enter. Com e.preventDefault(), você valida antes de a página recarregar.",
  "click": "O evento de clique: dispara quando o usuário clica no elemento. O gatilho mais comum do addEventListener em botões.",
  "change": "Dispara quando o valor muda E a ação termina (marcou o checkbox, saiu do campo). Para reagir a cada tecla, o evento é input.",
  "e.preventDefault()": "Cancela o comportamento padrão do evento: o formulário não recarrega a página, o link não navega. Você assume o volante dali em diante.",
  "e.target": "O elemento exato onde o evento aconteceu: com um ouvinte só no pai, e.target revela qual filho foi clicado — a base da delegação de eventos.",
  "disabled": "Desativa o controle: o botão fica acinzentado e surdo a cliques. Útil até o formulário ficar válido: enviar.disabled = !ok.",
  "<li>": "Tag de item de lista (list item): cada <li> é uma linha dentro de <ul> (lista de bolinhas) ou <ol> (lista numerada).",
  "<thead>": "Tag do cabeçalho da tabela: agrupa a linha de títulos das colunas, separada do corpo (<tbody>). Organiza a tabela e permite estilizar o topo à parte.",
  "true": "O verdadeiro do JavaScript, em minúsculas — diferente do True do Python. É o que .checked devolve quando a caixinha está marcada.",
  "false": "O falso do JavaScript, em minúsculas — diferente do False do Python. Validação reprovada e caixinha desmarcada geram ele.",
};
