// Pessoa 2 — Resiliência + HTTP Client
//
// @Injectable()
// export class PaymentClient {
//   private readonly baseUrl = process.env.PAYMENT_SERVICE_URL!;
//
//   async pay(orderId: string, amount: number): Promise<{ status: 'approved' | 'declined' | 'pending' }> {
//     // Usar p-retry para 3 tentativas com backoff 1s → 2s → 4s
//     // Usar axios com timeout: 2_000
//     // Em caso de erro persistente: retornar { status: 'pending' } (fallback)
//   }
// }
//
// Requisitos (seção 10 contexto-geral):
//   - Retry: 3 tentativas
//   - Backoff: 1s → 2s → 4s
//   - Timeout: 2s
//   - Fallback: PENDING
//   - (opcional) opossum para circuit breaker
 
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import pRetry from 'p-retry';

@Injectable()
export class HttpPaymentClient { //onde pegamos a irl do serviço de pagamento
  private readonly baseUrl = process.env.PAYMENT_SERVICE_URL!;
  // O 'process.env' faz a busca da informação de um certo arquivo de configuração escondido
  // recebe o ID do pedido e do valor
  // A 'Promise' indica que essa função vai rodar em segundo plano 
  // e no futuro vai devolver um status: 'approved', 'declined' ou 'pending'.
  async pay(orderId: string, amount: number): Promise<{ status: 'approved' | 'declined' | 'pending' }> {
    
    // criamos uma função interna para tentar fazer o post enviar dados para o serviço 
    const makeRequest = async () => {
      const response = await axios.post(this.baseUrl, { orderId, amount }, {
        timeout: 2000, // aqui esta a principal regra:se o servidor demorar +2 segundos, aborte (timeout)
      });
      return response.data; //caso ocorra tudo como planejado, devolve a resposta do servidor
    };

    //esse bloco 'try' vai tentar executar nosso código. 
    // Se algo der errado, a internet caia, ou o servidor fora do ar, ele pula direto pro 'catch'.
    try {
      // O pRetry pega aquela função que preparamos ali em cima (makeRequest) e executa 
      return await pRetry(makeRequest, {
        retries: 3,              // Se falhar a primeira vez, tente mais 3 vezes.
        factor: 2,              // Dobre o tempo de espera a cada nova tentativa.
        minTimeout: 1000,      // O primeiro tempo de espera é de 1000 milissegundos (1 segundo).

        // Essa função roda toda vez que uma tentativa falha, 
        //para imprimir um aviso no terminal pra gente ver o que está acontecendo.
        onFailedAttempt: error => {
          console.log(`Erro no pagamento. Restam ${error.retriesLeft} tentativas.`);
        },
      });
    } catch (erro) {
        // Se passamos pelas 3 tentativas extras e ainda assim deu erro, o código cai aqui.
        // Aqui esta o plano b (fallback)
        // Em vez de quebrar o sistema inteiro e dar tela de erro para o usuário, 
        // nós engolimos o erro e devolvemos o status 'pending' (pendente).
      console.log('Todas as tentativas falharam. Retornando status pending.');
      return { status: 'pending' };
    }
  }
}