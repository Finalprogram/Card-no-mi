# Card-no-mi: O que é e Como Funciona?

Olá! Este documento foi criado para explicar, de forma simples, o que é o projeto Card-no-mi. Vamos usar exemplos do dia a dia para que você entenda para que ele serve e como suas partes se encaixam.

## 1. O que é este projeto?

Imagine um grande shopping center, mas em vez de lojas de roupas e sapatos, todas as lojas vendem um único tipo de produto: cards de jogos, como os do famoso anime One Piece. O Card-no-mi é exatamente isso: um **marketplace online** que conecta pessoas que querem vender cards com pessoas que querem comprá-los. É um ponto de encontro digital para fãs e colecionadores.

Este projeto foi feito para resolver um problema comum: encontrar aquele card raro ou vender suas cartas repetidas sem ter que procurar em dezenas de sites e grupos diferentes. Ele junta tudo e todos em um só lugar, de forma organizada e segura.

## 2. O que dá para fazer com ele?

Com o Card-no-mi, você pode:

*   Criar sua conta de usuário.
*   Anunciar cards que você quer vender.
*   Procurar por cards específicos.
*   Comprar cartas de vários vendedores diferentes em um único pedido.
*   Pagar de forma segura pela internet.
*   Acompanhar o envio de suas compras.
*   Conversar com outros colecionadores em um fórum de discussão.

#### Exemplo 1: A Jornada do Comprador

> **Carlos** está montando um baralho e precisa de um card específico, o "Roronoa Zoro". Em vez de procurar em vários sites, ele entra no Card-no-mi. Ele digita "Roronoa Zoro" na busca e encontra o card à venda por três vendedores diferentes. Carlos compara o preço e o estado de conservação de cada um, escolhe o melhor para ele, e finaliza a compra com um único pagamento, mesmo que o card seja de uma loja em outra cidade.

#### Exemplo 2: A Jornada da Vendedora

> **Ana** abriu vários pacotes de cards e tem muitas cartas repetidas. Ela tira fotos das cartas, cria sua lojinha no Card-no-mi e cadastra seus anúncios. No dia seguinte, ela recebe um e-mail: "Você fez uma venda!". O sistema já avisa que o pagamento foi aprovado e até gera a etiqueta de envio para ela. Ana só precisa embalar o card e levá-lo aos Correios.

## 3. Como ele funciona (visão geral)?

Pense no Card-no-mi como um **aplicativo de delivery de comida que trabalha com vários restaurantes**.

*   **Entrada (O Pedido):** Você abre o "cardápio" (o site), que mostra pratos de vários restaurantes (cards de vários vendedores). Você escolhe o que quer, talvez um prato do restaurante A e uma sobremesa do restaurante B, e adiciona tudo ao seu "carrinho". Você faz um único pagamento ao "atendente" do aplicativo.

*   **Processamento (A Cozinha e o Gerente):** Assim que você paga, o "gerente" do sistema (o "cérebro" do projeto) entra em ação. Ele não cozinha nada, mas organiza tudo:
    1.  Envia o pedido do prato para a cozinha do restaurante A (notifica o vendedor A).
    2.  Envia o pedido da sobremesa para a cozinha do restaurante B (notifica o vendedor B).
    3.  Ao mesmo tempo, ele já combina com o "entregador" (o serviço de frete) como a coleta será feita.

*   **Resultado (A Entrega):** Cada restaurante prepara sua parte do pedido. O "gerente" acompanha tudo e, assim que os pacotes são enviados, ele te manda o código de rastreio. Você pode ver exatamente onde seus cards estão até que cheguem à sua casa.

## 4. Principais partes do sistema

Todo o sistema pode ser dividido em quatro partes principais:

1.  **A Interface (A Vitrine da Loja):** É a parte que você vê e com a qual interage: o site. Inclui as fotos dos cards, os botões, os menus e o seu perfil. É como a fachada e os corredores de uma loja física.

2.  **O "Cérebro" (O Gerente):** É a parte que trabalha nos bastidores. Ele contém todas as regras de negócio, como "quando um pagamento é aprovado, avise o vendedor" ou "calcule o total do pedido". Você não o vê, mas é ele que toma todas as decisões e faz o sistema funcionar.

3.  **Os Dados (O Arquivo Central):** É a memória do sistema. Imagine um arquivo gigante e super organizado onde tudo é guardado: quem são os usuários, quais cards estão à venda, o histórico de todos os pedidos. Sem ele, o sistema esqueceria de tudo assim que você fechasse a página.

4.  **As Integrações (Os Ajudantes Especializados):** O sistema não faz tudo sozinho. Para tarefas específicas, ele "contrata" ajudantes externos:
    *   **Mercado Pago:** É o "caixa" que processa seu pagamento de forma segura.
    *   **Melhor Envio:** É o "especialista em logística" que calcula o preço do frete e gera as etiquetas de envio.
    *   **API de Cards:** É a "biblioteca" que fornece o catálogo oficial de todos os cards que podem ser vendidos.

## 5. O que precisa para rodar?

Esta seção é para quem tem curiosidade sobre como "ligar" o projeto em um computador.

*   **O que precisa instalar?** Para o projeto funcionar, o computador precisa de algumas ferramentas básicas, como se fossem os "ingredientes" de uma receita:
    *   **Node.js:** O "motor" que faz o "cérebro" do sistema funcionar.
    *   **PostgreSQL e MongoDB:** Os programas que gerenciam o "arquivo central" de dados.
    *   **Redis:** Uma espécie de "bloco de notas" super rápido que o sistema usa para organizar as tarefas.

*   **O que é "configuração"?** A configuração é como uma agenda de contatos privada para o sistema. Em vez de escrever senhas e chaves secretas diretamente no código (o que seria muito inseguro), nós as guardamos em um arquivo separado (`.env`). Quando o sistema precisa falar com o "caixa" (Mercado Pago), ele procura a "senha" do caixa nessa agenda privada. Isso faz com que a agenda seja privada, e só quem tem acesso a ela pode "ligar" o sistema corretamente.

*   **Passo a passo simples:**
    1.  Junte todos os "ingredientes" (instale os programas necessários).
    2.  Preencha a "agenda de contatos" (o arquivo de configuração `.env`).
    3.  Aperte o botão de "Ligar" (rode um comando no terminal para iniciar o projeto).

## 6. Limitações e Cuidados

*   **O que pode dar errado?** O mais comum são erros de configuração. Se a "agenda de contatos" (arquivo `.env`) estiver faltando um "número de telefone" para um dos "ajudantes", o sistema não conseguirá se comunicar com ele. Por exemplo, se a senha para o "caixa" de pagamentos estiver errada, você não conseguirá finalizar uma compra.

*   **Boas práticas:** A segurança do sistema depende também do usuário. A regra número um da internet vale aqui: **não compartilhe sua senha com ninguém!** Crie senhas fortes e use um e-mail que só você acessa.

## 7. Glossário

*   **API:** Uma "ponte" que permite que programas de computador diferentes conversem entre si, trocando informações.
*   **Backend (ou "Cérebro"):** A parte do sistema que funciona "por trás dos panos", fazendo todo o processamento que o usuário não vê diretamente.
*   **Banco de Dados (ou "Dados"):** O local onde todas as informações importantes são armazenadas de forma organizada e permanente.
*   **Frontend (ou "Interface"):** A parte visível de um site ou aplicativo, com a qual o usuário interage diretamente.
*   **Marketplace:** Uma plataforma online que permite que vários vendedores vendam produtos para vários compradores, como um shopping virtual.
*   **Webhook:** Uma "notificação automática" que um sistema envia para outro quando algo específico acontece (ex: um pagamento é aprovado, ou um pedido é enviado).